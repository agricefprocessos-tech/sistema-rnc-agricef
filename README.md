# Sistema RNC Agricef — Guia de Deploy e Operação
**Versão MVP · Q2 2026**

---

## Arquivos do projeto

| Arquivo | Função |
|---|---|
| `Code.gs` | Backend / Middleware (Google Apps Script) |
| `Index.html` | Formulário de abertura de RNC (operadores) |
| `Painel.html` | Dashboard de indicadores (gestores) |

---

## Pré-requisitos

Antes do primeiro deploy, você precisa ter em mãos:

1. **Conta de serviço Jira** (`bot.qualidade@agricef.com`) com permissão de escrita no projeto RNC
2. **API Token** gerado na conta de serviço: https://id.atlassian.com/manage-profile/security/api-tokens
3. **jira_mapeamento_ids.json** gerado pelo script Python do manifesto (contém os IDs dos custom fields)
4. **Pasta raiz no Google Drive** chamada `Repositório RNC` — anotar o ID da URL
5. **Template do Google Docs** (`TEMPLATE_RNC_AGRICEF`) criado na pasta raiz — anotar o ID da URL

---

## Passo 1 — Criar o projeto no Google Apps Script

1. Acesse https://script.google.com e clique em **Novo projeto**
2. Renomeie o projeto para `Agricef RNC`
3. Apague o conteúdo do arquivo `Código.gs` e cole o conteúdo de `Code.gs`
4. Crie dois novos arquivos HTML: **Arquivo > Novo > HTML**
   - Nomeie o primeiro como `Index` e cole o conteúdo de `Index.html`
   - Nomeie o segundo como `Painel` e cole o conteúdo de `Painel.html`

---

## Passo 2 — Configurar as credenciais (PropertiesService)

No editor do Apps Script:

1. Clique em **Configurações do projeto** (engrenagem ⚙️ no menu lateral)
2. Role até **Propriedades do script**
3. Clique em **Adicionar propriedade** e adicione as três chaves:

| Propriedade | Valor |
|---|---|
| `JIRA_URL` | `https://suaempresa.atlassian.net/rest/api/3` |
| `JIRA_EMAIL` | `bot.qualidade@agricef.com` |
| `JIRA_TOKEN` | `(token gerado na conta de serviço)` |

> ⚠️ Nunca coloque essas informações diretamente no código-fonte.

---

## Passo 3 — Atualizar os IDs no Code.gs

Abra o `Code.gs` e localize o bloco `const CONFIG = { ... }`.

Substitua os valores indicados:

```javascript
const CONFIG = {
  PASTA_RAIZ_ID:   "1BxiMVs...",   // ID da pasta "Repositório RNC" no Drive
  TEMPLATE_DOC_ID: "1aMVt9z...",   // ID do TEMPLATE_RNC_AGRICEF no Docs

  JIRA_PROJECT:    "RNC",          // Confirmar a chave do projeto no Jira
  JIRA_ISSUE_TYPE: "10001",        // ID do Issue Type gerado pelo manifesto Python

  CF: {
    ORIGEM:    "customfield_10120",  // ← substitua pelos IDs do jira_mapeamento_ids.json
    QTD_LOTE:  "customfield_10121",
    QTD_DESVIO:"customfield_10122",
    COD_ITEM:  "customfield_10123",
    SETOR:     "customfield_10124",
    LINK_PDF:  "customfield_10125",
    CAUSA_RAIZ:"customfield_10126",
    DISPOSICAO:"customfield_10127",
  },
```

**Como encontrar os IDs no jira_mapeamento_ids.json:**
O script Python do manifesto gera um arquivo como este:
```json
{
  "Origem do Item":       "customfield_10120",
  "Setor Responsável":    "customfield_10124",
  "Quantidade do Lote":   "customfield_10121",
  ...
}
```
Copie os valores correspondentes para o `CONFIG.CF` acima.

---

## Passo 4 — Cadastrar os REs dos operadores

No `Code.gs`, localize o array `RES_AUTORIZADOS`:

```javascript
RES_AUTORIZADOS: ["1001", "1002", "1003", "1004", "1005"],
```

Substitua pelos REs reais dos inspetores e operadores autorizados a abrir RNCs.

> **Dica para produção:** mover esta lista para uma aba `Config` de uma planilha vinculada ao projeto, assim o João pode adicionar/remover REs sem alterar código. O `_verificarRE()` já tem comentário indicando este caminho.

---

## Passo 5 — Criar o template no Google Docs

1. Crie um novo Google Docs na pasta `Repositório RNC`
2. Nomeie como `TEMPLATE_RNC_AGRICEF`
3. Cole a estrutura abaixo (adicione logo e formatação da identidade Agricef):

```
AGRICEF — RELATÓRIO DE NÃO CONFORMIDADE

Data de Abertura: {{DATA}}
Inspetor / Operador (RE): {{RE_INSPETOR}}

─────────────────────────────────────────
1. RASTREABILIDADE DA PEÇA

Código do Item / OP:     {{COD_ITEM}}
Origem da Inspeção:      {{ORIGEM}}
Quantidade do Lote:      {{QTD_LOTE}}
Quantidade com Desvio:   {{QTD_DEF}}
Setor Responsável:       {{SETOR_RESP}}

─────────────────────────────────────────
2. DESCRIÇÃO TÉCNICA DO DESVIO

{{DESCRICAO}}

─────────────────────────────────────────
3. EVIDÊNCIA VISUAL

{{FOTO_DEFEITO}}

─────────────────────────────────────────
Documento gerado automaticamente pelo Sistema de Qualidade Agricef
```

