# negative-proof-service-booking-decision-quarantine-gate.ps1
# Prova que o guard audit-service-booking-decision-quarantine-gate.mjs MORDE cada regressão das DUAS portas.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$decision = Join-Path (Get-Location) 'src\modules\services\service-booking-decision.service.ts'
$order = Join-Path (Get-Location) 'src\modules\services\service-order.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-service-booking-decision-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do createDecision -> guard FAIL
    @{ name = 'decision-gate-removed'; file = $decision;
       find = "await assertAuthorityActorActive\(tenantId, owner\.authorityActorId\);";
       repl = "/* sem gate */" },
    # 2) escrita de decision ANTES do gate -> guard FAIL
    @{ name = 'decision-write-before-gate'; file = $decision;
       find = "await assertAuthorityActorActive\(tenantId, owner\.authorityActorId\);";
       repl = "await serviceBookingDecisionRepository.create(tenantId, {});`n    await assertAuthorityActorActive(tenantId, owner.authorityActorId);" },
    # 3) gate usando decidedByActorId CRU em vez do authorityActorId resolvido -> guard FAIL
    @{ name = 'decision-raw-actor'; file = $decision;
       find = "await assertAuthorityActorActive\(tenantId, owner\.authorityActorId\);";
       repl = "await assertAuthorityActorActive(tenantId, input.decidedByActorId);" },
    # 4) remover gate do confirmBookingFromDecision (a sala atras da porta) -> guard FAIL
    @{ name = 'order-gate-removed'; file = $order;
       find = "await assertAuthorityActorActive\(tenantId, owner\.authorityActorId\);";
       repl = "/* sem gate */" },
    # 5) gate do order usando confirmedByActorId CRU -> guard FAIL
    @{ name = 'order-raw-actor'; file = $order;
       find = "await assertAuthorityActorActive\(tenantId, owner\.authorityActorId\);";
       repl = "await assertAuthorityActorActive(tenantId, confirmedByActorId);" },
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
Write-Host "[neg-proof service-booking-decision-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao das duas portas; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
