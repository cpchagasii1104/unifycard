# negative-proof-actor-authority-boundary.ps1
# Prova que o guard audit-actor-authority-boundary:
#   (1) detecta NOVA violação client-declared sem binding (6º canal);
#   (2) detecta subject==target spoof (hard-fail não-baselineável);
#   (3) [FATIA A] o recognizer safeSubjectProof ACEITA subject server-side (req.user) e REJEITA
#       subject vindo de actionContext/params/query e subject==target;
#   (4) [FATIA A] o guard reconhece exatamente os readers safe-subject (safe_subject_recognized) e new=0.
# Tudo com restauração limpa (zero resíduo).
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

# Fase 3 (FATIA A): asserções UNITÁRIAS do recognizer safeSubjectProof — subject server-side ACEITO,
# subject de actionContext/params/query e subject==target REJEITADOS.
$asrt = Join-Path (Get-Location) 'scripts\__neg_safe_subject_assert__.mjs'
$asrtContent = @'
import { safeSubjectProof } from './audit-actor-authority-boundary.mjs';
const C = [
  ['serverside.id',            'const userId = req.user?.id;\n await s.requirePermission(tenantId, userId, actorId, "k");', true],
  ['serverside.userId.coalesce','const userId = req.user?.userId ?? req.user?.id;\n await s.requirePermission(tenantId, userId, actorId, "k");', true],
  ['formA.preHandler',         "fastify.requirePermission(['admin:view_audit_logs'])", true],
  ['reject.actionContext',     'const a = req.actionContext.actorId;\n await s.requirePermission(tenantId, a, target, "k");', false],
  ['reject.params',            'const a = req.params.actorId;\n await s.requirePermission(tenantId, a, target, "k");', false],
  ['reject.query',             'const a = req.query.actorId;\n await s.requirePermission(tenantId, a, target, "k");', false],
  ['reject.subjectEqTarget',   'const userId = req.user?.id;\n await s.requirePermission(tenantId, actorId, actorId, "k");', false],
  ['reject.serverSubjectEqTarget','const userId = req.user?.id;\n await s.requirePermission(tenantId, userId, userId, "k");', false],
  ['formC.companyScoped',      'const userId = req.user?.id;\n const c = await companiesService.resolveCompanyIdForActor(tenantId, req.params.actorId);\n await companiesService.canUserPerformCompanyCapability(tenantId, userId, "can_view_reports", { companyId: c });', true],
  ['formC.coalesce',           'const userId = req.user?.userId ?? req.user?.id;\n const c = await companiesService.resolveCompanyIdForActor(tenantId, req.params.actorId);\n await companiesService.canUserPerformCompanyCapability(tenantId, userId, "can_view_risk", { companyId: c });', true],
  ['reject.formC.noCompanyScope','const userId = req.user?.id;\n await companiesService.canUserPerformCompanyCapability(tenantId, userId, "can_view_risk");', false],
  ['reject.formC.params',      'const a = req.params.actorId;\n const c = await companiesService.resolveCompanyIdForActor(tenantId, a);\n await companiesService.canUserPerformCompanyCapability(tenantId, a, "can_manage_policy", { companyId: c });', false],
  ['reject.formC.actionContext','const a = req.actionContext.actorId;\n const c = await companiesService.resolveCompanyIdForActor(tenantId, a);\n await companiesService.canUserPerformCompanyCapability(tenantId, a, "can_view_audit_logs", { companyId: c });', false],
  ['formD.tenantCapability',   'const userId = req.user?.id;\n await companiesService.canUserPerformTenantCapability(tenantId, userId, "can_view_tenant_reports");', true],
  ['formD.coalesce',           'const userId = req.user?.userId ?? req.user?.id;\n await companiesService.canUserPerformTenantCapability(tenantId, userId, "can_view_tenant_risk");', true],
  ['reject.formD.params',      'const a = req.params.actorId;\n await companiesService.canUserPerformTenantCapability(tenantId, a, "can_manage_tenant_policy");', false],
  ['reject.formD.actionContext','const a = req.actionContext.actorId;\n await companiesService.canUserPerformTenantCapability(tenantId, a, "can_view_tenant_audit_logs");', false],
];
let ok = true;
for (const [name, code, expect] of C) {
  const got = !!safeSubjectProof(code);
  const pass = got === expect;
  if (!pass) ok = false;
  console.log(`  ${pass ? 'OK' : 'FAIL'} ${name} expected=${expect} got=${got}`);
}
process.exit(ok ? 0 : 1);
'@
Set-Content -Path $asrt -Value $asrtContent -Encoding UTF8
node $asrt
$recognizerOk = ($LASTEXITCODE -eq 0)
Remove-Item $asrt -Force -ErrorAction SilentlyContinue

# Fase 4 (FATIA A + R2): prova POSITIVA — guard reconhece readers safe-subject e new=0.
$guardOut = (node scripts/audit-actor-authority-boundary.mjs 2>&1 | Out-String)
$recognizedFour = ($guardOut -match 'safe_subject_recognized=4')
$newZero = ($guardOut -match '\bnew=0\b')

$ok = $baseOk -and $guardFailed -and $guardOkAgain -and (-not (Test-Path $probe)) `
  -and $spoofFailed -and $spoofRestored -and (-not (Test-Path $probe2)) `
  -and $recognizerOk -and $recognizedFour -and $newZero
Write-Host "[neg-proof actor-authority-boundary] baseOk=$baseOk newViolationFailed=$guardFailed restoredOk=$guardOkAgain subjectEqTargetFailed=$spoofFailed spoofRestored=$spoofRestored recognizerUnitOk=$recognizerOk recognized4=$recognizedFour new0=$newZero residue=$([bool](Test-Path $probeDir))"
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard detecta (a) violacao client-declared sem binding, (b) subject==target spoof, (c) recognizer aceita req.user (Formas A/B/C company-scoped) e rejeita actionContext/params/query/subject==target/Forma-C-sem-company-scope, (d) reconhece os 3 readers actor-scoped; restauracao limpa.' -ForegroundColor Green
exit 0
