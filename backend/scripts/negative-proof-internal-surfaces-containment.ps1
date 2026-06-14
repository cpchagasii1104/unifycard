# negative-proof-internal-surfaces-containment.ps1
# Prova que o guard audit-internal-surfaces-containment.mjs MORDE: se a contenção de R18
# (executeDueActions/query.now reabertos) ou R19 (createDispute/list/update/alert ou tenant_id
# de body/query reabertos) voltar, o guard FALHA. Mutação temporária dos arquivos reais com
# RESTAURAÇÃO garantida (try/finally) + verificação de hash byte-idêntico.
# Uso: pwsh -File scripts/negative-proof-internal-surfaces-containment.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$auto = 'src/modules/automation/automation.routes.ts'
$disp = 'src/modules/disputes/financial-dispute.controller.ts'

function Invoke-Guard {
  node scripts/audit-internal-surfaces-containment.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$autoOrig = Get-Content $auto -Raw
$dispOrig = Get-Content $disp -Raw
$autoShaBefore = Get-Sha $auto
$dispShaBefore = Get-Sha $disp

$baseOk = ((Invoke-Guard) -eq 0)
$r18Bit = $false
$r19Bit = $false

try {
  # R18 — reabrir execução via executeDueActions( como CÓDIGO (não comentário).
  Set-Content -Path $auto -Value ($autoOrig + "`nfunction __reopen_r18__(t, n) { return scheduledActionService.executeDueActions(t, n); }`n") -Encoding UTF8 -NoNewline
  $r18Bit = ((Invoke-Guard) -ne 0)
  Set-Content -Path $auto -Value $autoOrig -Encoding UTF8 -NoNewline

  # R19 — reabrir mutação via createDispute( como CÓDIGO.
  Set-Content -Path $disp -Value ($dispOrig + "`nfunction __reopen_r19__(t) { return createDispute(t, {}); }`n") -Encoding UTF8 -NoNewline
  $r19Bit = ((Invoke-Guard) -ne 0)
  Set-Content -Path $disp -Value $dispOrig -Encoding UTF8 -NoNewline
}
finally {
  # Restauração incondicional.
  Set-Content -Path $auto -Value $autoOrig -Encoding UTF8 -NoNewline
  Set-Content -Path $disp -Value $dispOrig -Encoding UTF8 -NoNewline
}

$autoRestored = (Get-Sha $auto) -eq $autoShaBefore
$dispRestored = (Get-Sha $disp) -eq $dispShaBefore
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $r18Bit -and $r19Bit -and $autoRestored -and $dispRestored -and $guardGreenAgain
Write-Host "[neg-proof internal-surfaces] baseOk=$baseOk r18Bites=$r18Bit r19Bites=$r19Bit autoRestored=$autoRestored dispRestored=$dispRestored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde ao reabrir R18 (executeDueActions) e R19 (createDispute); restauração byte-idêntica.' -ForegroundColor Green
exit 0
