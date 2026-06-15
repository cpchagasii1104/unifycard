# negative-proof-pdv-authority-lock.ps1
# Prova que o guard audit-pdv-authority-lock.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica
# (SHA256). O guard FALHA se:
#   (a) surgir rota PDV nova não classificada (autoria canal-1);
#   (b) a rota de pagamento for declassificada de DIVERGENT-MONEY sem binding real;
#   (c) o PDV tocar bank_ledger DIRETO.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = 'src/modules/pdv/pdv.routes.ts'
$service = 'src/modules/pdv/pdv.service.ts'
$guard = 'scripts/audit-pdv-authority-lock.mjs'
$files = @($routes, $service, $guard)

function Invoke-Guard { node scripts/audit-pdv-authority-lock.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$newRouteBites = $false; $payDeclassBites = $false; $bankTouchBites = $false

try {
  # (a) rota PDV nova não classificada.
  Set-Content -Path $routes -Value ($orig[$routes] + "`nfastify.post('/np/fake-new', async () => ({}));`n") -Encoding UTF8 -NoNewline
  $newRouteBites = ((Invoke-Guard) -ne 0); Restore

  # (b) pay declassificada de DIVERGENT-MONEY sem binding (mutação no REGISTRO do guard).
  Set-Content -Path $guard -Value ($orig[$guard] -replace "('POST /orders/:orderId/pay':\s*)'DIVERGENT-MONEY[^']*'", "`$1'CANONICAL (fake)'") -Encoding UTF8 -NoNewline
  $payDeclassBites = ((Invoke-Guard) -ne 0); Restore

  # (c) PDV toca bank_ledger direto.
  Set-Content -Path $service -Value ($orig[$service] + "`nasync function __np_bank__(p){ return p.query('INSERT INTO bank_ledger (x) VALUES (1)'); }`n") -Encoding UTF8 -NoNewline
  $bankTouchBites = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $newRouteBites -and $payDeclassBites -and $bankTouchBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof pdv-authority-lock] baseOk=$baseOk newRouteBites=$newRouteBites payDeclassBites=$payDeclassBites bankTouchBites=$bankTouchBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde rota nova/pay-declassificada/bank-touch direto; restauração byte-idêntica.' -ForegroundColor Green
exit 0
