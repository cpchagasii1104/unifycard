# negative-proof-groups-votes-post-insert-schema-aligned.ps1
# Prova que o guard audit-groups-votes-post-insert-schema-aligned.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\groups\votes.service.ts'

function Invoke-Guard {
    node scripts/audit-groups-votes-post-insert-schema-aligned.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) reintroduzir global_user_id na lista de colunas -> guard FAIL
    @{ name = 'reintroduce-global-user-id'; file = $svc;
       find = "            tenant_id, actor_id, content, intent, intent_metadata, targeting, metadata";
       repl = "            tenant_id, global_user_id, actor_id, content, intent, intent_metadata, targeting, metadata" },
    # 2) reintroduzir coluna `media` -> guard FAIL
    @{ name = 'reintroduce-media-column'; file = $svc;
       find = "            tenant_id, actor_id, content, intent, intent_metadata, targeting, metadata";
       repl = "            tenant_id, actor_id, content, media, intent, intent_metadata, targeting, metadata" },
    # 3) RETURNING post_id em vez de id -> guard FAIL
    @{ name = 'returning-post-id'; file = $svc;
       find = "          RETURNING id, created_at, updated_at";
       repl = "          RETURNING post_id, created_at, updated_at" },
    # 4) remover actor_id da lista -> guard FAIL
    @{ name = 'remove-actor-id'; file = $svc;
       find = "            tenant_id, actor_id, content, intent, intent_metadata, targeting, metadata";
       repl = "            tenant_id, content, intent, intent_metadata, targeting, metadata" },
    # 5) quebrar intent='vote' -> guard FAIL
    @{ name = 'intent-vote-broken'; file = $svc;
       find = "          'vote',";
       repl = "          'personal'," },
    # 6) reintroduzir param globalUserId na assinatura -> guard FAIL
    @{ name = 'reintroduce-globaluserid-param'; file = $svc;
       find = "    input: CreateVoteInput,\s*\n\s*userId: string\s*\n\s*\): Promise<GroupVote> \{";
       repl = "    input: CreateVoteInput,`n    userId: string,`n    globalUserId: string`n  ): Promise<GroupVote> {" },
    # 7) quebrar gate de quarentena de createVote -> guard FAIL
    @{ name = 'createvote-gate-broken'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica";
       repl = "// Transação atômica" }
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
Write-Host "[neg-proof groups-votes-post-insert-schema-aligned] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
