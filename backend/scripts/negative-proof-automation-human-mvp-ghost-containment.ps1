# negative-proof-automation-human-mvp-ghost-containment.ps1
# Reproducible Test-Bite proofs that audit-automation-human-mvp-ghost-containment.mjs BITES on regression:
#   (1) automation: reintroduce an alertService call in a contained route -> guard FAILS.
#   (2) human-mvp: reintroduce a humanMvpSkillService call in a contained route -> guard FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. R8N.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-automation-human-mvp-ghost-containment.mjs'

function Test-Bite {
  param([string]$file, [string]$needle, [string]$inject, [string]$rel)
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "BASE FAILED ($rel)." }
    Write-Host "[OK] BASE guard passes: $rel" -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw "MUTATION NO-OP: anchor not found in $rel." }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw "NEGATIVE-PROOF FAILED ($rel): guard PASSED with regression." }
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

Write-Host "=== (1) automation: reintroduce alertService call ===" -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/automation/automation.routes.ts' `
  -needle "fastify.post('/alerts', async (_req, reply) => reply.status(501).send(AUTOMATION_GHOST_BODY));" `
  -inject "fastify.post('/alerts', async (req, reply) => reply.send(await alertService.createAlert(req.tenant.id, req.body)));" `
  -rel 'backend/src/modules/automation/automation.routes.ts'

Write-Host "=== (2) human-mvp: reintroduce humanMvpSkillService call ===" -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/human-mvp/human-mvp.routes.ts' `
  -needle "fastify.post('/skills', async (_req, reply) => reply.status(501).send(HUMAN_MVP_GHOST_BODY));" `
  -inject "fastify.post('/skills', async (req, reply) => reply.send(await humanMvpSkillService.createSkill(req.body, req.tenant.id, req.actionContext.actorId)));" `
  -rel 'backend/src/modules/human-mvp/human-mvp.routes.ts'

Write-Host "R8N NEGATIVE-PROOF: both guards bite and restore byte-identical. OK" -ForegroundColor Green
exit 0
