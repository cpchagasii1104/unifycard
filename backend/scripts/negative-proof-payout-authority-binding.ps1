# negative-proof-payout-authority-binding.ps1
# Prova que o guard audit-payout-authority-binding.mjs MORDE: se payout voltar a
# (a) executar (executePayoutManual) ou (b) usar seller_available como autorização, o guard FALHA.
# Mutação temporária do arquivo real com RESTAURAÇÃO garantida (try/finally) + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-payout-authority-binding.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/modules/payout/payout.routes.ts'

function Invoke-Guard {
  node scripts/audit-payout-authority-binding.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$shaBefore = Get-Sha $f

$baseOk = ((Invoke-Guard) -eq 0)
$execBites = $false
$sellerBites = $false

try {
  # (a) reabrir execução manual.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_exec__(t, id) { return payoutService.executePayoutManual(t, id, {}); }`n") -Encoding UTF8 -NoNewline
  $execBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) usar seller_available como autorização.
  Set-Content -Path $f -Value ($orig + "`nconst __np_seller__ = 'seller_available';`n") -Encoding UTF8 -NoNewline
  $sellerBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $shaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $execBites -and $sellerBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof payout-authority-binding] baseOk=$baseOk execBites=$execBites sellerBites=$sellerBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde ao reabrir payout exec e seller_available; restauração byte-idêntica.' -ForegroundColor Green
exit 0
