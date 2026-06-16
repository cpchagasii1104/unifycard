# negative-proof-temporal-purpose.ps1
# Prova que o guard audit-temporal-purpose.mjs MORDE. Mutações temporárias + RESTAURAÇÃO byte-idêntica (SHA256).
# Morde se: (1) coluna/FK sumir; (2) seed perder um concept; (3) gate perder AVAILABILITY_PERSONAL_PROTECTED;
# (4) materializer não gravar purposeConceptId; (5) zod não validar os 4 slugs; (6) aparecer is_bookable boolean.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$service = 'src/core/availability/unified-availability.service.ts'
$materializer = 'src/core/availability/weekly-template-materializer.service.ts'
$routes = 'src/core/availability/unified-availability.routes.ts'
$seedMig = (Get-ChildItem migrations -Filter '*seed_concepts_temporal_purpose.sql' | Select-Object -First 1).FullName
$seedMig = (Resolve-Path $seedMig).Path -replace [regex]::Escape((Resolve-Path .).Path + '\'), ''
$colMig = (Get-ChildItem migrations -Filter '*availability_purpose_concept_id.sql' | Select-Object -First 1).FullName
$colMig = (Resolve-Path $colMig).Path -replace [regex]::Escape((Resolve-Path .).Path + '\'), ''
$files = @($service, $materializer, $routes, $seedMig, $colMig)

function Invoke-Guard { node scripts/audit-temporal-purpose.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$colGone = $false; $seedGone = $false; $gateGone = $false; $matGone = $false; $zodGone = $false; $isBookable = $false

try {
  # (1) coluna/FK quebra (perde REFERENCES concepts).
  Set-Content -Path $colMig -Value ($orig[$colMig] -replace 'REFERENCES concepts\(concept_id\)', 'REFERENCES domains(domain_key)') -Encoding UTF8 -NoNewline
  $colGone = ((Invoke-Guard) -ne 0); Restore

  # (2) seed perde um concept.
  Set-Content -Path $seedMig -Value ($orig[$seedMig] -replace "'cuidados-pessoais'", "'cuidado-removido'") -Encoding UTF8 -NoNewline
  $seedGone = ((Invoke-Guard) -ne 0); Restore

  # (3) gate de booking perde o erro protegido.
  Set-Content -Path $service -Value ($orig[$service] -replace 'AVAILABILITY_PERSONAL_PROTECTED', 'AVAILABILITY_BOOK_OK') -Encoding UTF8 -NoNewline
  $gateGone = ((Invoke-Guard) -ne 0); Restore

  # (4) materializer não grava purposeConceptId na criação.
  Set-Content -Path $materializer -Value ($orig[$materializer] -replace 'purposeConceptId: w\.purposeConceptId', 'capacity: null') -Encoding UTF8 -NoNewline
  $matGone = ((Invoke-Guard) -ne 0); Restore

  # (5) zod deixa de validar os 4 slugs (vira string livre).
  Set-Content -Path $routes -Value ($orig[$routes] -replace "purposes: z\.record\(z\.enum\(\['trabalho', 'estudo', 'cuidados-pessoais', 'lazer'\]\)\)", 'purposes: z.record(z.string())') -Encoding UTF8 -NoNewline
  $zodGone = ((Invoke-Guard) -ne 0); Restore

  # (6) aparece coluna is_bookable boolean (dupla verdade proibida).
  Set-Content -Path $colMig -Value ($orig[$colMig] + "`nALTER TABLE availability ADD COLUMN is_bookable boolean DEFAULT true;`n") -Encoding UTF8 -NoNewline
  $isBookable = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $colGone -and $seedGone -and $gateGone -and $matGone -and $zodGone -and $isBookable -and $restored -and $guardGreenAgain
Write-Host "[neg-proof temporal-purpose] baseOk=$baseOk colGone=$colGone seedGone=$seedGone gateGone=$gateGone matGone=$matGone zodGone=$zodGone isBookable=$isBookable restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde coluna/FK/seed/gate/materializer/zod/is_bookable; restauracao byte-identica.' -ForegroundColor Green
exit 0
