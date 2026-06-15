// gerar_governanca.js — Gera os 6 documentos de governança SGQ da Agricef como .docx
// Execute: node gerar_governanca.js
"use strict";

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  TableLayoutType, VerticalAlign, PageOrientation, convertInchesToTwip,
} = require("docx");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "governanca");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Cores ────────────────────────────────────────────────────
const AZUL      = "1A56A0";
const AZUL_CLR  = "E8F0FB";
const VERDE     = "1A7A45";
const CINZA_CLR = "F0F4FA";
const BRANCO    = "FFFFFF";
const PRETO     = "222222";

// ── Helpers de parágrafo ─────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: AZUL, font: "Calibri" })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: AZUL, font: "Calibri" })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, color: PRETO, font: "Calibri" })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text, size: 20, color: PRETO, font: "Calibri", ...opts })],
  });
}
function item(text) {
  return new Paragraph({
    spacing: { before: 0, after: 40 },
    indent: { left: 440 },
    children: [new TextRun({ text, size: 20, color: PRETO, font: "Calibri" })],
  });
}
function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 80 }, children: [] });
}
function divisor() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
    children: [],
  });
}
function rodape(codigo) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 0 },
    children: [new TextRun({
      text: `${codigo} · Documento controlado. Impressões são cópias não controladas. Verifique a versão vigente no SGQ Agricef.`,
      size: 16, italics: true, color: "888888", font: "Calibri",
    })],
  });
}

// ── Helpers de célula / tabela ───────────────────────────────
function cell(text, { header = false, shade = false, bold = false, color = PRETO, colspan = 1 } = {}) {
  return new TableCell({
    columnSpan: colspan,
    shading: header
      ? { type: ShadingType.SOLID, color: AZUL,     fill: AZUL     }
      : shade
        ? { type: ShadingType.SOLID, color: CINZA_CLR, fill: CINZA_CLR }
        : { type: ShadingType.SOLID, color: BRANCO,  fill: BRANCO   },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({
        text,
        size: 18,
        bold: header || bold,
        color: header ? BRANCO : color,
        font: "Calibri",
      })],
    })],
  });
}

function tabela(cabecalho, linhas) {
  const rows = [
    new TableRow({ children: cabecalho.map(t => cell(t, { header: true })), tableHeader: true }),
    ...linhas.map((linha, i) =>
      new TableRow({ children: linha.map(t => cell(t, { shade: i % 2 === 0 })) })
    ),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

// ── Cabeçalho ISO ────────────────────────────────────────────
function cabecalhoISO(codigo, titulo, revisao, data, elaborado, aprovado) {
  const idRows = [
    new TableRow({ children: [
      cell("Código",        { header: true }), cell(codigo,    { bold: true }),
      cell("Revisão",       { header: true }), cell(revisao),
    ]}),
    new TableRow({ children: [
      cell("Título",        { header: true }), cell(titulo,    { bold: true, colspan: 3 }),
    ]}),
    new TableRow({ children: [
      cell("Data",          { header: true }), cell(data),
      cell("Aprovado por",  { header: true }), cell(aprovado),
    ]}),
    new TableRow({ children: [
      cell("Elaborado por", { header: true }), cell(elaborado, { colspan: 3 }),
    ]}),
  ];
  return [
    h1("AGRICEF EQUIPAMENTOS AGRÍCOLAS"),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: "Sistema de Gestão da Qualidade — SGQ", size: 20, italics: true, color: "555555", font: "Calibri" })],
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: idRows }),
    divisor(),
  ];
}

