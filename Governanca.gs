// ============================================================
// AGRICEF — Governanca.gs
// Gera os documentos do Sistema de Gestão da Qualidade (SGQ)
// como Google Docs na pasta do sistema no Drive.
//
// Execute: criarDocumentosGovernanca()
// ============================================================

/**
 * Ponto de entrada: cria todos os 6 documentos de governança.
 * Os documentos são gerados na subpasta "Governança SGQ" dentro
 * da pasta raiz do sistema (FOLDER_ID no PropertiesService).
 */
function criarDocumentosGovernanca() {
  const props    = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("FOLDER_ID");
  if (!folderId) {
    Logger.log("⚠ FOLDER_ID não encontrado. Execute configurarPropriedades() primeiro.");
    return;
  }

  const raiz      = DriveApp.getFolderById(folderId);
  const subNome   = "Governança SGQ";
  const iterador  = raiz.getFoldersByName(subNome);
  const pasta     = iterador.hasNext() ? iterador.next() : raiz.createFolder(subNome);

  Logger.log(`📁 Pasta: "${subNome}" — ${pasta.getUrl()}`);
  Logger.log("Gerando documentos...\n");

  const docs = [
    _docPQ01(pasta),
    _docPQ02(pasta),
    _docPQ03(pasta),
    _docPQ04(pasta),
    _docPQ05(pasta),
    _docPQ06(pasta),
  ];

  Logger.log("\n✅ Todos os documentos criados:");
  docs.forEach(d => Logger.log(`   ${d.titulo} → ${d.url}`));
  Logger.log(`\n📁 Pasta: ${pasta.getUrl()}`);
}

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS DE FORMATAÇÃO
// ─────────────────────────────────────────────────────────────

function _novoDoc(pasta, codigo, titulo) {
  const nomeCompleto = `${codigo} · ${titulo}`;
  const doc  = DocumentApp.create(nomeCompleto);
  const file = DriveApp.getFileById(doc.getId());
  // Move para a pasta correta (remove de "Meu Drive" raiz)
  pasta.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  Logger.log(`  📄 Criando: ${nomeCompleto}`);
  return doc;
}

function _cabecalho(body, codigo, titulo, revisao, data, elaborado, aprovado) {
  // Título do documento
  const tituloP = body.appendParagraph("AGRICEF EQUIPAMENTOS AGRÍCOLAS");
  tituloP.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  tituloP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  tituloP.editAsText().setFontSize(14).setBold(true).setForegroundColor("#1a56a0");

  const subP = body.appendParagraph("Sistema de Gestão da Qualidade");
  subP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subP.editAsText().setFontSize(11).setItalic(true).setForegroundColor("#555555");

  body.appendParagraph("").setSpacingAfter(4);

  // Tabela de identificação do documento
  const tabId = body.appendTable([
    ["Código", codigo,   "Revisão", revisao],
    ["Título", titulo,   "Data",    data   ],
    ["Elaborado por", elaborado, "Aprovado por", aprovado],
  ]);
  tabId.setColumnWidth(0, 100); tabId.setColumnWidth(2, 100);
  for (let r = 0; r < tabId.getNumRows(); r++) {
    for (let c = 0; c < tabId.getRow(r).getNumCells(); c++) {
      const cell = tabId.getCell(r, c);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
      const txt = cell.editAsText();
      if (c % 2 === 0) { // colunas de label
        txt.setBold(true).setForegroundColor("#1a56a0");
        cell.setBackgroundColor("#e8f0fb");
      }
      txt.setFontSize(10);
    }
  }

  _divisor(body);
}

function _divisor(body) {
  const p = body.appendParagraph("─".repeat(90));
  p.editAsText().setFontSize(6).setForegroundColor("#cccccc");
  p.setSpacingBefore(4).setSpacingAfter(4);
}

function _h2(body, texto) {
  const p = body.appendParagraph(texto);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  p.editAsText().setFontSize(12).setBold(true).setForegroundColor("#1a56a0");
  p.setSpacingBefore(14).setSpacingAfter(4);
  return p;
}

function _h3(body, texto) {
  const p = body.appendParagraph(texto);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING3);
  p.editAsText().setFontSize(11).setBold(true).setForegroundColor("#333333");
  p.setSpacingBefore(10).setSpacingAfter(2);
  return p;
}

function _p(body, texto) {
  const p = body.appendParagraph(texto);
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  p.editAsText().setFontSize(10).setForegroundColor("#222222");
  p.setSpacingAfter(4).setIndentStart(0);
  return p;
}

function _item(body, texto) {
  const p = body.appendParagraph(texto);
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  p.setIndentStart(24);
  p.editAsText().setFontSize(10);
  p.setSpacingAfter(2);
  return p;
}

function _tabela(body, cabecalho, linhas) {
  const todas = [cabecalho, ...linhas];
  const tab = body.appendTable(todas);
  // Formata cabeçalho
  const row0 = tab.getRow(0);
  for (let c = 0; c < row0.getNumCells(); c++) {
    const cell = row0.getCell(c);
    cell.setBackgroundColor("#1a56a0");
    cell.editAsText().setFontSize(10).setBold(true).setForegroundColor("#ffffff");
    cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
  }
  // Formata corpo
  for (let r = 1; r < tab.getNumRows(); r++) {
    const cor = r % 2 === 0 ? "#f0f4fa" : "#ffffff";
    for (let c = 0; c < tab.getRow(r).getNumCells(); c++) {
      const cell = tab.getCell(r, c);
      cell.setBackgroundColor(cor);
      cell.editAsText().setFontSize(10).setForegroundColor("#222222");
    }
  }
  body.appendParagraph("").setSpacingAfter(6);
  return tab;
}

