# negative-proof-service-order-direct-create-dead-end-sweep.ps1
# Prova que o guard audit-service-order-direct-create-dead-end-sweep.mjs MORDE cada regressão da
# lei da rota (ordem só nasce pelo fluxo canônico; nenhum frontend vivo oferece criação direta).
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$app    = Join-Path (Get-Location) '..\frontend\src\App.tsx'
$quar   = Join-Path (Get-Location) '..\frontend\src\pages\ServiceLegacyQuarantinePage.tsx'
$orders = Join-Path (Get-Location) '..\frontend\src\pages\ServiceOrdersPage.tsx'
$routes = Join-Path (Get-Location) 'src\modules\services\service-order.routes.ts'

function Invoke-Guard {
    # ErrorActionPreference=Continue ao redor do native call: WPS 5.1 levanta NativeCommandError quando o
    # guard escreve em stderr (GATE FAIL) sob Stop. 2>&1 | Out-Null engole streams nos dois shells.
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & node scripts/audit-service-order-direct-create-dead-end-sweep.mjs 2>&1 | Out-Null }
    finally { $ErrorActionPreference = $old }
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) rota /service-orders/new volta a renderizar o formulário direto -> guard FAIL (A)
    @{ name = 'route-order-new-reopens-create-form'; file = $app;
       find = '<ServiceLegacyQuarantinePage variant="order-create" />';
       repl = '<CreateServiceOrderPage />' },
    # 2) rota /booking-requests volta a System-A viva -> guard FAIL (B)
    @{ name = 'route-booking-requests-reopens-systema'; file = $app;
       find = '<ServiceLegacyQuarantinePage variant="booking-requests" />';
       repl = '<ServiceBookingRequestsPage />' },
    # 3) reintroduz import do legado de criação direta -> guard FAIL (C)
    @{ name = 'app-reimports-create-order-page'; file = $app;
       find = "import ServiceLegacyQuarantinePage from './pages/ServiceLegacyQuarantinePage';";
       repl = "import CreateServiceOrderPage from './pages/CreateServiceOrderPage';`nimport ServiceLegacyQuarantinePage from './pages/ServiceLegacyQuarantinePage';" },
    # 4) reintroduz CTA vivo navegando para o dead-end -> guard FAIL (D)
    @{ name = 'live-cta-navigates-to-dead-end'; file = $orders;
       find = "onClick=\{\(\) => navigate\('/discover/services'\)\}";
       repl = "onClick={() => navigate('/service-orders/new')}" },
    # 5) a própria página-guia passa a navegar para o dead-end -> guard FAIL (E)
    @{ name = 'quarantine-page-self-dead-end'; file = $quar;
       find = "onClick=\{\(\) => navigate\('/discover/services'\)\}";
       repl = "onClick={() => navigate('/service-orders/new')}" },
    # 6) backend reabre criação direta (lei soberana) -> guard FAIL (F)
    @{ name = 'backend-direct-create-reopened'; file = $routes;
       find = 'SERVICE_ORDER_DIRECT_CREATE_DISABLED';
       repl = 'SERVICE_ORDER_DIRECT_CREATE_ENABLED' }
)

# IO via [System.IO.File] (UTF8 sem BOM, fiel a acentos) — Set-Content/Get-Content do WPS 5.1 adicionam BOM e
# decodificam em ANSI, corrompendo bytes e quebrando a restauração byte-idêntica.
$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = [System.IO.File]::ReadAllText($f); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { [System.IO.File]::WriteAllText($file, $snapshot[$file].content) }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            $mutated = $rx.Replace($orig, $b.repl, 1)
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            [System.IO.File]::WriteAllText($b.file, $mutated)
            $bit = ((Invoke-Guard) -ne 0)
        }
        finally { Restore-FromSnapshot $b.file }
        $restoredOk = ((Invoke-Guard) -eq 0)
        $hashOk = ((Get-FileHash $b.file -Algorithm SHA256).Hash -eq $origHash)
        if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
        $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
    }
}
finally {
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot" -ForegroundColor Yellow
        }
    }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof service-order-direct-create-dead-end-sweep] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
