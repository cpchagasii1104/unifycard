# negative-proof-referral-register-actor-code-gate.ps1
# Reproducible proof that audit-referral-register-actor-code-gate.mjs BITES when the single read-only
# resolver is downgraded to legacy-only (the actor_referral_codes lookup removed, leaving users.referral_code
# as the only substrate). Mutates referral.service.ts (byte-exact backup), confirms GATE FAIL (exit 1),
# restores byte-identical and confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell
# 5.1 and PowerShell 7. F-REFERRAL-REGISTER-ACTOR-CODE-GATE (DECISION-0139).
$ErrorActionPreference = 'Stop'
# Guard resolves src/... against process.cwd(); pin to backend so the proof runs from any cwd.
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/core/referral/referral.service.ts'
$guard = 'C:/unificard/backend/scripts/audit-referral-register-actor-code-gate.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
# git status of the file BEFORE the proof; restoration must leave it unchanged (file may carry legit
# uncommitted frente edits -- we prove the PROOF left no residual, not that it matches HEAD).
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/core/referral/referral.service.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: gut the actor-scoped lookup so the resolver consults only the legacy substrate
  # (the exact vector guarded: the entry-point silently fails actor-scoped codes again).
  $needle = 'FROM actor_referral_codes arc'
  $inject = 'FROM users arc_DISABLED_actor_referral_codes'
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: actor-scoped anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the actor-scoped lookup removed -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with resolver downgraded to legacy-only (expected)." -ForegroundColor Green
}
catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
finally {
  [IO.File]::WriteAllBytes($file, $origBytes)
  Write-Host "[CLEANUP] file restored." -ForegroundColor Cyan
}
if ($failed) { exit 1 }

$restored = [IO.File]::ReadAllBytes($file)
$identical = ($restored.Length -eq $origBytes.Length)
if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
if (-not $identical) { Write-Host "[ERROR] restore is NOT byte-identical." -ForegroundColor Red; exit 1 }
Write-Host "[OK] restore is byte-identical to the original." -ForegroundColor Green

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/core/referral/referral.service.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
