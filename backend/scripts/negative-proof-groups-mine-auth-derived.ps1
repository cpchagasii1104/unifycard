# negative-proof-groups-mine-auth-derived.ps1
# Prova que o guard audit-groups-mine-auth-derived.mjs MORDE. Mutações temporárias + RESTAURAÇÃO
# byte-idêntica (SHA256). O guard FALHA se:
#   (a) o handler GET /mine deixar de derivar req.user?.userId;
#   (b) o handler perder o fail-closed 401 UNAUTHENTICATED;
#   (c) o handler virar não-read-only (INSERT/UPDATE/DELETE);
#   (d) o handler re-acoplar autoridade de cliente (actionContext/actorId);
#   (e) o bypass do plugin deixar de ser EXATO (virar endsWith);
#   (f) o repository deixar de filtrar gm.user_id = $2.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = 'src/modules/groups/groups.routes.ts'
$plugin = 'src/plugins/action-context.plugin.ts'
$repo   = 'src/modules/groups/groups.repository.ts'
$files = @($routes, $plugin, $repo)

function Invoke-Guard { node scripts/audit-groups-mine-auth-derived.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$noUserIdBites = $false; $no401Bites = $false; $writeBites = $false; $recoupleBites = $false; $bypassBites = $false; $repoBites = $false

$mineLine = 'const groups = await groupsService.getUserGroups(tenantId, userId);'
try {
  # (a) handler deixa de derivar req.user?.userId.
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'req\.user\?\.userId', 'req.user?.actorId') -Encoding UTF8 -NoNewline
  $noUserIdBites = ((Invoke-Guard) -ne 0); Restore

  # (b) handler perde o 401 fail-closed.
  Set-Content -Path $routes -Value ($orig[$routes] -replace 'reply\.code\(401\)', 'reply.code(200)') -Encoding UTF8 -NoNewline
  $no401Bites = ((Invoke-Guard) -ne 0); Restore

  # (c) handler vira não-read-only (INSERT no /mine).
  Set-Content -Path $routes -Value ($orig[$routes] -replace [regex]::Escape($mineLine), "await pool.query('INSERT INTO group_members (x) VALUES (1)'); $mineLine") -Encoding UTF8 -NoNewline
  $writeBites = ((Invoke-Guard) -ne 0); Restore

  # (d) handler re-acopla autoridade de cliente (actionContext no /mine).
  Set-Content -Path $routes -Value ($orig[$routes] -replace [regex]::Escape($mineLine), "const _ac = actionContext.actorId; $mineLine") -Encoding UTF8 -NoNewline
  $recoupleBites = ((Invoke-Guard) -ne 0); Restore

  # (e) bypass do plugin deixa de ser EXATO (vira endsWith).
  Set-Content -Path $plugin -Value ($orig[$plugin] -replace "rawPath === '/groups/mine'", "rawPath.endsWith('/groups/mine')") -Encoding UTF8 -NoNewline
  $bypassBites = ((Invoke-Guard) -ne 0); Restore

  # (f) repository deixa de filtrar gm.user_id = $2.
  Set-Content -Path $repo -Value ($orig[$repo] -replace 'gm\.user_id = \$2', 'gm.actor_id = $2') -Encoding UTF8 -NoNewline
  $repoBites = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $noUserIdBites -and $no401Bites -and $writeBites -and $recoupleBites -and $bypassBites -and $repoBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof groups-mine-auth-derived] baseOk=$baseOk noUserId=$noUserIdBites no401=$no401Bites write=$writeBites recouple=$recoupleBites bypass=$bypassBites repo=$repoBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-userId/sem-401/write/recouple-actionContext/bypass-alargado/repo-namespace; restauração byte-idêntica.' -ForegroundColor Green
exit 0
