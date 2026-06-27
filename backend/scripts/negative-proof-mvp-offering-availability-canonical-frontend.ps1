# negative-proof-mvp-offering-availability-canonical-frontend.ps1
# Prova que o guard audit-mvp-offering-availability-canonical-frontend.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
# Cobre a contenção da armadilha W1 (agenda SERVICE-level invisível ao consumer):
#   reintroduzir a rota/import service-level como reservável, perder o offering-level canônico
#   (declareOfferingAvailability), perder a leitura do consumer (owner='service_offering'), tornar a escrita
#   service-level consumer-facing, perder o terminal honesto, tocar dinheiro ou reabrir schedules.
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$fe = Join-Path (Get-Location) '..\frontend\src'
$app = Join-Path $fe 'App.tsx'
$create = Join-Path $fe 'pages\ServiceCreatePage.tsx'
$selector = Join-Path $fe 'components\ServiceOfferingSelector.tsx'
$quarantine = Join-Path $fe 'pages\ServiceLegacyQuarantinePage.tsx'
$discoveryDetail = Join-Path $fe 'pages\ServiceDiscoveryDetailPage.tsx'

function Invoke-Guard {
    node scripts/audit-mvp-offering-availability-canonical-frontend.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

# Bites que MUTAM arquivo existente (regex replace, 1ª ocorrência) ─────────────────────────────────
$mutateBites = @(
    @{ name = 'app-reroutes-service-level-availability'; file = $app;
       find = 'element=\{<ServiceLegacyQuarantinePage variant="availability-offering-managed" />\}';
       repl = 'element={<ServiceAvailabilityPage />}' },
    @{ name = 'app-reimports-service-availability-page'; file = $app;
       find = "import ServiceDetailPage from './pages/ServiceDetailPage'; // Services MVP";
       repl = "import ServiceDetailPage from './pages/ServiceDetailPage'; // Services MVP`nimport ServiceAvailabilityPage from './pages/ServiceAvailabilityPage';" },
    @{ name = 'create-loses-offering-availability'; file = $create;
       find = 'declareOfferingAvailability\(offering\.id';
       repl = 'void declareOfferingAvailability; await Promise.resolve(offering.id' },
    @{ name = 'selector-loses-offering-owner-read'; file = $selector;
       find = "ownerType: 'service_offering'";
       repl = "ownerType: 'service'" },
    @{ name = 'discovery-detail-imports-service-level-write'; file = $discoveryDetail;
       find = "import './ServiceDiscoveryDetailPage.css';";
       repl = "import { createServiceAvailability } from '../api/service-availability';`nimport './ServiceDiscoveryDetailPage.css';" },
    @{ name = 'quarantine-loses-honest-variant'; file = $quarantine;
       find = "'availability-offering-managed': \{";
       repl = "'availability-zzz-removed': {" }
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
Write-Host "[neg-proof mvp-offering-availability-canonical-frontend] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
