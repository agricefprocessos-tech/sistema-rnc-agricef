// ============================================================
// AGRICEF — Sistema de Gestão de Qualidade e RNC
// Arquivo: Code.gs (Google Apps Script — Backend / Middleware)
// Versão: 1.1.0 — MVP Q2/2026
// ============================================================
// SETUP OBRIGATÓRIO antes do primeiro deploy:
//   1. Vá em Configurações do Script > Propriedades do Script
//   2. Adicione as três chaves abaixo:
//      JIRA_URL   → https://suaempresa.atlassian.net/rest/api/3
//      JIRA_EMAIL → bot.qualidade@agricef.com
//      JIRA_TOKEN → (token gerado na conta de serviço da Atlassian)
//   3. Substitua ID_PASTA_RAIZ_DRIVE e ID_TEMPLATE_DOC pelos IDs reais
//   4. Substitua os customfield_XXXXX pelos IDs gerados pelo manifesto Python
// ============================================================

// ── Constantes de ambiente ────────────────────────────────────────────────────

const CONFIG = {
  PASTA_RAIZ_ID:          "12fhJSIVxxlPlSCFZUsHg9NoRjIQqEj1O", // Repositório RNC no Drive
  TEMPLATE_DOC_ID:        "",  // Deixe vazio — lido do PropertiesService (chave TEMPLATE_DOC_ID)
                               // definido automaticamente pela função criarTemplateRNC() em Setup.gs
  PLANILHA_CONTINGENCIA_ID: "",                                  // ID da planilha de contingência (opcional).
                                                                 // Se vazio, erros são gravados apenas no Logger.
                                                                 // Crie uma planilha no Drive, copie o ID da URL
                                                                 // e cole aqui. NUNCA use getActiveSpreadsheet()
                                                                 // em Web Apps standalone — não há planilha ativa.
  JIRA_PROJECT:    "SGQ",                    // Chave do projeto no Jira (atualizado para SGQ em 03/06/2026)
  JIRA_ISSUE_TYPE: "10074",                  // ID do Issue Type padrão do projeto SGQ (Business project)
  // Mapa de Custom Fields — IDs recriados para projeto SGQ em 03/06/2026
  CF: {
    ORIGEM:       "customfield_10127",  // Origem do Item SGQ
    QTD_LOTE:     "customfield_10129",  // Qtd Lote SGQ
    QTD_DESVIO:   "customfield_10130",  // Qtd Desvio SGQ
    COD_ITEM:     "customfield_10131",  // Codigo Peca SGQ
    SETOR:        "customfield_10128",  // Setor Responsavel SGQ
    LINK_PDF:     "customfield_10132",  // Link PDF SGQ
    CAUSA_RAIZ:   "customfield_10133",  // Causa Raiz SGQ
    DISPOSICAO:   "customfield_10134",  // Disposicao Peca SGQ
  },
  // Lista de REs autorizados. Em produção, mover para uma aba "Config" de uma planilha
  // para permitir adição/remoção sem alterar código.
  RES_AUTORIZADOS: ["1001", "1002", "1003", "1004", "1005"],
  MAX_IMG_BASE64_BYTES: 2 * 1024 * 1024, // 2 MB hard cap pós-compressão
};


// ── Roteador de páginas ───────────────────────────────────────────────────────

/**
 * Renderiza a página correta com base no parâmetro ?page= da URL.
 * URL padrão          → Index.html  (formulário do operador)
 * ?page=painel        → Painel.html (dashboard do gestor)
 */
