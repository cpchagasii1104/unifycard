# negative-proof-organization-schema-ghost-containment.ps1
# Prova que o guard audit-organization-schema-ghost-containment.mjs MORDE cada regressão da contenção e que
# a restauração é byte-idêntica (SHA256). Mordidas sobre o arquivo REAL organization.routes.ts; cada uma:
# muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-organization-schema-ghost-containment.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = Join-Path (Get-Location) 'src\modules\organization\organization.routes.ts'
$origText = Get-Content $routes -Raw
$origHash = (Get-FileHash $routes -Algorithm SHA256).Hash

function Invoke-Guard {
    node scripts/audit-organization-schema-ghost-containment.mjs *> $null
    return $LASTEXITCODE
}
function Restore-Original {
    Set-Content -Path $routes -Value $origText -NoNewline -Encoding UTF8
}

$baseOk = ((Invoke-Guard) -eq 0)

# Cada mordida: (rótulo, regex, substituição que reintroduz a regressão). `all` = substituir todas as ocorrências.
$bites = @(
    @{ name = 'drop-contain-code';   find = 'ORGANIZATION_SCHEMA_GHOST_CONTAINED';                        repl = 'ORGANIZATION_SOMETHING_ELSE_X'; all = $true },
    @{ name = 'reexpose-service';     find = "fastify\.post\('/invites', contained\);";                   repl = "fastify.post('/invites', async (req, reply) => reply.send(await organizationInviteService.inviteUser(req.tenant.id, req.body)));" },
    @{ name = 'reintroduce-actionctx';find = 'const organizationRoutes';                                  repl = "const _leak = (r) => r.actionContext.actorId;`r`nconst organizationRoutes" },
    @{ name = 'reintroduce-bodyactor';find = 'const contained = async';                                   repl = "const _bodyLeak = (r) => r.body.actorId;`r`n  const contained = async" },
    @{ name = 'reanimate-binding';    find = 'const contained = async';                                   repl = "const _bind = async (r) => canRepresentActor(r);`r`n  const contained = async" }
)

$allBitesOk = $true
$details = @()
foreach ($b in $bites) {
    $rx = [regex]::new($b.find)
    if ($b.all) { $mutated = $rx.Replace($origText, $b.repl) } else { $mutated = $rx.Replace($origText, $b.repl, 1) }
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
Write-Host "[neg-proof organization-schema-ghost-containment] baseOk=$baseOk finalHashOk=$finalHashOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão da contenção; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
