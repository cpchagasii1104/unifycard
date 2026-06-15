# negative-proof-pdv-authority-lock.ps1
# Prova que o guard audit-pdv-authority-lock.mjs MORDE (PDV-F0-LOCK + PDV-F2A). Mutações temporárias +
# RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se:
#   (a) a rota pay perder canRepresentActor (CANONICAL sem binding real);
#   (b) a rota pay perder getOrderById (order/seller não resolvido server-side);
#   (c) payOrderFromPdv for chamado ANTES do gate canônico;
#   (d) surgir rota PDV nova não classificada;
#   (e) o PDV tocar bank_ledger DIRETO.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = 'src/modules/pdv/pdv.routes.ts'
$service = 'src/modules/pdv/pdv.service.ts'
$files = @($routes, $service)

function Invoke-Guard { node scripts/audit-pdv-authority-lock.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$noBindingBites = $false; $noOrderBites = $false; $orderBites = $false; $newRouteBites = $false; $bankBites = $false

try {
  # (a) pay sem canRepresentActor (CANONICAL sem binding).
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $noBindingBites = ((Invoke-Guard) -ne 0); Restore

  # (b) pay sem getOrderById (seller não resolvido server-side).
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'orderService\.getOrderById', 'orderService.someOtherGet') -Encoding UTF8 -NoNewline
  $noOrderBites = ((Invoke-Guard) -ne 0); Restore

  # (c) payOrderFromPdv ANTES do gate (inserido após a leitura do idempotencyKey, antes do gate).
  Set-Content -Path $routes -Value ($orig[$routes] -replace "(const idempotencyKey = \(req\.headers\['idempotency-key'\] as string\) \|\| undefined;)", "`$1 await pdvService.payOrderFromPdv(tenantId, input);") -Encoding UTF8 -NoNewline
  $orderBites = ((Invoke-Guard) -ne 0); Restore

  # (d) rota PDV nova não classificada.
  Set-Content -Path $routes -Value ($orig[$routes] + "`nfastify.post('/np/fake-new', async () => ({}));`n") -Encoding UTF8 -NoNewline
  $newRouteBites = ((Invoke-Guard) -ne 0); Restore

  # (e) PDV toca bank_ledger direto.
  Set-Content -Path $service -Value ($orig[$service] + "`nasync function __np_bank__(p){ return p.query('INSERT INTO bank_ledger (x) VALUES (1)'); }`n") -Encoding UTF8 -NoNewline
  $bankBites = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $noBindingBites -and $noOrderBites -and $orderBites -and $newRouteBites -and $bankBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof pdv-authority-lock] baseOk=$baseOk noBinding=$noBindingBites noOrder=$noOrderBites orderBeforeGate=$orderBites newRoute=$newRouteBites bank=$bankBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-binding/sem-order/side-effect-antes-do-gate/rota-nova/bank-touch; restauração byte-idêntica.' -ForegroundColor Green
exit 0
