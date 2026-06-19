# negative-proof-unifycard-method-money-containment.ps1
# Reproducible Test-Bite proofs that audit-unifycard-method-money-containment.mjs BITES on regression:
#   (1) POST reintroduces unifyCardMethodService.createMethod + actionContext.actorId -> guard FAILS.
#   (2) GET reintroduces unifyCardMethodService.listMethods -> guard FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. R8Q.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/marketplace/unifycard-method.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-unifycard-method-money-containment.mjs'
$rel   = 'backend/src/modules/marketplace/unifycard-method.routes.ts'

function Test-Bite {
  param([string]$needle, [string]$inject)
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'BASE FAILED: guard did not pass before mutation.' }
    Write-Host '[OK] BASE guard passes.' -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw 'MUTATION NO-OP: anchor not found.' }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'NEGATIVE-PROOF FAILED: guard PASSED with regression.' }
    Write-Host '[OK] NEGATIVE-PROOF: guard FAILED with regression (expected).' -ForegroundColor Green
  }
  catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
  finally { [IO.File]::WriteAllBytes($file, $origBytes); Write-Host '[CLEANUP] restored.' -ForegroundColor Cyan }
  if ($failed) { exit 1 }
  $restored = [IO.File]::ReadAllBytes($file)
  $identical = ($restored.Length -eq $origBytes.Length)
  if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
  if (-not $identical) { Write-Host '[ERROR] restore NOT byte-identical.' -ForegroundColor Red; exit 1 }
  if ($preStatus -ne (& git -C C:/unificard status --porcelain -- $rel)) { Write-Host '[ERROR] git status changed.' -ForegroundColor Red; exit 1 }
  & node $guard | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host '[ERROR] POST-RESTORE guard not OK.' -ForegroundColor Red; exit 1 }
  Write-Host '[OK] restored byte-identical + git clean + guard OK.' -ForegroundColor Green
}

Write-Host '=== (1) POST reintroduces createMethod + actionContext.actorId ===' -ForegroundColor Cyan
Test-Bite -needle "fastify.post('/unifycard/methods', async (_req, reply) => reply.status(501).send(UNIFYCARD_METHOD_GHOST_BODY));" -inject "fastify.post('/unifycard/methods', async (req, reply) => reply.send(await unifyCardMethodService.createMethod(req.tenant.id, req.body, req.actionContext.actorId)));"

Write-Host '=== (2) GET reintroduces listMethods ===' -ForegroundColor Cyan
Test-Bite -needle "fastify.get('/unifycard/methods', async (_req, reply) => reply.status(501).send(UNIFYCARD_METHOD_GHOST_BODY));" -inject "fastify.get('/unifycard/methods', async (req, reply) => reply.send(await unifyCardMethodService.listMethods(req.tenant.id)));"

Write-Host 'R8Q NEGATIVE-PROOF: guard bites on both regressions and restores byte-identical. OK' -ForegroundColor Green
exit 0
