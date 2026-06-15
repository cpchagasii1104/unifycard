# negative-proof-social-work-payment-ownership.ps1
# Prova que o guard audit-social-work-payment-ownership.mjs MORDE. Mutação temporária em
# social-work-payment.routes.ts + RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se a rota GET payments:
#   (a) voltar a usar userHasAnyRole (role-solo);
#   (b) voltar a ter requirePermission (preHandler role-only);
#   (c) perder o gate de ownership (post.globalUserId !== currentGlobalUserId).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$f = 'src/modules/social/social-work-payment.routes.ts'
function Invoke-Guard { node scripts/audit-social-work-payment-ownership.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = Get-Content $f -Raw
$sha = Get-Sha $f
$baseOk = ((Invoke-Guard) -eq 0)
$roleBites = $false; $permBites = $false; $noOwnerBites = $false

try {
  # (a) role-solo de volta (EOF está dentro do bloco GET payments → até o fim do arquivo).
  Set-Content -Path $f -Value ($orig + "`nasync function __np_role__(t,u){ return rbacService.userHasAnyRole(t,u,['admin']); }`n") -Encoding UTF8 -NoNewline
  $roleBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (b) requirePermission role-only de volta.
  Set-Content -Path $f -Value ($orig + "`nconst __np_perm__ = fastify.requirePermission(['x']);`n") -Encoding UTF8 -NoNewline
  $permBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline

  # (c) remover o gate canônico (canRepresentActor).
  Set-Content -Path $f -Value ($orig -replace 'authorizationService\.canRepresentActor', 'authorizationService.someOtherCheck') -Encoding UTF8 -NoNewline
  $noOwnerBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $f -Value $orig -Encoding UTF8 -NoNewline
}

$restored = (Get-Sha $f) -eq $sha
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $roleBites -and $permBites -and $noOwnerBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof social-work-payment-ownership] baseOk=$baseOk roleBites=$roleBites permBites=$permBites noOwnerBites=$noOwnerBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde role-solo / requirePermission / remoção do ownership; restauração byte-idêntica.' -ForegroundColor Green
exit 0
