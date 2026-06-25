# negative-proof-groups-votes-closevote-quarantine-gate.ps1
# Prova que o guard audit-groups-votes-closevote-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\groups\votes.service.ts'
$routes = Join-Path (Get-Location) 'src\modules\groups\votes.routes.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-groups-votes-closevote-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do closeVote -> guard FAIL
    @{ name = 'closevote-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, userActor\.actor_id\);";
       repl = "/* sem gate */" },
    # 2) mover gate para DEPOIS do repository.closeVote -> guard FAIL
    @{ name = 'gate-after-write'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, userActor\.actor_id\);\s*\n\s*\n\s*// Fechar votação\s*\n\s*return votesRepository\.closeVote\(tenantId, voteId\);";
       repl = "const __r = votesRepository.closeVote(tenantId, voteId);`n    await this.assertActorNotQuarantined(tenantId, userActor.actor_id);`n    return __r;" },
    # 3) remover ensureUserActor do closeVote (ancorado no gate seguinte — único do closeVote) -> guard FAIL
    @{ name = 'ensureuseractor-removed'; file = $svc;
       find = "const userActor = await ensureUserActor\(tenantId, userId\);(\s*\n\s*await this\.assertActorNotQuarantined\(tenantId, userActor\.actor_id\);)";
       repl = "const userActor = { actor_id: userId };`$1" },
    # 4) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, userActor\.actor_id\);";
       repl = "await this.assertActorNotQuarantined(tenantId, userId);" },
    # 5) quebrar gate do createVote (9ª fatia) -> guard FAIL
    @{ name = 'createvote-gate-broken'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica";
       repl = "// Transação atômica" },
    # 6) quebrar gate do vote() (9ª fatia) -> guard FAIL
    @{ name = 'vote-gate-broken'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Validar: actor ainda não votou";
       repl = "// Validar: actor ainda não votou" },
    # 7) rota deixa de passar userId ao closeVote -> guard FAIL
    @{ name = 'route-drops-userid'; file = $routes;
       find = "votesService\.closeVote\(req\.tenant\.id, groupId, voteId, userId\)";
       repl = "votesService.closeVote(req.tenant.id, groupId, voteId)" },
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
Write-Host "[neg-proof groups-votes-closevote-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
