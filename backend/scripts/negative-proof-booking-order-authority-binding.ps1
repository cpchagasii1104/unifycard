# negative-proof-booking-order-authority-binding.ps1
# Prova que o guard audit-booking-order-authority-binding detecta NOVO writer que cria
# service_order lendo metadata.serviceId SEM resolveAvailabilityOwner (regressão do confused-deputy)
# -> guard deve FALHAR -> remove o arquivo -> guard volta a passar. Zero resíduo.
# Uso: pwsh -File scripts/negative-proof-booking-order-authority-binding.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$probe = Join-Path (Get-Location) 'src\modules\__neg_probe__\neg-probe-booking-order.service.ts'
$probeDir = Split-Path $probe -Parent

function Invoke-Guard {
    node scripts/audit-booking-order-authority-binding.mjs *> $null
    return $LASTEXITCODE
}

# 1) Estado base: guard verde.
$baseOk = ((Invoke-Guard) -eq 0)

# 2) Injeta writer novo: cria service_order resolvendo provider de metadata.serviceId SEM
#    resolveAvailabilityOwner (autoridade por metadata = confused-deputy).
New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
$content = @'
import { servicesRepository } from '@modules/services/services.repository';
import { serviceOrderRepository } from '@modules/services/service-order.repository';
class NegProbeService {
  async make(tenantId: string, booking: any, decidedByActorId: string) {
    const serviceId = booking.metadata?.serviceId;
    const service = await servicesRepository.findById(tenantId, serviceId);
    if (service.actorId === decidedByActorId) {
      // autoridade derivada de metadata, sem dono soberano da availability
      return serviceOrderRepository.createOrder(tenantId, {
        serviceId,
        workerActorId: service.actorId,
        customerActorId: booking.requesterActorId,
      } as any);
    }
    return null;
  }
}
export const negProbeService = new NegProbeService();
'@
Set-Content -Path $probe -Value $content -Encoding UTF8

$guardFailed = ((Invoke-Guard) -ne 0)

# 3) Remove o probe e a pasta.
Remove-Item $probe -Force
Remove-Item $probeDir -Force -Recurse -ErrorAction SilentlyContinue

$guardOkAgain = ((Invoke-Guard) -eq 0)

# 4) Fase 2: re-exposicao da rota direta POST /service-orders chamando serviceOrderService.createOrder.
$routes = Join-Path (Get-Location) 'src\modules\services\service-order.routes.ts'
$bak = "$routes.negbak"
Copy-Item $routes $bak -Force
$routeFailed = $false; $routeRestored = $false
try {
    Add-Content -Path $routes -Value 'const _negProbe = async () => serviceOrderService.createOrder(0 as any, 0 as any, "", "");' -Encoding UTF8
    $routeFailed = ((Invoke-Guard) -ne 0)
}
finally {
    Move-Item $bak $routes -Force
    $routeRestored = ((Invoke-Guard) -eq 0)
}

$ok = $baseOk -and $guardFailed -and $guardOkAgain -and (-not (Test-Path $probe)) -and $routeFailed -and $routeRestored -and (-not (Test-Path $bak))
Write-Host "[neg-proof booking-order-authority-binding] baseOk=$baseOk writerViolationFailed=$guardFailed writerRestoredOk=$guardOkAgain routeReexposeFailed=$routeFailed routeRestoredOk=$routeRestored residue=$([bool](Test-Path $probeDir))"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard detecta (a) writer confused-deputy novo e (b) re-exposicao da rota direta; restauracao limpa.' -ForegroundColor Green
exit 0
