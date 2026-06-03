#!/bin/bash
# deploy.sh — Deploy automático via clasp (Linux/macOS)
# Pré-requisito: npm install -g @google/clasp
#                clasp login  (feito uma vez)

set -e

echo "============================================================"
echo " Deploy — Sistema RNC Agricef"
echo "============================================================"

# Verifica clasp
if ! command -v clasp &> /dev/null; then
    echo "[ERRO] clasp não encontrado. Instale com:"
    echo "       npm install -g @google/clasp"
    exit 1
fi

# Verifica .clasp.json
if [ ! -f ".clasp.json" ]; then
    echo "[ERRO] .clasp.json não encontrado."
    echo "       Copie .clasp.json.template para .clasp.json"
    echo "       e substitua COLE_AQUI_O_SCRIPT_ID_DO_GAS pelo ID real."
    echo ""
    echo "       Como obter o Script ID:"
    echo "         1. Abra script.google.com"
    echo "         2. Selecione o projeto 'Agricef RNC'"
    echo "         3. Configurações do projeto (engrenagem ⚙️)"
    echo "         4. Copie o 'ID do script'"
    exit 1
fi

echo "[1/2] Enviando arquivos para o Google Apps Script..."
clasp push --force

echo ""
echo "[2/2] Push concluído com sucesso!"
echo ""
echo "Próximos passos (no editor do Apps Script):"
echo "  1. Implantar > Nova implantação > Aplicativo Web"
echo "  2. Executar como: Eu (seu e-mail corporativo)"
echo "  3. Quem tem acesso: Qualquer pessoa"
echo "  4. Copie a URL gerada para os QR Codes"
