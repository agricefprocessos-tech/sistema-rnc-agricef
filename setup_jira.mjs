/**
 * setup_jira.mjs — Manifesto Jira para o Sistema RNC Agricef
 * Requer: Node.js >= 18  (usa fetch nativo, sem dependências externas)
 *
 * Uso:
 *   node setup_jira.mjs
 *   (lê .env na mesma pasta ou variáveis de ambiente do sistema)
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));

// ── Carrega .env manualmente (sem dependências) ───────────────────────────────
const envPath = path.join(__dir, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(linha => {
    const [chave, ...resto] = linha.trim().split("=");
    if (chave && !chave.startsWith("#") && resto.length) {
      process.env[chave.trim()] = resto.join("=").trim();
    }
  });
}

const BASE  = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.JIRA_EMAIL || "";
const TOKEN = process.env.JIRA_TOKEN || "";

if (!BASE || !EMAIL || !TOKEN) {
  console.error("❌ Variáveis JIRA_BASE_URL, JIRA_EMAIL e JIRA_TOKEN são obrigatórias.");
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

// ── Cliente HTTP ──────────────────────────────────────────────────────────────
async function req(method, endpoint, body) {
  const url = `${BASE}${endpoint}`;
  const opts = {
    method,
    headers: {
      "Authorization": AUTH,
      "Accept":        "application/json",
      "Content-Type":  "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();
  let   json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }

  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json };
}

// ── Definições ────────────────────────────────────────────────────────────────
const PROJECT_KEY      = "RNC";
const PROJECT_NAME     = "Gestão de Não Conformidades";
const ISSUE_TYPE_NAME  = "Não Conformidade";

const CUSTOM_FIELDS = [
  { key: "ORIGEM",     nome: "Origem do Item",          tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",    opcoes: ["Recebimento","Produção Interna","Montagem"] },
  { key: "SETOR",      nome: "Setor Responsável",        tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",    opcoes: ["Usinagem","Caldeiraria","Engenharia","Suprimentos","Qualidade"] },
  { key: "QTD_LOTE",   nome: "Quantidade do Lote",       tipo: "com.atlassian.jira.plugin.system.customfieldtypes:float",     opcoes: [] },
  { key: "QTD_DESVIO", nome: "Quantidade com Desvio",    tipo: "com.atlassian.jira.plugin.system.customfieldtypes:float",     opcoes: [] },
  { key: "COD_ITEM",   nome: "Código da Peça",           tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textfield", opcoes: [] },
  { key: "LINK_PDF",   nome: "Link do Dossiê PDF",       tipo: "com.atlassian.jira.plugin.system.customfieldtypes:url",       opcoes: [] },
  { key: "CAUSA_RAIZ", nome: "Causa Raiz",               tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",    opcoes: ["Mão de Obra","Máquina","Material","Método","Projeto"] },
  { key: "DISPOSICAO", nome: "Disposição da Peça",       tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",    opcoes: ["Retrabalho","Sucata","Concessão","Devolução"] },
];

// ── Funções de setup ──────────────────────────────────────────────────────────

async function verificarConexao() {
  console.log("🔍 Verificando conexão...");
  const { json } = await req("GET", "/rest/api/3/myself");
  console.log(`   ✓ Autenticado: ${json.displayName} (${json.emailAddress})`);
  return json;
}

async function obterOuCriarProjeto(accountId) {
  console.log(`\n📁 Verificando projeto '${PROJECT_KEY}'...`);
  const { status, json } = await req("GET", `/rest/api/3/project/${PROJECT_KEY}`);
  if (status === 200) {
    console.log(`   ✓ Projeto já existe: ${json.name} (ID: ${json.id})`);
    return json;
  }
  console.log(`   → Criando projeto '${PROJECT_KEY}'...`);
  const { json: novo } = await req("POST", "/rest/api/3/project", {
    key:              PROJECT_KEY,
    name:             PROJECT_NAME,
    projectTypeKey:   "software",
    projectTemplateKey: "com.pyxis.greenhopper.jira:gh-scrum-template",
    description:      "Gestão de Relatórios de Não Conformidade — Agricef",
    leadAccountId:    accountId,
    assigneeType:     "UNASSIGNED",
  });
  console.log(`   ✓ Projeto criado: ID ${novo.id}, chave ${novo.key}`);
  return novo;
}

async function obterOuCriarIssueType() {
  console.log(`\n🏷  Verificando Issue Type '${ISSUE_TYPE_NAME}'...`);
  const { json: lista } = await req("GET", "/rest/api/3/issuetype");
  const existente = (Array.isArray(lista) ? lista : []).find(t => t.name === ISSUE_TYPE_NAME);
  if (existente) {
    console.log(`   ✓ Já existe: ID ${existente.id}`);
    return existente.id;
  }
  console.log(`   → Criando Issue Type...`);
  const { json: novo } = await req("POST", "/rest/api/3/issuetype", {
    name:        ISSUE_TYPE_NAME,
    type:        "standard",
    description: "Relatório de Não Conformidade — Agricef",
  });
  console.log(`   ✓ Criado: ID ${novo.id}`);
  return novo.id;
}

async function obterOuCriarCampo(definicao) {
  const { json: todos } = await req("GET", "/rest/api/3/field");
  const existente = todos.find(f => f.name === definicao.nome && f.custom);
  if (existente) {
    console.log(`   ✓ '${definicao.nome}' já existe: ${existente.id}`);
    return existente.id;
  }

  const searcherMap = {
    "com.atlassian.jira.plugin.system.customfieldtypes:select":    "com.atlassian.jira.plugin.system.customfieldtypes:multiselectsearcher",
    "com.atlassian.jira.plugin.system.customfieldtypes:float":     "com.atlassian.jira.plugin.system.customfieldtypes:exactnumber",
    "com.atlassian.jira.plugin.system.customfieldtypes:textfield": "com.atlassian.jira.plugin.system.customfieldtypes:textsearcher",
    // URL fields in Jira Cloud do not support a custom searcher — omit the key
    "com.atlassian.jira.plugin.system.customfieldtypes:url":       null,
  };

  const searcher = searcherMap[definicao.tipo];
  const payload  = { name: definicao.nome, type: definicao.tipo };
  if (searcher) payload.searcherKey = searcher;

  const { json: novo } = await req("POST", "/rest/api/3/field", payload);
  console.log(`   + '${definicao.nome}' criado: ${novo.id}`);
  return novo.id;
}

async function adicionarOpcoesSelect(fieldId, opcoes, nomeCampo) {
  if (!opcoes.length) return;

  // Jira Cloud API v3: opções são gerenciadas via contexto do campo
  // 1. Obtém o contexto global (criado automaticamente ao criar o campo)
  let contextId;
  try {
    const { json } = await req("GET", `/rest/api/3/field/${fieldId}/context`);
    contextId = (json.values || [])[0]?.id;
  } catch (e) {
    console.log(`     ⚠ Contexto não encontrado para '${nomeCampo}': ${e.message.slice(0,60)}`);
    return;
  }
  if (!contextId) {
    console.log(`     ⚠ Sem contexto para '${nomeCampo}' — adicione as opções manualmente no Jira`);
    return;
  }

  // 2. Lista opções existentes no contexto
  let existentes = new Set();
  try {
    const { json } = await req("GET", `/rest/api/3/field/${fieldId}/context/${contextId}/option`);
    (json.values || []).forEach(o => existentes.add(o.value));
  } catch {}

  // 3. Adiciona opções novas em lote
  const novas = opcoes.filter(o => !existentes.has(o));
  if (!novas.length) { console.log(`     ✓ Opções já existem`); return; }

  try {
    const { json } = await req(
      "POST",
      `/rest/api/3/field/${fieldId}/context/${contextId}/option`,
      { options: novas.map(v => ({ value: v })) }
    );
    (json.options || []).forEach(o => console.log(`     + opção '${o.value}'`));
  } catch (e) {
    console.log(`     ⚠ Erro ao adicionar opções: ${e.message.slice(0, 100)}`);
  }
}

async function associarCamposTela(fieldIds) {
  console.log("\n🖥  Associando campos à tela do projeto...");
  try {
    const { json: telas } = await req("GET", "/rest/api/3/screens");
    const lista = telas.values || telas;
    // Busca tela do projeto RNC ou a tela Default
    const tela = lista.find(t =>
      t.name && (t.name.includes(PROJECT_KEY) || t.name.includes("Default") || t.name.includes("default"))
    ) || lista[0];

    if (!tela) { console.log("   ⚠ Nenhuma tela encontrada. Adicione os campos manualmente."); return; }

    const { json: tabs } = await req("GET", `/rest/api/3/screens/${tela.id}/tabs`);
    const tabId = (tabs[0] || {}).id;
    if (!tabId) { console.log("   ⚠ Nenhuma aba na tela."); return; }

    const { json: camposTela } = await req("GET", `/rest/api/3/screens/${tela.id}/tabs/${tabId}/fields`);
    const presentes = new Set((camposTela || []).map(f => f.id));

    let adicionados = 0;
    for (const fid of fieldIds) {
      if (presentes.has(fid)) continue;
      try {
        await req("POST", `/rest/api/3/screens/${tela.id}/tabs/${tabId}/fields`, { fieldId: fid });
        adicionados++;
      } catch (e) {
        console.log(`   ⚠ ${fid}: ${e.message.slice(0, 60)}`);
      }
    }
    console.log(adicionados
      ? `   ✓ ${adicionados} campo(s) associado(s) à tela '${tela.name}'`
      : `   ✓ Todos os campos já estavam na tela.`
    );
  } catch (e) {
    console.log(`   ⚠ Não foi possível associar automaticamente: ${e.message.slice(0, 120)}`);
    console.log("     → Adicione manualmente: Configurações do Projeto > Telas");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("=".repeat(58));
console.log("  SETUP JIRA — Sistema RNC Agricef");
console.log("=".repeat(58));

try {
  const eu      = await verificarConexao();
  const projeto = await obterOuCriarProjeto(eu.accountId);
  const itId    = await obterOuCriarIssueType();

  console.log(`\n🔧 Criando/verificando ${CUSTOM_FIELDS.length} Custom Fields...`);
  const mapeamento = {
    issue_type_id: itId,
    project_key:   PROJECT_KEY,
    project_id:    String(projeto.id || ""),
    campos:        {},
  };
  const fieldIds = [];

  for (const def of CUSTOM_FIELDS) {
    const fid = await obterOuCriarCampo(def);
    mapeamento.campos[def.key] = { id: fid, nome: def.nome, tipo: def.tipo };
    fieldIds.push(fid);
    await adicionarOpcoesSelect(fid, def.opcoes, def.nome);
    await new Promise(r => setTimeout(r, 200));
  }

  await associarCamposTela(fieldIds);

  // Grava JSON
  const saida = path.join(__dir, "jira_mapeamento_ids.json");
  fs.writeFileSync(saida, JSON.stringify(mapeamento, null, 2), "utf8");

  console.log(`\n✅ Arquivo gerado: jira_mapeamento_ids.json`);
  console.log("\n📋 Resumo:");
  console.log(`   Issue Type ID : ${itId}`);
  for (const [k, v] of Object.entries(mapeamento.campos)) {
    console.log(`   ${k.padEnd(14)}: ${v.id}  ← ${v.nome}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠  PASSO MANUAL necessário no Jira (não automatizável via API):
   Crie o workflow com 5 status:
     Aberto → Em Análise → Plano de Ação → Verificação QA → Concluído
   Veja README.md — Passos 8 e 9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

} catch (err) {
  console.error("\n❌ ERRO:", err.message);
  process.exit(1);
}
