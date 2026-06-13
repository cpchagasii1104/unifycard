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

$ok = $baseOk -and $guardFailed -and $guardOkAgain -and (-not (Test-Path $probe))
Write-Host "[neg-proof actor-authority-boundary] baseOk=$baseOk newViolationFailed=$guardFailed restoredOk=$guardOkAgain residue=$([bool](Test-Path $probeDir))"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK — guard detecta nova violação client-declared sem binding; restauração limpa.' -ForegroundColor Green
exit 0
