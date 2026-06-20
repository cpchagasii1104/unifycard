# negative-proof-payout-e2e-ephemeral-guard.ps1
# Reproducible Test-Bite proofs that audit-payout-e2e-ephemeral-guard.mjs BITES on regression:
#   NPa remove the `await assertEphemeral()` call from F3   -> guard FAILS
#   NPb remove the unificard_dev block from C3              -> guard FAILS
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-payout-e2e-ephemeral-guard.mjs'

function Test-Bite {
  param([string]$file, [string]$rel, [string]$needle, [string]$inject)
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

$f3 = 'C:/unificard/backend/src/scripts/validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts'
$f3Rel = 'backend/src/scripts/validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts'
$c3 = 'C:/unificard/backend/src/scripts/validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts'
$c3Rel = 'backend/src/scripts/validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts'

Write-Host '=== NPa — remove the await assertEphemeral() call from F3 ===' -ForegroundColor Cyan
Test-Bite -file $f3 -rel $f3Rel -needle '  await assertEphemeral();' -inject '  // assertEphemeral removed (negative-proof)'

Write-Host '=== NPb — remove the unificard_dev block from C3 ===' -ForegroundColor Cyan
Test-Bite -file $c3 -rel $c3Rel `
  -needle "if (db === 'unificard_dev') throw new Error('Refusing to run payout/recovery E2E against non-ephemeral database.');" `
  -inject "/* unificard_dev block removed (negative-proof) */"

Write-Host 'PAYOUT E2E EPHEMERAL GUARD NEGATIVE-PROOF: both bites confirmed and restored byte-identical. OK' -ForegroundColor Green
exit 0
