# negative-proof-event-rfq-legacy-availability-antirevival-guard.ps1
# Reproducible proof that audit-event-rfq-legacy-availability-antirevival-guard.mjs BITES when the frozen
# legacy writer is silently re-keyed. Simulated regression: flip the dead acceptQuote availability write from
# ownerType: AvailabilityOwnerType.SERVICE (legacy owner) to .SERVICE_OFFERING (the forbidden silent re-key
# that must go through a proper front, not drift). CHECK C (writer freeze) must FAIL.
# Mutates event-rfq.service.ts (byte-exact backup), confirms GATE FAIL (exit 1), restores byte-identical and
# confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
# F-EVENT-RFQ-LEGACY-SERVICE-AVAILABILITY-ANTI-REACTIVATION-GUARD.
$ErrorActionPreference = 'Stop'
# Guard resolves src/... against process.cwd(); pin to backend so the proof runs from any cwd.
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/events/event-rfq.service.ts'
$guard = 'C:/unificard/backend/scripts/audit-event-rfq-legacy-availability-antirevival-guard.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/events/event-rfq.service.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: silent re-key of the frozen legacy owner_type='service' writer to service_offering.
  $needle = "ownerType: AvailabilityOwnerType.SERVICE,"
  $inject = "ownerType: AvailabilityOwnerType.SERVICE_OFFERING,"
  if (-not $text.Contains($needle)) { throw 'MUTATION NO-OP: frozen writer anchor not found (did the file change?).' }
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: replace produced identical text.' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the legacy writer re-keyed -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with owner_type='service' silently re-keyed (expected)." -ForegroundColor Green
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

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/events/event-rfq.service.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