// ════════════════════════════════════════════════════════════
// PQ-01 — POLÍTICA DA QUALIDADE
// ════════════════════════════════════════════════════════════
async function gerarPQ01() {
  const cod = "PQ-01"; const titulo = "Política da Qualidade";
  const doc = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 20 } } } }, sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade", "Direção Geral"),
    h2("1. Propósito"),
    p("Este documento estabelece os princípios e compromissos da Agricef Equipamentos Agrícolas com a qualidade dos seus produtos, processos e serviços, alinhados aos requisitos da norma ABNT NBR ISO 9001:2015."),
    h2("2. Declaração de Política"),
    p("A Agricef tem como missão desenvolver e fornecer equipamentos agrícolas que superem as expectativas dos clientes em desempenho, durabilidade e segurança. Para isso, assumimos os seguintes compromissos:"),
    item("a) Atender plenamente os requisitos dos clientes e os requisitos legais e regulatórios aplicáveis aos nossos produtos."),
    item("b) Prevenir não conformidades por meio do controle rigoroso de processos de fabricação, inspeção e fornecimento."),
    item("c) Promover a melhoria contínua do SGQ, revisando periodicamente indicadores, processos e resultados."),
    item("d) Capacitar e engajar os colaboradores, garantindo que cada pessoa compreenda seu papel na qualidade do produto final."),
    item("e) Estabelecer parcerias com fornecedores que compartilhem dos mesmos valores de qualidade e melhoria contínua."),
    item("f) Registrar, analisar e tratar todas as Não Conformidades (RNCs) de forma sistemática, com ações corretivas que eliminem as causas raiz."),
    h2("3. Objetivos da Qualidade"),
    p("Os objetivos são definidos anualmente na Revisão pela Direção e monitorados pelos indicadores abaixo:"),
    spacer(),
    tabela(
      ["Indicador", "Meta", "Frequência"],
      [
        ["Taxa de RNCs por lote produzido",                "< 2%",           "Mensal"],
        ["Taxa de reincidência de causa raiz",             "< 10%",          "Trimestral"],
        ["Lead time médio de fechamento RNC Padrão",       "≤ 7 dias úteis", "Mensal"],
        ["Lead time médio de fechamento RNC Emergência",   "≤ 24 horas",     "Semanal"],
        ["Índice de aprovação de fornecedores críticos",   "> 85%",          "Trimestral"],
        ["Reclamações pós-venda com reincidência",         "0",              "Mensal"],
      ]
    ),
    spacer(),
    h2("4. Responsabilidades"),
    tabela(
      ["Papel", "Responsabilidade"],
      [
        ["Direção Geral",                    "Aprovar esta política, prover recursos e participar da Revisão pela Direção."],
        ["Representante da Qualidade (RQ)",  "Manter, divulgar e auditar o SGQ. Reportar desempenho à Direção."],
        ["Líderes de Setor",                 "Garantir conformidade dos processos e preencher tratativas de RNC no prazo."],
        ["Operadores / Inspetores",          "Registrar imediatamente toda não conformidade identificada."],
        ["Compras / Suprimentos",            "Qualificar fornecedores e tratar desvios de recebimento."],
      ]
    ),
    spacer(),
    h2("5. Comunicação e Revisão"),
    p("Esta política é comunicada a todos os colaboradores na integração e está disponível no sistema de gestão da Agricef. É revisada anualmente ou sempre que ocorrer mudança significativa no contexto da organização, nos requisitos de clientes ou na estrutura organizacional."),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ════════════════════════════════════════════════════════════
