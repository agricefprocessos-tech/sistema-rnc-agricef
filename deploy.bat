@echo off
:: deploy.bat — Deploy automático via clasp (Windows)
:: Pré-requisito: npm install -g @google/clasp
::                clasp login  (feito uma vez, grava credenciais em %APPDATA%\clasp)

echo ============================================================
echo  Deploy — Sistema RNC Agricef
echo ============================================================

:: Verifica se clasp está instalado
where clasp >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] clasp nao encontrado. Instale com:
    echo        npm install -g @google/clasp
    pause
    exit /b 1
)

:: Verifica se .clasp.json existe (criado a partir do template)
if not exist ".clasp.json" (
    echo [ERRO] .clasp.json nao encontrado.
    echo        Copie .clasp.json.template para .clasp.json
    echo        e substitua COLE_AQUI_O_SCRIPT_ID_DO_GAS pelo ID real.
    echo.
    echo        Como obter o Script ID:
    echo          1. Abra script.google.com
    echo          2. Selecione o projeto "Agricef RNC"
    echo          3. Configuracoes do projeto (engrenagem)
    echo          4. Copie o "ID do script"
    pause
    exit /b 1
)

echo [1/2] Enviando arquivos para o Google Apps Script...
clasp push --force
if %errorlevel% neq 0 (
    echo [ERRO] clasp push falhou. Verifique as credenciais com: clasp login
    pause
    exit /b 1
)

echo.
echo [2/2] Push concluido com sucesso!
echo.
echo Proximos passos (no editor do Apps Script):
echo   1. Implantar ^> Nova implantacao ^> Aplicativo Web
echo   2. Executar como: Eu (seu e-mail corporativo)
echo   3. Quem tem acesso: Qualquer pessoa
echo   4. Copie a URL gerada para os QR Codes
echo.
pause
