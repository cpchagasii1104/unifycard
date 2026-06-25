# negative-proof-availability-quarantine-gate.ps1
# Prova que o guard audit-availability-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\core\availability\unified-availability.service.ts'
$helper = Join-Path (Get-Location) 'src\core\availability\availability-owner-authority.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-availability-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover o gate do create -> guard FAIL
    @{ name = 'create-gate-removed'; file = $svc;
       find = "await assertAvailabilityOwnerAuthorityActive\(tenantId, input\.ownerType, input\.ownerId\);";
       repl = "/* sem gate */" },
    # 2) remover o gate do update -> guard FAIL
    @{ name = 'update-gate-removed'; file = $svc;
       find = "await assertAvailabilityOwnerAuthorityActive\(tenantId, existing\.ownerType, existing\.ownerId\);";
       repl = "/* sem gate */" },
    # 3) escrita ANTES do gate no create -> guard FAIL
    @{ name = 'create-write-before-gate'; file = $svc;
       find = "await assertAvailabilityOwnerAuthorityActive\(tenantId, input\.ownerType, input\.ownerId\);";
       repl = "await unifiedAvailabilityRepository.create(tenantId, input);`n    await assertAvailabilityOwnerAuthorityActive(tenantId, input.ownerType, input.ownerId);" },
    # 4) quarentena com ownerId CRU (em vez de authorityActorId resolvido) -> guard FAIL
    @{ name = 'quarantine-raw-ownerid'; file = $helper;
       find = "if \(await isActorEffectivelyBlocked\(tenantId, owner\.authorityActorId\)\) \{";
       repl = "if (await isActorEffectivelyBlocked(tenantId, ownerId)) {" },
    # 5) meter quarentena em canRepresentActor -> guard FAIL
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
Write-Host "[neg-proof availability-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
