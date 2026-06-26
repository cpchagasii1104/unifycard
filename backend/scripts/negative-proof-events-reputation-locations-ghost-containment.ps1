# negative-proof-events-reputation-locations-ghost-containment.ps1
# Prova que o guard audit-events-reputation-locations-ghost-containment.mjs MORDE cada regressão de contenção.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
# Bites de migration: cria .sql temporário em migrations/ -> guard FALHA -> remove (try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\events.service.ts'
$idr = Join-Path (Get-Location) 'src\core\identity\identity.routes.ts'
$rpr = Join-Path (Get-Location) 'src\core\reputation\reputation.routes.ts'
$rfq = Join-Path (Get-Location) 'src\modules\events\event-rfq.routes.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'
$migDir = Join-Path (Get-Location) 'migrations'

function Invoke-Guard {
    # ErrorActionPreference=Continue ao redor do native call: WPS 5.1 levanta NativeCommandError quando o
    # guard escreve em stderr (GATE FAIL) sob Stop. 2>&1 | Out-Null engole streams nos dois shells.
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & node scripts/audit-events-reputation-locations-ghost-containment.mjs 2>&1 | Out-Null }
    finally { $ErrorActionPreference = $old }
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) recriar hard-fail de assignStaff por reputation_scores -> guard FAIL
    @{ name = 'assignstaff-rehard-fail'; file = $svc;
       find = "await reputationService\.getScoreByGlobalUserId\(globalUserId\);";
       repl = "const reputation = await reputationService.getScoreByGlobalUserId(globalUserId); if (!reputation || reputation.scores.global < 3.0) { throw new Error('reputação suficiente'); }" },
    # 2) remover contenção isMissingRelation da reputação em assignStaff -> guard FAIL
    @{ name = 'assignstaff-remove-containment'; file = $svc;
       find = "if \(!isMissingRelation\(err\)\) throw err;\s*\r?\n\s*// reputation_scores ausente";
       repl = "void err;`n      // reputation_scores ausente" },
    # 3) substituir reputação por actor_reputation (social) sem decisão -> guard FAIL (E)
    @{ name = 'assignstaff-substitute-actor-reputation'; file = $svc;
       find = "await reputationService\.getScoreByGlobalUserId\(globalUserId\);";
       repl = "await runQueryWithTenant(tenantId, 'SELECT 1 FROM actor_reputation LIMIT 1', []);" },
    # 4) remover gate de quarentena de assignStaff -> guard FAIL
    @{ name = 'assignstaff-gate-removed'; file = $svc;
       find = "await this\.assertGlobalUserNotQuarantined\(tenantId, assignedByGlobalUserId\);";
       repl = "/* sem gate */" },
    # 5) quebrar INSERT actor-keyed (remover responsible_actor_id) -> guard FAIL
    @{ name = 'assignstaff-break-actorkeyed'; file = $svc;
       find = "INSERT INTO event_staff \(tenant_id, event_id, responsible_actor_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id\)";
       repl = "INSERT INTO event_staff (tenant_id, event_id, responsible_actor_type, role, global_user_id, assigned_by_global_user_id)" },
    # 6) remover contenção de event_locations em getEventWithDetails -> guard FAIL
    @{ name = 'locations-remove-containment'; file = $svc;
       find = "if \(!isMissingRelation\(err\)\) throw err;\s*\r?\n\s*// event_locations ausente";
       repl = "throw err;`n      // event_locations ausente" },
    # 7) voltar reader de sessões para name/start_time/end_time -> guard FAIL
    #    Anchor inclui `FROM event_sessions` para mirar o reader de getEventWithDetails (não o RETURNING de addSession,
    #    que compartilha a mesma lista de colunas).
    @{ name = 'reader-sessions-regress'; file = $svc;
       find = "title AS name, starts_at AS start_time, ends_at AS end_time, now\(\) AS created_at, now\(\) AS updated_at\s*\r?\n\s*FROM event_sessions";
       repl = "name, start_time, end_time, now() AS created_at, now() AS updated_at`n      FROM event_sessions" },
    # 8) deixar rota /identity reputation propagar 500 bruto por ghost -> guard FAIL
    @{ name = 'identity-route-500-leak'; file = $idr;
       find = "return reply\.status\(501\)\.send\(\{ error: 'Reputação indisponível: fonte não provisionada', code: 'REPUTATION_SOURCE_UNAVAILABLE' \}\);";
       repl = "throw repErr;" },
    # 9) deixar rota /reputation/:type/:id propagar 500 bruto por ghost -> guard FAIL
    @{ name = 'reputation-route-500-leak'; file = $rpr;
       find = "return reply\.status\(501\)\.send\(\{ error: 'Reputação indisponível: fonte não provisionada', code: 'REPUTATION_SOURCE_UNAVAILABLE' \}\);";
       repl = "throw err;" },
    # 10) remover containment de acceptQuote (freezer R7b) -> guard FAIL
    @{ name = 'acceptquote-containment-removed'; file = $rfq;
       find = "EVENT_RFQ_ACCEPT_QUOTE_CONTAINED";
       repl = "EVENT_RFQ_ACCEPT_QUOTE_RELEASED" },
    # 11) enfiar quarentena em canRepresentActor -> guard FAIL
    @{ name = 'quarantine-in-canrepresent'; file = $authz;
       find = "  async canRepresentActor\(";
       repl = "  async canRepresentActor(__q = await import('@modules/risk-identity/actor-effective-block').then(m => m.isActorEffectivelyBlocked)," }
)

# IO via [System.IO.File] (UTF8 sem BOM, fiel a acentos) — Set-Content/Get-Content do WPS 5.1 adicionam BOM e
# decodificam em ANSI, corrompendo bytes e quebrando a restauração byte-idêntica. ReadAllText/WriteAllText
# round-trip idêntico nos dois shells.
$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = [System.IO.File]::ReadAllText($f); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { [System.IO.File]::WriteAllText($file, $snapshot[$file].content) }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            $mutated = $rx.Replace($orig, $b.repl, 1)
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            [System.IO.File]::WriteAllText($b.file, $mutated)
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

# ── Bites de MIGRATION (temp file em migrations/, removido em try/finally) ──
$migBites = @(
    @{ name = 'migration-creates-reputation_scores'; fname = 'zzz_negproof_reputation_scores_TEMP.sql';
       sql = 'CREATE TABLE IF NOT EXISTS reputation_scores (tenant_id uuid);' },
    @{ name = 'migration-creates-event_locations'; fname = 'zzz_negproof_event_locations_TEMP.sql';
       sql = 'CREATE TABLE IF NOT EXISTS event_locations (id uuid);' }
)
foreach ($mb in $migBites) {
    $path = Join-Path $migDir $mb.fname
    $bit = $false
    try {
        [System.IO.File]::WriteAllText($path, $mb.sql)
        $bit = ((Invoke-Guard) -ne 0)
    }
    finally {
        if (Test-Path $path) { Remove-Item $path -Force }
    }
    $restoredOk = ((Invoke-Guard) -eq 0)
    $removedOk = (-not (Test-Path $path))
    if (-not ($bit -and $restoredOk -and $removedOk)) { $allBitesOk = $false }
    $details += "$($mb.name)=morde:$bit,restaura:$restoredOk,removido:$removedOk"
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof events-reputation-locations-ghost-containment] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256); migrations temporarias removidas.' -ForegroundColor Green
exit 0