function doGet(e) {
  const chave = e && e.parameters && e.parameters.page ? e.parameters.page[0] : null;

  // ── Endpoint JSON para o Painel GitHub Pages ──────────────────────────────
  // ?page=api&action=dashboard[&mesAno=2026-06]
  // ?page=api&action=meses
  if (chave === "api") {
    return _handleApiRequest(e);
  }

  // ── Páginas HTML normais ──────────────────────────────────────────────────
  const paginas = {
    painel: { arquivo: "Painel", titulo: "Agricef · Dashboard Qualidade" },
  };
  const config = paginas[chave] || { arquivo: "Index", titulo: "Agricef · Abertura de RNC" };

  return HtmlService.createTemplateFromFile(config.arquivo)
    .evaluate()
    .setTitle(config.titulo)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/**
 * Recebe o formulário RNC enviado pelo app GitHub Pages via fetch POST.
 * Content-Type: text/plain (evita preflight CORS).
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result  = processarRNC(payload.dados, payload.imagem);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Responde requisições JSON do Painel GitHub Pages.
 * Retorna ContentService (texto puro) com MIME JSON para suportar fetch() externo.
 */
function _handleApiRequest(e) {
  const params = (e && e.parameters) || {};
  const action = params.action ? params.action[0] : "";
  const mesAno = params.mesAno ? params.mesAno[0] : null;

  try {
    let resultado;
    if (action === "meses") {
      resultado = buscarMesesDisponiveis();
    } else {
      // default: dashboard
      const filtros = mesAno ? { mesAno } : null;
      resultado = buscarDadosDashboard(filtros);
    }

    const json = JSON.stringify({ ok: true, data: resultado });
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const json = JSON.stringify({ ok: false, error: err.message });
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper para incluir arquivos HTML parciais dentro de templates.
 * Uso no HTML: <?!= include('Estilos') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// ── Processamento principal de RNC ────────────────────────────────────────────

/**
 * Função principal chamada pelo Index.html via google.script.run.
 * Orquestra: validação → Drive → Jira (rascunho) → PDF com nº ticket → atualiza Jira.
 * O Jira é criado primeiro para que o número do ticket apareça no dossiê PDF.
 *
 * @param {Object} dados - Campos do formulário enviados pelo operador
 * @param {string} base64Imagem - Foto comprimida em Base64 (sem prefixo data:image)
 * @returns {Object} { sucesso: true, ticket: "RNC-42", urlPdf: "https://..." }
 */
function processarRNC(dados, base64Imagem) {

  // 1. Firewall: valida RE antes de qualquer operação
  if (!_verificarRE(dados.reOperador)) {
    throw new Error("ACESSO NEGADO: Registro de Empregado (RE) não autorizado. Solicite cadastro ao setor de Qualidade.");
  }

  // 2. Valida tamanho da imagem (hard cap de 2MB no servidor, reforço ao client-side)
  const tamanhoBytes = Utilities.base64Decode(base64Imagem).length;
  if (tamanhoBytes > CONFIG.MAX_IMG_BASE64_BYTES) {
    throw new Error("Imagem excede 2MB mesmo após compressão. Tire uma nova foto com menos detalhes ou distância maior.");
  }

  // 3. Cria pasta do mês com semáforo anti-race-condition
  const pastaDestino = _garantirPastaMes();

  try {
    // 4. Salva imagem no Drive e obtém URL
    const { blobImagem, urlImagem } = _salvarImagem(base64Imagem, dados.codigoItem, pastaDestino);

    // 5. Cria ticket no Jira sem URL do PDF (ainda não existe)
    //    Assim o número do ticket fica disponível para o dossiê PDF.
    const ticketKey = _enviarParaJira(dados, null, urlImagem);

    // 6. Gera dossiê PDF com o número do ticket já preenchido no template
    const urlPdf = _gerarPdf(dados, blobImagem, pastaDestino, ticketKey);

    // 7. Atualiza o campo Link do Dossiê PDF no ticket Jira
    _atualizarLinkPdfJira(ticketKey, urlPdf);

    return { sucesso: true, ticket: ticketKey, urlPdf };

  } catch (erro) {
    // 7. Contingência: salva em Sheets se o Jira ou o Drive falharem
    _registrarFalhaContingencia(dados, erro.toString());
    throw new Error(
      "Erro no processamento. Dados salvos na planilha de contingência para não se perderem. " +
      "Informe ao setor de TI. Detalhe: " + erro.toString()
    );
  }
}


// ── Dashboard: leitura de dados do Jira ──────────────────────────────────────

/**
 * Busca TODOS os tickets RNC do Jira com paginação automática.
 * Retorna array de objetos simplificados para o Painel.html renderizar.
 *
 * @param {Object} filtros - { mesAno: "2026-06" } — null/undefined retorna todos
 * @returns {Array} Lista de RNCs consolidadas
 */
function buscarDadosDashboard(filtros) {
  const props  = PropertiesService.getScriptProperties();
  const base   = props.getProperty("JIRA_URL");
  const email  = props.getProperty("JIRA_EMAIL");
  const token  = props.getProperty("JIRA_TOKEN");
  const cred   = Utilities.base64Encode(email + ":" + token);

  // Monta JQL com filtro de período se fornecido
  let jql = `project = ${CONFIG.JIRA_PROJECT} ORDER BY created DESC`;
  if (filtros && filtros.mesAno) {
    // Ex: mesAno = "2026-06" → busca RNCs criadas em junho/2026
    const [ano, mes] = filtros.mesAno.split("-");
    const inicio = `${ano}-${mes}-01`;
    // Último dia do mês
    const ultimo = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const fim    = `${ano}-${mes}-${String(ultimo).padStart(2, "0")}`;
    jql = `project = ${CONFIG.JIRA_PROJECT} AND created >= "${inicio}" AND created <= "${fim}" ORDER BY created DESC`;
  }

  // Campos que queremos trazer (inclui resolutiondate para calcular Lead Time)
  const fields = [
    "key", "summary", "created", "resolutiondate", "status",
    CONFIG.CF.ORIGEM, CONFIG.CF.SETOR, CONFIG.CF.DISPOSICAO,
    CONFIG.CF.CAUSA_RAIZ, CONFIG.CF.QTD_DESVIO, CONFIG.CF.COD_ITEM,
    CONFIG.CF.LINK_PDF,
  ].join(",");

  const headers = { "Authorization": "Basic " + cred };

  // Paginação: busca em lotes de 50 até esgotar resultados
  const todos      = [];
  const PAGE_SIZE  = 50;
  let   startAt    = 0;
  let   totalFetch = 0;
  let   totalJira  = Infinity; // atualizado na 1ª página; declarado fora do bloco para
                                // ser acessível na condição do while (const dentro do do{}
                                // ficaria fora de escopo no while() e causaria ReferenceError)

  do {
    const url = `${base}/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=${encodeURIComponent(fields)}`;
    const res  = UrlFetchApp.fetch(url, { method: "get", headers, muteHttpExceptions: true });

    if (res.getResponseCode() !== 200) {
      throw new Error("Jira API erro " + res.getResponseCode() + ": " + res.getContentText().substring(0, 200));
    }

    const json = JSON.parse(res.getContentText());
    totalJira  = json.total;

    json.issues.forEach(issue => {
      const f = issue.fields;
      const criado   = new Date(f.created);
      const fechado  = f.resolutiondate ? new Date(f.resolutiondate) : null;
      const leadTime = fechado
        ? Math.round((fechado - criado) / (1000 * 60 * 60)) // em horas
        : null;

      todos.push({
        ticket:      issue.key,
        dataCriacao: f.created.substring(0, 10),
        dataFechado: f.resolutiondate ? f.resolutiondate.substring(0, 10) : null,
        leadTimeH:   leadTime,        // horas — null se ainda aberto
        status:      f.status ? f.status.name : "—",
        setor:       f[CONFIG.CF.SETOR]       ? f[CONFIG.CF.SETOR].value       : "Não atribuído",
        origem:      f[CONFIG.CF.ORIGEM]      ? f[CONFIG.CF.ORIGEM].value      : "—",
        disposicao:  f[CONFIG.CF.DISPOSICAO] ? f[CONFIG.CF.DISPOSICAO].value  : "Pendente",
        causaRaiz:   f[CONFIG.CF.CAUSA_RAIZ] ? f[CONFIG.CF.CAUSA_RAIZ].value  : "—",
        codigoItem:  f[CONFIG.CF.COD_ITEM]   || "—",
        qtdDesvio:   f[CONFIG.CF.QTD_DESVIO] || 0,
        urlPdf:      f[CONFIG.CF.LINK_PDF]   || null,
      });
    });

    startAt    += PAGE_SIZE;
    totalFetch += json.issues.length;

    // Proteção: para no máximo 1000 tickets por chamada (evita timeout de 6 min do GAS)
    if (totalFetch >= 1000) break;

  } while (startAt < totalJira);

  return todos;
}

/**
 * Retorna os meses disponíveis (com RNCs) para popular o seletor de período no painel.
 */
function buscarMesesDisponiveis() {
  const props = PropertiesService.getScriptProperties();
  const base  = props.getProperty("JIRA_URL");
  const email = props.getProperty("JIRA_EMAIL");
  const token = props.getProperty("JIRA_TOKEN");
  const cred  = Utilities.base64Encode(email + ":" + token);

  const jql = `project = ${CONFIG.JIRA_PROJECT} ORDER BY created ASC`;
  const url  = `${base}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1&fields=created`;
  const res  = UrlFetchApp.fetch(url, { method: "get", headers: { "Authorization": "Basic " + cred }, muteHttpExceptions: true });

  if (res.getResponseCode() !== 200) return [];

  const json  = JSON.parse(res.getContentText());
  if (!json.total) return [];

  // Gera lista de meses desde a primeira RNC até hoje
  const primeiraRnc = new Date(json.issues[0].fields.created);
  const hoje        = new Date();
  const meses       = [];

  let cursor = new Date(primeiraRnc.getFullYear(), primeiraRnc.getMonth(), 1);
  while (cursor <= hoje) {
    const ano = cursor.getFullYear();
    const mes = String(cursor.getMonth() + 1).padStart(2, "0");
    meses.push({ valor: `${ano}-${mes}`, label: `${mes}/${ano}` });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses.reverse(); // mais recente primeiro
}


// ── Funções privadas de suporte ───────────────────────────────────────────────

/**
 * Valida se o RE informado está na lista de autorizados.
 */
function _verificarRE(re) {
  if (!re) return false;
  return CONFIG.RES_AUTORIZADOS.includes(re.toString().trim());
}

/**
 * Garante que a pasta do mês corrente existe no Drive.
 * Usa LockService para evitar race condition em envios simultâneos.
 */
function _garantirPastaMes() {
  const trava = LockService.getScriptLock();
  try {
    trava.waitLock(15000);
  } catch (e) {
    throw new Error("Servidor ocupado. Tente novamente em alguns instantes.");
  }

  const nomeMes    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const pastaRaiz  = DriveApp.getFolderById(CONFIG.PASTA_RAIZ_ID);
  const existentes = pastaRaiz.getFoldersByName(nomeMes);
  const pasta      = existentes.hasNext() ? existentes.next() : pastaRaiz.createFolder(nomeMes);

  trava.releaseLock();
  return pasta;
}

/**
 * Converte Base64 em Blob, salva no Drive e retorna o blob + URL.
 */
function _salvarImagem(base64, codigoItem, pasta) {
  const blobImagem = Utilities.newBlob(
    Utilities.base64Decode(base64),
    MimeType.JPEG,
    `EVIDENCIA_${codigoItem}_${Date.now()}.jpg`
  );
  const arquivoImg = pasta.createFile(blobImagem);
  arquivoImg.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { blobImagem, urlImagem: arquivoImg.getUrl() };
}

/**
 * Clona o template do Docs, substitui tags, injeta imagem e exporta PDF.
 */
function _gerarPdf(dados, blobImagem, pasta, ticketKey) {
  // Lê o TEMPLATE_DOC_ID do PropertiesService (definido pelo Setup.gs na primeira execução).
  const templateId = PropertiesService.getScriptProperties().getProperty("TEMPLATE_DOC_ID") || CONFIG.TEMPLATE_DOC_ID;
  if (!templateId) throw new Error("TEMPLATE_DOC_ID não configurado. Execute criarTemplateRNC() no Apps Script.");

  const nomeDossie = `DOSSIE_${ticketKey || "RNC"}_${dados.codigoItem}_${Date.now()}`;
  const copia      = DriveApp.getFileById(templateId).makeCopy(nomeDossie, pasta);
  const doc        = DocumentApp.openById(copia.getId());
  const corpo      = doc.getBody();

  // Substituição de tags textuais
  const agora = new Date();
  const tagMap = {
    "{{TICKET}}":      ticketKey || "—",
    "{{DATA}}":        Utilities.formatDate(agora, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    "{{RE_INSPETOR}}": dados.reOperador,
    "{{ORIGEM}}":      dados.origemItem,
    "{{COD_ITEM}}":    dados.codigoItem,
    "{{QTD_LOTE}}":    String(dados.qtdLote),
    "{{QTD_DEF}}":     String(dados.qtdDesvio),
    "{{DESCRICAO}}":   dados.descricaoDefeito,
    "{{SETOR_RESP}}":  dados.setorResponsavel,
  };
  Object.entries(tagMap).forEach(([tag, valor]) => corpo.replaceText(tag, valor));

  // Injeção da imagem no marcador {{FOTO_DEFEITO}}
  const marcador = corpo.findText("\\{\\{FOTO_DEFEITO\\}\\}");
  if (marcador) {
    const paragrafo = marcador.getElement().getParent().asParagraph();
    const img       = paragrafo.appendInlineImage(blobImagem);
    // Redimensiona proporcionalmente para caber na largura A4 (máx 450pt)
    const LARGURA_MAX = 450;
    if (img.getWidth() > LARGURA_MAX) {
      img.setHeight(Math.round((LARGURA_MAX * img.getHeight()) / img.getWidth()));
      img.setWidth(LARGURA_MAX);
    }
    marcador.getElement().asText().setText("");
  }

  doc.saveAndClose();

  // Exporta para PDF, salva na pasta e remove o Doc temporário
  const blobPdf   = copia.getAs(MimeType.PDF);
  const arquivoPdf = pasta.createFile(blobPdf);
  arquivoPdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  copia.setTrashed(true);

  return arquivoPdf.getUrl();
}

/**
 * Monta o payload ADF e faz POST na API v3 do Jira.
 * urlPdf pode ser null na primeira chamada (o link é atualizado depois pelo _atualizarLinkPdfJira).
 * Retorna a chave do ticket criado (ex: "RNC-42").
 */
function _enviarParaJira(dados, urlPdf, urlImagem) {
  const props = PropertiesService.getScriptProperties();
  const base  = props.getProperty("JIRA_URL");
  const email = props.getProperty("JIRA_EMAIL");
  const token = props.getProperty("JIRA_TOKEN");
  const cred  = Utilities.base64Encode(email + ":" + token);

  // Descrição ADF — linha do PDF só aparece se a URL já existir
  const adfContent = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Aberta via Web App pelo RE: ", marks: [{ type: "strong" }] },
        { type: "text", text: dados.reOperador },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Descrição técnica do desvio:\n", marks: [{ type: "strong" }] },
        { type: "text", text: dados.descricaoDefeito },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Evidência visual (foto): ", marks: [{ type: "strong" }] },
        { type: "text", text: urlImagem, marks: [{ type: "link", attrs: { href: urlImagem } }] },
      ],
    },
  ];

  // Campos do payload
  const fields = {
    project:   { key: CONFIG.JIRA_PROJECT },
    summary:   `RNC · ${dados.codigoItem} · ${dados.setorResponsavel} · ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy")}`,
    issuetype: { id: CONFIG.JIRA_ISSUE_TYPE },
    [CONFIG.CF.ORIGEM]:    { value: dados.origemItem },
    [CONFIG.CF.QTD_LOTE]:  parseFloat(dados.qtdLote),
    [CONFIG.CF.QTD_DESVIO]: parseFloat(dados.qtdDesvio),
    [CONFIG.CF.COD_ITEM]:  dados.codigoItem,
    [CONFIG.CF.SETOR]:     { value: dados.setorResponsavel },
    description: { version: 1, type: "doc", content: adfContent },
  };
  // Só adiciona LINK_PDF se já tiver URL (evita erro de campo URL vazio no Jira)
  if (urlPdf) fields[CONFIG.CF.LINK_PDF] = urlPdf;

  const payload = { fields };

  const resp = UrlFetchApp.fetch(`${base}/issue`, {
    method:      "post",
    contentType: "application/json",
    headers:     { Authorization: "Basic " + cred },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const codigo = resp.getResponseCode();
  const corpo  = JSON.parse(resp.getContentText());

  if (codigo === 201 || codigo === 200) {
    return corpo.key;
  }
  throw new Error(`Jira retornou ${codigo}: ${JSON.stringify(corpo).substring(0, 300)}`);
}

/**
 * Atualiza o campo Link do Dossiê PDF no ticket Jira após o PDF ser gerado.
 */
function _atualizarLinkPdfJira(ticketKey, urlPdf) {
  const props = PropertiesService.getScriptProperties();
  const base  = props.getProperty("JIRA_URL");
  const email = props.getProperty("JIRA_EMAIL");
  const token = props.getProperty("JIRA_TOKEN");
  const cred  = Utilities.base64Encode(email + ":" + token);

  const payload = { fields: { [CONFIG.CF.LINK_PDF]: urlPdf } };

  const resp = UrlFetchApp.fetch(`${base}/issue/${ticketKey}`, {
    method:      "put",
    contentType: "application/json",
    headers:     { Authorization: "Basic " + cred },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  // PUT bem-sucedido retorna 204 No Content
  const codigo = resp.getResponseCode();
  if (codigo !== 204 && codigo !== 200) {
    // Não é erro crítico — ticket já existe, só o link do PDF ficou pendente
    Logger.log(`Aviso: não foi possível atualizar LINK_PDF no ticket ${ticketKey}: ${resp.getResponseCode()}`);
  }
}

/**
 * Plano B: registra os dados da RNC em uma planilha se a API falhar.
 * Os dados podem ser reenviados ao Jira manualmente após restabelecimento.
 *
 * IMPORTANTE: getActiveSpreadsheet() retorna null em Web Apps standalone.
 * Por isso usamos openById() com CONFIG.PLANILHA_CONTINGENCIA_ID.
 * Se o ID não estiver configurado, o erro é gravado apenas no Logger do GAS
 * (acessível em Execuções > Logs no editor do Apps Script).
 */
function _registrarFalhaContingencia(dados, mensagemErro) {
  // Sempre grava no Logger para rastreabilidade independente da planilha
  Logger.log("CONTINGÊNCIA RNC | RE: %s | Item: %s | Erro: %s",
    dados.reOperador, dados.codigoItem, mensagemErro);

  if (!CONFIG.PLANILHA_CONTINGENCIA_ID) {
    // ID não configurado — erro já está no Logger acima
    return;
  }

  try {
    const ss  = SpreadsheetApp.openById(CONFIG.PLANILHA_CONTINGENCIA_ID);
    let   aba = ss.getSheetByName("Contingência_RNC");
    if (!aba) {
      aba = ss.insertSheet("Contingência_RNC");
      aba.appendRow(["Timestamp", "RE", "Origem", "Código Item", "Qtd Lote", "Qtd Desvio", "Setor", "Descrição", "Erro"]);
      aba.getRange(1, 1, 1, 9).setFontWeight("bold");
    }
    aba.appendRow([
      new Date(),
      dados.reOperador,
      dados.origemItem,
      dados.codigoItem,
      dados.qtdLote,
      dados.qtdDesvio,
      dados.setorResponsavel,
      dados.descricaoDefeito,
      mensagemErro,
    ]);
  } catch (e) {
    Logger.log("FALHA ao gravar na planilha de contingência: " + e.toString());
  }
}
