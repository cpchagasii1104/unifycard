# negative-proof-service-order-inbox-auto-emit.ps1
# Prova que o guard audit-service-order-inbox-auto-emit.mjs MORDE cada regressão do auto-emit canônico.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc   = Join-Path (Get-Location) 'src\modules\services\service-order.service.ts'
$proj  = Join-Path (Get-Location) 'src\modules\inbox\social-inbox.projector.ts'
$repo  = Join-Path (Get-Location) 'src\modules\inbox\social-inbox.repository.ts'
$seed  = Join-Path (Get-Location) 'src\scripts\validate-pipeline-e2e-mvp-service-journey-seed.ts'
$routes = Join-Path (Get-Location) 'src\modules\services\service-order.routes.ts'

function Invoke-Guard {
    # ErrorActionPreference=Continue ao redor do native call: WPS 5.1 levanta NativeCommandError quando o
    # guard escreve em stderr (GATE FAIL) sob Stop. 2>&1 | Out-Null engole streams nos dois shells.
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & node scripts/audit-service-order-inbox-auto-emit.mjs 2>&1 | Out-Null }
    finally { $ErrorActionPreference = $old }
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover o auto-emit de confirmBookingFromDecision -> guard FAIL (A)
    @{ name = 'service-auto-emit-removed'; file = $svc;
       find = "projectServiceOrderConfirmed\(tenantId";
       repl = "projectServiceOrderConfirmedXX(tenantId" },
    # 2) trocar provider soberano por cliente -> guard FAIL (A-provider)
    @{ name = 'service-provider-becomes-customer'; file = $svc;
       find = "providerActorId: owner\.authorityActorId, // provider SOBERANO";
       repl = "providerActorId: booking.requesterActorId, // provider SOBERANO" },
    # 3) reintroduzir agenda paralela no caminho -> guard FAIL (G)
    @{ name = 'service-schedule-slots-reintroduced'; file = $svc;
       find = "const \{ socialInboxProjector \} = await import\('@modules/inbox/social-inbox\.projector'\);";
       repl = "const __x = 'schedule_slots'; const { socialInboxProjector } = await import('@modules/inbox/social-inbox.projector');" },
    # 4) referenciar substrato financeiro no módulo inbox -> guard FAIL (C)
    @{ name = 'inbox-repo-money-ref'; file = $repo;
       find = "class SocialInboxRepository \{";
       repl = "class SocialInboxRepository {`n  bank_ledger = 1;" },
    # 5) importar CRM (agreements) no módulo inbox -> guard FAIL (D)
    @{ name = 'inbox-projector-crm-import'; file = $proj;
       find = "import \{ socialInboxRepository \} from '\./social-inbox\.repository';";
       repl = "import { socialInboxRepository } from './social-inbox.repository';`nimport { agreementService } from '../agreements/agreement.service';" },
    # 6) reintroduzir writer test-only direto no E2E seed -> guard FAIL (E-upsert)
    @{ name = 'e2e-seed-testonly-upsert'; file = $seed;
       find = "const inbox = await socialInboxService\.getInboxItems\(TENANT_ID, operator\.actorId\);";
       repl = "await socialInboxRepository.upsert(TENANT_ID, operator.actorId, InboxSourceType.ORDER, order.id, {});`n  const inbox = await socialInboxService.getInboxItems(TENANT_ID, operator.actorId);" },
    # 7) reintroduzir metadata test-only no E2E seed -> guard FAIL (E-origin)
    @{ name = 'e2e-seed-testonly-origin'; file = $seed;
       find = "record\('I atendimento mínimo";
       repl = "const __t = { origin: 'e2e-test-only' };`n  record('I atendimento mínimo" },
    # 8) reabrir POST /service-orders direto -> guard FAIL (F)
    @{ name = 'routes-direct-create-reopened'; file = $routes;
       find = "SERVICE_ORDER_DIRECT_CREATE_DISABLED";
       repl = "SERVICE_ORDER_DIRECT_CREATE_ENABLED" }
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
Write-Host "[neg-proof service-order-inbox-auto-emit] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
