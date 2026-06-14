# negative-proof-financial-approval-core-boundary.ps1
# Prova que o guard audit-financial-approval-core-boundary.mjs MORDE: se o Core de Aprovação
# passar a (a) chamar Bank port / executor financeiro, ou (b) usar availableBalanceCents como
# entrada, o guard FALHA. Mutação temporária do arquivo real com RESTAURAÇÃO garantida
# (try/finally) + verificação de hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-financial-approval-core-boundary.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$svc = 'src/core/financial-approval/financial-approval.service.ts'

function Invoke-Guard {
  node scripts/audit-financial-approval-core-boundary.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $svc -Raw
$shaBefore = Get-Sha $svc

$baseOk = ((Invoke-Guard) -eq 0)
$bankBites = $false
$balanceBites = $false

try {
  # (a) reabrir execução via Bank port.
  Set-Content -Path $svc -Value ($orig + "`nfunction __np_bank__() { return bankTransactionService.transfer(1); }`n") -Encoding UTF8 -NoNewline
  $bankBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $svc -Value $orig -Encoding UTF8 -NoNewline

  # (b) usar availableBalanceCents como entrada.
  Set-Content -Path $svc -Value ($orig + "`nconst __np_bal__ = availableBalanceCents;`n") -Encoding UTF8 -NoNewline
  $balanceBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $svc -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $svc -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $svc) -eq $shaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $bankBites -and $balanceBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof financial-approval-core] baseOk=$baseOk bankBites=$bankBites balanceBites=$balanceBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde ao reabrir Bank port e availableBalanceCents no Core; restauração byte-idêntica.' -ForegroundColor Green
exit 0
