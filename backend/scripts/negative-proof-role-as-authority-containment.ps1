# negative-proof-role-as-authority-containment.ps1
# Prova que o guard audit-role-as-authority-containment.mjs MORDE. Mutação temporária num arquivo benigno
# (vira caller não-classificado) + RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se:
#   (a) um NOVO arquivo passar a chamar userHasAnyRole sem classificação;
#   (b) um NOVO arquivo passar a chamar actorHasAnyRole sem classificação.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/core/dashboard/daily-metrics.routes.ts'  # arquivo benigno, NÃO é caller de role hoje
function Invoke-Guard { node scripts/audit-role-as-authority-containment.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$sha = Get-Sha $f
$baseOk = ((Invoke-Guard) -eq 0)
$userBites = $false; $actorBites = $false

try {
  # (a) novo caller userHasAnyRole não classificado.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_u__(t,u){ return rbacService.userHasAnyRole(t,u,['admin']); }`n") -Encoding UTF8 -NoNewline
  $userBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) novo caller actorHasAnyRole não classificado.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_a__(t,a){ return rbacService.actorHasAnyRole(t,a,['admin']); }`n") -Encoding UTF8 -NoNewline
  $actorBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $sha
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $userBites -and $actorBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof role-as-authority-containment] baseOk=$baseOk userBites=$userBites actorBites=$actorBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde novo caller userHasAnyRole/actorHasAnyRole não classificado; restauração byte-idêntica.' -ForegroundColor Green
exit 0
