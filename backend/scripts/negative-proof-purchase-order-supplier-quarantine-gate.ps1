# negative-proof-purchase-order-supplier-quarantine-gate.ps1
# Prova que o guard audit-purchase-order-supplier-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$po = Join-Path (Get-Location) 'src\modules\marketplace\purchase-order.service.ts'
$sup = Join-Path (Get-Location) 'src\modules\marketplace\supplier.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-purchase-order-supplier-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do createSupplier -> guard FAIL
    @{ name = 'supplier-gate-removed'; file = $sup;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.ownerActorId\);";
       repl = "/* sem gate */" },
    # 2) escrita de supplier ANTES do gate -> guard FAIL
    @{ name = 'supplier-write-before-gate'; file = $sup;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.ownerActorId\);";
       repl = "await supplierRepository.createSupplier(tenantId, {});`n    await this.assertActorNotQuarantined(tenantId, input.ownerActorId);" },
    # 3) remover gate do createPO -> guard FAIL
    @{ name = 'po-create-gate-removed'; file = $po;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.ownerActorId\);";
       repl = "/* sem gate */" },
    # 4) remover gate (owner) do submitPO especificamente (ancorado no if submittedByActorId) -> guard FAIL
    @{ name = 'po-submit-gate-removed'; file = $po;
       find = "await this\.assertActorNotQuarantined\(tenantId, order\.ownerActorId\);\s*\n\s*if \(submittedByActorId";
       repl = "if (submittedByActorId" },
    # 5) reabrir receivePO (remover hard-stop) -> guard FAIL
    @{ name = 'receivepo-reopened'; file = $po;
       find = "PURCHASE_ORDER_RECEIVE_CONTAINED";
       all = $true; repl = "PURCHASE_ORDER_RECEIVE_OPEN" },
    # 6) dar caller vivo ao receivePOContainedImpl -> guard FAIL
    @{ name = 'contained-impl-caller'; file = $po;
       find = "class PurchaseOrderService \{";
       repl = "class PurchaseOrderService {`n  async __leak(t, o) { return this.receivePOContainedImpl(t, o); }" },
    # 7) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $po;
       find = "await this\.assertActorNotQuarantined\(tenantId, input\.ownerActorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, createdByUserId);" },
    # 8) quebrar o vocabulário canônico lowercase 'active'/'inactive' -> guard FAIL
    #    (muda além de só caixa — `-eq` do PowerShell é case-insensitive e leria mudança só-de-caixa como NAO_MUTOU)
    @{ name = 'supplier-status-broken'; file = $sup;
       find = "'active',\s+'inactive'";
       repl = "'ACTIVE_X', 'inactive'" },
    # 9) enfiar quarentena em canRepresentActor -> guard FAIL
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
Write-Host "[neg-proof purchase-order-supplier-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
