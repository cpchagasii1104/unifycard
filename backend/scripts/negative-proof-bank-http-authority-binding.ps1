# negative-proof-bank-http-authority-binding.ps1
# Prova que o guard audit-bank-http-authority-binding.mjs MORDE: se bank-http voltar a
# (a) executar Bank (getBankTransaction) ou (b) usar availableBalanceCents, o guard FALHA.
# Mutação temporária do arquivo real com RESTAURAÇÃO garantida (try/finally) + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-bank-http-authority-binding.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/core/unifybank/bank-http.routes.ts'

function Invoke-Guard {
  node scripts/audit-bank-http-authority-binding.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$shaBefore = Get-Sha $f

$baseOk = ((Invoke-Guard) -eq 0)
$execBites = $false
$balanceBites = $false

try {
  # (a) reabrir execução via Bank transaction.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_exec__(t) { const bt = bankPortsRegistry.getBankTransaction(); return bt.createSimpleTransaction(t, {}); }`n") -Encoding UTF8 -NoNewline
  $execBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) usar availableBalanceCents como autorização.
  Set-Content -Path $f -Value ($orig + "`nconst __np_bal__ = availableBalanceCents;`n") -Encoding UTF8 -NoNewline
  $balanceBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $shaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $execBites -and $balanceBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof bank-http-authority-binding] baseOk=$baseOk execBites=$execBites balanceBites=$balanceBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde ao reabrir Bank exec e availableBalanceCents em bank-http; restauração byte-idêntica.' -ForegroundColor Green
exit 0
