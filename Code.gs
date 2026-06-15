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
    // ── Campos v1 (abertura) ──────────────────────────────────────
    ORIGEM:       "customfield_10127",  // Origem do Item SGQ
    QTD_LOTE:     "customfield_10129",  // Qtd Lote SGQ
    QTD_DESVIO:   "customfield_10130",  // Qtd Desvio SGQ
    COD_ITEM:     "customfield_10131",  // Codigo Peca SGQ
    SETOR:        "customfield_10128",  // Setor Responsavel SGQ
    LINK_PDF:     "customfield_10132",  // Link PDF SGQ
    CAUSA_RAIZ:   "customfield_10133",  // Causa Raiz SGQ
    DISPOSICAO:   "customfield_10134",  // Disposicao Peca SGQ
    LINK_PASTA:   "customfield_10167",  // Link Pasta Drive SGQ
    // ── Campos v2 (abertura expandida) ───────────────────────────
    PRIORIDADE:   "customfield_10241",  // Prioridade RNC SGQ (Padrão / Emergência)
    PROCESSO:     "customfield_10242",  // Processo Inspecionado SGQ
    NUM_SERIE:    "customfield_10238",  // Número de Série SGQ
    // ── Campos v2 (tratativa — fase 2) ───────────────────────────
    CONTENCAO:    "customfield_10233",  // Ação de Contenção SGQ
    ACAO_CORRET:  "customfield_10234",  // Ação Corretiva SGQ
    RESP_NOME:    "customfield_10236",  // Responsável Tratativa SGQ
    RESP_EMAIL:   "customfield_10237",  // Email Responsável Tratativa
    HORAS_RETRAB: "customfield_10239",  // Horas de Retrabalho SGQ
    CUSTO_SUCATA: "customfield_10240",  // Custo Sucateado SGQ (R$)
    // ── Campos v2 (verificação — fase 3) ─────────────────────────
    MOTIVO_DEVOL: "customfield_10235",  // Motivo Devolução SGQ
  },

  // Status IDs do projeto SGQ (Jira Business)
  STATUS: {
    ABERTO:        { id: "10107", transicao: "21" },
    EM_ANALISE:    { id: "10108", transicao: "31" },
    PLANO_ACAO:    { id: "10142", transicao: null }, // descoberto dinamicamente
    VERIFICACAO_QA:{ id: "10143", transicao: null }, // descoberto dinamicamente
    CONCLUIDO:     { id: "10109", transicao: "41" },
  },
  // Lista de REs autorizados. Em produção, mover para uma aba "Config" de uma planilha
  // para permitir adição/remoção sem alterar código.
  // ⚠ Substitua pelos REs reais dos operadores Agricef
  RES_AUTORIZADOS: ["1001", "1002", "1003", "1004", "1005"],

  // E-mails globais — recebem TODAS as RNCs (equipe de qualidade)
  EMAILS_NOTIFICACAO: [
    "agricef.qualidade@agricef.com.br",
    // "gestor.qualidade@agricef.com.br",
  ],

  // Mapa setor → e-mail do responsável direto.
  // O responsável do setor afetado recebe o e-mail junto com a equipe de qualidade.
  // Valores aceitos pelo campo "Setor Responsável" no formulário devem bater com as
  // chaves abaixo (case-insensitive na comparação). Deixe "" para setores sem responsável
  // cadastrado ou adicione o e-mail quando souber.
  // ⚠ Substitua pelos e-mails reais dos supervisores Agricef
  RESPONSAVEIS_SETOR: {
    "Usinagem":           "",  // ex: "supervisor.usinagem@agricef.com.br"
    "Montagem":           "",
    "Soldagem":           "",
    "Injeção Plástica":   "",
    "Estamparia":         "",
    "Qualidade":          "",
    "Expedição":          "",
    "Almoxarifado":       "",
    "Manutenção":         "",
    "Externo / Fornecedor": "",
  },

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
 * Recebe ações do app GitHub Pages via fetch POST.
 * Content-Type: text/plain (evita preflight CORS).
 *
 * Ações suportadas:
 *   (sem action / action="criarRNC")  → processarRNC()
 *   action="salvarTratativa"          → salvarTratativa()
 *   action="verificarRNC"             → verificarRNC()
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    let result;

    switch (payload.action) {
      case "salvarTratativa":
        result = salvarTratativa(payload.ticket, payload.dados, payload.fase);
        break;
      case "verificarRNC":
        result = verificarRNC(payload.ticket, payload.aprovado, payload.motivo, payload.responsavel);
        break;
      default: // "criarRNC" ou legado sem action
        result = processarRNC(payload.dados, payload.imagem);
    }

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
    } else if (action === "rncsAbertas") {
      resultado = buscarRNCsAbertas();
    } else if (action === "rnc") {
      const ticket = params.ticket ? params.ticket[0] : null;
      if (!ticket) throw new Error("Parâmetro 'ticket' obrigatório.");
      resultado = buscarDadosRNC(ticket);
    } else if (action === "rncsVerificacao") {
      resultado = buscarRNCsVerificacao();
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

  // 2. Valida tamanho da imagem (apenas se enviada — foto é opcional)
  if (base64Imagem) {
    const tamanhoBytes = Utilities.base64Decode(base64Imagem).length;
    if (tamanhoBytes > CONFIG.MAX_IMG_BASE64_BYTES) {
      throw new Error("Imagem excede 2MB mesmo após compressão. Tire uma nova foto com menos detalhes ou distância maior.");
    }
  }

  // 3. Cria pasta do mês com semáforo anti-race-condition
  const pastaDestino = _garantirPastaMes();

  try {
    // 4. Salva imagem no Drive e obtém URL (se houver foto)
    let blobImagem = null, urlImagem = null;
    if (base64Imagem) {
      const img = _salvarImagem(base64Imagem, dados.codigoItem, pastaDestino);
      blobImagem = img.blobImagem;
      urlImagem  = img.urlImagem;
    }

    // 5. Obtém a URL da pasta do mês para registrar no Jira
    const urlPasta = "https://drive.google.com/drive/folders/" + pastaDestino.getId();

    // 6. Cria ticket no Jira sem URL do PDF (ainda não existe)
    //    Assim o número do ticket fica disponível para o dossiê PDF.
    const ticketKey = _enviarParaJira(dados, null, urlImagem, urlPasta);

    // 7. Gera dossiê PDF com o número do ticket já preenchido no template
    const urlPdf = _gerarPdf(dados, blobImagem, pastaDestino, ticketKey);

    // 8. Atualiza o campo Link do Dossiê PDF no ticket Jira
    _atualizarLinkPdfJira(ticketKey, urlPdf);

    // 9. Envia notificação por e-mail aos responsáveis (assíncrono — não bloqueia)
    try { _notificarResponsaveis(dados, ticketKey, urlPdf, urlPasta); } catch(eNotif) {
      Logger.log("⚠ Notificação e-mail falhou (não crítico): " + eNotif.message);
    }

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
  const { base, cred } = _jiraAuth();

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
  const { base, cred } = _jiraAuth();

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

  // Injeção da imagem no marcador {{FOTO_DEFEITO}} (apenas se houver foto)
  const marcador = corpo.findText("\\{\\{FOTO_DEFEITO\\}\\}");
  if (marcador && blobImagem) {
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
function _enviarParaJira(dados, urlPdf, urlImagem, urlPasta) {
  const { base, cred } = _jiraAuth();

  // Descrição ADF
  const adfContent = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Aberta via Web App pelo RE: ", marks: [{ type: "strong" }] },
        { type: "text", text: String(dados.reOperador) },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Descrição técnica do desvio: ", marks: [{ type: "strong" }] },
        { type: "text", text: String(dados.descricaoDefeito) },
      ],
    },
  ];
  // Adiciona link de foto apenas se houver imagem
  if (urlImagem) {
    adfContent.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Evidência visual (foto): ", marks: [{ type: "strong" }] },
        { type: "text", text: urlImagem, marks: [{ type: "link", attrs: { href: urlImagem } }] },
      ],
    });
  }

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
  // Campos v2 opcionais (podem ser null/undefined se não enviados)
  if (dados.prioridade)    fields[CONFIG.CF.PRIORIDADE] = { value: dados.prioridade };
  if (dados.processo)      fields[CONFIG.CF.PROCESSO]   = { value: dados.processo };
  if (dados.numSerie)      fields[CONFIG.CF.NUM_SERIE]  = dados.numSerie;
  // Só adiciona campos URL se preenchidos (evita erro de campo URL vazio no Jira)
  if (urlPdf)   fields[CONFIG.CF.LINK_PDF]   = urlPdf;
  if (urlPasta) fields[CONFIG.CF.LINK_PASTA] = urlPasta;

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
  const { base, cred } = _jiraAuth();

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


