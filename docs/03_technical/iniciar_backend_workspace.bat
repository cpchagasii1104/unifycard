@echo off
echo ========================================
echo   INICIANDO BACKEND (WORKSPACE)
echo ========================================
echo.

cd /d C:\unificard

echo 1. Matando processos Node antigos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Iniciando backend como workspace...
echo    Comando: npm run dev -w unificard-backend
echo.

npm run dev -w unificard-backend

pause


















