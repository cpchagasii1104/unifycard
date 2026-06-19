# negative-proof-safe-subject-form-c-dedicated-guards.ps1
# Reproducible Test-Bite proofs that audit-safe-subject-form-c-dedicated-guards.mjs BITES on regression:
#   (1) business-audit: neutralize canUserPerformCompanyCapability AND canUserPerformTenantCapability -> guard FAILS.
#   (2) risk-command-center: pass actionContext.actorId as an argument to riskDashboardService (authority) -> guard FAILS.
# Each mutation: byte-exact backup, confirm GATE FAIL (exit 1), restore byte-identical, confirm git unchanged + GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7. Z3 hygiene.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-safe-subject-form-c-dedicated-guards.mjs'

function Test-Bite {
  param([string]$file, [string]$rel, [string]$needle, [string]$inject)
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

Write-Host '=== (1) business-audit: subject deixa de vir de req.user ===' -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/business-audit/business-audit.routes.ts' `
  -rel 'backend/src/modules/business-audit/business-audit.routes.ts' `
  -needle 'const userId = req.user?.id;' -inject "const userId = 'spoofed-subject';"

Write-Host '=== (2) risk-command-center: pass actionContext.actorId as authority to the data service ===' -ForegroundColor Cyan
Test-Bite `
  -file 'C:/unificard/backend/src/modules/risk-command-center/risk-dashboard.routes.ts' `
  -rel 'backend/src/modules/risk-command-center/risk-dashboard.routes.ts' `
  -needle 'const overview = await riskDashboardService.getOverview(tenantId);' `
  -inject 'const overview = await riskDashboardService.getOverview(tenantId, req.actionContext.actorId);'

Write-Host 'Z3 NEGATIVE-PROOF: guard bites on both regressions and restores byte-identical. OK' -ForegroundColor Green
exit 0
