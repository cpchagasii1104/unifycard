# negative-proof-operator-service-order-view-grant.ps1
# Prova que o guard audit-operator-service-order-view-grant.mjs MORDE cada regressão da fatia
# F-OPERATOR-SERVICE-ORDER-VIEW-GRANT. Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256.
# Restauração garantida (snapshot + try/finally + backstop).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$types  = Join-Path (Get-Location) 'src\modules\authority\actor-capability-grant.types.ts'
$mig    = Join-Path (Get-Location) 'migrations\20260626120000_expand_capability_allowlist_service_order_view.sql'
$svc    = Join-Path (Get-Location) 'src\modules\services\service-order.service.ts'
$routes = Join-Path (Get-Location) 'src\modules\services\service-order.routes.ts'

function Invoke-Guard {
    # ErrorActionPreference=Continue ao redor do native call: WPS 5.1 levanta NativeCommandError quando o
    # guard escreve em stderr (GATE FAIL) sob Stop. 2>&1 | Out-Null engole streams nos dois shells.
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & node scripts/audit-operator-service-order-view-grant.mjs 2>&1 | Out-Null }
    finally { $ErrorActionPreference = $old }
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) tirar 'service_order:view' da allowlist (types) -> guard FAIL (A-types)
    @{ name = 'types-allowlist-drops-key'; file = $types;
       find = "'service_order:view',";
       repl = "'service_order:viewX'," },
    # 2) adicionar capability de ESCRITA na allowlist (types) -> guard FAIL (B)
    @{ name = 'types-allowlist-adds-write-cap'; file = $types;
       find = "'service_order:view',";
       repl = "'service_order:view',`n  'service_order:update_status'," },
    # 3) remover 'service_order:view' do CHECK efetivo da migration -> guard FAIL (A-migration)
    #    (alvo é a LINHA do CHECK — 6 espaços —, não a menção no comentário SQL que o guard descarta)
    @{ name = 'migration-check-drops-key'; file = $mig;
       find = "`n      'service_order:view'";
       repl = "`n      'service_order:viewX'" },
    # 4) canViewOrderForParty perde canRepresentActor (owner/representação) -> guard FAIL (C)
    @{ name = 'service-loses-canrepresent'; file = $svc;
       find = "canRepresentActor\(tenantId, userId, partyActorId\)";
       repl = "canRepresentActorX(tenantId, userId, partyActorId)" },
    # 5) canViewOrderForParty perde o fallback do grant (key errada) -> guard FAIL (C)
    #    (alvo é o argumento da chamada hasCapabilityGrant — 8 espaços + vírgula —, não o comentário)
    @{ name = 'service-loses-grant-key'; file = $svc;
       find = "`n        'service_order:view',";
       repl = "`n        'service_order:viewX'," },
    # 6) GET :id deixa de ligar o fallback de grant (allowViewGrant: false) -> guard FAIL (D)
    @{ name = 'route-get-id-disables-grant'; file = $routes;
       find = "\{ allowViewGrant: true \}";
       repl = "{ allowViewGrant: false }" },
    # 7) financial-terms passa a herdar o fallback de grant -> guard FAIL (E — vaza visão financeira)
    @{ name = 'route-financial-terms-inherits-grant'; file = $routes;
       find = "assertOrderParty\(req, reply, tenantId, order\)\)";
       repl = "assertOrderParty(req, reply, tenantId, order, { allowViewGrant: true }))" },
    # 8) rota importa o grant service (enforcement em rota) -> guard FAIL (D)
    @{ name = 'route-imports-grant-service'; file = $routes;
       find = "import \{ serviceOrderService \} from './service-order\.service';";
       repl = "import { serviceOrderService } from './service-order.service';`nimport { actorCapabilityGrantService } from '@modules/authority/actor-capability-grant.service';" }
)

# IO via [System.IO.File] (UTF8 sem BOM, fiel a acentos) — Set-Content/Get-Content do WPS 5.1 adicionam BOM e
# decodificam em ANSI, corrompendo bytes e quebrando a restauração byte-idêntica.
$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = [System.IO.File]::ReadAllText($f); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { [System.IO.File]::WriteAllText($file, $snapshot[$file].content) }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $rx = [regex]::new($b.find)
            $mutated = $rx.Replace($orig, $b.repl, 1)
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            [System.IO.File]::WriteAllText($b.file, $mutated)
            $bit = ((Invoke-Guard) -ne 0)
        }
        finally { Restore-FromSnapshot $b.file }
        $restoredOk = ((Invoke-Guard) -eq 0)
        $hashOk = ((Get-FileHash $b.file -Algorithm SHA256).Hash -eq $origHash)
        if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
        $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
    }
}
finally {
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot" -ForegroundColor Yellow
        }
    }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof operator-service-order-view-grant] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
