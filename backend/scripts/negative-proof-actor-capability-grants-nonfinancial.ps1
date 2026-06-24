# negative-proof-actor-capability-grants-nonfinancial.ps1
# Prova que o guard audit-actor-capability-grants-nonfinancial.mjs MORDE cada regressão dos invariantes do
# substrato de grants e que a restauração é byte-idêntica (SHA256). Mordidas sobre arquivos REAIS; cada uma:
# muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-actor-capability-grants-nonfinancial.ps1
#
# HARDENING (F-NEGATIVE-PROOF-HARNESS-HARDENING): o restore é GARANTIDO mesmo se uma bite falhar, se um
# comando nativo (node) retornar exit!=0 (que é o ESPERADO quando o guard morde), ou se o processo sofrer
# erro terminante no meio. Mecanismos: (1) $PSNativeCommandUseErrorActionPreference=$false p/ exit!=0 do
# node NÃO lançar; (2) SNAPSHOT de cada arquivo-alvo ANTES de qualquer mutação; (3) try/finally POR BITE
# (restore imediato); (4) try/finally GLOBAL backstop (restaura qualquer arquivo que não bata o snapshot).
$ErrorActionPreference = 'Stop'
# Em PS7 um nativo com exit!=0 lança quando ErrorActionPreference='Stop'. Aqui exit!=0 do guard é ESPERADO
# (é a mordida). Neutralizar localmente evita abortar o harness no meio de uma bite (deixando arquivo mutado).
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$mig    = Join-Path (Get-Location) 'migrations\20260616210000_create_actor_capability_grants.sql'
$types  = Join-Path (Get-Location) 'src\modules\authority\actor-capability-grant.types.ts'
$lookup = Join-Path (Get-Location) 'src\modules\authority\actor-lookup.service.ts'
$pk     = Join-Path (Get-Location) 'src\core\authorization\permission-keys.ts'
$routes = Join-Path (Get-Location) 'src\modules\authority\actor-capability-grant.routes.ts'
$svc    = Join-Path (Get-Location) 'src\modules\services\services.service.ts'

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
    @{ name = 'lookup-referral';     file = $lookup; find = 'AND slug=\$2';                         repl = "AND referral_code=`$2" },
    @{ name = 'pk-misalign';         file = $pk;     find = "  'services:create': null,[^\r\n]*\r?\n"; repl = '' },
    @{ name = 'ep-financial';        file = $routes; find = 'const actorCapabilityGrantRoutes';      repl = "const _fin = 'financial:execute_payout';`r`nconst actorCapabilityGrantRoutes" },
    @{ name = 'ep-no-scope';         file = $routes; find = 'scopeActorId: z\.string\(\)\.uuid\(\),'; repl = 'scopeActorId: z.string().uuid().optional(),'; all = $true },
    @{ name = 'ep-requirepermission';file = $routes; find = 'const actorCapabilityGrantRoutes';      repl = "const _rp = requirePermission;`r`nconst actorCapabilityGrantRoutes" },
    @{ name = '1c-enforcement-gone'; file = $svc;    find = "hasCapabilityGrant\(tenantId, grantee\.actor_id, 'services:create'"; repl = "hasCapabilityGrant(tenantId, grantee.actor_id, 'services:edit'" }
)

# SNAPSHOT byte-seguro de cada arquivo-alvo DISTINTO antes de qualquer mutação (restore garantido).
$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) {
    $snapshot[$f] = @{ content = (Get-Content $f -Raw); hash = (Get-FileHash $f -Algorithm SHA256).Hash }
}
function Restore-FromSnapshot([string]$file) {
    Set-Content -Path $file -Value $snapshot[$file].content -NoNewline -Encoding UTF8
}

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            if ($b.all) { $mutated = $rx.Replace($orig, $b.repl) } else { $mutated = $rx.Replace($orig, $b.repl, 1) }
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            Set-Content -Path $b.file -Value $mutated -NoNewline -Encoding UTF8
            $bit = ((Invoke-Guard) -ne 0)
        }
        finally {
            # RESTORE IMEDIATO E GARANTIDO deste arquivo — independe de erro/continue/exit dentro do try.
            Restore-FromSnapshot $b.file
        }
        $restoredOk = ((Invoke-Guard) -eq 0)
        $hashOk = ((Get-FileHash $b.file -Algorithm SHA256).Hash -eq $origHash)
        if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
        $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
    }
}
finally {
    # BACKSTOP: garante que TODO arquivo-alvo voltou ao snapshot (caso algo escape do finally por-bite).
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot (byte-idêntico)" -ForegroundColor Yellow
        }
    }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof actor-capability-grants-nonfinancial] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão; restauração byte-idêntica (SHA256); restore garantido (try/finally + backstop).' -ForegroundColor Green
exit 0
