# negative-proof-marketplace-money-latent-containment.ps1
# Prova reprodutível de que audit-marketplace-money-latent-containment.mjs MORDE quando uma rota
# money-latent volta a chamar o sink (settlementService.settle) em vez do 403 fail-closed. Muta o
# arquivo (backup byte-exato), confirma GATE FAIL (exit 1), restaura byte-idêntico e confirma GATE OK.
# F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT.
$ErrorActionPreference = 'Stop'
$file  = 'C:/unificard/backend/src/modules/marketplace/settlement.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-marketplace-money-latent-containment.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$failed = $false
try {
  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Regressão simulada: religar o sink de mutação no handler de settle (o vetor exato que o guard defende).
  $needle = 'return reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED);'
  $inject = 'await settlementService.settle(req.tenant.id, req.params.id, ''x'', ''y''); return reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED);'
  $mutated = $text.Replace($needle, $inject)
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: âncora do 403 não encontrada (o arquivo mudou?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FALHOU: guard PASSOU (exit 0) com o sink religado — esperado FAIL." }
  Write-Host "✅ NEGATIVE-PROOF: guard FALHOU (exit $rc) com settlementService.settle religado (esperado)." -ForegroundColor Green
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  [IO.File]::WriteAllBytes($file, $origBytes)
  Write-Host "🧹 arquivo restaurado byte-idêntico." -ForegroundColor Cyan
}
if ($failed) { exit 1 }

& node $guard
if ($LASTEXITCODE -ne 0) { Write-Host "💥 POST-RESTORE: guard não passou após restore." -ForegroundColor Red; exit 1 }
Write-Host "✅ POST-RESTORE: guard OK (exit 0). Negative-proof reproduzível concluído." -ForegroundColor Green
exit 0
