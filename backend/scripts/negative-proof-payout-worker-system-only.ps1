# negative-proof-payout-worker-system-only.ps1
# Prova que o guard audit-payout-worker-system-only.mjs MORDE: se o worker canônico voltar a (a) usar
# seller_available, (b) chamar bankTransactionService direto, ou (c) o BOOT religar o worker LEGADO
# startPayoutWorker, o guard FALHA. Mutação temporária com RESTAURAÇÃO garantida + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-payout-worker-system-only.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$w = 'src/workers/actor-wallet-payout-worker.ts'
$boot = 'BOOT.ts'

function Invoke-Guard {
  node scripts/audit-payout-worker-system-only.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$wOrig = Get-Content $w -Raw
$bootOrig = Get-Content $boot -Raw
$wSha = Get-Sha $w
$bootSha = Get-Sha $boot

$baseOk = ((Invoke-Guard) -eq 0)
$sellerBites = $false
$bankBites = $false
$legacyBootBites = $false

try {
  # (a) reintroduzir seller_available no worker canônico.
  Set-Content -Path $w -Value ($wOrig + "`nconst __np_seller__ = 'seller_available';`n") -Encoding UTF8 -NoNewline
  $sellerBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $w -Value $wOrig -Encoding UTF8 -NoNewline

  # (b) reintroduzir bankTransactionService direto no worker.
  Set-Content -Path $w -Value ($wOrig + "`nasync function __np_bank__(t) { return bankTransactionService.transfer(t, {}); }`n") -Encoding UTF8 -NoNewline
  $bankBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $w -Value $wOrig -Encoding UTF8 -NoNewline

  # (c) BOOT religa o worker LEGADO startPayoutWorker().
  Set-Content -Path $boot -Value ($bootOrig + "`nasync function __np_legacy__() { startPayoutWorker(); }`n") -Encoding UTF8 -NoNewline
  $legacyBootBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $boot -Value $bootOrig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $w -Value $wOrig -Encoding UTF8 -NoNewline
  Set-Content -Path $boot -Value $bootOrig -Encoding UTF8 -NoNewline
}

$wRestored = (Get-Sha $w) -eq $wSha
$bootRestored = (Get-Sha $boot) -eq $bootSha
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $sellerBites -and $bankBites -and $legacyBootBites -and $wRestored -and $bootRestored -and $guardGreenAgain
Write-Host "[neg-proof payout-worker-system-only] baseOk=$baseOk sellerBites=$sellerBites bankBites=$bankBites legacyBootBites=$legacyBootBites wRestored=$wRestored bootRestored=$bootRestored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde seller_available + bank direto + BOOT religando worker legado; restauração byte-idêntica.' -ForegroundColor Green
exit 0
