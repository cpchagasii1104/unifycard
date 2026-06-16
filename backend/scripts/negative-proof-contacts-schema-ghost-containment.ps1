# negative-proof-contacts-schema-ghost-containment.ps1
# Prova que o guard audit-contacts-schema-ghost-containment.mjs MORDE. Mutações temporárias + RESTAURAÇÃO
# byte-idêntica (SHA256). Morde se: (1) remover assert de um método do service; (2) quebrar o probe do guard;
# (3) remover o code 501; (4) um caller externo passar a usar contactRepository direto (funil quebrado).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$service = 'src/modules/marketplace/contact.service.ts'
$guard = 'src/modules/marketplace/contact-feature.guard.ts'
# arquivo externo só para o teste de funil (restaurado byte-idêntico)
$external = 'src/modules/venue/venue.routes.ts'
$files = @($service, $guard, $external)

function Invoke-Guard { node scripts/audit-contacts-schema-ghost-containment.mjs *> $null; return $LASTEXITCODE }
function Get-Sha([string]$p) { (Get-FileHash -Algorithm SHA256 $p).Hash }

$orig = @{}; $sha = @{}
foreach ($f in $files) { $orig[$f] = Get-Content $f -Raw; $sha[$f] = Get-Sha $f }
function Restore { foreach ($f in $script:files) { Set-Content -Path $f -Value $script:orig[$f] -Encoding UTF8 -NoNewline } }

$baseOk = ((Invoke-Guard) -eq 0)
$assertGone = $false; $probeGone = $false; $codeGone = $false; $funnelBroken = $false

try {
  # (1) remover a contenção de getContactById (mantém a chamada ao repository).
  $mut = $orig[$service] -replace "(?s)(async getContactById\(tenantId: string, contactId: string\): Promise<Contact \| null> \{\r?\n)([^\r\n]*\r?\n[^\r\n]*assertContactsFeatureAvailable\(\);\r?\n)", '$1'
  Set-Content -Path $service -Value $mut -Encoding UTF8 -NoNewline
  $assertGone = ((Invoke-Guard) -ne 0); Restore

  # (2) quebrar o probe to_regclass do guard.
  Set-Content -Path $guard -Value ($orig[$guard] -replace "to_regclass\('public\.contacts'\)", "to_regclass('public.NOPE')") -Encoding UTF8 -NoNewline
  $probeGone = ((Invoke-Guard) -ne 0); Restore

  # (3) remover o code CONTACTS_SCHEMA_GHOST_CONTAINED do guard.
  Set-Content -Path $guard -Value ($orig[$guard] -replace "CONTACTS_SCHEMA_GHOST_CONTAINED", "CONTACTS_OK") -Encoding UTF8 -NoNewline
  $codeGone = ((Invoke-Guard) -ne 0); Restore

  # (4) caller externo passa a usar contactRepository direto (quebra o funil).
  Set-Content -Path $external -Value ($orig[$external] + "`nconst __np = `"contactRepository.getContactById(0,0)`";`n") -Encoding UTF8 -NoNewline
  $funnelBroken = ((Invoke-Guard) -ne 0); Restore
}
finally { Restore }

$restored = $true
foreach ($f in $files) { if ((Get-Sha $f) -ne $sha[$f]) { $restored = $false } }
$guardGreenAgain = ((Invoke-Guard) -eq 0)
$ok = $baseOk -and $assertGone -and $probeGone -and $codeGone -and $funnelBroken -and $restored -and $guardGreenAgain
Write-Host "[neg-proof contacts-ghost] baseOk=$baseOk assertGone=$assertGone probeGone=$probeGone codeGone=$codeGone funnelBroken=$funnelBroken restored=$restored guardGreenAgain=$guardGreenAgain"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard morde assert-removido/probe-quebrado/code-removido/funil-quebrado; restauracao byte-identica.' -ForegroundColor Green
exit 0
