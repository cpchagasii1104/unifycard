# negative-proof-event-settlement-financial-containment.ps1
# Prova que o guard audit-event-settlement-financial-containment.mjs MORDE cada regressão da contenção.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$fw  = Join-Path (Get-Location) 'src\modules\marketplace\event-settlement-financial-firewall.ts'
$svc = Join-Path (Get-Location) 'src\modules\marketplace\event-settlement.service.ts'

function Invoke-Guard {
    node scripts/audit-event-settlement-financial-containment.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    @{ name = 'firewall-removed'; file = $svc; find = "assertEventSettlementRuntimeEnabled\('POST /events/:id/settlement/settle'\);"; repl = "/* removido */" },
    @{ name = 'helper-fail-open';  file = $fw;  find = "return process\.env\[EVENT_SETTLEMENT_RUNTIME_FLAG\] === 'true';"; repl = "return true;" },
    @{ name = 'node-env-autoenable'; file = $fw; find = "return process\.env\[EVENT_SETTLEMENT_RUNTIME_FLAG\] === 'true';"; repl = "return process.env.NODE_ENV !== 'production';" },
    @{ name = 'firewall-after-mark'; file = $svc;
       find = "assertEventSettlementRuntimeEnabled\('POST /events/:id/settlement/settle'\);";
       repl = "markAsSettled(0);`r`n    assertEventSettlementRuntimeEnabled('POST /events/:id/settlement/settle');" }
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
Write-Host "[neg-proof event-settlement-financial-containment] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
