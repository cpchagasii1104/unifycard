# negative-proof-services-discovery-direct-pay-containment.ps1
# Reproducible proof that audit-services-discovery-direct-pay-containment.mjs BITES when the retired direct-pay
# route is reactivated -- re-introduce the payAcceptedRequest sink + client-declared actionContext.actorId into
# the /request/pay handler. The guard then fails (forbids payAcceptedRequest + actionContext.actorId in handler).
# Mutates services-discovery.routes.ts (byte-exact backup), confirms GATE FAIL (exit 1), restores byte-identical
# and confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
# R8J SERVICES-DISCOVERY DIRECT-PAY RETIREMENT (DECISION-0110 D2).
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/services/services-discovery.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-services-discovery-direct-pay-containment.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/services/services-discovery.routes.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: reactivate the direct-pay sink inside /request/pay (anchor is unique to that handler).
  $needle = "return reply.status(403).send(serviceFinancialDisabledBody('POST /services/request/pay'));"
  $inject = "await servicesDiscoveryService.payAcceptedRequest(req.tenant.id, req.actionContext.actorId, req.body); return reply.status(403).send(serviceFinancialDisabledBody('POST /services/request/pay'));"
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: /request/pay anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the direct-pay sink reactivated -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with payAcceptedRequest/actionContext reintroduced (expected)." -ForegroundColor Green
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

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/services/services-discovery.routes.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
