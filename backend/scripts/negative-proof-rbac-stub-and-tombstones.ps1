# negative-proof-rbac-stub-and-tombstones.ps1
# Prova que o guard audit-rbac-stub-and-tombstones.mjs MORDE. Mutação temporária na migration
# fail-closed + RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se:
#   (a) F1 — actor_has_permission for redefinido (mais novo) p/ RETURN TRUE (swap do stub FASE 6);
#   (b) F2 — alguma migration (re)criar organization_members (ressurreição de tombstone).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$mig = 'migrations/20260422000100_actor_has_permission_fail_closed.sql'
function Invoke-Guard { node scripts/audit-rbac-stub-and-tombstones.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $mig -Raw
$sha = Get-Sha $mig
$baseOk = ((Invoke-Guard) -eq 0)
$swapBites = $false; $resurrectBites = $false

$swap = "`nCREATE OR REPLACE FUNCTION actor_has_permission(p_tenant_id UUID, p_actor_id UUID, p_resource TEXT, p_action TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS `$`$ BEGIN RETURN TRUE; END; `$`$;`n"
$resurrect = "`nCREATE TABLE organization_members (id uuid PRIMARY KEY);`n"

try {
  # (a) swap do stub p/ RETURN TRUE (def mais nova no arquivo efetivo).
  Set-Content -Path $mig -Value ($orig + $swap) -Encoding UTF8 -NoNewline
  $swapBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $mig -Value $orig -Encoding UTF8 -NoNewline

  # (b) ressurreição de organization_members.
  Set-Content -Path $mig -Value ($orig + $resurrect) -Encoding UTF8 -NoNewline
  $resurrectBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $mig -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $mig -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $mig) -eq $sha
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $swapBites -and $resurrectBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof rbac-stub-and-tombstones] baseOk=$baseOk swapBites=$swapBites resurrectBites=$resurrectBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde swap do stub (RETURN TRUE) e ressurreição de organization_members; restauração byte-idêntica.' -ForegroundColor Green
exit 0