function _rodape(body, codigo) {
  _divisor(body);
  const p = body.appendParagraph(
    `${codigo} · Documento controlado. Impressões são cópias não controladas. ` +
    `Verifique a versão vigente no sistema de gestão da Agricef.`
  );
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p.editAsText().setFontSize(8).setItalic(true).setForegroundColor("#888888");
}

// ─────────────────────────────────────────────────────────────
// PQ-01 — POLÍTICA DA QUALIDADE
// ─────────────────────────────────────────────────────────────
function _docPQ01(pasta) {
  const cod   = "PQ-01";
  const titulo = "Política da Qualidade";
  const doc   = _novoDoc(pasta, cod, titulo);
  const body  = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade", "Direção Geral");

  _h2(body, "1. Propósito");
  _p(body, "Este documento estabelece os princípios e compromissos da Agricef Equipamentos Agrícolas com a qualidade dos seus produtos, processos e serviços, alinhados aos requisitos da norma ABNT NBR ISO 9001:2015.");

  _h2(body, "2. Declaração de Política");
  _p(body, "A Agricef tem como missão desenvolver e fornecer equipamentos agrícolas que superem as expectativas dos clientes em desempenho, durabilidade e segurança. Para isso, assumimos os seguintes compromissos:");
  _item(body, "a) Atender plenamente os requisitos dos clientes e os requisitos legais e regulatórios aplicáveis aos nossos produtos.");
  _item(body, "b) Prevenir não conformidades por meio do controle rigoroso de processos de fabricação, inspeção e fornecimento.");
  _item(body, "c) Promover a melhoria contínua do Sistema de Gestão da Qualidade (SGQ), revisando periodicamente indicadores, processos e resultados.");
  _item(body, "d) Capacitar e engajar os colaboradores, garantindo que cada pessoa compreenda seu papel na qualidade do produto final.");
  _item(body, "e) Estabelecer parcerias com fornecedores que compartilhem dos mesmos valores de qualidade e melhoria contínua.");
  _item(body, "f) Registrar, analisar e tratar todas as Não Conformidades (RNCs) de forma sistemática, com ações corretivas que eliminem as causas raiz.");

  _h2(body, "3. Objetivos da Qualidade");
  _p(body, "Os objetivos da qualidade são definidos anualmente pela Direção na Revisão pelo Sistema de Gestão e devem ser mensuráveis e coerentes com esta política. Como referência, os principais indicadores monitorados são:");
  _tabela(body,
    ["Indicador", "Meta", "Frequência de Revisão"],
    [
      ["Taxa de RNCs por lote produzido", "< 2%", "Mensal"],
      ["Taxa de reincidência de causa raiz", "< 10%", "Trimestral"],
      ["Lead time médio de fechamento de RNC (Padrão)", "≤ 7 dias úteis", "Mensal"],
      ["Lead time médio de fechamento de RNC (Emergência)", "≤ 24 horas", "Semanal"],
      ["Índice de aprovação de fornecedores críticos", "> 85%", "Trimestral"],
      ["Satisfação do cliente (reclamações pós-venda)", "0 recorrências", "Mensal"],
    ]
  );

  _h2(body, "4. Responsabilidades");
  _tabela(body,
    ["Papel", "Responsabilidade"],
    [
      ["Direção Geral",          "Aprovar esta política, prover recursos e participar da Revisão pela Direção."],
      ["Representante da Qualidade (RQ)", "Manter, divulgar e auditar o SGQ. Reportar desempenho à Direção."],
      ["Líderes de Setor",       "Garantir a conformidade dos processos, preencher tratativas de RNC no prazo."],
      ["Operadores",             "Registrar não conformidades identificadas durante a produção ou recebimento."],
      ["Compras / Suprimentos",  "Qualificar fornecedores e tratar desvios de recebimento junto aos fornecedores."],
    ]
  );

  _h2(body, "5. Comunicação e Revisão");
  _p(body, "Esta política é comunicada a todos os colaboradores na integração e está disponível no sistema de gestão da Agricef. É revisada anualmente ou sempre que ocorrer mudança significativa no contexto da organização, nos requisitos de clientes ou na estrutura organizacional.");
  _p(body, "Revisão periódica: anual, conduzida na Reunião de Revisão pela Direção (ver PQ-06).");

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}

