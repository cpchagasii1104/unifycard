# negative-proof-actor-authority-boundary.ps1
# Prova que o guard audit-actor-authority-boundary detecta NOVA violação do 6º canal.
# Injeta uma rota temporária que lê req.body.actor SEM binding → guard deve FALHAR (new>=1)
# → remove o arquivo → guard volta a passar. Zero resíduo.
# Uso: pwsh -File scripts/negative-proof-actor-authority-boundary.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$probe = Join-Path (Get-Location) 'src\modules\__neg_probe__\neg-probe-authority.routes.ts'
$probeDir = Split-Path $probe -Parent

function Invoke-Guard {
    node scripts/audit-actor-authority-boundary.mjs *> $null
    return $LASTEXITCODE
}

# 1) Estado base: guard verde.
$baseOk = ((Invoke-Guard) -eq 0)

# 2) Injeta rota nova com canal client-declared (body.actor.kind) SEM binding.
New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
$content = @'
import type { FastifyPluginAsync } from 'fastify';
const negProbeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/neg-probe', async (req: any, reply: any) => {
    // 6º canal: ator declarado pelo cliente usado como autoridade, SEM binding server-side.
    const kind = req.body.actor.kind;
    const actorId = req.body.actor.actorId;
    return reply.send({ ok: true, kind, actorId });
  });
};
export default negProbeRoutes;
'@
Set-Content -Path $probe -Value $content -Encoding UTF8

$guardFailed = ((Invoke-Guard) -ne 0)

# 3) Remove o probe e a pasta.
Remove-Item $probe -Force
Remove-Item $probeDir -Force -Recurse -ErrorAction SilentlyContinue

$guardOkAgain = ((Invoke-Guard) -eq 0)

# Fase 2: subject==target (requirePermission(tenantId, X, X, ...)) -> guard deve FALHAR (antipadrao spoof).
$probe2 = Join-Path (Get-Location) 'src\modules\__neg_probe2__\neg-probe-spoof.routes.ts'
$probe2Dir = Split-Path $probe2 -Parent
New-Item -ItemType Directory -Force -Path $probe2Dir | Out-Null
$content2 = @'
export const negSpoof = async (req: any, tenantId: string, actorId: string) => {
  await businessAuthorizationService.requirePermission(tenantId, actorId, actorId, 'financial:view_all_ledger');
};
'@
Set-Content -Path $probe2 -Value $content2 -Encoding UTF8
$spoofFailed = ((Invoke-Guard) -ne 0)
Remove-Item $probe2 -Force
Remove-Item $probe2Dir -Force -Recurse -ErrorAction SilentlyContinue
$spoofRestored = ((Invoke-Guard) -eq 0)

$ok = $baseOk -and $guardFailed -and $guardOkAgain -and (-not (Test-Path $probe)) -and $spoofFailed -and $spoofRestored -and (-not (Test-Path $probe2))
Write-Host "[neg-proof actor-authority-boundary] baseOk=$baseOk newViolationFailed=$guardFailed restoredOk=$guardOkAgain subjectEqTargetFailed=$spoofFailed spoofRestored=$spoofRestored residue=$([bool](Test-Path $probeDir))"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard detecta (a) violacao client-declared sem binding e (b) subject==target spoof; restauracao limpa.' -ForegroundColor Green
exit 0
