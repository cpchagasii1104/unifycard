# negative-proof-po-owner-authority.ps1
# Prova que o guard audit-po-owner-authority.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica.
# Morde se: (1) perder validação organizacional do owner; (2) perder canRepresentActor; (3) service não exigir
# owner; (4) rota tocar Bank/inventory; (5) receivePO deixar de ser 403 contido; (6) migration de owner quebrar.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = 'src/modules/marketplace/purchase-order.routes.ts'
$service = 'src/modules/marketplace/purchase-order.service.ts'
$mig = (Get-ChildItem migrations -Filter '*purchase_orders_owner_actor_id.sql' | Select-Object -First 1).FullName
$mig = (Resolve-Path $mig).Path -replace [regex]::Escape((Resolve-Path .).Path + '\'), ''
$files = @($routes, $service, $mig)

function Invoke-Guard { node scripts/audit-po-owner-authority.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$noOrg = $false; $noRep = $false; $noOwnerReq = $false; $bankTouch = $false; $receiveUncontained = $false; $migBroken = $false

try {
  # (1) perde validação organizacional (actor_type='page').
  Set-Content -Path $routes -Value ($orig[$routes] -replace "actor_type === 'page'", "actor_type === 'user'") -Encoding UTF8 -NoNewline
  $noOrg = ((Invoke-Guard) -ne 0); Restore

  # (2) perde canRepresentActor.
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $noRep = ((Invoke-Guard) -ne 0); Restore

  # (3) service deixa de exigir owner.
  Set-Content -Path $service -Value ($orig[$service] -replace 'PURCHASE_ORDER_OWNER_REQUIRED', 'PURCHASE_ORDER_OWNER_OK') -Encoding UTF8 -NoNewline
  $noOwnerReq = ((Invoke-Guard) -ne 0); Restore

  # (4) rota toca Bank/inventory.
  Set-Content -Path $routes -Value ($orig[$routes] + "`nconst __np = `"await inventoryService.addMovement(tenantId, {})`";`n") -Encoding UTF8 -NoNewline
  $bankTouch = ((Invoke-Guard) -ne 0); Restore

  # (5) receivePO deixa de ser 403 contido.
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'PURCHASE_ORDER_RECEIVE_CONTAINED', 'PURCHASE_ORDER_RECEIVE_OK') -Encoding UTF8 -NoNewline
  $receiveUncontained = ((Invoke-Guard) -ne 0); Restore

  # (6) migration de owner quebra (perde FK actors).
  Set-Content -Path $mig -Value ($orig[$mig] -replace 'REFERENCES actors', 'REFERENCES suppliers') -Encoding UTF8 -NoNewline
  $migBroken = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $noOrg -and $noRep -and $noOwnerReq -and $bankTouch -and $receiveUncontained -and $migBroken -and $restored -and $guardGreenAgain
Write-Host "[neg-proof po-owner-authority] baseOk=$baseOk noOrg=$noOrg noRep=$noRep noOwnerReq=$noOwnerReq bankTouch=$bankTouch receiveUncontained=$receiveUncontained migBroken=$migBroken restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-org/sem-canRepresentActor/service-sem-owner/bank-touch/receive-descontido/migration-quebrada; restauração byte-idêntica.' -ForegroundColor Green
exit 0