// ── Endpoints de Tratativa e Verificação (Fase 2 e 3) ────────────────────────

/**
 * Lista RNCs abertas/em tratativa para a aba Tratativa do app.
 * Retorna flag `trativadaPreenchida` para o indicador ⏳/✅.
 */
function buscarRNCsAbertas() {
  const { base, cred } = _jiraAuth();
  const jql = `project = ${CONFIG.JIRA_PROJECT} AND status in ("Aberto","Em Análise","Plano de Ação") ORDER BY created DESC`;
  const fields = [
    "key", "summary", "status", "created", "priority",
    CONFIG.CF.SETOR, CONFIG.CF.COD_ITEM, CONFIG.CF.PRIORIDADE,
    CONFIG.CF.CONTENCAO, CONFIG.CF.ACAO_CORRET,
  ].join(",");

  const url = `${base}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${encodeURIComponent(fields)}`;
  const res  = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Basic " + cred }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("Jira API " + res.getResponseCode());

  const json = JSON.parse(res.getContentText());
  return json.issues.map(issue => {
    const f = issue.fields;
    const contencao   = f[CONFIG.CF.CONTENCAO]   || null;
    const acaoCorret  = f[CONFIG.CF.ACAO_CORRET]  || null;
    const prioridade  = f[CONFIG.CF.PRIORIDADE]   ? f[CONFIG.CF.PRIORIDADE].value : "Padrão";
    return {
      ticket:               issue.key,
      resumo:               f.summary,
      status:               f.status ? f.status.name : "—",
      setor:                f[CONFIG.CF.SETOR]    ? f[CONFIG.CF.SETOR].value    : "—",
      codigoItem:           f[CONFIG.CF.COD_ITEM] || "—",
      prioridade,
      dataCriacao:          f.created ? f.created.substring(0, 10) : "—",
      trativadaPreenchida:  !!(contencao && acaoCorret),
    };
  });
}