4. Copie o ID do documento na URL (a parte entre `/d/` e `/edit`)
5. Cole no `CONFIG.TEMPLATE_DOC_ID` do `Code.gs`

---

## Passo 6 — Fazer o deploy do Web App

1. No editor do Apps Script, clique em **Implantar > Nova implantação**
2. Clique em **Selecionar tipo > Aplicativo Web**
3. Configure:
   - **Descrição:** `MVP v1.0 — Q2 2026`
   - **Executar como:** `Eu (seu email corporativo)`
   - **Quem tem acesso:** `Qualquer pessoa`
4. Clique em **Implantar** e copie a URL gerada

> A URL terá o formato: `https://script.google.com/macros/s/AKfycb.../exec`

---

## Passo 7 — Gerar os QR Codes

**URL do formulário (operadores):**
```
https://script.google.com/macros/s/SEU_ID/exec
```

**URL do painel (gestores):**
```
https://script.google.com/macros/s/SEU_ID/exec?page=painel
```

Acesse https://br.qr-code-generator.com ou similar, gere os QR Codes e imprima em acrílico A5.

Coloque também o link encurtado (ex: bit.ly/rnc-agricef) embaixo do QR Code como fallback caso a câmera não consiga ler.

---

## Passo 8 — Configurar as Transition Screens no Jira (manual)

Este passo não é automatizável via script. Faça no painel admin do Jira:

1. **Configurações do Projeto RNC > Fluxos de trabalho**
2. Edite o workflow e clique na transição `Em Análise → Plano de Ação`
3. Vá em **Condições pós-função > Adicionar tela de transição**
4. Crie uma tela com os campos obrigatórios:
   - `Causa Raiz` (obrigatório)
   - `Disposição da Peça` (obrigatório)
5. Repita para a transição `Verificação QA → Concluído`

---

## Passo 9 — Configurar o Calendário de SLA no Jira

1. **Configurações > Jira Service Management > Calendários de horário**
2. Crie um calendário `Horário Industrial Agricef`:
   - Segunda a sexta, das 07h00 às 17h00
   - Adicione os feriados nacionais
3. Vincule ao projeto RNC em **Configurações do Projeto > SLA**

---

## Operação diária — O que o João precisa saber

### Adicionar novo operador autorizado
Abra o `Code.gs`, localize `RES_AUTORIZADOS` e adicione o RE. Faça uma nova implantação (Implantar > Gerenciar implantações > Editar > versão nova).

### Atualizar o token do Jira
O token expira periodicamente. Para renovar:
1. Gere um novo token na conta `bot.qualidade@agricef.com`
2. Vá em **Configurações do projeto > Propriedades do script**
3. Edite a propriedade `JIRA_TOKEN` com o novo valor
4. Não é necessário fazer nova implantação — o script lê o valor em tempo real

### Verificar registros de contingência
Se o Jira ficar fora do ar durante um envio, os dados são salvos na aba `Contingência_RNC` da planilha vinculada ao projeto. Acesse a planilha pelo Apps Script (Extensões > Apps Script) e copie os dados manualmente para o Jira quando o serviço voltar.

### Acessar os dossiês PDF
Todos os PDFs ficam organizados em:
```
Repositório RNC/
  └── 2026-06/
      ├── EVIDENCIA_USI-2024-0087_1717123456.jpg
      ├── DOSSIE_RNC_USI-2024-0087_1717123456.pdf
      └── ...
```

---

## Checklist de homologação (antes do rollout)

Execute com peças físicas reais nas bancadas:

- [ ] **Firewall RE:** digitar RE inválido (`9999`) → sistema deve bloquear com mensagem de acesso negado
- [ ] **Scanner:** escanear etiqueta de OP física → campo Código deve ser preenchido automaticamente
- [ ] **Modal de iluminação:** tocar na área de foto → modal deve aparecer antes de abrir a câmera
- [ ] **Compressão:** enviar foto de 5MB → arquivo no Drive deve ter menos de 300KB
- [ ] **Hard cap 2MB:** forçar envio com imagem muito densa → sistema deve bloquear antes de enviar
- [ ] **PDF:** abrir o PDF gerado no Drive → verificar foto visível e campos preenchidos corretamente
- [ ] **Ticket Jira:** verificar se o card foi criado com todos os custom fields preenchidos
- [ ] **E-mail de roteamento:** verificar se o líder do setor selecionado recebeu o alerta
- [ ] **Painel:** acessar URL `?page=painel` → KPIs e gráficos carregam corretamente
- [ ] **Filtro de mês:** selecionar mês diferente → dados filtram sem erro
- [ ] **Lead Time:** fechar uma RNC teste no Jira → gráfico de lead time deve mostrar o setor com valor em horas

---

## Contatos de suporte

- **Dúvidas de processo / RNC:** Setor de Qualidade Agricef
- **Dúvidas técnicas de sistema:** [Nome do responsável TI]
- **Jira Admin:** [Email do admin Atlassian]