// PQ-02 — PROCEDIMENTO DE CONTROLE DE RNC
// ════════════════════════════════════════════════════════════
async function gerarPQ02() {
  const cod = "PQ-02"; const titulo = "Procedimento de Controle de Não Conformidades";
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade", "Direção Geral"),
    h2("1. Objetivo"),
    p("Estabelecer o método padronizado para identificação, registro, análise de causa, tratativa e verificação de Não Conformidades (RNCs) detectadas nos processos produtivos, de recebimento e de campo da Agricef, garantindo rastreabilidade, prazo e eficácia das ações corretivas."),
    h2("2. Escopo"),
    p("Aplica-se a todos os desvios de qualidade identificados por operadores, inspetores, líderes, equipe de compras ou clientes, incluindo:"),
    item("• Inspeção de recebimento de materiais e componentes de fornecedores externos"),
    item("• Processos internos de fabricação (usinagem, caldeiraria, soldagem, dobra, montagem, pintura)"),
    item("• Inspeção final e testes funcionais"),
    item("• Reclamações e devoluções de clientes (campo / pós-venda)"),
    h2("3. Definições"),
    tabela(
      ["Termo", "Definição"],
      [
        ["Não Conformidade (NC)",  "Não atendimento a um requisito especificado (dimensional, funcional, visual, documental ou de segurança)."],
        ["RNC",                    "Registro de Não Conformidade. Documento eletrônico gerado no sistema SGQ da Agricef (Jira / SGQ-X)."],
        ["Ação de Contenção",      "Medida imediata para isolar ou neutralizar o impacto da NC antes da análise de causa."],
        ["Causa Raiz",             "Causa fundamental cuja eliminação impede a reocorrência. Identificada pelos 5 Porquês / Ishikawa."],
        ["Ação Corretiva",         "Ação que elimina a causa raiz e previne a reocorrência da NC."],
        ["Disposição",             "Decisão sobre o destino do item NC: retrabalho, sucata, concessão, devolução ou aprovação."],
        ["SLA",                    "Acordo de Nível de Serviço — prazo máximo para conclusão de cada etapa do fluxo de RNC."],
        ["Emergência",             "RNC que implica parada de linha, risco à segurança ou iminente atraso de entrega ao cliente."],
      ]
    ),
    spacer(),
    h2("4. Fluxo do Processo"),
    h3("4.1 Visão Geral"),
    tabela(
      ["Etapa", "Status no Sistema", "Responsável", "SLA Padrão", "SLA Emergência"],
      [
        ["1. Abertura",          "Aberto",         "Operador / Inspetor",  "No ato",       "No ato"],
        ["2. Análise inicial",   "Em Análise",     "Líder de Setor",       "D+1",          "2 horas"],
        ["3. Tratativa",         "Plano de Ação",  "Líder de Setor",       "7 dias úteis", "24 horas"],
        ["4. Verificação QA",    "Verificação QA", "Qualidade",            "3 dias úteis", "8 horas"],
        ["5a. Encerramento",     "Concluído",      "Qualidade",            "—",            "—"],
        ["5b. Devolução",        "Aberto",         "Qualidade → Líder",    "—",            "—"],
      ]
    ),
    spacer(),
    h3("4.2 Etapa 1 — Abertura da RNC"),
    p("O operador ou inspetor que identificar o desvio deve abrir a RNC no sistema SGQ imediatamente após a detecção, sem aguardar autorização."),
    p("Informações obrigatórias na abertura:", { bold: true }),
    item("• RE do operador (matrícula)"),
    item("• Setor responsável pela geração do desvio"),
    item("• Processo inspecionado (soldagem, usinagem, montagem, etc.)"),
    item("• Código do item / OP e quantidades (lote e desvio)"),
    item("• Descrição detalhada do desvio"),
    item("• Prioridade: Padrão ou Emergência"),
    item("• Evidência fotográfica (obrigatória para Emergências)"),
    p("Ao registrar, o sistema gera automaticamente: número do ticket (SGQ-X), relatório PDF e e-mail de notificação para o setor e para a equipe de Qualidade."),
    h3("4.3 Etapa 2 — Análise Inicial (Em Análise)"),
    p("O líder do setor é notificado por e-mail com link direto para a tratativa. Deve:"),
    item("• Confirmar a não conformidade fisicamente"),
    item("• Isolar o lote afetado (área de quarentena com etiqueta vermelha)"),
    item("• Definir se a prioridade deve ser elevada para Emergência"),
    item("• Iniciar o preenchimento da tratativa (pode salvar rascunho)"),
    h3("4.4 Etapa 3 — Tratativa / Plano de Ação"),
    p("Campos obrigatórios para envio à QA:", { bold: true }),
    item("• Ação de contenção: o que foi feito imediatamente com o material"),
    item("• Causa raiz (categoria Ishikawa): Mão de Obra / Máquina / Método / Material / Medição / Meio Ambiente"),
    item("• Descrição da causa raiz (5 Porquês): encadeamento lógico até a causa fundamental"),
    item("• Ação corretiva definitiva: mudança no processo para prevenir reocorrência"),
    item("• Disposição da peça: Retrabalho / Sucata / Devolução / Concessão / Aprovado"),
    item("• Horas de retrabalho e custo de sucateamento quando aplicável"),
    h3("4.5 Etapa 4 — Verificação QA"),
    p("O analista de qualidade verifica se:"),
    item("• A causa raiz é plausível e suficientemente profunda"),
    item("• A ação corretiva elimina de fato a causa raiz"),
    item("• A disposição da peça foi executada"),
    item("• Há evidências de implementação ou prazo claro"),
    spacer(),
    tabela(
      ["Decisão", "Status resultante", "Notificação"],
      [
        ["✅ Aprovar",  "Concluído", "E-mail ao líder e ao setor"],
        ["↩ Devolver", "Aberto",    "E-mail ao líder com motivo. SLA reinicia."],
      ]
    ),
    spacer(),
    h3("4.6 Critérios de Rejeição na Verificação QA"),
    tabela(
      ["Situação", "Ação"],
      [
        ["Causa raiz rasa ('erro do operador' sem investigação)",           "Devolver — exigir 5 Porquês completo"],
        ["Ação corretiva genérica ('treinar operadores') sem plano",        "Devolver — exigir plano com prazo e responsável"],
        ["Disposição da peça não executada e sem prazo",                   "Devolver — exigir comprovação ou prazo formal"],
        ["Reincidência da mesma causa raiz no mesmo setor",                "Devolver + escalar para Direção (ver PQ-04)"],
        ["Emergência sem ação de contenção documentada",                   "Devolver imediatamente"],
      ]
    ),
    spacer(),
    h2("5. Identificação e Segregação de Material NC"),
    p("Todo material não conforme deve ser fisicamente segregado e identificado com etiqueta vermelha padrão 'MATERIAL NÃO CONFORME — AGUARDANDO DISPOSIÇÃO', contendo: número do ticket RNC, data, setor e responsável pela segregação. O material só pode ser movimentado com autorização da Qualidade."),
    h2("6. Reincidência"),
    p("Se a mesma causa raiz ou tipo de desvio ocorrer 3 vezes no mesmo setor em 90 dias, a Qualidade deve:"),
    item("a) Convocar reunião com o líder do setor e a Direção"),
    item("b) Exigir revisão do processo / instrução de trabalho com evidência de atualização"),
    item("c) Aumentar a frequência de inspeção no processo por 30 dias"),
    item("d) Registrar o evento na ata da próxima Revisão pela Direção (PQ-06)"),
    h2("7. Registros"),
    tabela(
      ["Registro", "Local", "Retenção"],
      [
        ["Tickets RNC (SGQ-X)",          "Jira Cloud (agricef-qualidade.atlassian.net)", "Indefinido"],
        ["Relatório PDF de cada RNC",    "Google Drive — pasta do mês",                 "5 anos"],
        ["Relatório mensal de qualidade","Google Drive — Governança SGQ",                "5 anos"],
        ["Ata de Revisão pela Direção",  "Google Drive — Governança SGQ",                "5 anos"],
      ]
    ),
    spacer(),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ════════════════════════════════════════════════════════════
// PQ-03 — CRITÉRIOS DE INSPEÇÃO POR PROCESSO
// ════════════════════════════════════════════════════════════
async function gerarPQ03() {
  const cod = "PQ-03"; const titulo = "Critérios de Inspeção por Processo";
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade", "Direção Geral"),
    h2("1. Objetivo"),
    p("Definir os critérios de inspeção — tipo, frequência e tamanho de amostra — para cada processo produtivo da Agricef, garantindo que as inspeções sejam proporcionais ao risco, ao histórico de qualidade e à criticidade do item para o produto final."),
    p("Nota: Os critérios de amostragem são regras de governança e não fazem parte do formulário de abertura de RNC. Uma RNC deve ser aberta sempre que um desvio for detectado, independentemente do método de inspeção adotado.", { italics: true }),
    h2("2. Classificação de Defeitos"),
    tabela(
      ["Classe", "Definição", "Exemplos", "Ação imediata"],
      [
        ["Crítico (CR)", "Compromete segurança, função principal ou conformidade legal.",   "Falha estrutural, risco de acidente, vazamento hidráulico crítico", "Parar lote. RNC Emergência. Acionar Direção."],
        ["Maior (MA)",   "Compromete funcionalidade sem risco imediato.",                   "Solda fora de spec, dimensional fora de tolerância",              "Segregar lote. RNC Padrão. Inspeção 100%."],
        ["Menor (ME)",   "Desvio que não afeta função nem segurança.",                      "Acabamento, risco visual superficial, marcação deslocada",        "Registrar. Avaliar concessão se aplicável."],
      ]
    ),
    spacer(),
    h2("3. Critérios por Processo"),
    h3("3.1 Recebimento de Materiais Externos"),
    tabela(
      ["Tipo de Item", "Plano de Inspeção", "Amostra", "Critério de Aceitação"],
      [
        ["Materiais estruturais (chapas, perfis, tubos)",        "Dimensional + visual + certificado de material", "5% do lote (mín. 3 pças)", "0 CR/MA; ≤ 1 ME"],
        ["Componentes usinados / torneados",                     "Dimensional — 100% críticos; amostra demais",    "10% (mín. 5) ou 100% se CR","0 CR/MA"],
        ["Parafusos, fixadores, elementos normalizados",         "Visual + dimensional por amostra",               "3% (mín. 5 pças)",         "0 CR; ≤ 2% MA"],
        ["Serviços externos (tratamento térmico, pintura ext.)", "Inspeção no recebimento + laudo do fornecedor",  "10% das peças tratadas",   "Conforme spec do pedido"],
      ]
    ),
    spacer(),
    h3("3.2 Caldeiraria e Corte"),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Dimensional (comprimento, ângulo, folga)", "100% para peças críticas; 1ª + última + 10% para séries", "Dentro da tolerância do desenho"],
        ["Visual (rebarba, amassado, marca de corte)", "100%",                                                  "0 defeitos CR; rebarba removida"],
        ["Verificação de material (espessura, tipo)",  "Por lote / corrida",                                   "Conforme especificação e certificado"],
      ]
    ),
    spacer(),
    h3("3.3 Dobra e Estamparia"),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Ângulo de dobra",          "1ª peça + a cada 20 peças",        "± 1° da especificação (ou conforme desenho)"],
        ["Dimensional geral",        "1ª peça + 10% do lote",            "Dentro da tolerância do desenho"],
        ["Visual (trinca, marcas)",  "100%",                             "0 trincas; marcas superficiais conforme critério visual padrão"],
        ["Gabarito de verificação",  "1ª peça após ajuste de ferramenta","Aprovado antes de iniciar série"],
      ]
    ),
    spacer(),
    h3("3.4 Soldagem"),
    p("Soldagem é processo especial — o resultado não pode ser totalmente verificado após a execução sem ensaios destrutivos ou END. A qualidade é garantida principalmente pelo controle do processo (soldador qualificado, procedimento de soldagem, parâmetros controlados)."),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Visual de cordão (porosidade, respingo, cratera, mordedura)", "100%",                                              "Conforme AWS D1.1 ou norma aplicável. 0 defeitos CR."],
        ["Dimensional pós-solda (empeno, posição)",                     "100% em conjuntos críticos; 20% nos demais",        "Dentro da tolerância do gabarito"],
        ["Inspeção com líquido penetrante (LP)",                        "Soldas críticas estruturais — por amostra definida pelo RQ", "0 indicações relevantes"],
        ["Qualificação do soldador",                                     "Por contratação e anualmente",                     "CQS (Certificado de Qualificação de Soldador) válido"],
      ]
    ),
    spacer(),
    h3("3.5 Usinagem"),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Dimensional (diâmetro, comprimento, rosca, tolerâncias)", "1ª peça + a cada 10 peças ou troca de ferramenta", "Dentro das tolerâncias do desenho"],
        ["Acabamento superficial (rugosidade)",                      "Por amostragem quando especificado",               "Ra conforme desenho"],
        ["Visual (rebarbas, marcas)",                                "100%",                                             "Sem rebarbas; marcas conforme critério visual"],
      ]
    ),
    spacer(),
    h3("3.6 Montagem e Teste Final"),
    p("Toda máquina ou equipamento deve passar pela inspeção final antes de ser liberado para expedição."),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Check-list de montagem (itens, torques, conexões)", "100% — todo equipamento",  "Todos os itens OK e assinados pelo responsável"],
        ["Teste funcional (operação em vazio e sob carga)",   "100% — todo equipamento",  "Funciona conforme especificação técnica do produto"],
        ["Visual geral (pintura, identificação, etiquetas)",  "100%",                     "Conforme padrão de acabamento Agricef"],
        ["Verificação de documentação (manual, certificados)","100%",                     "Documentação completa e correta"],
        ["Rastreabilidade (Nº de série gravado / plaqueta)",  "100%",                     "Nº de série aplicado e registrado no sistema"],
      ]
    ),
    spacer(),
    h3("3.7 Pintura"),
    tabela(
      ["Inspeção", "Frequência", "Critério"],
      [
        ["Espessura de tinta (medidor de espessura)",     "3 pontos por peça em lotes críticos; amostra demais", "Conforme especificação (ex: ≥ 80 µm)"],
        ["Aderência (risco em X, fita adesiva)",          "Por lote ou início de turno",                        "Nota ≥ 4 conforme ISO 2409"],
        ["Visual (bolha, escorrimento, falha, cor)",      "100%",                                               "0 defeitos CR/MA; ME conforme critério visual aprovado"],
        ["Verificação de pré-tratamento (fosfato, jato)", "Por lote antes de pintar",                           "Conforme procedimento de pré-tratamento"],
      ]
    ),
    spacer(),
    h2("4. Quando Acionar Inspeção 100%"),
    p("Além dos casos já indicados acima, a inspeção 100% deve ser acionada quando:"),
    item("• O processo apresentar RNC com defeito CR ou MA nas últimas 2 semanas"),
    item("• Houver troca de fornecedor, ferramenta ou lote de material"),
    item("• O lote for destinado a cliente estratégico ou pedido crítico de prazo"),
    item("• A Qualidade ou Direção determinar por critério de risco"),
    item("• O equipamento for o primeiro de um novo modelo (lote piloto)"),
    h2("5. Qualificação de Inspetores"),
    p("Somente colaboradores treinados e avaliados pela Qualidade podem realizar inspeções formais e liberar lotes. O treinamento inclui: leitura de desenho técnico, uso de instrumentos de medição, critérios de defeito e uso do sistema SGQ."),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ════════════════════════════════════════════════════════════
