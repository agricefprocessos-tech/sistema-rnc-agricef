// ============================================================
// AGRICEF — Setup.gs
// Execute as funções abaixo UMA VEZ no editor do Apps Script
// para configurar o ambiente completo sem precisar copiar IDs.
//
// ORDEM DE EXECUÇÃO:
//   1. configurarPropriedades()  — define as credenciais Jira
//   2. criarTemplateRNC()        — cria o Doc template no Drive
//   3. criarCamposV2()           — cria campos de tratativa/SLA
//   4. verificarSetup()          — valida toda a configuração
// ============================================================


/**
 * PASSO 2-C — Cria os novos campos Jira para tratativa, SLA e processo.
 *
 * Execute UMA VEZ após configurarPropriedades().
 * Os IDs são salvos automaticamente no PropertiesService e
 * lidos em Code.gs via PropertiesService.getScriptProperties().
 *
 * Campos criados:
 *   CF_CONTENCAO      — Ação de Contenção SGQ        (textarea)
 *   CF_ACAO_CORRET    — Ação Corretiva SGQ            (textarea)
 *   CF_MOTIVO_DEVOL   — Motivo Devolução SGQ          (textarea)
 *   CF_RESP_NOME      — Responsável Tratativa SGQ     (textfield)
 *   CF_RESP_EMAIL     — Email Responsável Tratativa   (textfield)
 *   CF_HORAS_RETRAB   — Horas de Retrabalho SGQ       (float)
 *   CF_CUSTO_SUCATA   — Custo Sucateado SGQ (R$)      (float)
 *   CF_PRIORIDADE_RNC — Prioridade RNC SGQ            (select: Padrão/Emergência)
 *   CF_PROCESSO       — Processo Inspecionado SGQ     (select: Dobra/Usinagem/...)
 *   CF_NUM_SERIE      — Número de Série SGQ           (textfield)
 */
