# negative-proof-db-role-rls-hardening.ps1
# Test-Bite: audit-db-role-rls-hardening.mjs MORDE em cada regressão de DB-role/RLS:
#   NP1 app role -> SUPERUSER                              -> guard FAIL
#   NP2 app role -> BYPASSRLS                              -> guard FAIL
#   NP3 remove FORCE RLS de tabela crítica                -> guard FAIL
#   NP4 policy USING(true) app-facing em tabela financeira -> guard FAIL
#   NP5 pre-flight deixa de consultar pg_roles            -> guard FAIL
#   NP6 DISABLE ROW LEVEL SECURITY ativo                  -> guard FAIL
#   NP7 relaxa RLS de bank_ledger                         -> guard FAIL
# Cada mutação: backup byte-exato, confirma GATE FAIL (exit 1), restaura byte-idêntico, git limpo, GATE OK.
# ASCII-only + no BOM (parseia em Windows PowerShell 5.1 e PowerShell 7).
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$guard = 'C:/unificard/backend/scripts/audit-db-role-rls-hardening.mjs'
$mig = 'C:/unificard/backend/migrations/20260620120000_db_role_rls_hardening.sql'
$migRel = 'backend/migrations/20260620120000_db_role_rls_hardening.sql'
$pre = 'C:/unificard/backend/src/core/database/db-role-rls-preflight.ts'
$preRel = 'backend/src/core/database/db-role-rls-preflight.ts'

function Test-Bite {
  param([string]$file, [string]$rel, [string]$needle, [string]$inject)
  $origBytes = [IO.File]::ReadAllBytes($file)
  $preStatus = (& git -C C:/unificard status --porcelain -- $rel)
  $failed = $false
  try {
    & node $guard | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'BASE FAILED: guard did not pass before mutation.' }
    Write-Host '[OK] BASE guard passes' -ForegroundColor Green
    $text = [Text.Encoding]::UTF8.GetString($origBytes)
    $mutated = $text.Replace($needle, $inject)
    if ($mutated -eq $text) { throw 'MUTATION NO-OP: anchor not found.' }
    [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))
    & node $guard | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'NEGATIVE-PROOF FAILED: guard PASSED with regression.' }
    Write-Host '[OK] NEGATIVE-PROOF: guard FAILED with regression (expected)' -ForegroundColor Green
  }
  catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
  finally { [IO.File]::WriteAllBytes($file, $origBytes); Write-Host '[CLEANUP] restored' -ForegroundColor Cyan }
  if ($failed) { exit 1 }
  $restored = [IO.File]::ReadAllBytes($file)
  $identical = ($restored.Length -eq $origBytes.Length)
  if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
  if (-not $identical) { Write-Host '[ERROR] restore NOT byte-identical' -ForegroundColor Red; exit 1 }
  if ($preStatus -ne (& git -C C:/unificard status --porcelain -- $rel)) { Write-Host '[ERROR] git status changed' -ForegroundColor Red; exit 1 }
  & node $guard | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host '[ERROR] POST-RESTORE guard not OK' -ForegroundColor Red; exit 1 }
  Write-Host '[OK] restored byte-identical + git clean + guard OK' -ForegroundColor Green
}

$grantAnchor = 'GRANT USAGE ON SCHEMA public TO unificard_app;'

Write-Host '=== NP1 - app role SUPERUSER ===' -ForegroundColor Cyan
Test-Bite $mig $migRel 'NOSUPERUSER' 'SUPERUSER'

Write-Host '=== NP2 - app role BYPASSRLS ===' -ForegroundColor Cyan
Test-Bite $mig $migRel 'NOBYPASSRLS' 'BYPASSRLS'

Write-Host '=== NP3 - remove FORCE RLS de approval_requests ===' -ForegroundColor Cyan
Test-Bite $mig $migRel 'ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;' '-- FORCE removido (negative-proof)'

Write-Host '=== NP4 - policy USING(true) app-facing ===' -ForegroundColor Cyan
Test-Bite $mig $migRel $grantAnchor "$grantAnchor`nCREATE POLICY evil_open ON approval_requests USING (true);"

Write-Host '=== NP5 - pre-flight deixa de consultar pg_roles ===' -ForegroundColor Cyan
Test-Bite $pre $preRel 'pg_roles' 'pg_DISABLED_roles'

Write-Host '=== NP6 - DISABLE ROW LEVEL SECURITY ativo ===' -ForegroundColor Cyan
Test-Bite $mig $migRel $grantAnchor "$grantAnchor`nALTER TABLE approval_requests DISABLE ROW LEVEL SECURITY;"

Write-Host '=== NP7 - relaxa RLS de bank_ledger ===' -ForegroundColor Cyan
Test-Bite $mig $migRel $grantAnchor "$grantAnchor`nALTER TABLE bank_ledger DISABLE ROW LEVEL SECURITY;"

Write-Host 'DB-ROLE-RLS-HARDENING NEGATIVE-PROOF: all seven bites confirmed and restored byte-identical. OK' -ForegroundColor Green
exit 0
