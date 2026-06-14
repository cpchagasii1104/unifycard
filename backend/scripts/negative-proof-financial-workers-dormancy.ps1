# negative-proof-financial-workers-dormancy.ps1
# Prova que o guard audit-financial-workers-dormancy.mjs MORDE: se BOOT.ts voltar a chamar
# startPayoutWorker() incondicional, ou se o gate virar fail-open / auto-enable por NODE_ENV,
# o guard FALHA. Mutação temporária dos arquivos reais com RESTAURAÇÃO garantida (try/finally)
# + hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-financial-workers-dormancy.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$boot = 'BOOT.ts'
$gate = 'src/workers/financial-worker-gate.ts'

function Invoke-Guard {
  node scripts/audit-financial-workers-dormancy.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$bootOrig = Get-Content $boot -Raw
$gateOrig = Get-Content $gate -Raw
$bootSha = Get-Sha $boot
$gateSha = Get-Sha $gate

$baseOk = ((Invoke-Guard) -eq 0)
$uncondBites = $false
$failOpenBites = $false
$nodeEnvBites = $false

try {
  # (a) reintroduzir start incondicional no BOOT.
  Set-Content -Path $boot -Value ($bootOrig + "`nasync function __np_uncond__() { startPayoutWorker(); }`n") -Encoding UTF8 -NoNewline
  $uncondBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $boot -Value $bootOrig -Encoding UTF8 -NoNewline

  # (b) gate fail-open (!== 'false').
  $gateFailOpen = $gateOrig -replace "process\.env\[flag\] === 'true'", "process.env[flag] !== 'false'"
  Set-Content -Path $gate -Value $gateFailOpen -Encoding UTF8 -NoNewline
  $failOpenBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $gate -Value $gateOrig -Encoding UTF8 -NoNewline

  # (c) auto-enable por NODE_ENV no gate.
  $gateNodeEnv = $gateOrig -replace "process\.env\[flag\] === 'true'", "process.env[flag] === 'true' || process.env.NODE_ENV === 'development'"
  Set-Content -Path $gate -Value $gateNodeEnv -Encoding UTF8 -NoNewline
  $nodeEnvBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $gate -Value $gateOrig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $boot -Value $bootOrig -Encoding UTF8 -NoNewline
  Set-Content -Path $gate -Value $gateOrig -Encoding UTF8 -NoNewline
}

$bootRestored = (Get-Sha $boot) -eq $bootSha
$gateRestored = (Get-Sha $gate) -eq $gateSha
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $uncondBites -and $failOpenBites -and $nodeEnvBites -and $bootRestored -and $gateRestored -and $guardGreenAgain
Write-Host "[neg-proof financial-workers-dormancy] baseOk=$baseOk uncondBites=$uncondBites failOpenBites=$failOpenBites nodeEnvBites=$nodeEnvBites bootRestored=$bootRestored gateRestored=$gateRestored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde start incondicional + fail-open + auto-enable NODE_ENV; restauração byte-idêntica.' -ForegroundColor Green
exit 0
