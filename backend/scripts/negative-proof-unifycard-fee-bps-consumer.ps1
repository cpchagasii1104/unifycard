# negative-proof-unifycard-fee-bps-consumer.ps1
# Reproducible Test-Bite proofs that the fee-bps migration guards BITE on regression:
#   NP1 reintroduce /100 in fee calc          -> audit-unifycard-fee-bps-consumer FAILS
#   NP2 reintroduce *100 orphan on bps        -> audit-unifycard-fee-bps-consumer FAILS
#   NP3 reintroduce feePercentage contract     -> audit-unifycard-fee-bps-consumer FAILS
#   NP4 compute fee outside the engine         -> audit-unifycard-fee-bps-consumer FAILS
#   NP5 read payment_methods as fee SSOT       -> audit-unifycard-fee-bps-consumer FAILS
#   NP6 reopen R8Q 501 unifycard-method route  -> audit-unifycard-method-money-containment FAILS
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$feeGuard = 'C:/unificard/backend/scripts/audit-unifycard-fee-bps-consumer.mjs'
$r8qGuard = 'C:/unificard/backend/scripts/audit-unifycard-method-money-containment.mjs'

function Test-Bite {
  param([string]$file, [string]$rel, [string]$guard, [string]$needle, [string]$inject)
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "BASE FAILED: guard did not pass before mutation ($rel)." }
    Write-Host "[OK] BASE guard passes: $rel" -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw "MUTATION NO-OP: anchor not found in $rel." }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw "NEGATIVE-PROOF FAILED ($rel): guard PASSED with regression." }
    Write-Host "[OK] NEGATIVE-PROOF: guard FAILED with regression (expected): $rel" -ForegroundColor Green
  }
  catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
  finally { [IO.File]::WriteAllBytes($file, $origBytes); Write-Host "[CLEANUP] restored $rel" -ForegroundColor Cyan }
  if ($failed) { exit 1 }
  $restored = [IO.File]::ReadAllBytes($file)
  $identical = ($restored.Length -eq $origBytes.Length)
  if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
  if (-not $identical) { Write-Host "[ERROR] restore NOT byte-identical: $rel" -ForegroundColor Red; exit 1 }
  if ($preStatus -ne (& git -C C:/unificard status --porcelain -- $rel)) { Write-Host "[ERROR] git status changed: $rel" -ForegroundColor Red; exit 1 }
  & node $guard | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE guard not OK: $rel" -ForegroundColor Red; exit 1 }
  Write-Host "[OK] restored byte-identical + git clean + guard OK: $rel" -ForegroundColor Green
}

$pe = 'C:/unificard/backend/src/modules/marketplace/payment-execution.service.ts'
$peRel = 'backend/src/modules/marketplace/payment-execution.service.ts'
$uc = 'C:/unificard/backend/src/modules/marketplace/unifycard.service.ts'
$ucRel = 'backend/src/modules/marketplace/unifycard.service.ts'
$fp = 'C:/unificard/backend/src/modules/marketplace/marketplace-fee-policy.ts'
$fpRel = 'backend/src/modules/marketplace/marketplace-fee-policy.ts'
$rt = 'C:/unificard/backend/src/modules/marketplace/unifycard-method.routes.ts'
$rtRel = 'backend/src/modules/marketplace/unifycard-method.routes.ts'

Write-Host '=== NP1 — reintroduce /100 in fee calc (payment-execution) ===' -ForegroundColor Cyan
Test-Bite -file $pe -rel $peRel -guard $feeGuard `
  -needle 'const feeAmountCents = feeResolution.feeAmountCents;' `
  -inject 'const feeAmountCents = Math.round(intent.amountCents / 100);'

Write-Host '=== NP2 — reintroduce *100 orphan on bps (marketplace-fee-policy) ===' -ForegroundColor Cyan
Test-Bite -file $fp -rel $fpRel -guard $feeGuard `
  -needle 'const feeRateBps = feeSplits.reduce((a, s) => a + (s.bps ?? 0), 0);' `
  -inject 'const feeRateBps = feeSplits.reduce((a, s) => a + (s.bps ?? 0), 0); const _np2 = feeRateBps * 100;'

Write-Host '=== NP3 — reintroduce feePercentage contract (unifycard.service) ===' -ForegroundColor Cyan
Test-Bite -file $uc -rel $ucRel -guard $feeGuard `
  -needle 'const feeAmountCents = feeResolution.feeAmountCents;' `
  -inject 'const feePercentage = 0; const feeAmountCents = feeResolution.feeAmountCents;'

Write-Host '=== NP4 — compute fee outside the engine (unifycard.service) ===' -ForegroundColor Cyan
Test-Bite -file $uc -rel $ucRel -guard $feeGuard `
  -needle 'const feeAmountCents = feeResolution.feeAmountCents;' `
  -inject 'const feeAmountCents = Math.round(input.grossAmountCents * 0.0299);'

Write-Host '=== NP5 — read payment_methods as fee SSOT (unifycard.service) ===' -ForegroundColor Cyan
Test-Bite -file $uc -rel $ucRel -guard $feeGuard `
  -needle 'const feeAmountCents = feeResolution.feeAmountCents;' `
  -inject 'const _np5 = paymentMethod.feePercentage; const feeAmountCents = feeResolution.feeAmountCents;'

Write-Host '=== NP6 — reopen R8Q 501 unifycard-method route ===' -ForegroundColor Cyan
Test-Bite -file $rt -rel $rtRel -guard $r8qGuard `
  -needle 'status(501)' -inject 'status(200)'

Write-Host 'UNIFYCARD FEE BPS NEGATIVE-PROOF: all six bites confirmed and restored byte-identical. OK' -ForegroundColor Green
exit 0
