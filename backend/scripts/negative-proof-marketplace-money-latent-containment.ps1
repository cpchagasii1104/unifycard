# negative-proof-marketplace-money-latent-containment.ps1
# Reproducible proof that audit-marketplace-money-latent-containment.mjs BITES when a money-latent
# route re-calls the sink (settlementService.settle) instead of the fail-closed 403. Mutates the file
# (byte-exact backup), confirms GATE FAIL (exit 1), restores byte-identical and confirms GATE OK.
# ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7 alike.
# F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT.
$ErrorActionPreference = 'Stop'
# Guard resolves src/... against process.cwd(); pin to backend so the proof runs from any cwd.
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/marketplace/settlement.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-marketplace-money-latent-containment.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$failed = $false
try {
  # Base state: guard must PASS before mutation.
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: re-wire the mutation sink in the settle handler (the exact vector guarded).
  $needle = 'return reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED);'
  $inject = 'await settlementService.settle(req.tenant.id, req.params.id, ''x'', ''y''); return reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED);'
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: 403 anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with the sink re-wired -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with settlementService.settle re-wired (expected)." -ForegroundColor Green
}
catch { $failed = $true; Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red }
finally {
  [IO.File]::WriteAllBytes($file, $origBytes)
  Write-Host "[CLEANUP] file restored." -ForegroundColor Cyan
}
if ($failed) { exit 1 }

# Restore must be byte-identical.
$restored = [IO.File]::ReadAllBytes($file)
$identical = ($restored.Length -eq $origBytes.Length)
if ($identical) { for ($i = 0; $i -lt $restored.Length; $i++) { if ($restored[$i] -ne $origBytes[$i]) { $identical = $false; break } } }
if (-not $identical) { Write-Host "[ERROR] restore is NOT byte-identical." -ForegroundColor Red; exit 1 }
Write-Host "[OK] restore is byte-identical to the original." -ForegroundColor Green

# git working tree must be clean for the mutated file (no residual change).
$dirty = (& git -C C:/unificard status --porcelain -- backend/src/modules/marketplace/settlement.routes.ts)
if ($dirty) { Write-Host "[ERROR] git shows residual change for settlement.routes.ts: $dirty" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status clean for settlement.routes.ts (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