function criarCamposV2() {
  const props   = PropertiesService.getScriptProperties();
  const base    = props.getProperty("JIRA_URL");
  const email   = props.getProperty("JIRA_EMAIL");
  const token   = props.getProperty("JIRA_TOKEN");
  if (!token || token === "COLE_AQUI_O_NOVO_TOKEN_JIRA") {
    throw new Error("⛔ Configure as credenciais Jira antes.");
  }
  const cred    = Utilities.base64Encode(email + ":" + token);
  const headers = { Authorization: "Basic " + cred, "Content-Type": "application/json" };

  // ── Definição dos campos ──────────────────────────────────────────────
  const CAMPOS = [
    { chave: "CF_CONTENCAO",     nome: "Ação de Contenção SGQ",         tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textarea" },
    { chave: "CF_ACAO_CORRET",   nome: "Ação Corretiva SGQ",            tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textarea" },
    { chave: "CF_MOTIVO_DEVOL",  nome: "Motivo Devolução SGQ",          tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textarea" },
    { chave: "CF_RESP_NOME",     nome: "Responsável Tratativa SGQ",     tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" },
    { chave: "CF_RESP_EMAIL",    nome: "Email Responsável Tratativa",   tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" },
    { chave: "CF_NUM_SERIE",     nome: "Número de Série SGQ",           tipo: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" },
    { chave: "CF_HORAS_RETRAB",  nome: "Horas de Retrabalho SGQ",       tipo: "com.atlassian.jira.plugin.system.customfieldtypes:float" },
    { chave: "CF_CUSTO_SUCATA",  nome: "Custo Sucateado SGQ (R$)",      tipo: "com.atlassian.jira.plugin.system.customfieldtypes:float" },
    { chave: "CF_PRIORIDADE_RNC",nome: "Prioridade RNC SGQ",            tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",
      opcoes: ["Padrão", "Emergência"] },
    { chave: "CF_PROCESSO",      nome: "Processo Inspecionado SGQ",     tipo: "com.atlassian.jira.plugin.system.customfieldtypes:select",
      opcoes: ["Dobra", "Usinagem", "Soldagem", "Montagem / Teste Final", "Pintura", "Recebimento Externo", "Campo / Pós-Venda"] },
  ];

  // ── Busca campos já existentes para evitar duplicação ────────────────
  const listaResp = UrlFetchApp.fetch(`${base}/field`, { method: "get", headers, muteHttpExceptions: true });
  if (listaResp.getResponseCode() !== 200) throw new Error("Erro ao listar campos: " + listaResp.getResponseCode());
  const existentes = JSON.parse(listaResp.getContentText());

  const ids = {};
  Logger.log("=== criarCamposV2 — iniciando ===\n");

  for (const campo of CAMPOS) {
    Utilities.sleep(250); // rate limit

    const jaExiste = existentes.find(c => c.name === campo.nome);
    if (jaExiste) {
      ids[campo.chave] = jaExiste.id;
      Logger.log(`✓ Já existe: "${campo.nome}" → ${jaExiste.id}`);
      if (campo.opcoes) _garantirOpcoes(jaExiste.id, campo.opcoes, base, headers);
      _adicionarCampoAoProjeto(jaExiste.id, base, headers);
      continue;
    }

    // Cria o campo
    const cr = UrlFetchApp.fetch(`${base}/field`, {
      method: "post", headers,
      payload: JSON.stringify({ name: campo.nome, type: campo.tipo }),
      muteHttpExceptions: true,
    });
    const st = cr.getResponseCode();
    const bd = JSON.parse(cr.getContentText());

    if (st !== 200 && st !== 201) {
      Logger.log(`✗ Erro ao criar "${campo.nome}": ${st} — ${JSON.stringify(bd).substring(0, 200)}`);
      continue;
    }

    const fieldId = bd.id;
    ids[campo.chave] = fieldId;
    Logger.log(`✅ Criado: "${campo.nome}" → ${fieldId}`);

    if (campo.opcoes) {
      Utilities.sleep(500);
      _garantirOpcoes(fieldId, campo.opcoes, base, headers);
    }
    _adicionarCampoAoProjeto(fieldId, base, headers);
  }

  // ── Salva IDs no PropertiesService ──────────────────────────────────
  if (Object.keys(ids).length) {
    props.setProperties(ids);
    Logger.log("\n✅ IDs salvos no PropertiesService.");
  }

  Logger.log("\n=== RESUMO — copie para Code.gs CONFIG.CF ===");
  Object.entries(ids).forEach(([k, v]) => Logger.log(`  ${k}: "${v}",`));
  Logger.log("=============================================");
}

/** Garante que as opções existam no campo select (não duplica se já existirem). */
function _garantirOpcoes(fieldId, opcoes, base, headers) {
  // Busca o contexto
  const ctxR = UrlFetchApp.fetch(`${base}/field/${fieldId}/context`, { method: "get", headers, muteHttpExceptions: true });
  if (ctxR.getResponseCode() !== 200) { Logger.log(`  ⚠ Sem contexto para ${fieldId}`); return; }
  const ctx = JSON.parse(ctxR.getContentText());
  const ctxId = ctx.values && ctx.values[0] && ctx.values[0].id;
  if (!ctxId) { Logger.log(`  ⚠ Contexto vazio para ${fieldId}`); return; }

  // Busca opções já existentes
  const opR = UrlFetchApp.fetch(`${base}/field/${fieldId}/context/${ctxId}/option`, { method: "get", headers, muteHttpExceptions: true });
  const existOpts = opR.getResponseCode() === 200
    ? JSON.parse(opR.getContentText()).values.map(o => o.value)
    : [];

  const novas = opcoes.filter(o => !existOpts.includes(o));
  if (!novas.length) { Logger.log(`  ✓ Opções já existem em ${fieldId}`); return; }

  const addR = UrlFetchApp.fetch(`${base}/field/${fieldId}/context/${ctxId}/option`, {
    method: "post", headers,
    payload: JSON.stringify({ options: novas.map(o => ({ value: o })) }),
    muteHttpExceptions: true,
  });
  if (addR.getResponseCode() === 200 || addR.getResponseCode() === 201) {
    Logger.log(`  ✅ Opções adicionadas a ${fieldId}: ${novas.join(", ")}`);
  } else {
    Logger.log(`  ⚠ Erro opções ${fieldId}: ${addR.getResponseCode()} — ${addR.getContentText().substring(0, 150)}`);
  }
}


/**
 * PASSO 1 — Define as credenciais Jira no PropertiesService.
 *
 * COMO USAR:
 *   1. Substitua os valores "COLE_AQUI_..." pelas suas credenciais
 *   2. Clique em Executar (▶) com esta função selecionada
 *   3. IMEDIATAMENTE após executar: apague os valores e salve
 *      (ou use a UI do PropertiesService em Projeto > Configurações)
 *
 * ⚠ NUNCA commite este arquivo com credenciais reais!
 */
function configurarPropriedades() {
  const props = PropertiesService.getScriptProperties();

  // ── PREENCHA ABAIXO (apague após executar!) ──────────────
  const JIRA_URL   = "https://agricef-qualidade.atlassian.net/rest/api/3";
  const JIRA_EMAIL = "agricef.qualidade@agricef.com.br";
  const JIRA_TOKEN = "COLE_AQUI_O_NOVO_TOKEN_JIRA";
  // ─────────────────────────────────────────────────────────

  if (JIRA_TOKEN === "COLE_AQUI_O_NOVO_TOKEN_JIRA") {
    throw new Error("⛔ Configure o JIRA_TOKEN antes de executar!");
  }

  props.setProperties({ JIRA_URL, JIRA_EMAIL, JIRA_TOKEN });

  Logger.log("✅ Propriedades Jira configuradas com sucesso.");
  Logger.log("   JIRA_URL   : " + JIRA_URL);
  Logger.log("   JIRA_EMAIL : " + JIRA_EMAIL);
  Logger.log("   JIRA_TOKEN : (definido — " + JIRA_TOKEN.length + " caracteres)");
  Logger.log("");
  Logger.log("⚠ IMPORTANTE: Apague o valor do JIRA_TOKEN neste arquivo agora!");
}


/**
 * PASSO 2 — Cria o template TEMPLATE_RNC_AGRICEF no Google Docs,
 * espelhando o layout do formulário Excel oficial da Agricef.
 * Salva na pasta Repositório RNC e grava o ID no PropertiesService.
 *
 * Execute apenas UMA vez.
 */
function criarTemplateRNC() {
  const PASTA_ID  = "12fhJSIVxxlPlSCFZUsHg9NoRjIQqEj1O";
  const AZUL      = "#1a3a6b";
  const CINZA_CLR = "#f2f2f2";
  const BORDA_CLR = "#cccccc";

  Logger.log("📄 Criando template RNC (layout Agricef)...");

  const pasta = DriveApp.getFolderById(PASTA_ID);
  const doc   = DocumentApp.create("TEMPLATE_RNC_AGRICEF");
  const corpo = doc.getBody();
  corpo.setMarginTop(36).setMarginBottom(36).setMarginLeft(54).setMarginRight(54);

  // Estilo base do corpo
  const estiloBase = {};
  estiloBase[DocumentApp.Attribute.FONT_FAMILY] = "Arial";
  estiloBase[DocumentApp.Attribute.FONT_SIZE]   = 10;
  corpo.setAttributes(estiloBase);

  corpo.clear();

  // ════════════════════════════════════════════════════════
  // CABEÇALHO — RELATÓRIO DE NÃO CONFORMIDADE
  // ════════════════════════════════════════════════════════
  const hdr = corpo.appendParagraph("AGRICEF  ·  RELATÓRIO DE NÃO CONFORMIDADE");
  hdr.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  hdr.editAsText()
     .setFontSize(14)
     .setBold(true)
     .setForegroundColor("#ffffff");
  hdr.setBackgroundColor(AZUL);
  hdr.setSpacingBefore(0).setSpacingAfter(0);

  // Número do ticket
  const numRnc = corpo.appendParagraph("Nº  {{TICKET}}");
  numRnc.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  numRnc.editAsText().setFontSize(9).setBold(true).setForegroundColor("#ffffff");
  numRnc.setBackgroundColor(AZUL);
  numRnc.setSpacingBefore(0).setSpacingAfter(6);

  // ════════════════════════════════════════════════════════
  // BLOCO 1 — Identificação
  // ════════════════════════════════════════════════════════
  _secao(corpo, "IDENTIFICAÇÃO", AZUL);

  _campo(corpo, "Setor Emissor / Causador:",  "{{SETOR_RESP}}");
  _campo(corpo, "Inspetor / Operador (RE):",  "{{RE_INSPETOR}}");
  _campo(corpo, "Origem da Peça / Desvio:",   "{{ORIGEM}}");
  _campo(corpo, "Data de Abertura:",          "{{DATA}}");

  // Tipo de RNC (checkboxes)
  const tipoP = corpo.appendParagraph("");
  const tipoT = tipoP.editAsText();
  tipoT.appendText("Tipo de RNC:   ");
  tipoT.setBold(0, 13, true);
  tipoT.appendText("(   ) Ação Preventiva     (  ✓  ) Ação Corretiva     (   ) Melhoria");
  tipoP.setSpacingAfter(4);

  // ════════════════════════════════════════════════════════
  // BLOCO 2 — Rastreabilidade da Peça
  // ════════════════════════════════════════════════════════
  _secao(corpo, "RASTREABILIDADE DA PEÇA", AZUL);

  _campo(corpo, "Código do Item / OP:", "{{COD_ITEM}}");

  // Qtd em linha dupla
  const qtdP = corpo.appendParagraph("");
  const qtdT = qtdP.editAsText();
  qtdT.appendText("Qtd Total do Lote:  ");
  qtdT.setBold(0, 19, true);
  qtdT.appendText("{{QTD_LOTE}}", );
  qtdT.appendText("          Qtd com Desvio:  ");
  const qtdIni = qtdT.getText().length - 27;
  qtdT.setBold(qtdIni, qtdIni + 18, true);
  qtdT.appendText("{{QTD_DEF}}");
  qtdP.setSpacingAfter(4);

  // ════════════════════════════════════════════════════════
  // BLOCO 3 — Descrição do Problema
  // ════════════════════════════════════════════════════════
  _secao(corpo, "DESCRIÇÃO DO PROBLEMA", AZUL);

  const descP = corpo.appendParagraph("{{DESCRICAO}}");
  descP.setSpacingAfter(4);
  // Espaço para texto longo
  for (let i = 0; i < 4; i++) corpo.appendParagraph("").setSpacingAfter(2);

  // ════════════════════════════════════════════════════════
  // BLOCO 4 — Análise de Causa  (preenchida no Jira)
  // ════════════════════════════════════════════════════════
  _secao(corpo, "ANÁLISE DE CAUSA  (a preencher no Jira — transição → Plano de Ação)", AZUL);
  for (let i = 0; i < 4; i++) corpo.appendParagraph("").setSpacingAfter(2);

  // ════════════════════════════════════════════════════════
  // BLOCO 5 — Evidência Visual
  // ════════════════════════════════════════════════════════
  _secao(corpo, "EVIDÊNCIA VISUAL", AZUL);

  const fotoP = corpo.appendParagraph("{{FOTO_DEFEITO}}");
  fotoP.setSpacingAfter(4);
  corpo.appendParagraph("").setSpacingAfter(4);

  // ════════════════════════════════════════════════════════
  // BLOCO 6 — Ações para Resolução  (preenchida no Jira)
  // ════════════════════════════════════════════════════════
  _secao(corpo, "AÇÕES PARA RESOLUÇÃO  (a preencher no Jira — Plano de Ação → Verificação QA)", AZUL);

  _campo(corpo, "Responsável pela ação:", "Agricef");
  for (let i = 0; i < 3; i++) corpo.appendParagraph("").setSpacingAfter(2);

  // ════════════════════════════════════════════════════════
  // RODAPÉ
  // ════════════════════════════════════════════════════════
  const rodape = corpo.appendParagraph(
    "Documento gerado automaticamente pelo Sistema de Qualidade Agricef  ·  Não alterar manualmente"
  );
  rodape.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  rodape.editAsText()
        .setFontSize(8)
        .setItalic(true)
        .setForegroundColor("#999999");
  rodape.setSpacingBefore(12);

  doc.saveAndClose();

  // Move para a pasta correta (ao criar, fica na raiz do Drive)
  const arquivo = DriveApp.getFileById(doc.getId());
  pasta.addFile(arquivo);
  try { DriveApp.getRootFolder().removeFile(arquivo); } catch(e) {}

  const templateId = doc.getId();
  PropertiesService.getScriptProperties().setProperty("TEMPLATE_DOC_ID", templateId);

  Logger.log("✅ Template criado com sucesso!");
  Logger.log("   Nome : TEMPLATE_RNC_AGRICEF");
  Logger.log("   ID   : " + templateId);
  Logger.log("   URL  : https://docs.google.com/document/d/" + templateId + "/edit");
  Logger.log("▶ Execute agora: verificarSetup()");

  return templateId;
}

/** Cabeçalho de seção colorido */
function _secao(corpo, titulo, cor) {
  const p = corpo.appendParagraph("  " + titulo);
  p.editAsText()
   .setFontSize(9)
   .setBold(true)
   .setForegroundColor("#ffffff");
  p.setBackgroundColor(cor);
  p.setSpacingBefore(8).setSpacingAfter(4);
}

/** Linha rótulo em negrito + valor */
function _campo(corpo, rotulo, valor) {
  const p    = corpo.appendParagraph("");
  const text = p.editAsText();
  text.appendText(rotulo + "  ");
  text.setBold(0, rotulo.length - 1, true);
  text.appendText(valor);
  p.setSpacingAfter(4);
}


/**
 * PASSO 2-B — Cria o campo "Link Pasta Drive SGQ" no Jira e adiciona ao projeto SGQ.
 *
 * Execute UMA VEZ após configurarPropriedades().
 * Após rodar, verifique nos logs o ID retornado.
 * Se for diferente de "customfield_10135", atualize CONFIG.CF.LINK_PASTA em Code.gs.
 */
function criarCampoLinkPasta() {
  const props = PropertiesService.getScriptProperties();
  const base  = props.getProperty("JIRA_URL");
  const email = props.getProperty("JIRA_EMAIL");
  const token = props.getProperty("JIRA_TOKEN");
  if (!token || token === "COLE_AQUI_O_NOVO_TOKEN_JIRA") {
    throw new Error("⛔ Configure as credenciais Jira antes (execute configurarPropriedades()).");
  }
  const cred    = Utilities.base64Encode(email + ":" + token);
  const headers = { Authorization: "Basic " + cred, "Content-Type": "application/json" };

  // ── 1. Verifica se o campo já existe ──────────────────────────────────────
  const listaResp = UrlFetchApp.fetch(`${base}/field`, {
    method: "get", headers, muteHttpExceptions: true,
  });
  if (listaResp.getResponseCode() !== 200) {
    throw new Error("Erro ao listar campos: " + listaResp.getContentText().substring(0, 300));
  }
  const campos    = JSON.parse(listaResp.getContentText());
  const existente = campos.find(c => c.name === "Link Pasta Drive SGQ");
  if (existente) {
    Logger.log("✅ Campo já existe: " + existente.id);
    Logger.log("   Atualize CONFIG.CF.LINK_PASTA = \"" + existente.id + "\" em Code.gs se necessário.");
    _adicionarCampoAoProjeto(existente.id, base, headers);
    return existente.id;
  }

  // ── 2. Cria o campo customizado do tipo URL ────────────────────────────────
  const criarResp = UrlFetchApp.fetch(`${base}/field`, {
    method: "post",
    headers,
    payload: JSON.stringify({
      name:        "Link Pasta Drive SGQ",
      description: "URL da pasta do Google Drive com os dossiês do mês desta RNC",
      type:        "com.atlassian.jira.plugin.system.customfieldtypes:url",
    }),
    muteHttpExceptions: true,
  });

  const statusCriar = criarResp.getResponseCode();
  const corpoCriar  = JSON.parse(criarResp.getContentText());

  if (statusCriar !== 201 && statusCriar !== 200) {
    throw new Error("Erro ao criar campo (" + statusCriar + "): " + JSON.stringify(corpoCriar).substring(0, 300));
  }

  const fieldId = corpoCriar.id;
  Logger.log("✅ Campo criado: " + fieldId + " · Link Pasta Drive SGQ");

  // ── 3. Tenta adicionar o campo ao projeto SGQ ─────────────────────────────
  _adicionarCampoAoProjeto(fieldId, base, headers);

  Logger.log("");
  Logger.log("▶ Se o ID abaixo for diferente de customfield_10135, atualize Code.gs:");
  Logger.log("   CONFIG.CF.LINK_PASTA = \"" + fieldId + "\"");
  return fieldId;
}

/** Tenta adicionar o campo à primeira tela do projeto SGQ via API de telas. */
function _adicionarCampoAoProjeto(fieldId, base, headers) {
  try {
    const telasResp = UrlFetchApp.fetch(`${base}/screens?projectKey=SGQ&maxResults=10`, {
      method: "get", headers, muteHttpExceptions: true,
    });
    if (telasResp.getResponseCode() !== 200) {
      Logger.log("⚠ Não foi possível listar telas via API. Adicione manualmente:");
      Logger.log("   SGQ > Configurações > Campos > Adicionar campo > 'Link Pasta Drive SGQ'");
      return;
    }
    const telas = JSON.parse(telasResp.getContentText());
    const lista  = telas.values || telas || [];
    if (!lista.length) {
      Logger.log("⚠ Nenhuma tela encontrada para o projeto SGQ. Adicione manualmente.");
      return;
    }
    const telaId = lista[0].id;

    // Busca a primeira aba da tela
    const tabsResp = UrlFetchApp.fetch(`${base}/screens/${telaId}/tabs`, {
      method: "get", headers, muteHttpExceptions: true,
    });
    if (tabsResp.getResponseCode() !== 200) return;
    const tabs  = JSON.parse(tabsResp.getContentText());
    const tabId = tabs[0] && tabs[0].id;
    if (!tabId) return;

    const addResp = UrlFetchApp.fetch(`${base}/screens/${telaId}/tabs/${tabId}/fields`, {
      method: "post",
      headers,
      payload: JSON.stringify({ fieldId }),
      muteHttpExceptions: true,
    });
    const st = addResp.getResponseCode();
    if (st === 200 || st === 201) {
      Logger.log("✅ Campo adicionado à tela do projeto SGQ.");
    } else {
      Logger.log("⚠ API retornou " + st + " ao adicionar campo à tela.");
      Logger.log("   Adicione manualmente: SGQ > Configurações > Campos > 'Link Pasta Drive SGQ'");
    }
  } catch(e) {
    Logger.log("⚠ Erro ao adicionar campo à tela: " + e.message);
    Logger.log("   Adicione manualmente: SGQ > Configurações > Campos > 'Link Pasta Drive SGQ'");
  }
}


/**
 * PASSO 3 — Valida toda a configuração antes do deploy.
 * Verifique os logs (Ctrl+Enter) após executar.
 */
function verificarSetup() {
  const props = PropertiesService.getScriptProperties();
  const erros = [];
  let   ok    = 0;

  function check(chave, descricao) {
    const val = props.getProperty(chave);
    if (val && val.length > 4) {
      Logger.log("  ✓ " + descricao + ": " + val.substring(0, 20) + "...");
      ok++;
    } else {
      Logger.log("  ✗ " + descricao + ": NÃO CONFIGURADO");
      erros.push(chave);
    }
  }

  Logger.log("=== VERIFICAÇÃO DE SETUP — Sistema RNC Agricef ===");
  Logger.log("");
  Logger.log("Propriedades do script:");
  check("JIRA_URL",        "JIRA_URL");
  check("JIRA_EMAIL",      "JIRA_EMAIL");
  check("JIRA_TOKEN",      "JIRA_TOKEN");
  check("TEMPLATE_DOC_ID", "TEMPLATE_DOC_ID");

  Logger.log("");
  Logger.log("CONFIG (code.gs):");
  Logger.log("  ✓ PASTA_RAIZ_ID  : " + CONFIG.PASTA_RAIZ_ID.substring(0, 20) + "...");
  Logger.log("  ✓ JIRA_PROJECT   : " + CONFIG.JIRA_PROJECT);
  Logger.log("  ✓ JIRA_ISSUE_TYPE: " + CONFIG.JIRA_ISSUE_TYPE);
  Logger.log("  ✓ CF.ORIGEM      : " + CONFIG.CF.ORIGEM);
  Logger.log("  ✓ CF.SETOR       : " + CONFIG.CF.SETOR);

  // Testa acesso à pasta do Drive
  Logger.log("");
  Logger.log("Acesso ao Google Drive:");
  try {
    const pasta = DriveApp.getFolderById(CONFIG.PASTA_RAIZ_ID);
    Logger.log("  ✓ Pasta 'Repositório RNC': acessível (" + pasta.getName() + ")");
    ok++;
  } catch (e) {
    Logger.log("  ✗ Pasta Drive: ERRO — " + e.message);
    erros.push("PASTA_RAIZ_ID");
  }

  // Testa acesso ao template
  const templateId = props.getProperty("TEMPLATE_DOC_ID");
  if (templateId) {
    try {
      const doc = DocumentApp.openById(templateId);
      Logger.log("  ✓ Template RNC: acessível (" + doc.getName() + ")");
      ok++;
    } catch (e) {
      Logger.log("  ✗ Template RNC: ERRO — " + e.message);
      erros.push("TEMPLATE_DOC_ID");
    }
  }

  Logger.log("");
  if (!erros.length) {
    Logger.log("🚀 SETUP COMPLETO! Tudo configurado corretamente.");
    Logger.log("   Faça o deploy: Implantar > Nova implantação > Aplicativo Web");
  } else {
    Logger.log("⚠ PENDÊNCIAS: " + erros.join(", "));
    Logger.log("   Execute as funções de setup correspondentes.");
  }
}
