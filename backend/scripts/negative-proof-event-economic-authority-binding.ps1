# negative-proof-event-economic-authority-binding.ps1
# Prova que o guard audit-event-economic-authority-binding.mjs MORDE. Mutação temporária em
# event.routes.ts + RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se:
#   (a) o binding userRepresentsActor(..., event.actorId) for removido das rotas econômicas;
#   (b) um novo createCustody for chamado SEM binding antes.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/core/events/event.routes.ts'
function Invoke-Guard { node scripts/audit-event-economic-authority-binding.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$sha = Get-Sha $f
$baseOk = ((Invoke-Guard) -eq 0)
$removeBindingBites = $false; $unboundCallBites = $false

try {
  # (a) remover o binding (troca a chamada canônica por outra) nas duas rotas econômicas.
  Set-Content -Path $f -Value ($orig -replace 'userRepresentsActor\(req\.tenant\.id, req\.user\.userId, event\.actorId\)', 'someOtherCheck(req.tenant.id, req.user.userId, event.actorId)') -Encoding UTF8 -NoNewline
  $removeBindingBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) novo createCustody SEM binding antes.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_unbound__(t){ return eventCustodyService.createCustody(t, {}); }`n") -Encoding UTF8 -NoNewline
  $unboundCallBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $sha
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $removeBindingBites -and $unboundCallBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof event-economic-authority-binding] baseOk=$baseOk removeBindingBites=$removeBindingBites unboundCallBites=$unboundCallBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde remoção do binding e createCustody sem binding; restauração byte-idêntica.' -ForegroundColor Green
exit 0
