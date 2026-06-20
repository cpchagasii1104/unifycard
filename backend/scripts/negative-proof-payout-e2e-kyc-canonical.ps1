# negative-proof-payout-e2e-kyc-canonical.ps1
# Test-Bite proofs that audit-payout-e2e-ephemeral-guard.mjs BITES on KYC regressions in the self-seed helper:
#   NP1 raw UPDATE identities.kyc_status (approve KYC "na marra" / bypass)  -> guard FAILS
#   NP2 remove the canonical reviewIdentityValidation(...) call             -> guard FAILS
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM (parses under Windows PowerShell 5.1 and PowerShell 7).
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-payout-e2e-ephemeral-guard.mjs'
$f = 'C:/unificard/backend/src/scripts/test-support/payout-e2e-self-seed.ts'
$rel = 'backend/src/scripts/test-support/payout-e2e-self-seed.ts'

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

Write-Host '=== NP1 — raw UPDATE identities.kyc_status (KYC bypass) ===' -ForegroundColor Cyan
Test-Bite -needle 'async function ensureRecoveryConcept()' -inject "const _np1 = `"UPDATE identities SET kyc_status='approved' WHERE global_user_id=x`";`nasync function ensureRecoveryConcept()"

Write-Host '=== NP2 — remove canonical reviewIdentityValidation call ===' -ForegroundColor Cyan
Test-Bite -needle 'identityValidationService.reviewIdentityValidation(' -inject 'identityValidationService.skipReview('

Write-Host 'PAYOUT KYC CANONICAL NEGATIVE-PROOF: both bites confirmed and restored byte-identical. OK' -ForegroundColor Green
exit 0
