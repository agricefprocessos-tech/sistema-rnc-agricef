// ============================================================
// AGRICEF — Setup.gs
// Execute as funções abaixo UMA VEZ no editor do Apps Script
// para configurar o ambiente completo sem precisar copiar IDs.
//
// ORDEM DE EXECUÇÃO:
//   1. configurarPropriedades()  — define as credenciais Jira
//   2. criarTemplateRNC()        — cria o Doc template no Drive
//   3. verificarSetup()          — valida toda a configuração
// ============================================================


/**
 * PASSO 1 — Define as credenciais Jira no PropertiesService.
 *
 * COMO USAR:
 *   1. Preencha os 3 valores abaixo com suas credenciais reais
 *   2. Clique em Executar (▶) com esta função selecionada
 *   3. Apague os valores após executar (ou deixe como estão — o GAS
 *      não expõe o código-fonte via Web App)
 */
function configurarPropriedades() {
  const props = PropertiesService.getScriptProperties();

  const JIRA_URL   = "https://agricef-qualidade.atlassian.net/rest/api/3";
  const JIRA_EMAIL = "agricef.qualidade@agricef.com.br";
  const JIRA_TOKEN = "COLE_AQUI_O_NOVO_TOKEN_JIRA";

  props.setProperties({
    JIRA_URL,
    JIRA_EMAIL,
    JIRA_TOKEN,
  });

  Logger.log("✅ Propriedades Jira configuradas com sucesso.");
  Logger.log("   JIRA_URL   : " + JIRA_URL);
  Logger.log("   JIRA_EMAIL : " + JIRA_EMAIL);
  Logger.log("   JIRA_TOKEN : (definido — " + JIRA_TOKEN.length + " caracteres)");
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
