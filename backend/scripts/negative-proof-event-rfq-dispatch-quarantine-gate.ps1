# negative-proof-event-rfq-dispatch-quarantine-gate.ps1
# Prova que o guard audit-event-rfq-dispatch-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\event-rfq-opportunity.service.ts'
$routes = Join-Path (Get-Location) 'src\modules\events\event-rfq.routes.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-event-rfq-dispatch-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do dispatch -> guard FAIL
    @{ name = 'dispatch-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, rfq\.organizerActorId\);";
       repl = "/* sem gate */" },
    # 2) mover gate para DEPOIS do createDispatch -> guard FAIL (injeta createDispatch antes do gate)
    @{ name = 'dispatch-gate-after-write'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, rfq\.organizerActorId\);";
       repl = "await opportunityDispatchService.createDispatch(tenantId, userId, {});`n    await this.assertActorNotQuarantined(tenantId, rfq.organizerActorId);" },
    # 3) gatear companyActorId (target) como executor -> guard FAIL
    @{ name = 'gate-target-company'; file = $svc;
       find = "for \(const companyActorId of companyActorIds\) \{";
       repl = "for (const companyActorId of companyActorIds) {`n      await this.assertActorNotQuarantined(tenantId, companyActorId);" },
    # 4) gate com actionContext cru -> guard FAIL
    @{ name = 'gate-raw-actioncontext'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, rfq\.organizerActorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, actionContext.actorId);" },
    # 5) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, rfq\.organizerActorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, userId);" },
    # 6) dispatch passa a tocar payment_request (money) -> guard FAIL
    @{ name = 'dispatch-money-leak'; file = $svc;
       find = "class EventRFQOpportunityService \{";
       repl = "class EventRFQOpportunityService {`n  async __leak() { return this.createPaymentRequest(); }" },
    # 7) remover containment de acceptQuote (freezer R7b) -> guard FAIL
    @{ name = 'acceptquote-containment-removed'; file = $routes;
       find = "EVENT_RFQ_ACCEPT_QUOTE_CONTAINED";
       all = $true; repl = "EVENT_RFQ_ACCEPT_QUOTE_OPEN" },
    # 8) enfiar quarentena em canRepresentActor -> guard FAIL
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
Write-Host "[neg-proof event-rfq-dispatch-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
