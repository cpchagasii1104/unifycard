# negative-proof-events-session-checkin-schema-drift.ps1
# Prova que o guard audit-events-session-checkin-schema-drift.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\events.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-events-session-checkin-schema-drift.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) voltar addSession para a coluna `name` -> guard FAIL
    @{ name = 'addsession-name-back'; file = $svc;
       find = "INSERT INTO event_sessions \(tenant_id, event_id, title, starts_at, ends_at\)";
       repl = "INSERT INTO event_sessions (tenant_id, event_id, name, starts_at, ends_at)" },
    # 2) voltar addSession para start_time -> guard FAIL
    @{ name = 'addsession-starttime-back'; file = $svc;
       find = "INSERT INTO event_sessions \(tenant_id, event_id, title, starts_at, ends_at\)";
       repl = "INSERT INTO event_sessions (tenant_id, event_id, title, start_time, ends_at)" },
    # 3) remover tenant_id do addSession -> guard FAIL
    @{ name = 'addsession-no-tenant'; file = $svc;
       find = "INSERT INTO event_sessions \(tenant_id, event_id, title, starts_at, ends_at\)";
       repl = "INSERT INTO event_sessions (event_id, title, starts_at, ends_at)" },
    # 4) remover tenant_id do checkIn INSERT -> guard FAIL
    @{ name = 'checkin-no-tenant'; file = $svc;
       find = "INSERT INTO event_attendees \(tenant_id, event_id, global_user_id, checked_in_at\)";
       repl = "INSERT INTO event_attendees (event_id, global_user_id, checked_in_at)" },
    # 5) introduzir a coluna renomeada check_in_time no checkIn -> guard FAIL
    @{ name = 'checkin-check-in-time'; file = $svc;
       find = "SET checked_in_at = now\(\)";
       repl = "SET check_in_time = now()" },
    # 6) remover gate de quarentena do addSession -> guard FAIL
    @{ name = 'addsession-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, actingGlobalUserId\);";
       repl = "/* sem gate */" },
    # 7) remover gate de quarentena do checkIn -> guard FAIL
    @{ name = 'checkin-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, globalUserId\);";
       repl = "/* sem gate */" },
    # 8) quebrar gate de scope do createEvent -> guard FAIL
    @{ name = 'createevent-scope-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorIdForEvent\);";
       repl = "/* sem gate */" },
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
Write-Host "[neg-proof events-session-checkin-schema-drift] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
