# negative-proof-spr-read-authority.ps1
# Prova que o guard audit-spr-read-authority.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica.
# O guard FALHA se: (1) a rota GET payment-request perder canRepresentActor; (2) a rota GET execution perder
# canRepresentActor; (3) o 403 fail-closed for removido.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$spr = 'src/modules/services/service-payment-request.routes.ts'
$exec = 'src/modules/services/service-payment-execution.routes.ts'
$files = @($spr, $exec)

function Invoke-Guard { node scripts/audit-spr-read-authority.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$sprBites = $false; $execBites = $false; $no403Bites = $false

try {
  # (1) SPR GET perde canRepresentActor.
  Set-Content -Path $spr -Value ($orig[$spr] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $sprBites = ((Invoke-Guard) -ne 0); Restore

  # (2) execution GET perde canRepresentActor.
  Set-Content -Path $exec -Value ($orig[$exec] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $execBites = ((Invoke-Guard) -ne 0); Restore

  # (3) SPR GET perde o 403 fail-closed.
  Set-Content -Path $spr -Value ($orig[$spr] -replace '\.status\(403\)', '.status(200)') -Encoding UTF8 -NoNewline
  $no403Bites = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $sprBites -and $execBites -and $no403Bites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof spr-read-authority] baseOk=$baseOk sprNoBinding=$sprBites execNoBinding=$execBites no403=$no403Bites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-canRepresentActor (spr/exec) e sem-403; restauração byte-idêntica.' -ForegroundColor Green
exit 0
