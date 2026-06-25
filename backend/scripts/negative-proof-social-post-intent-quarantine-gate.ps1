# negative-proof-social-post-intent-quarantine-gate.ps1
# Prova que o guard audit-social-post-intent-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\social\social-2.0.service.ts'
$legacy = Join-Path (Get-Location) 'src\modules\social\social.routes.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-social-post-intent-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate (author) do createPost -> guard FAIL
    @{ name = 'gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actor\.actor_id\);";
       repl = "/* sem gate */" },
    # 2) injetar INSERT INTO posts ANTES do gate -> guard FAIL
    @{ name = 'write-before-gate'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actor\.actor_id\);";
       repl = "await runQueryWithTenant(tenantId, 'INSERT INTO posts (id) VALUES (1)', []);`n    await this.assertActorNotQuarantined(tenantId, actor.actor_id);" },
    # 3) gate DEPOIS de validateIntent (mover) -> guard FAIL
    @{ name = 'gate-after-validateintent'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actor\.actor_id\);";
       repl = "await actorIntentsService.validateIntent(tenantId, actor.actor_id);`n    await this.assertActorNotQuarantined(tenantId, actor.actor_id);" },
    # 4) remover gate do acting/createdAs -> guard FAIL
    @{ name = 'acting-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, createdAsActorId\);";
       repl = "/* sem gate acting */" },
    # 5) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, actor\.actor_id\);";
       repl = "await this.assertActorNotQuarantined(tenantId, userId);" },
    # 6) abrir payment runtime DENTRO do createPost (RECEIVE_PAYMENT/SEND_CTA -> dinheiro) -> guard FAIL
    @{ name = 'payment-runtime-leak'; file = $svc;
       find = "\): Promise<PostWithActor> \{";
       repl = "): Promise<PostWithActor> {`n    await executePayment();" },
    # 7) religar legacy posts/create (remover 501) -> guard FAIL
    @{ name = 'legacy-reopened'; file = $legacy;
       find = "SOCIAL_LEGACY_POST_CREATE_CONTAINED";
       all = $true; repl = "SOCIAL_LEGACY_POST_CREATE_OPEN" },
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
Write-Host "[neg-proof social-post-intent-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
