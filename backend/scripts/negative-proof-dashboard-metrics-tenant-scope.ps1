# negative-proof-dashboard-metrics-tenant-scope.ps1
# Prova que o guard audit-dashboard-metrics-tenant-scope.mjs MORDE. Mutação temporária + RESTAURAÇÃO
# byte-idêntica (SHA256). O guard FALHA se:
#   (a) uma query do service perder o filtro tenant_id (vazamento cross-tenant);
#   (b) a rota deixar de passar req.tenant.id ao service.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$svc = 'src/core/dashboard/daily-metrics.service.ts'
$route = 'src/core/dashboard/daily-metrics.routes.ts'
function Invoke-Guard { node scripts/audit-dashboard-metrics-tenant-scope.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$origS = Get-Content $svc -Raw; $origR = Get-Content $route -Raw
$shaS = Get-Sha $svc; $shaR = Get-Sha $route
$baseOk = ((Invoke-Guard) -eq 0)
$svcBites = $false; $routeBites = $false

try {
  # (a) remover tenant_id da query de events.
  Set-Content -Path $svc -Value ($origS -replace 'WHERE tenant_id = \$1 AND created_at >= \$2 AND created_at < \$3', 'WHERE created_at >= $2 AND created_at < $3') -Encoding UTF8 -NoNewline
  $svcBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $svc -Value $origS -Encoding UTF8 -NoNewline

  # (b) rota deixa de passar req.tenant.id.
  Set-Content -Path $route -Value ($origR -replace 'getTodayMetrics\(req\.tenant\.id\)', 'getTodayMetrics()') -Encoding UTF8 -NoNewline
  $routeBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $route -Value $origR -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $svc -Value $origS -Encoding UTF8 -NoNewline
  Set-Content -Path $route -Value $origR -Encoding UTF8 -NoNewline
}

$restored = ((Get-Sha $svc) -eq $shaS) -and ((Get-Sha $route) -eq $shaR)
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $svcBites -and $routeBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof dashboard-metrics-tenant-scope] baseOk=$baseOk svcBites=$svcBites routeBites=$routeBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde query sem tenant_id e rota sem req.tenant.id; restauração byte-idêntica.' -ForegroundColor Green
exit 0