// ─────────────────────────────────────────────────────────────
// PQ-02 — PROCEDIMENTO DE CONTROLE DE RNC
// ─────────────────────────────────────────────────────────────
function _docPQ02(pasta) {
  const cod    = "PQ-02";
  const titulo = "Procedimento de Controle de Não Conformidades";
  const doc    = _novoDoc(pasta, cod, titulo);
  const body   = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade", "Direção Geral");

  _h2(body, "1. Objetivo");
  _p(body, "Estabelecer o método padronizado para identificação, registro, análise de causa, tratativa e verificação de Não Conformidades (RNCs) detectadas nos processos produtivos, de recebimento e de campo da Agricef, garantindo rastreabilidade, prazo e eficácia das ações corretivas.");

  _h2(body, "2. Escopo");
  _p(body, "Aplica-se a todos os desvios de qualidade identificados por operadores, inspetores, líderes, equipe de compras ou clientes, independentemente do processo ou setor de origem, incluindo:");
  _item(body, "• Inspeção de recebimento de materiais e componentes de fornecedores externos");
  _item(body, "• Processos internos de fabricação (usinagem, caldeiraria, soldagem, dobra, montagem, pintura)");
  _item(body, "• Inspeção final e testes funcionais");
  _item(body, "• Reclamações e devoluções de clientes (campo / pós-venda)");

  _h2(body, "3. Definições");
  _tabela(body,
    ["Termo", "Definição"],
    [
      ["Não Conformidade (NC)", "Não atendimento a um requisito especificado (dimensional, funcional, visual, documental ou de segurança)."],
      ["RNC",                  "Registro de Não Conformidade. Documento eletrônico gerado no sistema SGQ da Agricef (Jira)."],
      ["Ação de Contenção",    "Medida imediata para isolar ou neutralizar o impacto da NC antes da análise de causa."],
      ["Causa Raiz",           "Causa fundamental cuja eliminação impede a reocorrência da NC. Identificada pelos 5 Porquês / Ishikawa."],
      ["Ação Corretiva",       "Ação que elimina a causa raiz e previne a reocorrência da NC."],
      ["Disposição",           "Decisão sobre o destino do item não conforme: retrabalho, sucata, concessão, devolução ou aprovação."],
      ["SLA",                  "Acordo de Nível de Serviço. Prazo máximo para conclusão de cada etapa do fluxo de RNC."],
      ["Emergência",           "RNC que implica parada de linha, risco à segurança do operador ou iminente atraso de entrega ao cliente."],
    ]
  );

  _h2(body, "4. Fluxo do Processo");
  _h3(body, "4.1 Visão Geral do Fluxo");
  _tabela(body,
    ["Etapa", "Status no Sistema", "Responsável", "SLA Padrão", "SLA Emergência"],
    [
      ["1. Abertura",          "Aberto",         "Operador / Inspector", "—",           "—"],
      ["2. Análise inicial",   "Em Análise",     "Líder de Setor",       "D+1",         "2 horas"],
      ["3. Tratativa",         "Plano de Ação",  "Líder de Setor",       "7 dias úteis","24 horas"],
      ["4. Verificação QA",    "Verificação QA", "Qualidade",            "3 dias úteis","8 horas"],
      ["5. Encerramento",      "Concluído",      "Qualidade",            "—",           "—"],
      ["5b. Devolução",        "Aberto",         "Qualidade → Líder",    "—",           "—"],
    ]
  );

  _h3(body, "4.2 Etapa 1 — Abertura da RNC");
  _p(body, "O operador ou inspetor que identificar o desvio deve abrir a RNC no sistema SGQ (https://agricefprocessos-tech.github.io/sistema-rnc-agricef/) imediatamente após a detecção, sem aguardar autorização.");
  _p(body, "Informações obrigatórias na abertura:");
  _item(body, "• RE do operador (matrícula de identificação)");
  _item(body, "• Setor responsável pela geração do desvio");
  _item(body, "• Processo inspecionado (soldagem, usinagem, montagem, etc.)");
  _item(body, "• Código do item / OP");
  _item(body, "• Quantidade total do lote e quantidade com desvio");
  _item(body, "• Descrição detalhada do desvio (o que está errado, onde, como foi detectado)");
  _item(body, "• Prioridade: Padrão ou Emergência");
  _item(body, "• Evidência fotográfica (obrigatória para Emergências, fortemente recomendada nos demais)");
  _p(body, "Ao registrar, o sistema gera automaticamente: número do ticket (SGQ-X), PDF do relatório, e-mail de notificação para o setor responsável e para a equipe de Qualidade.");

  _h3(body, "4.3 Etapa 2 — Análise Inicial (Em Análise)");
  _p(body, "O líder do setor é notificado por e-mail com o link direto para a tratativa. Deve:");
  _item(body, "• Confirmar a não conformidade fisicamente");
  _item(body, "• Isolar o lote afetado (área de quarentena com identificação visual vermelha)");
  _item(body, "• Definir se a prioridade deve ser alterada para Emergência");
  _item(body, "• Iniciar o preenchimento da tratativa (pode salvar rascunho e editar depois)");

  _h3(body, "4.4 Etapa 3 — Tratativa / Plano de Ação");
  _p(body, "O líder preenche a tratativa completa no sistema. Campos obrigatórios para envio à QA:");
  _item(body, "• Ação de contenção: o que foi feito imediatamente com o material não conforme");
  _item(body, "• Causa raiz (categoria Ishikawa): Mão de Obra / Máquina / Método / Material / Medição / Meio Ambiente");
  _item(body, "• Descrição da causa raiz (5 Porquês): encadeamento lógico até a causa fundamental");
  _item(body, "• Ação corretiva definitiva: mudança no processo para prevenir reocorrência");
  _item(body, "• Disposição da peça: Retrabalho / Sucata / Devolução ao Fornecedor / Concessão / Aprovado");
  _item(body, "• Horas de retrabalho e custo estimado de sucateamento (quando aplicável)");
  _p(body, "Ao clicar em 'Enviar para Verificação QA', o status muda para 'Plano de Ação' e a equipe de QA é notificada.");

  _h3(body, "4.5 Etapa 4 — Verificação QA");
  _p(body, "O inspetor / analista de qualidade verifica:");
  _item(body, "• A causa raiz identificada é plausível e suficientemente profunda?");
  _item(body, "• A ação corretiva proposta elimina de fato a causa raiz?");
  _item(body, "• A disposição da peça é adequada e foi executada?");
  _item(body, "• Há evidências de que a ação foi implementada ou há prazo claro para implementação?");
  _p(body, "Decisões possíveis:");
  _item(body, "• ✅ Aprovar → status muda para 'Concluído'. E-mail enviado ao líder e ao sistema.");
  _item(body, "• ↩ Devolver → status retorna para 'Aberto'. E-mail enviado ao líder com o motivo detalhado da devolução. SLA reinicia.");

  _h3(body, "4.6 Critérios de Rejeição na Verificação QA");
  _tabela(body,
    ["Situação", "Ação"],
    [
      ["Causa raiz rasa ('erro do operador' sem investigação)", "Devolver — exigir 5 Porquês completo"],
      ["Ação corretiva genérica ('treinar operadores') sem plano", "Devolver — exigir plano com prazo e responsável"],
      ["Disposição da peça não executada e sem prazo", "Devolver — exigir comprovação ou prazo formal"],
      ["Reincidência da mesma causa raiz no mesmo setor", "Devolver + escalar para Direção (ver PQ-04)"],
      ["Emergência sem ação de contenção documentada", "Devolver imediatamente"],
    ]
  );

  _h2(body, "5. Identificação e Segregação de Material NC");
  _p(body, "Todo material identificado como não conforme deve ser fisicamente segregado e identificado com etiqueta vermelha padrão 'MATERIAL NÃO CONFORME — AGUARDANDO DISPOSIÇÃO', contendo: número do ticket RNC, data, setor, responsável pela segregação. O material só pode ser movimentado com autorização da Qualidade.");

  _h2(body, "6. Reincidência");
  _p(body, "Se a mesma causa raiz ou tipo de desvio ocorrer 3 vezes no mesmo setor em um período de 90 dias, a Qualidade deve:");
  _item(body, "a) Convocar reunião com o líder do setor e a Direção.");
  _item(body, "b) Exigir revisão do processo / instrução de trabalho com evidência de atualização.");
  _item(body, "c) Aumentar a frequência de inspeção no processo por 30 dias.");
  _item(body, "d) Registrar o evento na ata da próxima Revisão pela Direção (PQ-06).");

  _h2(body, "7. Registros");
  _tabela(body,
    ["Registro", "Local", "Retenção"],
    [
      ["Tickets RNC (SGQ-X)", "Jira Cloud (agricef-qualidade.atlassian.net)", "Indefinido"],
      ["Relatório PDF de cada RNC", "Google Drive — pasta do mês", "5 anos"],
      ["Relatório mensal de qualidade", "Google Drive — Governança SGQ", "5 anos"],
      ["Ata de Revisão pela Direção", "Google Drive — Governança SGQ", "5 anos"],
    ]
  );

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}

