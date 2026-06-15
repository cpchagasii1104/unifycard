# negative-proof-po-receive-containment.ps1
# Prova que o guard audit-po-receive-containment.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica.
# O guard FALHA se: (1) receivePO perder o hard-stop; (2) uma mutação voltar para dentro de receivePO;
# (3) o impl contido ganhar caller; (4) a rota /receive perder o 403; (5) a rota voltar a chamar o service receivePO.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$svc = 'src/modules/marketplace/purchase-order.service.ts'
$routes = 'src/modules/marketplace/purchase-order.routes.ts'
$files = @($svc, $routes)

function Invoke-Guard { node scripts/audit-po-receive-containment.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$noHardStop = $false; $mutationInReceive = $false; $implCaller = $false; $routeNo403 = $false; $routeCallsService = $false

try {
  # (1) receivePO perde o hard-stop (remove o throw).
  Set-Content -Path $svc -Value ($orig[$svc] -replace 'throw new AppError\(', 'const __np_removed = (') -Encoding UTF8 -NoNewline
  $noHardStop = ((Invoke-Guard) -ne 0); Restore

  # (2) uma mutação volta para dentro de receivePO (injetada após o hard-stop).
  Set-Content -Path $svc -Value ($orig[$svc] -replace "('PURCHASE_ORDER_RECEIVE_CONTAINED'\s*\r?\n\s*\);)", "`$1 await inventoryService.addMovement(tenantId, {} as any);") -Encoding UTF8 -NoNewline
  $mutationInReceive = ((Invoke-Guard) -ne 0); Restore

  # (3) o impl contido ganha caller.
  Set-Content -Path $svc -Value ($orig[$svc] -replace 'private async receivePOContainedImpl\(', "async __npCaller(){ return this.receivePOContainedImpl('a','b',{} as any); }`n  private async receivePOContainedImpl(") -Encoding UTF8 -NoNewline
  $implCaller = ((Invoke-Guard) -ne 0); Restore

  # (4) a rota /receive perde o 403.
  Set-Content -Path $routes -Value ($orig[$routes] -replace '\.status\(403\)', '.status(200)') -Encoding UTF8 -NoNewline
  $routeNo403 = ((Invoke-Guard) -ne 0); Restore

  # (5) a rota volta a chamar purchaseOrderService.receivePO.
  Set-Content -Path $routes -Value ($orig[$routes] -replace "return reply\.status\(403\)\.send\(\{", "void purchaseOrderService.receivePO(_req as any); return reply.status(403).send({") -Encoding UTF8 -NoNewline
  $routeCallsService = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $noHardStop -and $mutationInReceive -and $implCaller -and $routeNo403 -and $routeCallsService -and $restored -and $guardGreenAgain
Write-Host "[neg-proof po-receive-containment] baseOk=$baseOk noHardStop=$noHardStop mutationInReceive=$mutationInReceive implCaller=$implCaller routeNo403=$routeNo403 routeCallsService=$routeCallsService restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-hard-stop/mutacao-em-receivePO/impl-com-caller/rota-sem-403/rota-chama-service; restauração byte-idêntica.' -ForegroundColor Green
exit 0
