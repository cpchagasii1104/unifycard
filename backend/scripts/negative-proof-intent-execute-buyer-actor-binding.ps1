# negative-proof-intent-execute-buyer-actor-binding.ps1
# Prova reprodutível de que audit-intent-execute-buyer-actor-binding.mjs MORDE quando o binding
# server-side é removido. Muta o arquivo em memória (byte-exact backup), confirma GATE FAIL (exit 1),
# restaura byte-idêntico e confirma GATE OK. F-AUTHORITY-Z2-R5-INTENT-EXECUTE-BUYER-ACTOR-BINDING.
$ErrorActionPreference = 'Stop'
$file  = 'C:/unificard/backend/src/core/intent/intent-execute.routes.ts'
$guard = 'C:/unificard/backend/scripts/audit-intent-execute-buyer-actor-binding.mjs'

$origBytes = [IO.File]::ReadAllBytes($file)
$failed = $false
try {
  $text = [Text.Encoding]::UTF8.GetString($origBytes)
  # Regressão simulada: remover o gate server-side (canRepresentActor) — o vetor exato que o guard defende.
  $mutated = $text -replace 'authorizationService\.canRepresentActor\(tenantId, authUserId, buyerActorId\)', 'Promise.resolve(true)'
  if ($mutated -eq $text) { throw 'MUTATION NO-OP: padrão do binding não encontrado (o arquivo mudou?).' }
  [IO.File]::WriteAllText($file, $mutated, (New-Object Text.UTF8Encoding($false)))

  & node $guard
  $rc = $LASTEXITCODE
  if ($rc -eq 0) { throw "NEGATIVE-PROOF FALHOU: guard PASSOU (exit 0) com binding removido — esperado FAIL." }
  Write-Host "✅ NEGATIVE-PROOF: guard FALHOU (exit $rc) com binding removido (esperado)." -ForegroundColor Green
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
