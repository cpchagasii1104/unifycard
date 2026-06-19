# negative-proof-social-marketplace-ref-schema-ghost-containment.ps1
# Reproducible proof that audit-social-marketplace-ref-schema-ghost-containment.mjs BITES when a contained route
# starts writing again — re-introduce socialMarketplaceRefService.createRef in POST /marketplace-ref, touching the
# schema-ghost substrate. The guard then fails (service call forbidden + <3 contained).
# Mutates social-marketplace-ref.routes.ts (byte-exact backup), confirms GATE FAIL (exit 1), restores
# byte-identical and confirms GATE OK. ASCII-only + no BOM so it parses under Windows PowerShell 5.1 and PowerShell 7.
# R8D SOCIAL-MARKETPLACE-REF SCHEMA-GHOST CONTAINMENT.
$ErrorActionPreference = 'Stop'
Set-Location 'C:/unificard/backend'
$file  = 'C:/unificard/backend/src/modules/social/social-marketplace-ref.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-social-marketplace-ref-schema-ghost-containment.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$preStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/social/social-marketplace-ref.routes.ts)
$failed = $false
try {
  & node $guard
  if ($LASTEXITCODE -ne 0) { throw "BASE STATE FAILED: guard did not pass before mutation (exit $LASTEXITCODE)." }
  Write-Host "[OK] BASE: guard passes before mutation." -ForegroundColor Green

  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Simulated regression: POST writes again to the ghost substrate (service call reintroduced).
  $needle = "fastify.post('/marketplace-ref', async (_req, reply) => reply.status(501).send(CONTAINED));"
  $inject = "fastify.post('/marketplace-ref', async (req, reply) => reply.send(await socialMarketplaceRefService.createRef(req.tenant.id, req.body)));"
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: POST containment anchor not found (did the file change?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FAILED: guard PASSED (exit 0) with POST writing again -- expected FAIL." }
  Write-Host "[OK] NEGATIVE-PROOF: guard FAILED (exit $rc) with the ghost write reintroduced (expected)." -ForegroundColor Green
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

$postStatus = (& git -C C:/unificard status --porcelain -- backend/src/modules/social/social-marketplace-ref.routes.ts)
if ($preStatus -ne $postStatus) { Write-Host "[ERROR] git status changed by the proof (residual): '$preStatus' -> '$postStatus'" -ForegroundColor Red; exit 1 }
Write-Host "[OK] git status unchanged by the proof (no residual mutation)." -ForegroundColor Green

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] POST-RESTORE: guard did not pass after restore." -ForegroundColor Red; exit 1 }
Write-Host "[OK] POST-RESTORE: guard OK (exit 0). Reproducible negative-proof complete." -ForegroundColor Green
exit 0
