# negative-proof-groups-votes-post-intent-quarantine-gate.ps1
# Prova que o guard audit-groups-votes-post-intent-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\groups\votes.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-groups-votes-post-intent-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do createVote -> guard FAIL
    @{ name = 'createvote-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica";
       repl = "// Transação atômica" },
    # 2) mover gate para DEPOIS de runTenantTransaction -> guard FAIL
    @{ name = 'gate-after-transaction'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica: votação \+ opções \+ post no feed \(mesma trx\)\.\s*\n\s*return await runTenantTransaction\(tenantId, async \(trx\) => \{";
       repl = "return await runTenantTransaction(tenantId, async (trx) => {`n      await this.assertActorNotQuarantined(tenantId, actorId);" },
    # 3) remover gate do vote() -> guard FAIL
    @{ name = 'vote-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Validar: actor ainda não votou";
       repl = "// Validar: actor ainda não votou" },
    # 4) mover gate do vote() para DEPOIS de createVoteResponse -> guard FAIL
    @{ name = 'vote-gate-after-write'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Validar: actor ainda não votou";
       repl = "await votesRepository.createVoteResponse(tenantId, voteId, optionId, actorId);`n    await this.assertActorNotQuarantined(tenantId, actorId);`n    // Validar: actor ainda não votou" },
    # 5) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica";
       repl = "await this.assertActorNotQuarantined(tenantId, userId);`n    // Transação atômica" },
    # 6) gate com globalUserId -> guard FAIL
    @{ name = 'gate-globaluserid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actorId\);\s*\n\s*// Transação atômica";
       repl = "await this.assertActorNotQuarantined(tenantId, globalUserId);`n    // Transação atômica" },
    # 7) quebrar atomicidade (remover runTenantTransaction) -> guard FAIL
    @{ name = 'atomicity-broken'; file = $svc;
       find = "return await runTenantTransaction\(tenantId, async \(trx\) => \{";
       repl = "return await (async (trx) => {" },
    # 8) quebrar intent='vote' -> guard FAIL
    @{ name = 'intent-vote-broken'; file = $svc;
       find = "          'vote',";
       repl = "          'personal'," },
    # 9) abrir payment runtime no createVote -> guard FAIL
    @{ name = 'payment-runtime-leak'; file = $svc;
       find = "    // Transação atômica: votação \+ opções \+ post no feed \(mesma trx\)\.";
       repl = "    await executePayment();`n    // Transação atômica: votação + opções + post no feed (mesma trx)." },
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
Write-Host "[neg-proof groups-votes-post-intent-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
