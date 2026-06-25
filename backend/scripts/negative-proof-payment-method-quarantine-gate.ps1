# negative-proof-payment-method-quarantine-gate.ps1
# Prova que o guard audit-payment-method-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\marketplace\payment-method.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-payment-method-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate scopeActor do createMethod -> guard FAIL
    @{ name = 'gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.actorId\);";
       repl = "/* sem gate */" },
    # 2) mover gate para DEPOIS do unsetDefaultForActor (a tabua do default fica aberta) -> guard FAIL
    @{ name = 'gate-after-unset-default'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.actorId\);";
       repl = "await paymentMethodRepository.unsetDefaultForActor(tenantId, input.actorId);`n    await this.assertActorNotQuarantined(tenantId, input.actorId);" },
    # 3) remover gate do acting/createdBy actor -> guard FAIL
    @{ name = 'acting-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, createdByActorId\);";
       repl = "/* sem gate acting */"; all = $true },
    # 4) gate usando userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.actorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, createdByUserId);" },
    # 5) transformar payment-method em execucao financeira -> guard FAIL
    @{ name = 'payment-execution-leak'; file = $svc;
       find = "class PaymentMethodService \{";
       repl = "class PaymentMethodService {`n  async __leak() { await executePayment(); }" },
    # 6) enfiar quarentena em canRepresentActor -> guard FAIL
    @{ name = 'quarantine-in-canrepresent'; file = $authz;
       find = "  async canRepresentActor\(";
       repl = "  async canRepresentActor(__q = await import('@modules/risk-identity/actor-effective-block').then(m => m.isActorEffectivelyBlocked)," }
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
Write-Host "[neg-proof payment-method-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
