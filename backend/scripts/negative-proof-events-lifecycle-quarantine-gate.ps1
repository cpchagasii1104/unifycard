# negative-proof-events-lifecycle-quarantine-gate.ps1
# Prova que o guard audit-events-lifecycle-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\events.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-events-lifecycle-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate de scope do createEvent -> guard FAIL
    @{ name = 'createevent-scope-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorIdForEvent\);";
       repl = "/* sem gate scope */" },
    # 2) remover gate de acting do createEvent -> guard FAIL
    @{ name = 'createevent-acting-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, createdByGlobalUserId\);";
       repl = "/* sem gate acting */" },
    # 3) INSERT INTO events antes do gate de scope -> guard FAIL
    @{ name = 'createevent-write-before-gate'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorIdForEvent\);";
       repl = "await runQueryWithTenant(tenantId, 'INSERT INTO events (id) VALUES (1)', []);`n    await this.assertActorNotQuarantined(tenantId, actorIdForEvent);" },
    # 4) remover gate do addSession -> guard FAIL
    @{ name = 'addsession-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, actingGlobalUserId\);";
       repl = "/* sem gate */" },
    # 5) remover gate do assignStaff -> guard FAIL
    @{ name = 'assignstaff-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, assignedByGlobalUserId\);";
       repl = "/* sem gate */" },
    # 6) remover gate do checkIn -> guard FAIL
    @{ name = 'checkin-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, globalUserId\);";
       repl = "/* sem gate */" },
    # 7) gate com actionContext cru -> guard FAIL
    @{ name = 'gate-raw-actioncontext'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorIdForEvent\);";
       repl = "await this.assertActorNotQuarantined(tenantId, actionContext.actorId);" },
    # 8) helper resolve actor desmontado (ensureUserActor removido) -> guard FAIL
    @{ name = 'helper-ensureuseractor-removed'; file = $svc;
       find = "const actor = await ensureUserActor\(tenantId, userResult\.user_id\);\s*\n\s*await this\.assertActorNotQuarantined\(tenantId, actor\.actor_id\);";
       repl = "await this.assertActorNotQuarantined(tenantId, userResult.user_id);" },
    # 9) abrir RFQ/acceptQuote/booking em events.service -> guard FAIL
    @{ name = 'rfq-money-leak'; file = $svc;
       find = "class EventsService \{";
       repl = "class EventsService {`n  async __leak() { return this.acceptQuote(); }" },
    # 10) enfiar quarentena em canRepresentActor -> guard FAIL
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
Write-Host "[neg-proof events-lifecycle-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
