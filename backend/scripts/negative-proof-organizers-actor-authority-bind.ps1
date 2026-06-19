# negative-proof-organizers-actor-authority-bind.ps1
# Reproducible Test-Bite proofs that audit-organizers-actor-authority-bind.mjs BITES on regression:
#   (1) revert the subject to client-declared actionContext.actorId -> guard FAILS.
#   (2) derive the subject from a client channel instead of req.user -> guard FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. R8O.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/events/organizers/organizers.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-organizers-actor-authority-bind.mjs'
$rel   = 'backend/src/modules/events/organizers/organizers.routes.ts'

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

Write-Host '=== (1) subject reverts to client-declared actionContext.actorId ===' -ForegroundColor Cyan
Test-Bite -needle 'const requesterGlobalUserId = await resolveRequesterGlobalUserId(req, reply);' -inject 'const requesterGlobalUserId = (req as any).actionContext.actorId;'

Write-Host '=== (2) subject derived from a client channel instead of req.user ===' -ForegroundColor Cyan
Test-Bite -needle 'resolveGlobalUserId(req.user.id, req.tenant.id)' -inject 'resolveGlobalUserId((req as any).query.actorId, req.tenant.id)'

Write-Host 'R8O NEGATIVE-PROOF: guard bites on both regressions and restores byte-identical. OK' -ForegroundColor Green
exit 0
