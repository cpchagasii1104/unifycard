# negative-proof-supplier-owner-authority.ps1
# Prova que o guard audit-supplier-owner-authority.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica.
# Morde se: (1) perder validação organizacional; (2) perder canRepresentActor; (3) create passar body como owner;
# (4) created_by virar owner; (5) service não exigir owner; (6) migration de owner quebrar; (7) repo perder owner.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = 'src/modules/marketplace/supplier.routes.ts'
$service = 'src/modules/marketplace/supplier.service.ts'
$repo = 'src/modules/marketplace/supplier.repository.ts'
$types = 'src/modules/marketplace/supplier.types.ts'
$mig = (Get-ChildItem migrations -Filter '*suppliers_owner_actor_id.sql' | Select-Object -First 1).FullName
$mig = (Resolve-Path $mig).Path -replace [regex]::Escape((Resolve-Path .).Path + '\'), ''
$files = @($routes, $service, $repo, $types, $mig)

function Invoke-Guard { node scripts/audit-supplier-owner-authority.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$noOrg = $false; $noRep = $false; $bodyOwner = $false; $createdByOwner = $false; $noOwnerReq = $false; $migBroken = $false; $repoBroken = $false; $statusUpper = $false

try {
  # (1) perde validação organizacional (page).
  Set-Content -Path $routes -Value ($orig[$routes] -replace "actor_type === 'page'", "actor_type === 'user'") -Encoding UTF8 -NoNewline
  $noOrg = ((Invoke-Guard) -ne 0); Restore

  # (2) perde canRepresentActor.
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOther') -Encoding UTF8 -NoNewline
  $noRep = ((Invoke-Guard) -ne 0); Restore

  # (3) create passa o owner do BODY como autoridade (sem isOrgActor sobre ownerHint).
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'isOrgActor\(tenantId, ownerHint\)', 'isOrgActor(tenantId, "anything")') -Encoding UTF8 -NoNewline
  $bodyOwner = ((Invoke-Guard) -ne 0); Restore

  # (4) created_by vira owner (ownerActorId: actionContext.actorId direto, em vez do ownerHint validado).
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'ownerActorId: ownerHint }', 'ownerActorId: actionContext.actorId }') -Encoding UTF8 -NoNewline
  $createdByOwner = ((Invoke-Guard) -ne 0); Restore

  # (5) service não exige owner.
  Set-Content -Path $service -Value ($orig[$service] -replace 'SUPPLIER_OWNER_REQUIRED', 'SUPPLIER_OWNER_OK') -Encoding UTF8 -NoNewline
  $noOwnerReq = ((Invoke-Guard) -ne 0); Restore

  # (6) migration de owner quebra (perde FK actors).
  Set-Content -Path $mig -Value ($orig[$mig] -replace 'REFERENCES actors\(id\)', 'REFERENCES suppliers(id)') -Encoding UTF8 -NoNewline
  $migBroken = ((Invoke-Guard) -ne 0); Restore

  # (7) repo perde owner_actor_id.
  Set-Content -Path $repo -Value ($orig[$repo] -replace 'owner_actor_id', 'legacy_col') -Encoding UTF8 -NoNewline
  $repoBroken = ((Invoke-Guard) -ne 0); Restore

  # (8) status volta a uppercase no type (desalinha do CHECK físico lowercase).
  Set-Content -Path $types -Value ($orig[$types] -replace "SupplierStatus = 'active' \| 'inactive'", "SupplierStatus = 'ACTIVE' | 'inactive'") -Encoding UTF8 -NoNewline
  $statusUpper = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $noOrg -and $noRep -and $bodyOwner -and $createdByOwner -and $noOwnerReq -and $migBroken -and $repoBroken -and $statusUpper -and $restored -and $guardGreenAgain
Write-Host "[neg-proof supplier-owner] baseOk=$baseOk noOrg=$noOrg noRep=$noRep bodyOwner=$bodyOwner createdByOwner=$createdByOwner noOwnerReq=$noOwnerReq migBroken=$migBroken repoBroken=$repoBroken statusUpper=$statusUpper restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-org/sem-canRepresentActor/body-owner/created_by-owner/service-sem-owner/migration-quebrada/repo-sem-owner/status-uppercase; restauracao byte-identica.' -ForegroundColor Green
exit 0
