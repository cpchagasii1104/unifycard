# negative-proof-pdv-pay-financial-containment.ps1
# Prova que o guard audit-pdv-pay-financial-containment.mjs MORDE cada regressão da contenção do PDV-pay.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$fw  = Join-Path (Get-Location) 'src\modules\pdv\pdv-financial-firewall.ts'
$svc = Join-Path (Get-Location) 'src\modules\pdv\pdv.service.ts'

function Invoke-Guard {
    node scripts/audit-pdv-pay-financial-containment.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover o firewall da rota PDV (chamada no service) -> guard FAIL
    @{ name = 'firewall-removed';   file = $svc; find = "assertPdvFinancialRuntimeEnabled\('POST /pdv/orders/:orderId/pay'\);"; repl = "/* assertPdvFinancialRuntimeEnabled removido */" },
    # 2) helper fail-open: liga mesmo sem flag -> guard FAIL (=== 'true' some)
    @{ name = 'helper-fail-open';   file = $fw;  find = "return process\.env\[PDV_FINANCIAL_RUNTIME_FLAG\] === 'true';"; repl = "return true;" },
    # 3) NODE_ENV auto-enable -> guard FAIL
    @{ name = 'node-env-autoenable';file = $fw;  find = "return process\.env\[PDV_FINANCIAL_RUNTIME_FLAG\] === 'true';"; repl = "return process.env.NODE_ENV !== 'production';" },
    # 4) mover o firewall para DEPOIS do createPaymentIntent -> guard FAIL (ordem)
    @{ name = 'firewall-after-money'; file = $svc;
       find = "assertPdvFinancialRuntimeEnabled\('POST /pdv/orders/:orderId/pay'\);";
       repl = "createPaymentIntent(0);`r`n    assertPdvFinancialRuntimeEnabled('POST /pdv/orders/:orderId/pay');" }
)

$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = (Get-Content $f -Raw); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { Set-Content -Path $file -Value $snapshot[$file].content -NoNewline -Encoding UTF8 }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            $mutated = if ($b.all) { $rx.Replace($orig, $b.repl) } else { $rx.Replace($orig, $b.repl, 1) }
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
Write-Host "[neg-proof pdv-pay-financial-containment] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
