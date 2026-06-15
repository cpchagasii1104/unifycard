# negative-proof-temporal-legacy-tombstone.ps1
# Prova que o guard audit-temporal-legacy-tombstone.mjs MORDE (E2). Mutações temporárias +
# RESTAURAÇÃO byte-idêntica (SHA256). O guard FALHA se:
#   (1) um writer NOVO fizer INSERT INTO schedules;
#   (2) um writer NOVO fizer UPDATE schedule_slots;
#   (3) um writer NOVO fizer DELETE FROM schedules;
#   (4) a migration de REVOKE perder o REVOKE de schedule_slots FROM PUBLIC;
#   (5) um serviço-tombstone (SlotGenerator) deixar de lançar *LegacyError.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Invoke-Guard { node scripts/audit-temporal-legacy-tombstone.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$baseOk = ((Invoke-Guard) -eq 0)

# (1-3) writers NOVOS via probe temporário em runtime (src/modules, fora de scripts/tests).
$probe = 'src/modules/__neg_probe_temporal__/neg-temporal.service.ts'
$probeDir = Split-Path $probe -Parent
New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
$insBites = $false; $updBites = $false; $delBites = $false
Set-Content -Path $probe -Value 'export const q = `INSERT INTO schedules (id) VALUES (gen_random_uuid())`;' -Encoding UTF8
$insBites = ((Invoke-Guard) -ne 0)
Set-Content -Path $probe -Value "export const q = ``UPDATE schedule_slots SET status='x'``;" -Encoding UTF8
$updBites = ((Invoke-Guard) -ne 0)
Set-Content -Path $probe -Value 'export const q = `DELETE FROM schedules WHERE id = $1`;' -Encoding UTF8
$delBites = ((Invoke-Guard) -ne 0)
Remove-Item $probe -Force; Remove-Item $probeDir -Recurse -Force -ErrorAction SilentlyContinue
$probeRemoved = -not (Test-Path $probe)

# (4) migration de REVOKE enfraquecida (remove o REVOKE de schedule_slots).
$mig = 'migrations/20260428200000_schedules_revoke_write.sql'
$migAbs = (Resolve-Path $mig).Path
$migOrig = [System.IO.File]::ReadAllText($migAbs); $migSha = Get-Sha $mig
[System.IO.File]::WriteAllText($migAbs, ($migOrig -replace 'REVOKE INSERT, UPDATE ON schedule_slots FROM PUBLIC;', ''))
$migBites = ((Invoke-Guard) -ne 0)
[System.IO.File]::WriteAllText($migAbs, $migOrig)
$migRestored = ((Get-Sha $mig) -eq $migSha)

# (5) serviço-tombstone SlotGenerator deixa de lançar *LegacyError (ganha corpo vivo).
$svc = 'src/services/schedule/SlotGenerator.ts'
$svcAbs = (Resolve-Path $svc).Path
$svcOrig = [System.IO.File]::ReadAllText($svcAbs); $svcSha = Get-Sha $svc
[System.IO.File]::WriteAllText($svcAbs, ($svcOrig -replace 'throw new ScheduleLegacyError', 'return Promise.resolve'))
$svcBites = ((Invoke-Guard) -ne 0)
[System.IO.File]::WriteAllText($svcAbs, $svcOrig)
$svcRestored = ((Get-Sha $svc) -eq $svcSha)

$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $insBites -and $updBites -and $delBites -and $probeRemoved -and $migBites -and $migRestored -and $svcBites -and $svcRestored -and $guardGreenAgain
Write-Host "[neg-proof temporal-legacy-tombstone] baseOk=$baseOk insWriter=$insBites updWriter=$updBites delWriter=$delBites probeRemoved=$probeRemoved revokeWeakened=$migBites migRestored=$migRestored tombstoneResurrected=$svcBites svcRestored=$svcRestored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde writer-INSERT/UPDATE/DELETE-novo / REVOKE-enfraquecido / tombstone-ressuscitado; restauração byte-idêntica.' -ForegroundColor Green
exit 0