// ─────────────────────────────────────────────────────────────
// PQ-03 — CRITÉRIOS DE INSPEÇÃO POR PROCESSO
// ─────────────────────────────────────────────────────────────
function _docPQ03(pasta) {
  const cod    = "PQ-03";
  const titulo = "Critérios de Inspeção por Processo";
  const doc    = _novoDoc(pasta, cod, titulo);
  const body   = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade", "Direção Geral");

  _h2(body, "1. Objetivo");
  _p(body, "Definir os critérios de inspeção — tipo, frequência e tamanho de amostra — para cada processo produtivo da Agricef, garantindo que as inspeções sejam proporcionais ao risco, ao histórico de qualidade e à criticidade do item para o produto final.");
  _p(body, "Nota: Os critérios de amostragem são regras de governança da qualidade e não fazem parte do formulário de abertura de RNC. Uma RNC deve ser aberta sempre que um desvio for detectado, independentemente de como a inspeção foi conduzida.");

  _h2(body, "2. Classificação de Defeitos");
  _tabela(body,
    ["Classe", "Definição", "Exemplos", "Ação imediata"],
    [
      ["Crítico (CR)", "Compromete segurança, função principal ou conformidade legal.", "Falha estrutural, risco de acidente, vazamento hidráulico crítico", "Parar lote. RNC Emergência. Acionar Direção."],
      ["Maior (MA)",   "Compromete funcionalidade ou uso do produto sem risco imediato.", "Solda fora de especificação, peça dimensional fora de tolerância", "Segregar lote. RNC Padrão. Inspeção 100%."],
      ["Menor (ME)",   "Desvio que não afeta função nem segurança.", "Acabamento, pequeno risco visual, marcação fora de posição tolerável", "Registrar. Avaliar concessão se aplicável."],
    ]
  );

  _h2(body, "3. Critérios por Processo");

  _h3(body, "3.1 Recebimento de Materiais Externos");
  _p(body, "Aplica-se a matérias-primas, componentes comprados e serviços externos (usinagem terceirizada, tratamento superficial, etc.).");
  _tabela(body,
    ["Tipo de Item", "Plano de Inspeção", "Tamanho de Amostra", "Critério de Aceitação"],
    [
      ["Materiais estruturais (chapas, perfis, tubos)", "Dimensional + visual + certificado de material", "5% do lote (mín. 3 pças)", "0 defeitos CR/MA; ≤1 ME"],
      ["Componentes usinados / torneados", "Dimensional 100% para itens críticos; amostra para demais", "10% (mín. 5 pças) ou 100% se CR", "0 defeitos CR/MA"],
      ["Parafusos, fixadores, elementos normalizados", "Visual + dimensional por amostra", "3% do lote (mín. 5 pças)", "0 defeitos CR; ≤2% MA"],
      ["Serviços externos (tratamento térmico, pintura externa)", "Inspeção no recebimento + análise do laudo do fornecedor", "10% das peças tratadas", "Conforme especificação do pedido"],
    ]
  );

  _h3(body, "3.2 Caldeiraria e Corte");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Dimensional (comprimento, ângulo, folga)", "100% para peças críticas; 1ª e última + 10% para séries", "Dentro da tolerância do desenho"],
      ["Visual (rebarba, amassado, marca de corte)", "100%", "0 defeitos CR; rebarba removida"],
      ["Verificação de material (espessura, tipo)", "Por lote de material / corrida", "Conforme especificação e certificado"],
    ]
  );

  _h3(body, "3.3 Dobra e Estamparia");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Ângulo de dobra", "1ª peça + a cada 20 peças", "±1° da especificação (ou conforme desenho)"],
      ["Dimensional geral", "1ª peça + 10% do lote", "Dentro da tolerância do desenho"],
      ["Visual (trinca, marcas)", "100%", "0 trincas; marcas superficiais conforme critério visual padrão"],
      ["Gabarito de verificação", "1ª peça após ajuste de ferramenta", "Aprovado antes de iniciar série"],
    ]
  );

  _h3(body, "3.4 Soldagem");
  _p(body, "Soldagem é processo especial — o resultado não pode ser totalmente verificado após a execução sem ensaios destrutivos ou END. A qualidade é garantida principalmente pelo controle do processo (soldador qualificado, procedimento de soldagem, parâmetros controlados).");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Visual de cordão (porosidade, respingo, cratera, mordedura)", "100%", "Conforme AWS D1.1 ou norma aplicável. 0 defeitos CR."],
      ["Dimensional pós-solda (empeno, posição)", "100% em conjuntos críticos; 20% nos demais", "Dentro da tolerância do gabarito"],
      ["Inspeção com líquido penetrante (LP)", "Soldas críticas estruturais — por amostragem definida pelo RQ", "0 indicações relevantes"],
      ["Verificação de qualificação do soldador", "Por contratação e anualmente", "CQS (Certificação de Qualificação de Soldador) válida"],
    ]
  );

  _h3(body, "3.5 Usinagem");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Dimensional (diâmetro, comprimento, rosca, tolerâncias)", "1ª peça + a cada 10 peças ou troca de ferramenta", "Dentro das tolerâncias do desenho"],
      ["Acabamento superficial (rugosidade)", "Por amostragem quando especificado", "Ra conforme desenho"],
      ["Visual (rebarbas, marcas)", "100%", "Sem rebarbas; marcas conforme critério visual"],
    ]
  );

  _h3(body, "3.6 Montagem e Teste Final");
  _p(body, "Toda máquina ou equipamento deve passar pela inspeção final antes de ser liberado para expedição. Esta é a última barreira antes do cliente.");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Check-list de montagem (itens, torques, conexões)", "100% — todo equipamento", "Todos os itens do check-list OK e assinados"],
      ["Teste funcional (operação em vazio e sob carga)", "100% — todo equipamento", "Funciona conforme especificação técnica do produto"],
      ["Visual geral (pintura, identificação, etiquetas)", "100%", "Conforme padrão de acabamento Agricef"],
      ["Verificação de documentação (manual, certificados)", "100%", "Documentação completa e correta"],
      ["Rastreabilidade (Nº de série gravado / plaqueta)", "100%", "Nº de série aplicado e registrado no sistema"],
    ]
  );

  _h3(body, "3.7 Pintura");
  _tabela(body,
    ["Inspeção", "Frequência", "Critério"],
    [
      ["Espessura de tinta (medidor de espessura)", "3 pontos por peça em lotes críticos; amostra nos demais", "Conforme especificação (ex: ≥80 µm)"],
      ["Aderência (risco em X, fita adesiva)", "Por lote ou início de turno", "Nota ≥ 4 conforme ISO 2409"],
      ["Visual (bolha, escorrimento, falha de cobertura, cor)", "100%", "0 defeitos CR/MA; defeitos ME conforme critério visual aprovado"],
      ["Verificação de pré-tratamento (fosfatização, jato)", "Por lote antes de pintar", "Conforme procedimento de pré-tratamento"],
    ]
  );

  _h2(body, "4. Inspeção 100% — Quando Acionar");
  _p(body, "Além dos casos já indicados acima, a inspeção 100% deve ser acionada sempre que:");
  _item(body, "• O processo apresentar RNC com defeito CR ou MA nas últimas 2 semanas.");
  _item(body, "• Houver troca de fornecedor, ferramenta ou lote de material.");
  _item(body, "• O lote for destinado a um cliente estratégico ou pedido crítico de prazo.");
  _item(body, "• A Qualidade ou Direção determinar por critério de risco.");
  _item(body, "• O equipamento for o primeiro de um novo modelo (lote piloto).");

  _h2(body, "5. Qualificação de Inspetores");
  _p(body, "Somente colaboradores treinados e avaliados pela Qualidade podem realizar inspeções formais e liberar lotes. O treinamento inclui: leitura de desenho técnico, uso de instrumentos de medição, critérios de defeito e uso do sistema SGQ.");

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}

