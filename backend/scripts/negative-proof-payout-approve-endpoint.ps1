# negative-proof-payout-approve-endpoint.ps1
# Prova que o guard audit-payout-approve-endpoint.mjs MORDE. Mutação temporária + RESTAURAÇÃO
# byte-idêntica (SHA256) de payout-decision.routes.ts E payout-approval-policy.ts. O guard FALHA se:
#   (a) a rota chamar approveActorWalletPayout (aprovação real sem política Core);
#   (b) a rota retornar executed:true;
#   (c) a rota remover a trava requester!=approver (PAYOUT_APPROVER_CANNOT_BE_REQUESTER);
#   (d) a rota remover a consulta resolvePayoutApprovalPolicy (fail-closed);
#   (e) o resolvedor de política deixar de ser fail-closed (passar a retornar configured:true).
# Uso: pwsh -File scripts/negative-proof-payout-approve-endpoint.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$route = 'src/modules/payout/payout-decision.routes.ts'
$policy = 'src/modules/payout/payout-approval-policy.ts'

function Invoke-Guard {
  node scripts/audit-payout-approve-endpoint.mjs *> $null
  return $LASTEXITCODE
}
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$origRoute = Get-Content $route -Raw
$origPolicy = Get-Content $policy -Raw
$shaRouteBefore = Get-Sha $route
$shaPolicyBefore = Get-Sha $policy

$baseOk = ((Invoke-Guard) -eq 0)
$approveBites = $false
$executedTrueBites = $false
$noSegregationBites = $false
$noPolicyBites = $false
$configuredTrueBites = $false

try {
  # (a) reintroduzir aprovação real.
  Set-Content -Path $route -Value ($origRoute + "`nasync function __np_a__(t, id, u) { return actorWalletPayoutService.approveActorWalletPayout(t, id, u); }`n") -Encoding UTF8 -NoNewline
  $approveBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $route -Value $origRoute -Encoding UTF8 -NoNewline

  # (b) executed:true.
  Set-Content -Path $route -Value ($origRoute + "`nconst __np_b__ = { executed: true };`n") -Encoding UTF8 -NoNewline
  $executedTrueBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $route -Value $origRoute -Encoding UTF8 -NoNewline

  # (c) remover a trava de segregação (requester != approver).
  Set-Content -Path $route -Value ($origRoute -replace 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER', 'PAYOUT_OK_TO_SELF_APPROVE') -Encoding UTF8 -NoNewline
  $noSegregationBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $route -Value $origRoute -Encoding UTF8 -NoNewline

  # (d) remover a consulta de política fail-closed.
  Set-Content -Path $route -Value ($origRoute -replace 'resolvePayoutApprovalPolicy', 'someOtherResolver') -Encoding UTF8 -NoNewline
  $noPolicyBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $route -Value $origRoute -Encoding UTF8 -NoNewline

  # (e) resolvedor deixa de ser fail-closed (retorna configured:true).
  Set-Content -Path $policy -Value ($origPolicy -replace 'configured: false', 'configured: true') -Encoding UTF8 -NoNewline
  $configuredTrueBites = ((Invoke-Guard) -ne 0)
  Set-Content -Path $policy -Value $origPolicy -Encoding UTF8 -NoNewline
}
finally {
  Set-Content -Path $route -Value $origRoute -Encoding UTF8 -NoNewline
  Set-Content -Path $policy -Value $origPolicy -Encoding UTF8 -NoNewline
}

$restored = ((Get-Sha $route) -eq $shaRouteBefore) -and ((Get-Sha $policy) -eq $shaPolicyBefore)
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $approveBites -and $executedTrueBites -and $noSegregationBites -and $noPolicyBites -and $configuredTrueBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof payout-approve-endpoint] baseOk=$baseOk approveBites=$approveBites executedTrueBites=$executedTrueBites noSegregationBites=$noSegregationBites noPolicyBites=$noPolicyBites configuredTrueBites=$configuredTrueBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde approve/executed:true/sem-segregação/sem-política/configured:true; restauração byte-idêntica.' -ForegroundColor Green
exit 0
