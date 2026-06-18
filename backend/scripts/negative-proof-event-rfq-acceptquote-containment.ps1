# negative-proof-event-rfq-acceptquote-containment.ps1
# Reproducible proof that audit-event-rfq-acceptquote-containment.mjs BITES when the W6 hard-stop is defeated.
# Simulated regression: drop the `return` from the containment 403 (turn the early-exit into a no-op expression),
# so execution would fall through to eventRFQService.acceptQuote -- containment defeated.
# Mutates event-rfq.routes.ts (byte-exact backup), confirms GATE FAIL (exit 1), restores byte-identical and
# confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
# R7b ACCEPTQUOTE P0 CONTAINMENT.
$ErrorActionPreference = 'Stop'
# Guard resolves src/... against process.cwd(); pin to backend so the proof runs from any cwd.
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/events/event-rfq.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-event-rfq-acceptquote-containment.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/events/event-rfq.routes.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: defeat the hard-stop by dropping `return` (early-exit becomes a fall-through no-op),
  # so execution would fall through to eventRFQService.acceptQuote. CRLF-aware anchor: the W6 line ends right
  # at the newline (W1/W3's `return reply.status(403).send({ error:` continue inline, so this is W6-only).
  $needle = "return reply.status(403).send({`r`n"
  $inject = "void reply.status(403).send({`r`n"
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: containment anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the hard-stop defeated -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with containment return removed (expected)." -ForegroundColor Green
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

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/events/event-rfq.routes.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
