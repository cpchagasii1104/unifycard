# Script para EXTERMINAR todos os processos Node e diagnosticar
# Execute como Administrador

Write-Host "=== EXTERMINIO COMPLETO DE PROCESSOS NODE ===" -ForegroundColor Red
Write-Host ""

# 1) Mostra tudo que é node
Write-Host "1. PROCESSOS NODE ENCONTRADOS:" -ForegroundColor Yellow
$processes = Get-Process node -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Select-Object Id,ProcessName,StartTime,Path | Format-Table -Auto
    Write-Host "Total: $($processes.Count) processos" -ForegroundColor Red
} else {
    Write-Host "Nenhum processo Node encontrado" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. MATANDO TODOS OS PROCESSOS..." -ForegroundColor Red
if ($processes) {
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "3. CONFIRMANDO QUE MORRERAM:" -ForegroundColor Yellow
$remaining = Get-Process node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "AVISO: Ainda ha $($remaining.Count) processos Node!" -ForegroundColor Red
    $remaining | Select-Object Id,ProcessName,StartTime,Path | Format-Table -Auto
    Write-Host ""
    Write-Host "Tentando matar novamente..." -ForegroundColor Yellow
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $stillAlive = Get-Process node -ErrorAction SilentlyContinue
    if ($stillAlive) {
        Write-Host "ERRO: Processos resistentes! Execute como Administrador ou mate manualmente:" -ForegroundColor Red
        $stillAlive | ForEach-Object {
            Write-Host "  taskkill /F /PID $($_.Id)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "SUCESSO: Todos os processos foram mortos" -ForegroundColor Green
    }
} else {
    Write-Host "SUCESSO: Nenhum processo Node restante" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== DIAGNOSTICO DE PORTA 3000 ===" -ForegroundColor Cyan
Write-Host ""

# Verificar porta 3000
Write-Host "4. VERIFICANDO PORTA 3000:" -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "PORTA 3000 ESTA EM USO!" -ForegroundColor Red
    $port3000 | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -Auto
    
    $pid = ($port3000 | Select-Object -First 1).OwningProcess
    if ($pid) {
        Write-Host ""
        Write-Host "Processo usando a porta 3000 (PID $pid):" -ForegroundColor Yellow
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            $proc | Select-Object Id,ProcessName,Path,StartTime | Format-List
            Write-Host ""
            Write-Host "Matando processo PID $pid..." -ForegroundColor Red
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            Write-Host "Verificando novamente..." -ForegroundColor Yellow
            $port3000After = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
            if ($port3000After) {
                Write-Host "AVISO: Porta 3000 ainda em uso!" -ForegroundColor Red
            } else {
                Write-Host "SUCESSO: Porta 3000 liberada" -ForegroundColor Green
            }
        } else {
            Write-Host "AVISO: Processo PID $pid nao encontrado (pode ter morrido)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Porta 3000 esta livre" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== VERIFICANDO RESSUSCITADORES ===" -ForegroundColor Cyan
Write-Host ""

# Verificar tarefas agendadas
Write-Host "5. TAREFAS AGENDADAS (possiveis ressuscitadores):" -ForegroundColor Yellow
$tasks = Get-ScheduledTask | Where-Object {$_.TaskName -match "node|unificard|backend|dev|ts-node|nodemon"} -ErrorAction SilentlyContinue
if ($tasks) {
    $tasks | Select-Object TaskName,State | Format-Table -Auto
    Write-Host "AVISO: Encontradas tarefas que podem reiniciar Node!" -ForegroundColor Red
} else {
    Write-Host "Nenhuma tarefa suspeita encontrada" -ForegroundColor Green
}

# Verificar serviços
Write-Host ""
Write-Host "6. SERVICOS (possiveis ressuscitadores):" -ForegroundColor Yellow
$services = Get-Service | Where-Object {$_.Name -match "node|pm2|unificard"} -ErrorAction SilentlyContinue
if ($services) {
    $services | Format-Table -Auto
    Write-Host "AVISO: Encontrados servicos que podem reiniciar Node!" -ForegroundColor Red
} else {
    Write-Host "Nenhum servico suspeito encontrado" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== RESUMO FINAL ===" -ForegroundColor Cyan
Write-Host ""

$finalCheck = Get-Process node -ErrorAction SilentlyContinue
$finalPort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if (-not $finalCheck -and -not $finalPort) {
    Write-Host "SUCESSO: Sistema limpo!" -ForegroundColor Green
    Write-Host "  - Nenhum processo Node rodando" -ForegroundColor Green
    Write-Host "  - Porta 3000 livre" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora execute o backend:" -ForegroundColor Cyan
    Write-Host "  cd C:\unificard" -ForegroundColor White
    Write-Host "  `$env:UNIFICARD_RUN='DIRECT-' + [guid]::NewGuid().ToString()" -ForegroundColor White
    Write-Host "  node -r ts-node/register/transpile-only ./backend/src/server.ts" -ForegroundColor White
} else {
    Write-Host "ATENCAO: Ainda ha problemas:" -ForegroundColor Red
    if ($finalCheck) {
        Write-Host "  - $($finalCheck.Count) processo(s) Node ainda rodando" -ForegroundColor Red
    }
    if ($finalPort) {
        Write-Host "  - Porta 3000 ainda em uso" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Tente:" -ForegroundColor Yellow
    Write-Host "  1. Executar este script como Administrador" -ForegroundColor White
    Write-Host "  2. Reiniciar o computador" -ForegroundColor White
}


















