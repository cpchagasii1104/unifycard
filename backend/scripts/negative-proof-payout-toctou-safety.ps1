# negative-proof-payout-toctou-safety.ps1
# Test-Bite: audit-payout-toctou-safety.mjs MORDE em cada regressão de revalidação execute-time:
#   NP1 envelope payout -> transfer (action 'financial_payout' -> 'financial_transfer')  -> guard FAIL
#   NP2 remove erro/bloqueio recovery pending_approval                                   -> guard FAIL
#   NP3 remove invocação de requireFinancialRiskClearance no execute                     -> guard FAIL
#   NP4 saldo deixa de vir de bank_ledger (calculateBalance removido)                    -> guard FAIL
# (NP5 worker default-on e NP6 HTTP execution permanecem cobertos por guards existentes em
#  validate:regression-guards: audit-financial-workers-dormancy / audit-payout-execution-seal /
#  audit-payout-request-only-entrypoint — não duplicados aqui.)
# Cada mutação: backup byte-exato, confirma GATE FAIL (exit 1), restaura byte-idêntico, git limpo, GATE OK.
# ASCII-only + no BOM (parseia em Windows PowerShell 5.1 e PowerShell 7).
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-payout-toctou-safety.mjs'
$f = 'C:/unificard/backend/src/modules/wallet/actor-wallet-payout.service.ts'
$rel = 'backend/src/modules/wallet/actor-wallet-payout.service.ts'

function Test-Bite {
  param([string]$needle, [string]$inject)
  $origBytes = [IO.File]::ReadAllBytes($f)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'BASE FAILED: guard did not pass before mutation.' }
    Write-Host '[OK] BASE guard passes' -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw 'MUTATION NO-OP: anchor not found.' }
    [IO.File]::WriteAllText($f, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'NEGATIVE-PROOF FAILED: guard PASSED with regression.' }
    Write-Host '[OK] NEGATIVE-PROOF: guard FAILED with regression (expected)' -ForegroundColor Green
  }
  catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
  finally { [IO.File]::WriteAllBytes($f, $origBytes); Write-Host '[CLEANUP] restored' -ForegroundColor Cyan }
  if ($failed) { exit 1 }
  $restored = [IO.File]::ReadAllBytes($f)
  $identical = ($restored.Length -eq $origBytes.Length)
  if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
  if (-not $identical) { Write-Host '[ERROR] restore NOT byte-identical' -ForegroundColor Red; exit 1 }
  if ($preStatus -ne (& git -C C:/unificard status --porcelain -- $rel)) { Write-Host '[ERROR] git status changed' -ForegroundColor Red; exit 1 }
  & node $guard | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host '[ERROR] POST-RESTORE guard not OK' -ForegroundColor Red; exit 1 }
  Write-Host '[OK] restored byte-identical + git clean + guard OK' -ForegroundColor Green
}

Write-Host '=== NP1 - envelope payout -> transfer ===' -ForegroundColor Cyan
Test-Bite -needle "action: 'financial_payout'" -inject "action: 'financial_transfer'"

Write-Host '=== NP2 - remove erro recovery pending_approval ===' -ForegroundColor Cyan
Test-Bite -needle 'PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE' -inject 'PAYOUT_RECOVERY_PENDING_DISABLED'

Write-Host '=== NP3 - remove invocacao requireFinancialRiskClearance no execute ===' -ForegroundColor Cyan
Test-Bite -needle 'await requireFinancialRiskClearance(tenantId, {' -inject 'await skipClearance(tenantId, {'

Write-Host '=== NP4 - saldo deixa de vir de bank_ledger ===' -ForegroundColor Cyan
Test-Bite -needle 'bankLedgerRepository.calculateBalance' -inject 'bankLedgerRepository.disabledBalance'

Write-Host 'PAYOUT TOCTOU SAFETY NEGATIVE-PROOF: all four bites confirmed and restored byte-identical. OK' -ForegroundColor Green
exit 0
