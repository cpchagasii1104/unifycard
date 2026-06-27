# negative-proof-operator-service-order-view-grant-frontend.ps1
# Prova que o guard audit-operator-service-order-view-grant-frontend.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
# Cobre a contenção do FRONTEND do operador-por-concessão (nenhum guard de backend morde o browser):
#   ponte canônica virando business-permissions / tocando dinheiro / concedendo capability proibida,
#   GAP-B perdendo a capability fixa service_order:view, GAP-C tocando financial-terms / mutando ordem /
#   criando ordem direta / importando service-bookings, e a rota contida sumindo do App.
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$fe = Join-Path (Get-Location) '..\frontend\src'
$api = Join-Path $fe 'api\authority-grants.ts'
$mgr = Join-Path $fe 'components\authority\OperatorGrantsManager.tsx'
$page = Join-Path $fe 'pages\OperatorOrdersPage.tsx'
$app = Join-Path $fe 'App.tsx'

function Invoke-Guard {
    node scripts/audit-operator-service-order-view-grant-frontend.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

# Bites que MUTAM arquivo existente (regex replace, 1ª ocorrência) ─────────────────────────────────
$mutateBites = @(
    @{ name = 'api-uses-business-permissions'; file = $api;
       find = "import \{ apiFetchJson \} from './client';";
       repl = "import { checkPermission } from './business-permissions';`nimport { apiFetchJson } from './client';" },
    @{ name = 'api-allows-forbidden-capability'; file = $api;
       find = "  \| 'service_order:view';";
       repl = "  | 'service_order:view'`n  | 'booking:manage';" },
    @{ name = 'api-touches-money'; file = $api;
       find = "export type CapabilityGrantStatus";
       repl = "const __m = 'settlement';`nexport type CapabilityGrantStatus" },
    @{ name = 'gap-b-loses-service_order_view'; file = $mgr;
       find = "const CAPABILITY = 'service_order:view' as const;";
       repl = "const CAPABILITY = 'services:edit' as const;" },
    @{ name = 'gap-b-uses-business-permissions'; file = $mgr;
       find = "import './OperatorGrantsManager.css';";
       repl = "import { checkPermission } from '../../api/business-permissions';`nimport './OperatorGrantsManager.css';" },
    @{ name = 'gap-b-grants-non-read-capability'; file = $mgr;
       find = "const CAPABILITY = 'service_order:view' as const;";
       repl = "const CAPABILITY = 'service_order:view' as const;`nconst __X = 'service_order:update_status';" },
    @{ name = 'gap-c-touches-financial-terms'; file = $page;
       find = "import './ServiceOrdersPage.css';";
       repl = "import { getServiceOrderFinancialTerms } from '../api/service-orders';`nimport './ServiceOrdersPage.css';" },
    @{ name = 'gap-c-mutates-order'; file = $page;
       find = "  const formatDate = ";
       repl = "  const __mut = confirmServiceOrder;`n  const formatDate = " },
    @{ name = 'gap-c-creates-order-direct'; file = $page;
       find = "  const formatDate = ";
       repl = "  const __c = createServiceOrder;`n  const formatDate = " },
    @{ name = 'gap-c-uses-service-bookings'; file = $page;
       find = "import './ServiceOrdersPage.css';";
       repl = "import { x } from '../api/service-bookings';`nimport './ServiceOrdersPage.css';" },
    @{ name = 'app-drops-operator-route'; file = $app;
       find = 'path="operator/service-orders"';
       repl = 'path="zz/disabled"' }
)

$targets = @($mutateBites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = (Get-Content $f -Raw); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { Set-Content -Path $file -Value $snapshot[$file].content -NoNewline -Encoding UTF8 }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $mutateBites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            $mutated = $rx.Replace($orig, $b.repl, 1)
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            Set-Content -Path $b.file -Value $mutated -NoNewline -Encoding UTF8
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
Write-Host "[neg-proof operator-service-order-view-grant-frontend] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