// ─────────────────────────────────────────────────────────────
// PQ-04 — MATRIZ DE ESCALAÇÃO E SLA
// ─────────────────────────────────────────────────────────────
function _docPQ04(pasta) {
  const cod    = "PQ-04";
  const titulo = "Matriz de Escalação e SLA de RNC";
  const doc    = _novoDoc(pasta, cod, titulo);
  const body   = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade", "Direção Geral");

  _h2(body, "1. Objetivo");
  _p(body, "Definir os prazos máximos (SLA — Service Level Agreement) para cada etapa do fluxo de RNC e estabelecer a cadeia de escalação quando esses prazos são descumpridos ou quando a severidade da não conformidade exige envolvimento de níveis hierárquicos superiores.");

  _h2(body, "2. Definição de Prioridades");
  _tabela(body,
    ["Prioridade", "Critérios de Classificação", "Quem pode classificar"],
    [
      ["🔴 Emergência", "Parada total ou parcial de linha de produção\nRisco à segurança do operador ou usuário\nAtraso iminente de entrega a cliente com contrato de prazo\nDefeito crítico (CR) identificado em equipamento já expedido", "Operador, Líder, Qualidade ou Direção"],
      ["🟢 Padrão",     "Todos os demais desvios de qualidade que não se enquadram nos critérios de Emergência", "Operador ou Inspetor"],
    ]
  );
  _p(body, "Qualquer colaborador pode elevar a prioridade de Padrão para Emergência. Apenas a Qualidade ou Direção pode reclassificar de Emergência para Padrão, após análise.");

  _h2(body, "3. SLA por Etapa");
  _tabela(body,
    ["Etapa", "Responsável", "SLA Padrão", "SLA Emergência", "O que acontece se vencer"],
    [
      ["Abertura da RNC",          "Operador / Inspetor", "No ato da detecção", "No ato da detecção", "Qualidade abre a RNC em nome do setor e registra ocorrência"],
      ["Contenção inicial (isolar lote)", "Líder de Setor", "Até D+1",     "Até 2 horas",     "Qualidade aciona Direção"],
      ["Preenchimento da tratativa completa", "Líder de Setor", "7 dias úteis", "24 horas",  "1ª escalação: Qualidade contata líder. 2ª (D+2): Gerência de Produção. 3ª (D+4): Direção."],
      ["Verificação QA",           "Qualidade",    "3 dias úteis", "8 horas",          "Gerência de Qualidade assume a verificação diretamente"],
      ["Resposta do Fornecedor (SCAR)", "Compras / Fornecedor", "10 dias corridos", "48 horas", "Compras aplica penalidade e registra no histórico do fornecedor (PQ-05)"],
    ]
  );

  _h2(body, "4. Matriz de Escalação");
  _h3(body, "4.1 Escalação por Vencimento de SLA");
  _tabela(body,
    ["Situação", "Nível 1 (automático)", "Nível 2 (+2 dias)", "Nível 3 (+4 dias)"],
    [
      ["Tratativa não enviada — Padrão",      "E-mail automático ao Líder",      "Qualidade contata pessoalmente o Líder + e-mail ao Gerente de Produção", "Direção é notificada. Meta do setor impactada."],
      ["Tratativa não enviada — Emergência",  "E-mail automático ao Líder + QA", "Direção notificada em 2 horas",  "Reunião de crise convocada em 4 horas"],
      ["Verificação QA vencida",              "E-mail ao analista de QA",        "Gerência de QA assume",          "Direção de QA resolve"],
    ]
  );

  _h3(body, "4.2 Escalação por Severidade");
  _tabela(body,
    ["Gatilho", "Ação de escalação"],
    [
      ["Defeito CR identificado em qualquer processo",           "Notificar Direção imediatamente. Parar lote. Investigação obrigatória em 24h."],
      ["Defeito em equipamento já entregue ao cliente",          "Acionar pós-venda e Direção em até 2 horas. Avaliar recall/substituição."],
      ["3 RNCs do mesmo tipo em 90 dias no mesmo setor",         "Reunião de causa raiz com Gerência de Produção + Qualidade. Revisão de processo."],
      ["Rejeição de SCAR pelo fornecedor ou prazo vencido",      "Compras aplica penalidade. Avalia suspensão temporária do fornecedor (PQ-05)."],
      ["RNC com custo de sucata > R$ 5.000",                     "Relatar à Direção na semana corrente. Incluir na Revisão pela Direção."],
      ["Taxa mensal de RNCs ultrapassa meta de 2%",              "Reunião extraordinária de qualidade. Plano de ação setorial com prazo de 30 dias."],
    ]
  );

  _h2(body, "5. Responsabilidades na Escalação");
  _tabela(body,
    ["Papel", "Responsabilidade"],
    [
      ["Sistema SGQ",              "Registrar datas e prazos automaticamente. Fornecer dados para monitoramento."],
      ["Qualidade (analista)",     "Monitorar diariamente as RNCs abertas e os prazos vencidos. Executar nível 1 de escalação."],
      ["Gerência de Qualidade",    "Executar nível 2. Convocar reuniões de causa raiz. Reportar à Direção."],
      ["Gerência de Produção",     "Garantir que líderes cumpram os SLAs. Cobrar tratativas em aberto na equipe."],
      ["Direção",                  "Receber escalações de nível 3. Tomar decisões sobre suspensão de fornecedores, revisão de metas e recursos."],
    ]
  );

  _h2(body, "6. Monitoramento");
  _p(body, "O Painel de Qualidade do sistema SGQ (aba 'Painel') exibe em tempo real as RNCs abertas, os lead times e os casos que ultrapassaram SLA. O Representante da Qualidade revisa esses dados diariamente e apresenta o consolidado na Reunião de Qualidade semanal.");

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}