/**
 * Retorna todos os dados de uma RNC específica para pré-preencher o formulário de tratativa.
 */
function buscarDadosRNC(ticket) {
  const { base, cred } = _jiraAuth();
  const fields = [
    "summary", "description", "status", "created", "priority",
    CONFIG.CF.SETOR, CONFIG.CF.ORIGEM, CONFIG.CF.COD_ITEM,
    CONFIG.CF.QTD_LOTE, CONFIG.CF.QTD_DESVIO, CONFIG.CF.PRIORIDADE,
    CONFIG.CF.PROCESSO, CONFIG.CF.NUM_SERIE, CONFIG.CF.LINK_PDF, CONFIG.CF.LINK_PASTA,
    CONFIG.CF.CONTENCAO, CONFIG.CF.CAUSA_RAIZ, CONFIG.CF.ACAO_CORRET,
    CONFIG.CF.DISPOSICAO, CONFIG.CF.HORAS_RETRAB, CONFIG.CF.CUSTO_SUCATA,
    CONFIG.CF.RESP_NOME, CONFIG.CF.RESP_EMAIL, CONFIG.CF.MOTIVO_DEVOL,
  ].join(",");

  const res = UrlFetchApp.fetch(`${base}/issue/${ticket}?fields=${encodeURIComponent(fields)}`, {
    method: "get", headers: { Authorization: "Basic " + cred }, muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 404) throw new Error("Ticket " + ticket + " não encontrado.");
  if (res.getResponseCode() !== 200) throw new Error("Jira API " + res.getResponseCode());

  const { fields: f, key } = JSON.parse(res.getContentText());

  // Extrai texto da descrição ADF
  let descricaoTexto = "";
  try {
    const doc = f.description;
    if (doc && doc.content) {
      descricaoTexto = doc.content
        .flatMap(b => b.content || [])
        .filter(n => n.type === "text")
        .map(n => n.text)
        .join(" ");
    }
  } catch(e) {}

  return {
    ticket:        key,
    resumo:        f.summary,
    status:        f.status ? f.status.name : "—",
    dataCriacao:   f.created ? f.created.substring(0, 10) : "—",
    setor:         f[CONFIG.CF.SETOR]      ? f[CONFIG.CF.SETOR].value      : "—",
    origem:        f[CONFIG.CF.ORIGEM]     ? f[CONFIG.CF.ORIGEM].value     : "—",
    codigoItem:    f[CONFIG.CF.COD_ITEM]   || "—",
    qtdLote:       f[CONFIG.CF.QTD_LOTE]   || 0,
    qtdDesvio:     f[CONFIG.CF.QTD_DESVIO] || 0,
    prioridade:    f[CONFIG.CF.PRIORIDADE] ? f[CONFIG.CF.PRIORIDADE].value : "Padrão",
    processo:      f[CONFIG.CF.PROCESSO]   ? f[CONFIG.CF.PROCESSO].value   : "—",
    numSerie:      f[CONFIG.CF.NUM_SERIE]  || "",
    descricao:     descricaoTexto,
    urlPdf:        f[CONFIG.CF.LINK_PDF]   || null,
    urlPasta:      f[CONFIG.CF.LINK_PASTA] || null,
    // Tratativa (fase 2)
    contencao:     f[CONFIG.CF.CONTENCAO]    || "",
    causaRaiz:     f[CONFIG.CF.CAUSA_RAIZ]   ? f[CONFIG.CF.CAUSA_RAIZ].value   : "",
    acaoCorretiva: f[CONFIG.CF.ACAO_CORRET]  || "",
    disposicao:    f[CONFIG.CF.DISPOSICAO]   ? f[CONFIG.CF.DISPOSICAO].value   : "",
    horasRetr:     f[CONFIG.CF.HORAS_RETRAB] || null,
    custoSucata:   f[CONFIG.CF.CUSTO_SUCATA] || null,
    respNome:      f[CONFIG.CF.RESP_NOME]    || "",
    respEmail:     f[CONFIG.CF.RESP_EMAIL]   || "",
    motivoDev:     f[CONFIG.CF.MOTIVO_DEVOL] || "",
  };
}

/**
 * Salva a tratativa (contenção + ação corretiva) e transiciona o status.
 * fase = "rascunho" → Em Análise
 * fase = "envio"    → Plano de Ação (aguarda verificação QA)
 */
function salvarTratativa(ticket, dados, fase) {
  const { base, cred } = _jiraAuth();
  const headers = { Authorization: "Basic " + cred };

  // Monta os campos a atualizar
  const fields = {};
  if (dados.contencao)    fields[CONFIG.CF.CONTENCAO]    = dados.contencao;
  if (dados.causaRaiz)    fields[CONFIG.CF.CAUSA_RAIZ]   = { value: dados.causaRaiz };
  if (dados.acaoCorretiva)fields[CONFIG.CF.ACAO_CORRET]  = dados.acaoCorretiva;
  if (dados.disposicao)   fields[CONFIG.CF.DISPOSICAO]   = { value: dados.disposicao };
  if (dados.horasRetr)    fields[CONFIG.CF.HORAS_RETRAB] = parseFloat(dados.horasRetr);
  if (dados.custoSucata)  fields[CONFIG.CF.CUSTO_SUCATA] = parseFloat(dados.custoSucata);
  if (dados.respNome)     fields[CONFIG.CF.RESP_NOME]    = dados.respNome;
  if (dados.respEmail)    fields[CONFIG.CF.RESP_EMAIL]   = dados.respEmail;

  // PUT campos
  const putRes = UrlFetchApp.fetch(`${base}/issue/${ticket}`, {
    method: "put", contentType: "application/json",
    headers, payload: JSON.stringify({ fields }),
    muteHttpExceptions: true,
  });
  if (putRes.getResponseCode() !== 204 && putRes.getResponseCode() !== 200) {
    throw new Error("Erro ao salvar tratativa: " + putRes.getResponseCode() + " " + putRes.getContentText().substring(0, 200));
  }

  // Transiciona status
  const novoStatus = fase === "envio" ? "Plano de Ação" : "Em Análise";
  _transicionarStatus(ticket, novoStatus, base, headers);

  // Se for envio final, notifica QA
  if (fase === "envio") {
    try { _notificarTratativaEnviada(ticket, dados); } catch(e) {
      Logger.log("⚠ Notificação tratativa falhou: " + e.message);
    }
  }

  return { sucesso: true, ticket, status: novoStatus };
}

/**
 * Lista RNCs em "Plano de Ação" para a aba Verificação QA.
 */
function buscarRNCsVerificacao() {
  const { base, cred } = _jiraAuth();
  const jql = `project = ${CONFIG.JIRA_PROJECT} AND status = "Plano de Ação" ORDER BY created ASC`;
  const fields = [
    "key", "summary", "status", "created",
    CONFIG.CF.SETOR, CONFIG.CF.COD_ITEM, CONFIG.CF.PRIORIDADE,
    CONFIG.CF.CONTENCAO, CONFIG.CF.ACAO_CORRET, CONFIG.CF.RESP_NOME,
  ].join(",");

  const url = `${base}/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${encodeURIComponent(fields)}`;
  const res  = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Basic " + cred }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("Jira API " + res.getResponseCode());

  const json = JSON.parse(res.getContentText());
  return json.issues.map(issue => {
    const f = issue.fields;
    return {
      ticket:      issue.key,
      resumo:      f.summary,
      setor:       f[CONFIG.CF.SETOR]    ? f[CONFIG.CF.SETOR].value    : "—",
      codigoItem:  f[CONFIG.CF.COD_ITEM] || "—",
      prioridade:  f[CONFIG.CF.PRIORIDADE] ? f[CONFIG.CF.PRIORIDADE].value : "Padrão",
      dataCriacao: f.created ? f.created.substring(0, 10) : "—",
      respNome:    f[CONFIG.CF.RESP_NOME] || "—",
    };
  });
}

/**
 * Aprova ou devolve uma RNC após verificação da equipe de Qualidade.
 * aprovado = true  → Concluído
 * aprovado = false → Aberto (com motivo de devolução)
 */
function verificarRNC(ticket, aprovado, motivo, responsavel) {
  const { base, cred } = _jiraAuth();
  const headers = { Authorization: "Basic " + cred };

  if (aprovado) {
    _transicionarStatus(ticket, "Concluído", base, headers);
    try { _notificarVerificacao(ticket, true, motivo, responsavel); } catch(e) {}
    return { sucesso: true, ticket, acao: "aprovado" };
  } else {
    if (!motivo) throw new Error("Motivo de devolução obrigatório.");
    // Salva motivo e volta para Aberto
    UrlFetchApp.fetch(`${base}/issue/${ticket}`, {
      method: "put", contentType: "application/json",
      headers, payload: JSON.stringify({ fields: { [CONFIG.CF.MOTIVO_DEVOL]: motivo } }),
      muteHttpExceptions: true,
    });
    _transicionarStatus(ticket, "Aberto", base, headers);
    try { _notificarVerificacao(ticket, false, motivo, responsavel); } catch(e) {}
    return { sucesso: true, ticket, acao: "devolvido" };
  }
}

/**
 * Transiciona o status de um ticket buscando a transição pelo nome.
 * Em projetos Jira Business, todas as transições costumam estar disponíveis.
 */
function _transicionarStatus(ticket, nomeStatus, base, headers) {
  const tRes = UrlFetchApp.fetch(`${base}/issue/${ticket}/transitions`, {
    method: "get", headers, muteHttpExceptions: true,
  });
  if (tRes.getResponseCode() !== 200) {
    Logger.log("⚠ Não foi possível buscar transições de " + ticket);
    return;
  }
  const transitions = JSON.parse(tRes.getContentText()).transitions || [];
  const t = transitions.find(tr => tr.to && tr.to.name === nomeStatus);
  if (!t) {
    Logger.log("⚠ Transição '" + nomeStatus + "' não encontrada para " + ticket +
      ". Disponíveis: " + transitions.map(x => x.to.name).join(", "));
    return;
  }
  UrlFetchApp.fetch(`${base}/issue/${ticket}/transitions`, {
    method: "post", contentType: "application/json",
    headers, payload: JSON.stringify({ transition: { id: t.id } }),
    muteHttpExceptions: true,
  });
  Logger.log("✅ " + ticket + " → " + nomeStatus);
}

/** Extrai credenciais Jira do PropertiesService e retorna { base, cred }. */
function _jiraAuth() {
  const props = PropertiesService.getScriptProperties();
  const base  = props.getProperty("JIRA_URL");
  const email = props.getProperty("JIRA_EMAIL");
  const token = props.getProperty("JIRA_TOKEN");
  return { base, cred: Utilities.base64Encode(email + ":" + token) };
}

/** E-mail para QA quando líder envia a tratativa. */
function _notificarTratativaEnviada(ticket, dados) {
  const jiraUrl = `https://agricef-qualidade.atlassian.net/browse/${ticket}`;
  const dest    = CONFIG.EMAILS_NOTIFICACAO.filter(e => !!e).join(",");
  if (!dest) return;
  GmailApp.sendEmail(dest,
    `[Tratativa Enviada] ${ticket} aguarda Verificação QA`,
    `O líder ${dados.respNome || "—"} enviou a tratativa do ticket ${ticket}.\n\nJira: ${jiraUrl}`,
    {
      name: "Sistema RNC Agricef",
      htmlBody: `<p>O responsável <strong>${dados.respNome || "—"}</strong> (${dados.respEmail || "—"}) preencheu a tratativa do ticket <a href="${jiraUrl}"><strong>${ticket}</strong></a> e enviou para Verificação QA.</p>
      <p><strong>Contenção:</strong> ${(dados.contencao || "—").substring(0, 200)}</p>
      <p><strong>Ação Corretiva:</strong> ${(dados.acaoCorretiva || "—").substring(0, 200)}</p>
      <p><a href="${jiraUrl}" style="background:#1a56a0;color:#fff;padding:10px 18px;border-radius:5px;text-decoration:none;font-weight:bold">🔍 Verificar no Jira</a></p>`,
    }
  );
}

/** E-mail de resultado da verificação QA (aprovado ou devolvido). */
function _notificarVerificacao(ticket, aprovado, motivo, responsavel) {
  const jiraUrl   = `https://agricef-qualidade.atlassian.net/browse/${ticket}`;
  // Busca e-mail do responsável pela tratativa
  const dadosRnc  = buscarDadosRNC(ticket);
  const destLider = dadosRnc.respEmail || "";
  const destQA    = CONFIG.EMAILS_NOTIFICACAO.filter(e => !!e).join(",");
  const todos     = [...new Set([destLider, destQA].filter(e => !!e))].join(",");
  if (!todos) return;

  const assunto = aprovado
    ? `[RNC Concluída] ${ticket} aprovada pela Qualidade ✅`
    : `[RNC Devolvida] ${ticket} devolvida para revisão ⚠`;

  const corpo = aprovado
    ? `<p>A RNC <a href="${jiraUrl}"><strong>${ticket}</strong></a> foi <strong style="color:#1a7a45">aprovada e concluída</strong> pela equipe de Qualidade.</p><p>Verificado por: ${responsavel || "Qualidade"}</p>`
    : `<p>A RNC <a href="${jiraUrl}"><strong>${ticket}</strong></a> foi <strong style="color:#c0392b">devolvida para revisão</strong>.</p>
       <p><strong>Motivo:</strong> ${motivo}</p>
       <p>Por favor, acesse o app e revise a tratativa.</p>`;

  GmailApp.sendEmail(todos, assunto,
    aprovado ? `RNC ${ticket} aprovada.` : `RNC ${ticket} devolvida. Motivo: ${motivo}`,
    { name: "Sistema RNC Agricef", htmlBody: corpo }
  );
}


// ── Notificações por e-mail ───────────────────────────────────────────────────

/**
 * Envia e-mail de notificação para os responsáveis quando uma RNC é aberta.
 * Usa o GmailApp nativo do GAS — não requer configuração adicional.
 */
function _notificarResponsaveis(dados, ticketKey, urlPdf, urlPasta) {
  // Monta lista de destinatários: equipe de qualidade + responsável do setor (sem duplicatas)
  const base = CONFIG.EMAILS_NOTIFICACAO.filter(e => !!e);
  const emailSetor = CONFIG.RESPONSAVEIS_SETOR[dados.setorResponsavel] || "";
  const todos = [...new Set([...base, ...(emailSetor ? [emailSetor] : [])])];
  if (!todos.length) return;

  const jiraUrl  = `https://agricef-qualidade.atlassian.net/browse/${ticketKey}`;
  const dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  const assunto = `[RNC Aberta] ${ticketKey} · ${dados.codigoItem} · ${dados.setorResponsavel}`;

  const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1a56a0;padding:16px 20px;border-radius:6px 6px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">🔴 Nova Não Conformidade Registrada</h2>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">${dataHora}</p>
  </div>
  <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 6px 6px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-weight:bold;width:40%">Ticket Jira</td>
        <td style="padding:8px 12px"><a href="${jiraUrl}" style="color:#1a56a0;font-weight:bold">${ticketKey}</a></td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold">Código do Item / OP</td>
        <td style="padding:8px 12px">${dados.codigoItem}</td></tr>
      <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-weight:bold">Setor Responsável</td>
        <td style="padding:8px 12px">${dados.setorResponsavel}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold">Origem do Item</td>
        <td style="padding:8px 12px">${dados.origemItem}</td></tr>
      <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-weight:bold">Qtd Lote / Desvio</td>
        <td style="padding:8px 12px">${dados.qtdLote} pçs no lote · ${dados.qtdDesvio} com desvio</td></tr>
      <tr><td style="padding:8px 12px;font-weight:bold">Operador (RE)</td>
        <td style="padding:8px 12px">${dados.reOperador}</td></tr>
      <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-weight:bold;vertical-align:top">Descrição</td>
        <td style="padding:8px 12px">${dados.descricaoDefeito}</td></tr>
    </table>
    <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="${jiraUrl}" style="background:#1a56a0;color:#fff;padding:10px 18px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:13px">
        🔗 Ver no Jira
      </a>
      ${urlPdf ? `<a href="${urlPdf}" style="background:#1a7a45;color:#fff;padding:10px 18px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:13px">
        📄 Abrir PDF
      </a>` : ''}
      ${urlPasta ? `<a href="${urlPasta}" style="background:#c47600;color:#fff;padding:10px 18px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:13px">
        📁 Pasta Drive
      </a>` : ''}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#888">
      Sistema de Qualidade Agricef · Mensagem automática · Não responda este e-mail
    </p>
  </div>
</div>`;

  const textBody = `Nova RNC registrada em ${dataHora}\n\n`
    + `Ticket: ${ticketKey}\n`
    + `Código do Item: ${dados.codigoItem}\n`
    + `Setor: ${dados.setorResponsavel}\n`
    + `Origem: ${dados.origemItem}\n`
    + `Qtd Lote / Desvio: ${dados.qtdLote} / ${dados.qtdDesvio}\n`
    + `Operador RE: ${dados.reOperador}\n`
    + `Descrição: ${dados.descricaoDefeito}\n\n`
    + `Jira: ${jiraUrl}\n`
    + (urlPdf   ? `PDF:   ${urlPdf}\n`   : '')
    + (urlPasta ? `Pasta: ${urlPasta}\n` : '');

  GmailApp.sendEmail(
    todos.join(','),
    assunto,
    textBody,
    { htmlBody, name: 'Sistema RNC Agricef' }
  );

  Logger.log(`📧 Notificação enviada para: ${todos.join(', ')}`);
}
