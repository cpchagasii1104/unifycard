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
$sprBites = $false; $execBites = $false; $no403Bites = $false; $createNoReceiver = $false; $createBodyAuthority = $false

try {
  # (1) SPR GET/POST perde canRepresentActor.
  Set-Content -Path $spr -Value ($orig[$spr] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $sprBites = ((Invoke-Guard) -ne 0); Restore

  # (2) execution GET perde canRepresentActor.
  Set-Content -Path $exec -Value ($orig[$exec] -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $execBites = ((Invoke-Guard) -ne 0); Restore

  # (3) SPR perde o 403 fail-closed (afeta GET e POST create).
  Set-Content -Path $spr -Value ($orig[$spr] -replace '\.status\(403\)', '.status(200)') -Encoding UTF8 -NoNewline
  $no403Bites = ((Invoke-Guard) -ne 0); Restore

  # (4) POST create deixa de DERIVAR o receiver de service.actorId (server-side).
  Set-Content -Path $spr -Value ($orig[$spr] -replace 'const receiverActorId = service\.actorId;', "const receiverActorId = '';") -Encoding UTF8 -NoNewline
  $createNoReceiver = ((Invoke-Guard) -ne 0); Restore

  # (5) POST create volta a usar BODY (parsed.data) como parte autoritativa da cobrança.
  Set-Content -Path $spr -Value ($orig[$spr] -replace 'receiverActorId, // DERIVADO server-side \(body ignorado\)', 'receiverActorId: parsed.data.receiverActorId, // body') -Encoding UTF8 -NoNewline
  $createBodyAuthority = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $sprBites -and $execBites -and $no403Bites -and $createNoReceiver -and $createBodyAuthority -and $restored -and $guardGreenAgain
Write-Host "[neg-proof spr-read-authority] baseOk=$baseOk sprNoBinding=$sprBites execNoBinding=$execBites no403=$no403Bites createNoReceiver=$createNoReceiver createBodyAuthority=$createBodyAuthority restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde sem-canRepresentActor (spr/exec)/sem-403/create-sem-receiver-derivado/create-body-authority; restauração byte-idêntica.' -ForegroundColor Green
exit 0
