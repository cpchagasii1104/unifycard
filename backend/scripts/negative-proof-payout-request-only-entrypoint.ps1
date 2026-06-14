# negative-proof-payout-request-only-entrypoint.ps1
# Prova que o guard audit-payout-request-only-entrypoint.mjs MORDE: se a rota request-only voltar a
# (a) chamar executeActorWalletPayout/approveActorWalletPayout, (b) retornar executed:true, ou (c) remover
# o gate canRepresentActor, o guard FALHA. Mutação temporária com RESTAURAÇÃO garantida + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-payout-request-only-entrypoint.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/modules/payout/payout-request.routes.ts'

function Invoke-Guard {
  node scripts/audit-payout-request-only-entrypoint.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$shaBefore = Get-Sha $f

$baseOk = ((Invoke-Guard) -eq 0)
$execBites = $false
$executedTrueBites = $false
$noRepresentBites = $false

try {
  # (a) reintroduzir execução.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_exec__(t, id, u) { return actorWalletPayoutService.executeActorWalletPayout(t, id, u); }`n") -Encoding UTF8 -NoNewline
  $execBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) executed:true.
  Set-Content -Path $f -Value ($orig + "`nconst __np_exec_flag__ = { executed: true };`n") -Encoding UTF8 -NoNewline
  $executedTrueBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (c) remover o gate canRepresentActor.
  $noRep = $orig -replace 'canRepresentActor', 'someOtherCheck'
  Set-Content -Path $f -Value $noRep -Encoding UTF8 -NoNewline
  $noRepresentBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $shaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $execBites -and $executedTrueBites -and $noRepresentBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof payout-request-only] baseOk=$baseOk execBites=$execBites executedTrueBites=$executedTrueBites noRepresentBites=$noRepresentBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde execução + executed:true + remoção de canRepresentActor; restauração byte-idêntica.' -ForegroundColor Green
exit 0
