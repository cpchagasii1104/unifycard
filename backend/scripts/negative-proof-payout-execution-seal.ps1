# negative-proof-payout-execution-seal.ps1
# Prova que o guard audit-payout-execution-seal.mjs MORDE: se o executor voltar a (a) ler/escrever
# approval_requests por SQL cru, (b) escrever bank_* direto, ou (c) usar seller_available, o guard FALHA.
# Mutação temporária do arquivo real com RESTAURAÇÃO garantida (try/finally) + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-payout-execution-seal.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/modules/wallet/actor-wallet-payout.service.ts'

function Invoke-Guard {
  node scripts/audit-payout-execution-seal.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$shaBefore = Get-Sha $f

$baseOk = ((Invoke-Guard) -eq 0)
$rawApprovalBites = $false
$bankWriteBites = $false
$sellerBites = $false

try {
  # (a) ler approval por SQL cru.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_raw__(c, t, id) { return c.query('SELECT status FROM approval_requests WHERE tenant_id=\$1 AND id=\$2', [t, id]); }`n") -Encoding UTF8 -NoNewline
  $rawApprovalBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) escrever bank_ledger direto.
  Set-Content -Path $f -Value ($orig + "`nasync function __np_bank__(c) { return c.query('INSERT INTO bank_ledger (id) VALUES (gen_random_uuid())'); }`n") -Encoding UTF8 -NoNewline
  $bankWriteBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (c) usar seller_available.
  Set-Content -Path $f -Value ($orig + "`nconst __np_seller__ = 'seller_available';`n") -Encoding UTF8 -NoNewline
  $sellerBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $shaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $rawApprovalBites -and $bankWriteBites -and $sellerBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof payout-execution-seal] baseOk=$baseOk rawApprovalBites=$rawApprovalBites bankWriteBites=$bankWriteBites sellerBites=$sellerBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde SQL cru de approval + bank_* direto + seller_available; restauração byte-idêntica.' -ForegroundColor Green
exit 0
