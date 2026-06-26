# negative-proof-events-assignstaff-sessionread-schema-drift.ps1
# Prova que o guard audit-events-assignstaff-sessionread-schema-drift.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\events.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-events-assignstaff-sessionread-schema-drift.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover tenant_id do assignStaff INSERT -> guard FAIL
    @{ name = 'assignstaff-no-tenant'; file = $svc;
       find = "INSERT INTO event_staff \(tenant_id, event_id, responsible_actor_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id\)";
       repl = "INSERT INTO event_staff (event_id, responsible_actor_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id)" },
    # 2) remover responsible_actor_id -> guard FAIL
    @{ name = 'assignstaff-no-responsible-actor'; file = $svc;
       find = "INSERT INTO event_staff \(tenant_id, event_id, responsible_actor_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id\)";
       repl = "INSERT INTO event_staff (tenant_id, event_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id)" },
    # 3) remover responsible_actor_type -> guard FAIL
    @{ name = 'assignstaff-no-responsible-type'; file = $svc;
       find = "INSERT INTO event_staff \(tenant_id, event_id, responsible_actor_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id\)";
       repl = "INSERT INTO event_staff (tenant_id, event_id, responsible_actor_id, role, global_user_id, assigned_by_global_user_id)" },
    # 4) remover resolução do actor (ensureUserActor) -> guard FAIL
    @{ name = 'assignstaff-no-ensureuseractor'; file = $svc;
       find = "const staffActor = await ensureUserActor\(tenantId, staffUser\.user_id\);";
       repl = "const staffActor = { actor_id: globalUserId, actor_type: 'user' };" },
    # 5) remover gate de quarentena do assignStaff -> guard FAIL
    @{ name = 'assignstaff-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, assignedByGlobalUserId\);";
       repl = "/* sem gate */" },
    # 6) voltar reader para event_sessions.name (sem alias) -> guard FAIL
    @{ name = 'reader-name-back'; file = $svc;
       find = "SELECT id, event_id, title AS name, starts_at AS start_time, ends_at AS end_time, now\(\) AS created_at, now\(\) AS updated_at";
       repl = "SELECT id, event_id, name, starts_at AS start_time, ends_at AS end_time, now() AS created_at, now() AS updated_at" },
    # 7) voltar reader para start_time (coluna) -> guard FAIL
    @{ name = 'reader-starttime-back'; file = $svc;
       find = "SELECT id, event_id, title AS name, starts_at AS start_time, ends_at AS end_time, now\(\) AS created_at, now\(\) AS updated_at";
       repl = "SELECT id, event_id, title AS name, start_time, ends_at AS end_time, now() AS created_at, now() AS updated_at" },
    # 8) quebrar addSession (15ª fatia) -> guard FAIL
    @{ name = 'addsession-regress'; file = $svc;
       find = "INSERT INTO event_sessions \(tenant_id, event_id, title, starts_at, ends_at\)";
       repl = "INSERT INTO event_sessions (event_id, name, starts_at, ends_at)" },
    # 9) quebrar checkIn (15ª fatia) -> guard FAIL
    @{ name = 'checkin-regress'; file = $svc;
       find = "INSERT INTO event_attendees \(tenant_id, event_id, global_user_id, checked_in_at\)";
       repl = "INSERT INTO event_attendees (event_id, global_user_id, checked_in_at)" },
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
Write-Host "[neg-proof events-assignstaff-sessionread-schema-drift] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
