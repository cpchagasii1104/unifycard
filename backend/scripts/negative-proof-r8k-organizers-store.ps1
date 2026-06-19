# negative-proof-r8k-organizers-store.ps1
# Reproducible Test-Bite proofs that the two R8K guards BITE on regression:
#   (1) organizers billing: reintroduce an organizerBillingService call in a contained route -> guard FAILS.
#   (2) store-onboarding bind: remove the canRepresentActor binding -> guard FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'

function Test-Bite {
  param([string]$file, [string]$guard, [string]$needle, [string]$inject, [string]$rel)
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
    if ($LASTEXITCODE -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED with regression ($rel)." }
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

Write-Host "=== (1) organizers billing: reintroduce organizerBillingService call ===" -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/events/organizers/organizers.routes.ts' `
  -guard 'C:/unificard/backend/scripts/audit-organizer-billing-ghost-containment.mjs' `
  -needle 'reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)' `
  -inject 'reply.send(await organizerBillingService.cancelSubscription(req.tenant.id, req.params.id, true))' `
  -rel 'backend/src/modules/events/organizers/organizers.routes.ts'

Write-Host "=== (2) store-onboarding: remove canRepresentActor binding ===" -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/marketplace/store-onboarding.routes.ts' `
  -guard 'C:/unificard/backend/scripts/audit-store-onboarding-actor-bind.mjs' `
  -needle 'await authorizationService.canRepresentActor(' `
  -inject 'await Promise.resolve(true); const _disabled = (' `
  -rel 'backend/src/modules/marketplace/store-onboarding.routes.ts'

Write-Host "R8K NEGATIVE-PROOF: both guards bite and restore byte-identical. OK" -ForegroundColor Green
exit 0
