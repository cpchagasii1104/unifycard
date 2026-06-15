# negative-proof-reversal-containment.ps1
# Prova que o guard audit-reversal-containment.mjs MORDE. Mutações temporárias + RESTAURAÇÃO
# byte-idêntica (SHA256). O guard FALHA se:
#   (1) uma rota de dispute/reversal 403 for reaberta (INV1);
#   (2) o money do reversal trocar buildSystemAuthorship por autoria actor/user (INV3);
#   (3) uma rota HTTP passar a chamar o motor de reversal direto (INV4);
#   (4) o tombstone bank-transaction.reverseTransaction for reativado (INV5);
#   (5) surgir caller novo do bridge dead (rides.cancelRide) num arquivo de runtime (INV6);
#   (6) o post-D-money/recovery block for removido (INV7).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$disputeRoutes = 'src/modules/reconciliation/reconciliation-dispute.routes.ts'
$reversalSvc   = 'src/modules/reversal/reversal.service.ts'
$bankTxSvc     = 'src/modules/bank/bank-transaction.service.ts'
$files = @($disputeRoutes, $reversalSvc, $bankTxSvc)

function Invoke-Guard { node scripts/audit-reversal-containment.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$reopen403 = $false; $authorship = $false; $routeEngine = $false; $tombstone = $false; $newBridgeCaller = $false; $postDmoney = $false

try {
  # (1) reabrir a rota de reversal (remover o marcador DISABLED) → INV1.
  Set-Content -Path $disputeRoutes -Value ($orig[$disputeRoutes] -replace 'DISPUTE_REVERSAL_HTTP_DISABLED', 'DISPUTE_REVERSAL_HTTP_ENABLED') -Encoding UTF8 -NoNewline
  $reopen403 = ((Invoke-Guard) -ne 0); Restore

  # (3) rota HTTP passa a chamar o motor de reversal direto → INV4.
  Set-Content -Path $disputeRoutes -Value ($orig[$disputeRoutes] + "`nexecuteReversal(1);`n") -Encoding UTF8 -NoNewline
  $routeEngine = ((Invoke-Guard) -ne 0); Restore

  # (2) money do reversal deixa de ser system-authored → INV3.
  Set-Content -Path $reversalSvc -Value ($orig[$reversalSvc] -replace 'authorship: buildSystemAuthorship', 'authorship: buildActorAuthorship') -Encoding UTF8 -NoNewline
  $authorship = ((Invoke-Guard) -ne 0); Restore

  # (5) caller novo do bridge dead (rides.cancelRide) num arquivo de runtime → INV6.
  Set-Content -Path $reversalSvc -Value ($orig[$reversalSvc] + "`nfunction __np_c(){ return cancelRide(0); }`n") -Encoding UTF8 -NoNewline
  $newBridgeCaller = ((Invoke-Guard) -ne 0); Restore

  # (6) post-D-money/recovery block removido → INV7.
  Set-Content -Path $reversalSvc -Value ($orig[$reversalSvc] -replace 'refunded_via_recovery', 'refunded_via_xxx') -Encoding UTF8 -NoNewline
  $postDmoney = ((Invoke-Guard) -ne 0); Restore

  # (4) tombstone bank-transaction.reverseTransaction reativado (perde o marcador deprecated) → INV5.
  Set-Content -Path $bankTxSvc -Value ($orig[$bankTxSvc] -replace 'REVERSE_TRANSACTION_DEPRECATED', 'REVERSE_TRANSACTION_OK') -Encoding UTF8 -NoNewline
  $tombstone = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $reopen403 -and $authorship -and $routeEngine -and $tombstone -and $newBridgeCaller -and $postDmoney -and $restored -and $guardGreenAgain
Write-Host "[neg-proof reversal-containment] baseOk=$baseOk reopen403=$reopen403 authorship=$authorship routeEngine=$routeEngine tombstone=$tombstone newBridgeCaller=$newBridgeCaller postDmoney=$postDmoney restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde reabrir-403/authorship-nao-system/rota-chama-motor/tombstone-reativado/novo-caller-bridge/remover-post-dmoney; restauração byte-idêntica.' -ForegroundColor Green
exit 0
