# negative-proof-actor-capability-grants-nonfinancial.ps1
# Prova que o guard audit-actor-capability-grants-nonfinancial.mjs MORDE cada regressão dos invariantes do
# substrato de grants e que a restauração é byte-idêntica (SHA256). Mordidas sobre arquivos REAIS; cada uma:
# muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-actor-capability-grants-nonfinancial.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$mig    = Join-Path (Get-Location) 'migrations\20260616210000_create_actor_capability_grants.sql'
$types  = Join-Path (Get-Location) 'src\modules\authority\actor-capability-grant.types.ts'
$lookup = Join-Path (Get-Location) 'src\modules\authority\actor-lookup.service.ts'

function Invoke-Guard {
    node scripts/audit-actor-capability-grants-nonfinancial.mjs *> $null
    return $LASTEXITCODE
}

$baseOk = ((Invoke-Guard) -eq 0)

# (file, find, repl, rótulo) — `all`=todas as ocorrências; default=1ª.
$bites = @(
    @{ name = 'allowlist-financial'; file = $mig;    find = "'services:disable'";                  repl = "'services:disable',`r`n      'financial:execute_payout'" },
    @{ name = 'scope-global';        file = $mig;    find = "CHECK \(scope_type = 'actor'\)";      repl = "CHECK (scope_type IN ('actor','global'))" },
    @{ name = 'drop-grantee-actor';  file = $mig;    find = 'grantee_actor_id      UUID NOT NULL'; repl = 'grantee_actor_id      UUID NULL' },
    @{ name = 'types-financial';     file = $types;  find = "'services:disable',";                 repl = "'services:disable',`r`n  'split:create'," },
    @{ name = 'lookup-referral';     file = $lookup; find = 'AND slug=\$2';                         repl = "AND referral_code=`$2" }
)

$allBitesOk = $true
$details = @()
foreach ($b in $bites) {
    $orig = Get-Content $b.file -Raw
    $origHash = (Get-FileHash $b.file -Algorithm SHA256).Hash
    $rx = [regex]::new($b.find)
    $mutated = $rx.Replace($orig, $b.repl, 1)
    if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
    Set-Content -Path $b.file -Value $mutated -NoNewline -Encoding UTF8
    $bit = ((Invoke-Guard) -ne 0)
    Set-Content -Path $b.file -Value $orig -NoNewline -Encoding UTF8
    $restoredOk = ((Invoke-Guard) -eq 0)
    $hashOk = ((Get-FileHash $b.file -Algorithm SHA256).Hash -eq $origHash)
    if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
    $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof actor-capability-grants-nonfinancial] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
