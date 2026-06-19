# negative-proof-r8f-nonmoney-wave.ps1
# Reproducible proof that the R8F guards BITE on regression:
#   (1) plan: swap the PUT subject from req.user.userId to req.actionContext.actorId (spoof) -> audit-plan-self-bound FAILS.
#   (2) contact: re-introduce a contactService write in POST /contacts -> audit-contacts-schema-ghost-containment FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. R8F NON-MONEY WAVE.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'

function Test-Bite([string]$file, [string]$guard, [string]$needle, [string]$inject, [string]$rel) {
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "BASE FAILED: guard did not pass before mutation ($guard)." }
    Write-Host "[OK] BASE: $guard passes." -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw "MUTATION NO-OP: anchor not found in $file." }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw "NEGATIVE-PROOF FAILED: $guard PASSED with regression -- expected FAIL." }
    Write-Host "[OK] NEGATIVE-PROOF: $guard FAILED with regression (expected)." -ForegroundColor Green
  }
  catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
  finally { [IO.File]::WriteAllBytes($file, $origBytes); Write-Host "[CLEANUP] $rel restored." -ForegroundColor Cyan }
  if ($failed) { exit 1 }
  $restored = [IO.File]::ReadAllBytes($file)
  $identical = ($restored.Length -eq $origBytes.Length)
  if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
  if (-not $identical) { Write-Host "[ERROR] restore NOT byte-identical: $rel" -ForegroundColor Red; exit 1 }
  $postStatus = (& git -C C:/unificard status --porcelain -- $rel)
  if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed: $rel" -ForegroundColor Red; exit 1 }
  & node $guard | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE guard not OK: $guard" -ForegroundColor Red; exit 1 }
  Write-Host "[OK] $rel restored byte-identical, git clean, guard OK." -ForegroundColor Green
}

Write-Host "=== (1) plan self-bound subject spoof ===" -ForegroundColor Cyan
Test-Bite `
  'C:/unificard/backend/src/core/plan/plan.routes.ts' `
  'C:/unificard/backend/scripts/audit-plan-self-bound.mjs' `
  'findByUserId(req.tenant.id, req.user.userId)' `
  'findByUserId(req.tenant.id, req.actionContext.actorId)' `
  'backend/src/core/plan/plan.routes.ts'

Write-Host "=== (2) contact route re-introduces write ===" -ForegroundColor Cyan
Test-Bite `
  'C:/unificard/backend/src/modules/marketplace/contact.routes.ts' `
  'C:/unificard/backend/scripts/audit-contacts-schema-ghost-containment.mjs' `
  "fastify.post('/contacts', async (_req, reply) => reply.status(501).send(CONTAINED));" `
  "fastify.post('/contacts', async (req, reply) => reply.send(await contactService.createContact(req.tenant.id, req.body, req.actionContext.actorId)));" `
  'backend/src/modules/marketplace/contact.routes.ts'

Write-Host "R8F NEGATIVE-PROOF: both guards bite and restore byte-identical. OK" -ForegroundColor Green
exit 0
