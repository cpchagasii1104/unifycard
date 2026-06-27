# negative-proof-disputes-frontend-honest-containment.ps1
# Prova que o guard audit-disputes-frontend-honest-containment.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
# Cobre a fabricação ÚNICA do frontend (nenhum guard de backend morde o browser):
#   reversão/criação/resolução fake, localStorage como verdade, status='reverted',
#   revertedTransactionId como verdade, painel reimportando api/modal, modal de fabricação recriado,
#   e o botão "Reverter Ação" reintroduzido.
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$fe = Join-Path (Get-Location) '..\frontend\src'
$api = Join-Path $fe 'api\disputes.ts'
$panel = Join-Path $fe 'components\dispute\DisputePanel.tsx'
$act = Join-Path $fe 'components\timeline\ActivityDetailModal.tsx'
$resolutionModal = Join-Path $fe 'components\dispute\DisputeResolutionModal.tsx'

function Invoke-Guard {
    node scripts/audit-disputes-frontend-honest-containment.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

# Bites que MUTAM arquivo existente (regex replace, 1ª ocorrência) ─────────────────────────────────
$mutateBites = @(
    @{ name = 'api-reexports-revertDispute'; file = $api;
       find = "export async function listDisputes";
       repl = "export async function revertDispute(): Promise<any> { return null; }`nexport async function listDisputes" },
    @{ name = 'api-localStorage-as-truth'; file = $api;
       find = "  return \[\];";
       repl = "  localStorage.getItem('unify_disputes');`n  return [];" },
    @{ name = 'api-fabricates-status-reverted'; file = $api;
       find = "  return null;";
       repl = "  const d: any = {}; d.status = 'reverted'; return null;" },
    @{ name = 'api-fabricates-revertedTransactionId'; file = $api;
       find = "  return null;";
       repl = "  const d: any = {}; d.revertedTransactionId = 'tx'; return null;" },
    @{ name = 'panel-imports-DisputeResolutionModal'; file = $panel;
       find = "import './DisputePanel.css';";
       repl = "import DisputeResolutionModal from './DisputeResolutionModal';`nimport './DisputePanel.css';" },
    @{ name = 'panel-imports-api-disputes'; file = $panel;
       find = "import './DisputePanel.css';";
       repl = "import { listOpenDisputes } from '../../api/disputes';`nimport './DisputePanel.css';" },
    @{ name = 'panel-reintroduces-Reverter-Acao-button'; file = $panel;
       find = "  return \(";
       repl = "  const ___btn = 'Reverter Ação';`n  return (" },
    @{ name = 'activity-calls-createDispute'; file = $act;
       find = "  const formatDate = ";
       repl = "  createDispute();`n  const formatDate = " }
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

    # Bite que RECRIA um arquivo de fabricação removido (D) ─────────────────────────────────────────
    $createBit = $false
    try {
        Set-Content -Path $resolutionModal -Value "export default function DisputeResolutionModal() { return null; }" -NoNewline -Encoding UTF8
        $createBit = ((Invoke-Guard) -ne 0)
    }
    finally {
        if (Test-Path $resolutionModal) { Remove-Item $resolutionModal -Force }
    }
    $createRestoredOk = ((Invoke-Guard) -eq 0)
    $createGoneOk = (-not (Test-Path $resolutionModal))
    if (-not ($createBit -and $createRestoredOk -and $createGoneOk)) { $allBitesOk = $false }
    $details += "recreate-DisputeResolutionModal=morde:$createBit,restaura:$createRestoredOk,removido:$createGoneOk"
}
finally {
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot" -ForegroundColor Yellow
        }
    }
    if (Test-Path $resolutionModal) { Remove-Item $resolutionModal -Force; Write-Host "  [restore-backstop] DisputeResolutionModal removido" -ForegroundColor Yellow }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof disputes-frontend-honest-containment] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
