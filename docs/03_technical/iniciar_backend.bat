@echo off
echo ========================================
echo   INICIANDO BACKEND DO UNIFICARD
echo ========================================
echo.
cd backend
echo Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)
echo.
echo Iniciando servidor na porta 3000...
echo Aguarde ate ver a mensagem "SERVIDOR INICIADO COM SUCESSO"
echo.
call npm run dev
pause
