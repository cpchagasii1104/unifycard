# negative-proof-payout-approve-endpoint.ps1
# Prova que o guard audit-payout-approve-endpoint.mjs MORDE. Mutação temporária + RESTAURAÇÃO
# byte-idêntica (SHA256) dos 4 arquivos (route/orchestrator/core-service/constants). O guard FALHA se:
#   (a) a ROTA chamar approveActorWalletPayout (deve delegar ao orquestrador, não chamar o bridge);
#   (b) a ROTA retornar executed:true;
#   (c) a ROTA remover a trava requester!=approver (PAYOUT_APPROVER_CANNOT_BE_REQUESTER);
#   (d) o CORE parar de checar a autoridade material (financial_approval_authorities);
#   (e) a faixa MVP (CONST) divergir de 50000;
#   (f) o ORQUESTRADOR parar de chamar o bridge selado (approveActorWalletPayout).
# Uso: pwsh -File scripts/negative-proof-payout-approve-endpoint.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$route = 'src/modules/payout/payout-decision.routes.ts'
$orch  = 'src/modules/payout/payout-approval.service.ts'
$core  = 'src/core/financial-approval/payout-approval-policy.service.ts'
$const = 'src/core/financial-approval/payout-approval-policy.constants.ts'
$files = @($route, $orch, $core, $const)

function Invoke-Guard { node scripts/audit-payout-approve-endpoint.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }

$baseOk = ((Invoke-Guard) -eq 0)
$routeApproveBites = $false; $executedTrueBites = $false; $noSegregationBites = $false
$coreNoAuthorityBites = $false; $constFaixaBites = $false; $orchNoBridgeBites = $false

function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

try {
  # (a) ROTA chama o bridge direto.
  Set-Content -Path $route -Value ($orig[$route] + "`nasync function __np_a__(t,id,u){ return actorWalletPayoutService.approveActorWalletPayout(t,id,u); }`n") -Encoding UTF8 -NoNewline
  $routeApproveBites = ((Invoke-Guard) -ne 0); Restore

  # (b) executed:true na rota.
  Set-Content -Path $route -Value ($orig[$route] + "`nconst __np_b__ = { executed: true };`n") -Encoding UTF8 -NoNewline
  $executedTrueBites = ((Invoke-Guard) -ne 0); Restore

  # (c) remove a segregação na rota.
  Set-Content -Path $route -Value ($orig[$route] -replace 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER', 'PAYOUT_OK_SELF') -Encoding UTF8 -NoNewline
  $noSegregationBites = ((Invoke-Guard) -ne 0); Restore

  # (d) CORE deixa de checar autoridade material.
  Set-Content -Path $core -Value ($orig[$core] -replace 'financial_approval_authorities', 'xxx_no_authority') -Encoding UTF8 -NoNewline
  $coreNoAuthorityBites = ((Invoke-Guard) -ne 0); Restore

  # (e) faixa MVP divergente.
  Set-Content -Path $const -Value ($orig[$const] -replace 'PAYOUT_MVP_MAX_AMOUNT_CENTS = 50000', 'PAYOUT_MVP_MAX_AMOUNT_CENTS = 60000') -Encoding UTF8 -NoNewline
  $constFaixaBites = ((Invoke-Guard) -ne 0); Restore

  # (f) ORQUESTRADOR não chama o bridge.
  Set-Content -Path $orch -Value ($orig[$orch] -replace 'approveActorWalletPayout', 'someOtherCall') -Encoding UTF8 -NoNewline
  $orchNoBridgeBites = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $routeApproveBites -and $executedTrueBites -and $noSegregationBites -and $coreNoAuthorityBites -and $constFaixaBites -and $orchNoBridgeBites -and $restored -and $guardGreenAgain
Write-Host "[neg-proof payout-approve-endpoint] baseOk=$baseOk routeApprove=$routeApproveBites executedTrue=$executedTrueBites noSegregation=$noSegregationBites coreNoAuthority=$coreNoAuthorityBites constFaixa=$constFaixaBites orchNoBridge=$orchNoBridgeBites restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde route-approve/executed:true/sem-segregacao/core-sem-autoridade/faixa-divergente/orch-sem-bridge; restauracao byte-identica.' -ForegroundColor Green
exit 0
