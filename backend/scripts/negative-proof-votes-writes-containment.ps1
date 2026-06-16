# negative-proof-votes-writes-containment.ps1
# Prova que o guard audit-votes-writes-containment.mjs MORDE cada regressão da contenção e que a
# restauração é byte-idêntica (SHA256). Várias mordidas sobre o arquivo REAL votes.routes.ts;
# cada uma: muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-votes-writes-containment.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = Join-Path (Get-Location) 'src\modules\votes\votes.routes.ts'
$origText = Get-Content $routes -Raw
$origHash = (Get-FileHash $routes -Algorithm SHA256).Hash

function Invoke-Guard {
    node scripts/audit-votes-writes-containment.mjs *> $null
    return $LASTEXITCODE
}
function Restore-Original {
    Set-Content -Path $routes -Value $origText -NoNewline -Encoding UTF8
}

$baseOk = ((Invoke-Guard) -eq 0)

# Cada mordida: (rótulo, regex a substituir, substituição que reintroduz a regressão).
$bites = @(
    @{ name = 'drop-contain-code'; find = 'VOTES_ACTIVE_ACTOR_WIRING_MISSING';                          repl = 'VOTES_SOMETHING_ELSE'; once = $true },
    @{ name = 'reexpose-write';    find = 'return reply\.status\(501\)\.send\(VOTES_WRITES_CONTAINED\);'; repl = "await votesService.createVote(_req.tenant.id, _req.actionContext.actorId, _req.actionContext.actorId, _req.activeActor.actor_id, {}); return reply.status(201).send({});"; once = $true },
    @{ name = 'reintroduce-actionctx'; find = 'const votesRoutes';                                       repl = "const _leak = (r) => r.actionContext.actorId;`r`nconst votesRoutes"; once = $true }
)

$allBitesOk = $true
$details = @()
foreach ($b in $bites) {
    if ($b.once) {
        $rx = [regex]::new($b.find)
        $mutated = $rx.Replace($origText, $b.repl, 1)
    } else {
        $mutated = [regex]::Replace($origText, $b.find, $b.repl)
    }
    if ($mutated -eq $origText) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
    Set-Content -Path $routes -Value $mutated -NoNewline -Encoding UTF8
    $bit = ((Invoke-Guard) -ne 0)
    Restore-Original
    $restoredOk = ((Invoke-Guard) -eq 0)
    $hashOk = ((Get-FileHash $routes -Algorithm SHA256).Hash -eq $origHash)
    if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
    $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
}

Restore-Original
$finalHashOk = ((Get-FileHash $routes -Algorithm SHA256).Hash -eq $origHash)

$ok = $baseOk -and $allBitesOk -and $finalHashOk
Write-Host "[neg-proof votes-writes-containment] baseOk=$baseOk finalHashOk=$finalHashOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão da contenção; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
