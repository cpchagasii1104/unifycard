# negative-proof-ap-ar-reactivation-trap.ps1
# Reproducible proof that audit-ap-ar-reactivation-trap.mjs BITES on the two reactivation classes:
#   (1) a contained AP route writes again (re-introduces accountsPayableService.createManualPayable);
#   (2) the AP service loses its Proxy reject-all (repo silently reactivated -> Promise.resolve).
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. R8H AP/AR REACTIVATION TRAP.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-ap-ar-reactivation-trap.mjs'

function Test-Bite([string]$file, [string]$needle, [string]$inject, [string]$rel) {
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "BASE FAILED: guard did not pass before mutation." }
    Write-Host "[OK] BASE: guard passes." -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw "MUTATION NO-OP: anchor not found in $file." }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED with regression -- expected FAIL." }
    Write-Host "[OK] NEGATIVE-PROOF: guard FAILED with regression (expected)." -ForegroundColor Green
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
  if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE guard not OK." -ForegroundColor Red; exit 1 }
  Write-Host "[OK] $rel restored byte-identical, git clean, guard OK." -ForegroundColor Green
}

Write-Host "=== (1) AP route writes again (service call reintroduced) ===" -ForegroundColor Cyan
Test-Bite `
  'C:/unificard/backend/src/modules/marketplace/accounts-payable.routes.ts' `
  "fastify.post('/accounts-payable/manual', async (_req, reply) => reply.status(403).send(DISABLED));" `
  "fastify.post('/accounts-payable/manual', async (req, reply) => reply.send(await accountsPayableService.createManualPayable(req.tenant.id, req.body, req.actionContext.actorId)));" `
  'backend/src/modules/marketplace/accounts-payable.routes.ts'

Write-Host "=== (2) AP service loses Proxy reject-all (repo reactivated) ===" -ForegroundColor Cyan
Test-Bite `
  'C:/unificard/backend/src/modules/marketplace/accounts-payable.service.ts' `
  "Promise.reject(new Error('AccountsPayable migrated to Bank'))" `
  "Promise.resolve({})" `
  'backend/src/modules/marketplace/accounts-payable.service.ts'

Write-Host "R8H NEGATIVE-PROOF: route-write + proxy-removal both bite and restore byte-identical. OK" -ForegroundColor Green
exit 0