// PQ-04 — MATRIZ DE ESCALAÇÃO E SLA
// ════════════════════════════════════════════════════════════
async function gerarPQ04() {
  const cod = "PQ-04"; const titulo = "Matriz de Escalação e SLA de RNC";
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade", "Direção Geral"),
    h2("1. Objetivo"),
    p("Definir os prazos máximos (SLA) para cada etapa do fluxo de RNC e estabelecer a cadeia de escalação quando esses prazos são descumpridos ou quando a severidade da NC exige envolvimento de níveis hierárquicos superiores."),
    h2("2. Definição de Prioridades"),
    tabela(
      ["Prioridade", "Critérios de Classificação", "Quem pode classificar"],
      [
        ["🔴 Emergência", "Parada total ou parcial de linha de produção\nRisco à segurança do operador ou usuário\nAtraso iminente de entrega a cliente com contrato de prazo\nDefeito crítico (CR) em equipamento já expedido", "Qualquer colaborador (para elevar). Apenas QA/Direção para rebaixar."],
        ["🟢 Padrão",     "Todos os demais desvios que não se enquadram nos critérios de Emergência.",                                                                                                                          "Operador ou Inspetor"],
      ]
    ),
    spacer(),
    h2("3. SLA por Etapa"),
    tabela(
      ["Etapa", "Responsável", "SLA Padrão", "SLA Emergência", "O que acontece se vencer"],
      [
        ["Abertura da RNC",                       "Operador / Inspetor",  "No ato da detecção", "No ato da detecção", "QA abre em nome do setor e registra ocorrência"],
        ["Contenção inicial (isolar lote)",        "Líder de Setor",       "Até D+1",            "Até 2 horas",        "QA aciona Direção"],
        ["Preenchimento da tratativa completa",    "Líder de Setor",       "7 dias úteis",       "24 horas",           "1ª: QA contata líder. 2ª (D+2): Gerência de Produção. 3ª (D+4): Direção."],
        ["Verificação QA",                         "Qualidade",            "3 dias úteis",       "8 horas",            "Gerência de QA assume a verificação diretamente"],
        ["Resposta do Fornecedor (SCAR)",          "Compras / Fornecedor", "10 dias corridos",   "48 horas",           "Penalidade aplicada. Histórico do fornecedor impactado (PQ-05)."],
      ]
    ),
    spacer(),
    h2("4. Matriz de Escalação"),
    h3("4.1 Escalação por Vencimento de SLA"),
    tabela(
      ["Situação", "Nível 1 (automático)", "Nível 2 (+2 dias)", "Nível 3 (+4 dias)"],
      [
        ["Tratativa não enviada — Padrão",     "E-mail automático ao Líder",      "QA contata pessoalmente + e-mail ao Gerente de Produção", "Direção notificada. Meta do setor impactada."],
        ["Tratativa não enviada — Emergência", "E-mail ao Líder + QA",            "Direção notificada em 2 horas",                           "Reunião de crise convocada em 4 horas"],
        ["Verificação QA vencida",             "E-mail ao analista de QA",        "Gerência de QA assume",                                   "Diretoria de QA resolve"],
      ]
    ),
    spacer(),
    h3("4.2 Escalação por Severidade"),
    tabela(
      ["Gatilho", "Ação de escalação"],
      [
        ["Defeito CR em qualquer processo",                             "Notificar Direção imediatamente. Parar lote. Investigação obrigatória em 24h."],
        ["Defeito em equipamento já entregue ao cliente",               "Acionar pós-venda e Direção em até 2 horas. Avaliar recall/substituição."],
        ["3 RNCs do mesmo tipo em 90 dias no mesmo setor",              "Reunião de causa raiz com Gerência de Produção + QA. Revisão de processo."],
        ["Rejeição de SCAR pelo fornecedor ou prazo vencido",           "Compras aplica penalidade. Avalia suspensão temporária (PQ-05)."],
        ["RNC com custo de sucata > R$ 5.000",                         "Relatar à Direção na semana. Incluir na Revisão pela Direção."],
        ["Taxa mensal de RNCs ultrapassa meta de 2%",                   "Reunião extraordinária de qualidade. Plano de ação setorial em 30 dias."],
      ]
    ),
    spacer(),
    h2("5. Responsabilidades na Escalação"),
    tabela(
      ["Papel", "Responsabilidade"],
      [
        ["Sistema SGQ",              "Registrar datas e prazos automaticamente. Fornecer dados para monitoramento."],
        ["Qualidade (analista)",     "Monitorar diariamente as RNCs abertas e prazos. Executar nível 1 de escalação."],
        ["Gerência de Qualidade",    "Executar nível 2. Convocar reuniões de causa raiz. Reportar à Direção."],
        ["Gerência de Produção",     "Garantir que líderes cumpram os SLAs. Cobrar tratativas em aberto."],
        ["Direção",                  "Receber escalações de nível 3. Decidir sobre suspensão de fornecedores e recursos."],
      ]
    ),
    spacer(),
    h2("6. Monitoramento"),
    p("O Painel de Qualidade do sistema SGQ exibe em tempo real as RNCs abertas, os lead times e os casos que ultrapassaram SLA. O Representante da Qualidade revisa esses dados diariamente e apresenta o consolidado na Reunião de Qualidade semanal."),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ════════════════════════════════════════════════════════════
// PQ-05 — GESTÃO DE FORNECEDORES E SCAR
// ════════════════════════════════════════════════════════════
async function gerarPQ05() {
  const cod = "PQ-05"; const titulo = "Gestão de Fornecedores e SCAR";
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade / Compras", "Direção Geral"),
    h2("1. Objetivo"),
    p("Estabelecer o processo de qualificação, avaliação e desenvolvimento de fornecedores da Agricef, incluindo o tratamento formal de não conformidades de origem externa por meio do SCAR (Supplier Corrective Action Request — Solicitação de Ação Corretiva ao Fornecedor)."),
    h2("2. Classificação de Fornecedores"),
    tabela(
      ["Classe", "Critério", "Controle aplicável"],
      [
        ["Crítico (A)",   "Fornece itens que impactam diretamente a segurança ou função principal do produto. Sem alternativa de curto prazo.", "Qualificação obrigatória, auditorias periódicas, certificados por lote, SCAR obrigatório em qualquer NC."],
        ["Importante (B)","Fornece itens relevantes para a qualidade do produto mas com alternativas de mercado.",                              "Inspeção por amostragem no recebimento, avaliação semestral, SCAR para NC MA/CR."],
        ["Normal (C)",    "Fornece materiais ou serviços de baixo impacto na qualidade final.",                                                "Inspeção visual no recebimento. Avaliação anual. SCAR apenas para reincidências."],
      ]
    ),
    spacer(),
    h2("3. Qualificação de Novos Fornecedores"),
    p("Antes de iniciar compras de itens Classe A ou B, o fornecedor deve passar pelo processo de qualificação:"),
    item("a) Preenchimento do Questionário de Qualificação de Fornecedor (formulário Agricef)"),
    item("b) Envio de documentos: CNPJ, capacitação técnica, certificações (ISO, Inmetro) quando aplicável"),
    item("c) Avaliação de amostras ou lote piloto com inspeção pela Qualidade Agricef"),
    item("d) Aprovação formal pela Qualidade e Compras e inclusão na Lista de Fornecedores Aprovados (LFA)"),
    h2("4. Avaliação de Desempenho"),
    tabela(
      ["Critério", "Peso", "Forma de Medição"],
      [
        ["Qualidade (taxa de rejeição no recebimento)", "40%", "Nº de lotes rejeitados / total recebido"],
        ["Prazo de entrega",                            "30%", "Entregas no prazo / total de pedidos"],
        ["Resposta a SCAR",                             "20%", "SCARs respondidos no prazo / total emitidos"],
        ["Documentação e certificados",                 "10%", "Certificados entregues no prazo / total solicitados"],
      ]
    ),
    spacer(),
    tabela(
      ["Nota Final", "Classificação", "Ação"],
      [
        ["≥ 85",  "Fornecedor Aprovado",    "Manter. Reconhecimento opcional."],
        ["70–84", "Fornecedor Condicional", "Plano de melhoria em 30 dias. Reavaliação em 90 dias."],
        ["< 70",  "Fornecedor em Risco",    "Reunião de alinhamento. Suspensão de novos pedidos até aprovação. Busca de alternativa."],
      ]
    ),
    spacer(),
    h2("5. SCAR — Solicitação de Ação Corretiva ao Fornecedor"),
    h3("5.1 Quando Emitir SCAR"),
    p("Um SCAR deve ser emitido sempre que:"),
    item("• Uma RNC de origem 'Recebimento Externo' for registrada no SGQ (independente da classe para itens CR/MA)"),
    item("• Houver rejeição de lote por defeito dimensional, material incorreto, documentação faltante ou falha de processo"),
    item("• Um fornecedor Classe C acumular 2 ou mais RNCs em 6 meses"),
    h3("5.2 Conteúdo do SCAR"),
    item("• Identificação do fornecedor, pedido, nota fiscal e item"),
    item("• Descrição objetiva da NC com evidências (fotos, medições)"),
    item("• Número do ticket RNC no sistema Agricef (SGQ-X)"),
    item("• Disposição do material pelo Agricef (devolução, retrabalho a custo do fornecedor, sucata com desconto)"),
    item("• Prazo para resposta: 10 dias corridos / 48h em Emergência"),
    item("• Campos esperados na resposta: contenção, causa raiz, ação corretiva, prazo de implementação"),
    h3("5.3 Acompanhamento e Penalidades"),
    tabela(
      ["Situação", "Penalidade / Ação"],
      [
        ["Fornecedor responde no prazo com ação adequada",       "SCAR encerrado. Ação monitorada no próximo recebimento."],
        ["Fornecedor responde mas ação é insuficiente",          "QA solicita revisão. Prazo adicional de 5 dias."],
        ["Fornecedor não responde no prazo",                     "Nota zerada no critério SCAR. Compras notifica e avalia suspensão."],
        ["3º SCAR em 12 meses pelo mesmo fornecedor",            "Suspensão temporária. Reunião com Diretoria. Busca de alternativa."],
        ["Defeito CR que causou risco ao usuário final",         "Suspensão imediata. Comunicado formal. Avaliação de ação legal."],
      ]
    ),
    spacer(),
    h2("6. Custo de Não Qualidade do Fornecedor (COPQ)"),
    p("Os custos gerados por falha de fornecedor devem ser apurados e comunicados formalmente:"),
    item("• Custo de inspeção adicional (horas do inspetor)"),
    item("• Custo de retrabalho realizado pelo Agricef (horas + material)"),
    item("• Custo de sucata (valor do material perdido)"),
    item("• Custo de frete de devolução"),
    item("• Custo de parada de linha quando aplicável"),
    p("Esses valores compõem o COPQ do fornecedor e devem ser negociados para desconto / reembolso quando a responsabilidade for comprovada."),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ════════════════════════════════════════════════════════════
// PQ-06 — INDICADORES E REVISÃO PELA DIREÇÃO
// ════════════════════════════════════════════════════════════
async function gerarPQ06() {
  const cod = "PQ-06"; const titulo = "Indicadores de Qualidade e Revisão pela Direção";
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: [
    ...cabecalhoISO(cod, titulo, "Rev. 00", "Junho / 2026", "Departamento de Qualidade", "Direção Geral"),
    h2("1. Objetivo"),
    p("Definir os indicadores-chave de desempenho do SGQ da Agricef, a periodicidade de monitoramento e o processo de Revisão pela Direção, conforme requisito da cláusula 9.3 da ISO 9001:2015, garantindo que o sistema de gestão permaneça adequado, suficiente e eficaz."),
    h2("2. Indicadores do SGQ"),
    tabela(
      ["Cód.", "Indicador", "Meta", "Frequência", "Fonte"],
      [
        ["IQ-01", "Taxa de RNC por lote produzido",               "< 2%",           "Mensal",     "SGQ — Painel"],
        ["IQ-02", "Taxa de reincidência de causa raiz",           "< 10%",          "Trimestral", "SGQ — Painel"],
        ["IQ-03", "Lead time médio RNC Padrão",                   "≤ 7 dias úteis", "Mensal",     "SGQ — Painel"],
        ["IQ-04", "Lead time médio RNC Emergência",               "≤ 24 horas",     "Semanal",    "SGQ — Painel"],
        ["IQ-05", "Taxa de sucata (disposição Sucata / total)",   "< 5%",           "Mensal",     "SGQ — Painel"],
        ["IQ-06", "COPQ (Custo da Não Qualidade)",                "Redução 10%/ano","Trimestral", "SGQ + Financeiro"],
        ["IQ-07", "Desempenho médio de fornecedores Classe A+B",  "≥ 85",           "Semestral",  "PQ-05 + Compras"],
        ["IQ-08", "RNCs de campo / pós-venda (% do total)",       "< 1%",           "Mensal",     "SGQ — Painel"],
        ["IQ-09", "% RNCs concluídas dentro do SLA",              "> 90%",          "Mensal",     "SGQ — Painel"],
        ["IQ-10", "SCARs respondidos no prazo pelo fornecedor",   "> 85%",          "Trimestral", "PQ-05 + Compras"],
      ]
    ),
    spacer(),
    h2("3. Reunião de Qualidade Semanal"),
    p("Toda semana (30 min), o Representante da Qualidade conduz reunião com os líderes de setor para:"),
    item("• Revisar as RNCs abertas e os prazos de SLA em risco"),
    item("• Acompanhar ações corretivas em andamento"),
    item("• Identificar padrões e tendências emergentes"),
    item("• Definir prioridades da semana"),
    p("Participantes: Qualidade, Líderes de Setor, Compras (quando houver SCAR aberto). Ata registrada no Drive."),
    h2("4. Revisão pela Direção"),
    h3("4.1 Periodicidade e Participantes"),
    tabela(
      ["Revisão", "Periodicidade", "Participantes obrigatórios"],
      [
        ["Revisão Trimestral",        "A cada 3 meses", "RQ, Gerência de Produção, Compras"],
        ["Revisão Semestral",         "A cada 6 meses", "RQ, Gerências, Direção"],
        ["Revisão Anual (formal ISO)","1× ao ano",      "RQ, todas as Gerências, Direção Geral"],
      ]
    ),
    spacer(),
    h3("4.2 Entradas Obrigatórias da Revisão Anual (ISO 9001:2015 — 9.3.2)"),
    item("a) Status de ações de revisões anteriores"),
    item("b) Mudanças em questões externas e internas relevantes para o SGQ"),
    item("c) Desempenho e eficácia do SGQ — indicadores IQ-01 a IQ-10"),
    item("d) Satisfação de clientes e feedback de partes interessadas"),
    item("e) Extensão dos objetivos da qualidade atingidos"),
    item("f) Desempenho de processos e conformidade de produtos e serviços"),
    item("g) Não conformidades e ações corretivas — análise de reincidências e COPQ"),
    item("h) Resultados de monitoramento e medição"),
    item("i) Resultados de auditorias internas e externas"),
    item("j) Desempenho de fornecedores externos"),
    item("k) Adequação de recursos (pessoas, infraestrutura, equipamentos)"),
    item("l) Eficácia de ações tomadas para abordar riscos e oportunidades"),
    item("m) Oportunidades de melhoria"),
    h3("4.3 Saídas Obrigatórias da Revisão"),
    p("A revisão deve resultar em decisões e ações relacionadas a:"),
    item("• Oportunidades de melhoria (processos, produtos, SGQ)"),
    item("• Necessidade de mudanças no SGQ (procedimentos, escopo, política)"),
    item("• Necessidade de recursos (pessoas, equipamentos, calibração, sistemas)"),
    item("• Revisão ou confirmação das metas dos indicadores para o próximo período"),
    p("Todas as decisões são registradas na Ata de Revisão pela Direção, assinada pela Direção Geral e pelo RQ, e arquivada no Drive por no mínimo 5 anos."),
    h2("5. Relatório Mensal de Qualidade"),
    p("O Representante da Qualidade emite mensalmente um relatório contendo:"),
    item("• Gráficos dos indicadores IQ-01, IQ-02, IQ-03, IQ-05 (extraídos do Painel SGQ)"),
    item("• Lista das RNCs abertas e em atraso de SLA"),
    item("• Top 3 causas raiz do mês e setores com maior incidência"),
    item("• COPQ acumulado do mês"),
    item("• SCARs emitidos e status de resposta dos fornecedores"),
    item("• Destaques positivos e riscos identificados"),
    p("O relatório é enviado por e-mail à Direção até o 5º dia útil do mês seguinte."),
    h2("6. Auditoria Interna"),
    p("A Agricef deve conduzir pelo menos uma auditoria interna do SGQ por ano. O plano de auditoria deve cobrir todos os processos relacionados ao escopo da ISO 9001 em ciclos de 2 anos. Os resultados são entrada obrigatória para a Revisão Anual pela Direção."),
    divisor(),
    rodape(cod),
  ]}]});
  const buf = await Packer.toBuffer(doc);
  const arq = path.join(OUT, `${cod} - ${titulo}.docx`);
  fs.writeFileSync(arq, buf);
  console.log(`✅ ${arq}`);
}

// ── Executar tudo ────────────────────────────────────────────
(async () => {
  console.log("📄 Gerando documentos de governança SGQ Agricef...\n");
  await gerarPQ01();
  await gerarPQ02();
  await gerarPQ03();
  await gerarPQ04();
  await gerarPQ05();
  await gerarPQ06();
  console.log(`\n✅ Todos os documentos gerados em:\n   ${OUT}`);
})();