// ─────────────────────────────────────────────────────────────
// PQ-05 — GESTÃO DE FORNECEDORES (SCAR)
// ─────────────────────────────────────────────────────────────
function _docPQ05(pasta) {
  const cod    = "PQ-05";
  const titulo = "Gestão de Fornecedores e SCAR";
  const doc    = _novoDoc(pasta, cod, titulo);
  const body   = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade / Compras", "Direção Geral");

  _h2(body, "1. Objetivo");
  _p(body, "Estabelecer o processo de qualificação, avaliação e desenvolvimento de fornecedores da Agricef, incluindo o tratamento formal de não conformidades de origem externa por meio do Supplier Corrective Action Request (SCAR — Solicitação de Ação Corretiva ao Fornecedor).");

  _h2(body, "2. Classificação de Fornecedores");
  _tabela(body,
    ["Classe", "Critério", "Controle aplicável"],
    [
      ["Crítico (A)",   "Fornece itens que impactam diretamente a segurança ou função principal do produto. Sem alternativa de curto prazo.", "Qualificação obrigatória, auditorias periódicas, certificados por lote, SCAR obrigatório em qualquer NC."],
      ["Importante (B)","Fornece itens relevantes para a qualidade do produto mas com alternativas de mercado.", "Inspeção por amostragem no recebimento, avaliação semestral de desempenho, SCAR para NC MA/CR."],
      ["Normal (C)",    "Fornece materiais ou serviços de baixo impacto na qualidade final.", "Inspeção visual no recebimento. Avaliação anual. SCAR apenas para reincidências."],
    ]
  );

  _h2(body, "3. Qualificação de Novos Fornecedores");
  _p(body, "Antes de iniciar compras de itens Classe A ou B, o fornecedor deve passar pelo processo de qualificação:");
  _item(body, "a) Preenchimento do Questionário de Qualificação de Fornecedor (formulário Agricef).");
  _item(body, "b) Envio de documentos: CNPJ, capacitação técnica, certificações (ISO, inmetro, etc.) quando aplicável.");
  _item(body, "c) Avaliação de amostras ou lote piloto com inspeção pela Qualidade Agricef.");
  _item(body, "d) Aprovação formal pela Qualidade e Compras e inclusão na Lista de Fornecedores Aprovados (LFA).");

  _h2(body, "4. Avaliação de Desempenho");
  _p(body, "O desempenho de fornecedores Classe A e B é avaliado periodicamente com base nos seguintes critérios:");
  _tabela(body,
    ["Critério", "Peso", "Forma de Medição"],
    [
      ["Qualidade (taxa de rejeição no recebimento)", "40%", "Nº de lotes rejeitados / total recebido"],
      ["Prazo de entrega",                            "30%", "Entregas no prazo / total de pedidos"],
      ["Resposta a SCAR",                             "20%", "SCARs respondidos no prazo / total emitidos"],
      ["Documentação e certificados",                 "10%", "Certificados entregues no prazo / total solicitados"],
    ]
  );
  _tabela(body,
    ["Nota Final", "Classificação", "Ação"],
    [
      ["≥ 85",   "Fornecedor Aprovado",    "Manter. Reconhecimento opcional."],
      ["70–84",  "Fornecedor Condicional", "Plano de melhoria em 30 dias. Reavaliação em 90 dias."],
      ["< 70",   "Fornecedor em Risco",    "Reunião de alinhamento. Suspensão de novos pedidos até aprovação. Busca de alternativa."],
    ]
  );

  _h2(body, "5. SCAR — Solicitação de Ação Corretiva ao Fornecedor");
  _h3(body, "5.1 Quando emitir SCAR");
  _p(body, "Um SCAR deve ser emitido sempre que:");
  _item(body, "• Uma RNC de origem 'Recebimento Externo' for registrada no sistema SGQ (independente da classe do fornecedor para itens CR/MA).");
  _item(body, "• Houver rejeição de lote no recebimento por defeito dimensional, material incorreto, documentação faltante ou falha de processo.");
  _item(body, "• Um fornecedor Classe C acumular 2 ou mais RNCs em 6 meses.");

  _h3(body, "5.2 Conteúdo do SCAR");
  _item(body, "• Identificação do fornecedor, pedido, nota fiscal e item");
  _item(body, "• Descrição objetiva da não conformidade com evidências (fotos, medições)");
  _item(body, "• Número do ticket RNC no sistema Agricef");
  _item(body, "• Disposição do material pelo Agricef (devolução, retrabalho a custo do fornecedor, sucata com desconto)");
  _item(body, "• Prazo para resposta do fornecedor (10 dias corridos / 48h em Emergência)");
  _item(body, "• Campos esperados na resposta: contenção, causa raiz, ação corretiva, prazo de implementação");

  _h3(body, "5.3 Acompanhamento e Penalidades");
  _tabela(body,
    ["Situação", "Penalidade / Ação"],
    [
      ["Fornecedor responde no prazo com ação adequada",    "SCAR encerrado. Ação monitorada no próximo recebimento."],
      ["Fornecedor responde no prazo mas ação é insuficiente", "Qualidade solicita revisão. Prazo adicional de 5 dias."],
      ["Fornecedor não responde no prazo",                  "Nota de desempenho zerada no critério SCAR. Compras notifica e avalia suspensão."],
      ["3º SCAR em 12 meses pelo mesmo fornecedor",         "Suspensão temporária. Reunião com Diretoria. Busca de fornecedor alternativo."],
      ["Defeito CR que causou risco ao usuário final",      "Suspensão imediata. Comunicado formal. Avaliação de ação legal."],
    ]
  );

  _h2(body, "6. Custo de Não Qualidade do Fornecedor");
  _p(body, "Os custos gerados por falha de fornecedor devem ser apurados e comunicados formalmente:");
  _item(body, "• Custo de inspeção adicional (horas do inspetor)");
  _item(body, "• Custo de retrabalho realizado pelo Agricef (horas + material)");
  _item(body, "• Custo de sucata (valor do material perdido)");
  _item(body, "• Custo de frete de devolução");
  _item(body, "• Custo de parada de linha (quando aplicável)");
  _p(body, "Esses custos compõem o COPQ (Cost of Poor Quality) do fornecedor e devem ser negociados para desconto / reembolso quando a responsabilidade for comprovada.");

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}

