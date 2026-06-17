# negative-proof-services-actor-binding.ps1
# Reproducible proof that audit-services-actor-binding.mjs BITES when the route gate is removed.
# Mutates services.routes.ts (byte-exact backup), confirms GATE FAIL (exit 1), restores byte-identical
# and confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
# F-AUTHORITY-Z2-R6.1-SERVICES-ACTOR-BINDING.
$ErrorActionPreference = 'Stop'
# Guard resolves src/... against process.cwd(); pin to backend so the proof runs from any cwd.
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/services/services.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-services-actor-binding.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
# Capture the file's git status BEFORE the proof; restoration must leave it unchanged (the file may have
# legitimate uncommitted frente edits — we prove the PROOF left no residual, not that it matches HEAD).
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/services/services.routes.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: neutralize the POST gate by changing the subject to the declared actor (spoof).
  $needle = 'canRepresentActor(req.tenant.id, userId, parsed.data.actorId)'
  $inject = 'canRepresentActor(req.tenant.id, parsed.data.actorId, parsed.data.actorId)'
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: gate anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the subject spoofed -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with declared actor as subject (expected)." -ForegroundColor Green
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

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/services/services.routes.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual mutation): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
