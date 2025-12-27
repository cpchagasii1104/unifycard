@echo off
echo ========================================
echo   REINICIANDO FRONTEND UNIFICARD
echo ========================================
echo.

cd /d C:\unificard\frontend

echo Parando processos Node.js do frontend...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *vite*" 2>nul

echo.
echo Aguarde 2 segundos...
timeout /t 2 /nobreak >nul

echo.
echo Iniciando frontend...
echo.
echo IMPORTANTE: Mantenha esta janela aberta!
echo.

npm run dev

pause