// ─────────────────────────────────────────────────────────────
// PQ-06 — INDICADORES E REVISÃO PELA DIREÇÃO
// ─────────────────────────────────────────────────────────────
function _docPQ06(pasta) {
  const cod    = "PQ-06";
  const titulo = "Indicadores de Qualidade e Revisão pela Direção";
  const doc    = _novoDoc(pasta, cod, titulo);
  const body   = doc.getBody();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  _cabecalho(body, cod, titulo, "Rev. 00", "Junho / 2026",
             "Departamento de Qualidade", "Direção Geral");

  _h2(body, "1. Objetivo");
  _p(body, "Definir os indicadores-chave de desempenho do SGQ da Agricef, a periodicidade de monitoramento e o processo de Revisão pela Direção, conforme requisito da cláusula 9.3 da ISO 9001:2015, garantindo que o sistema de gestão permaneça adequado, suficiente e eficaz.");

  _h2(body, "2. Indicadores do SGQ");
  _tabela(body,
    ["Cód.", "Indicador", "Fórmula", "Meta", "Frequência", "Fonte"],
    [
      ["IQ-01", "Taxa de RNC por lote",         "Qtd RNCs / Qtd lotes produzidos × 100",              "< 2%",         "Mensal",     "SGQ (Painel)"],
      ["IQ-02", "Taxa de reincidência",          "RNCs com mesma causa raiz / total RNCs × 100",       "< 10%",        "Trimestral", "SGQ (Painel)"],
      ["IQ-03", "Lead time médio RNC Padrão",    "Soma lead times concluídas / Qtd concluídas (dias)", "≤ 7 dias úteis","Mensal",    "SGQ (Painel)"],
      ["IQ-04", "Lead time médio RNC Emergência","Idem, filtrado por Emergência (horas)",              "≤ 24 horas",   "Semanal",    "SGQ (Painel)"],
      ["IQ-05", "Taxa de sucata",                "RNCs com disposição Sucata / total × 100",           "< 5%",         "Mensal",     "SGQ (Painel)"],
      ["IQ-06", "COPQ (Custo da Não Qualidade)", "Soma custo sucata + horas retrabalho × custo/h",    "Redução 10%/ano","Trimestral","SGQ + Financeiro"],
      ["IQ-07", "Desempenho de fornecedores",    "Nota média dos fornecedores Classe A+B",             "≥ 85",         "Semestral",  "PQ-05 + Compras"],
      ["IQ-08", "RNCs origem campo/pós-venda",   "Qtd RNCs origem Campo / total × 100",               "< 1%",         "Mensal",     "SGQ (Painel)"],
      ["IQ-09", "% RNCs concluídas no prazo SLA","RNCs concluídas no prazo / total concluídas × 100", "> 90%",        "Mensal",     "SGQ (Painel)"],
      ["IQ-10", "SCARs respondidos no prazo",    "SCARs respondidos / total emitidos × 100",           "> 85%",        "Trimestral", "PQ-05 + Compras"],
    ]
  );

  _h2(body, "3. Reunião de Qualidade Semanal");
  _p(body, "Toda semana, o Representante da Qualidade conduz uma reunião rápida (30 min) com os líderes de setor para:");
  _item(body, "• Revisar as RNCs abertas e os prazos de SLA em risco");
  _item(body, "• Acompanhar ações corretivas em andamento");
  _item(body, "• Identificar padrões e tendências emergentes");
  _item(body, "• Definir prioridades da semana");
  _p(body, "Participantes: Qualidade, Líderes de Setor, Compras (quando houver SCAR aberto). Ata registrada no Drive.");

  _h2(body, "4. Revisão pela Direção");
  _h3(body, "4.1 Periodicidade e Participantes");
  _tabela(body,
    ["Revisão", "Periodicidade", "Participantes obrigatórios"],
    [
      ["Revisão Trimestral", "A cada 3 meses",  "RQ, Gerência de Produção, Compras"],
      ["Revisão Semestral",  "A cada 6 meses",  "RQ, Gerências, Direção"],
      ["Revisão Anual (formal ISO)", "1× ao ano","RQ, todas as Gerências, Direção Geral"],
    ]
  );

  _h3(body, "4.2 Entradas Obrigatórias da Revisão Anual");
  _p(body, "Conforme ISO 9001:2015 cláusula 9.3.2, a revisão deve considerar:");
  _item(body, "a) Status de ações de revisões anteriores");
  _item(body, "b) Mudanças em questões externas e internas relevantes para o SGQ");
  _item(body, "c) Desempenho e eficácia do SGQ — indicadores IQ-01 a IQ-10");
  _item(body, "d) Satisfação de clientes e feedback de partes interessadas");
  _item(body, "e) Extensão de objetivos da qualidade atingidos");
  _item(body, "f) Desempenho de processos e conformidade de produtos e serviços");
  _item(body, "g) Não conformidades e ações corretivas — análise de reincidências e COPQ");
  _item(body, "h) Resultados de monitoramento e medição");
  _item(body, "i) Resultados de auditorias internas e externas");
  _item(body, "j) Desempenho de fornecedores externos");
  _item(body, "k) Adequação de recursos");
  _item(body, "l) Eficácia de ações tomadas para abordar riscos e oportunidades");
  _item(body, "m) Oportunidades de melhoria");

  _h3(body, "4.3 Saídas Obrigatórias da Revisão");
  _p(body, "A revisão deve resultar em decisões e ações relacionadas a:");
  _item(body, "• Oportunidades de melhoria (processos, produtos, SGQ)");
  _item(body, "• Necessidade de mudanças no SGQ (procedimentos, escopo, política)");
  _item(body, "• Necessidade de recursos (pessoas, equipamentos, calibração, sistemas)");
  _item(body, "• Revisão ou confirmação das metas dos indicadores para o próximo período");
  _p(body, "Todas as decisões são registradas na Ata de Revisão pela Direção, assinada pela Direção Geral e pelo RQ, e arquivada no Drive por no mínimo 5 anos.");

  _h2(body, "5. Relatório Mensal de Qualidade");
  _p(body, "O Representante da Qualidade emite mensalmente um relatório com:");
  _item(body, "• Gráficos dos indicadores IQ-01, IQ-02, IQ-03, IQ-05 (extraídos do Painel SGQ)");
  _item(body, "• Lista das RNCs abertas e em atraso de SLA");
  _item(body, "• Top 3 causas raiz do mês e setores com maior incidência");
  _item(body, "• COPQ acumulado do mês");
  _item(body, "• SCARs emitidos e status de resposta dos fornecedores");
  _item(body, "• Destaques positivos e riscos identificados");
  _p(body, "O relatório é enviado por e-mail para a Direção até o 5º dia útil do mês seguinte.");

  _h2(body, "6. Auditoria Interna");
  _p(body, "A Agricef deve conduzir pelo menos uma auditoria interna do SGQ por ano, planejada pela Qualidade e com auditor designado (pode ser consultor externo na fase inicial). O plano de auditoria deve cobrir todos os processos relacionados ao escopo da ISO 9001 em ciclos de 2 anos. Os resultados são entrada obrigatória para a Revisão Anual pela Direção.");

  _rodape(body, cod);
  doc.saveAndClose();
  return { titulo: `${cod} · ${titulo}`, url: `https://docs.google.com/document/d/${doc.getId()}/edit` };
}
