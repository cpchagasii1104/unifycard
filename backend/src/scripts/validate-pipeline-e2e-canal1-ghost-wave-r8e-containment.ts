/**
 * E2E — F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE (DECISION-0113 / DECISION-0131 §B7 / Z2).
 * NÃO MOVE DINHEIRO. NÃO toca DB. Prova a CONTENÇÃO fail-closed das 2 superfícies SCHEMA-GHOST contidas na onda:
 * business-segment (business_segments ghost) e tax-profile (tax_profiles ghost). Ambas eram dead-at-db + canal-1.
 *
 *   A POST /business-segment   → 501 BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED
 *   B GET  /business-segment   → 501
 *   C PATCH /business-segment  → 501
 *   D POST /tax-profile        → 501 TAX_PROFILE_SCHEMA_GHOST_CONTAINED
 *   E GET  /tax-profile        → 501
 *   F PATCH /tax-profile       → 501
 *   G guard wave verde · H baseline canal-1 verde
 *
 * 🔒 SEM DB: as rotas contidas não importam pool/service — `fastify.inject` não conecta a banco algum.
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-canal1-ghost-wave-r8e-containment.ts
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function main(): Promise<void> {
  const Fastify = (await import('fastify')).default;
  const { default: businessSegmentRoutes } = await import('../modules/marketplace/business-segment.routes');
  const { default: taxProfileRoutes } = await import('../modules/marketplace/tax-profile.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(businessSegmentRoutes);
  await app.register(taxProfileRoutes);
  await app.ready();

  const contained = (r: { statusCode: number; body: string }, code: string): boolean => {
    if (r.statusCode !== 501) return false;
    try { return JSON.parse(r.body)?.code === code; } catch { return false; }
  };
  const BS = 'BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED';
  const TP = 'TAX_PROFILE_SCHEMA_GHOST_CONTAINED';
  const json = { 'content-type': 'application/json' };

  try {
    console.log('\n— business-segment (schema-ghost) contido (501) —');
    record('A POST /business-segment → 501 ' + BS, contained(await app.inject({ method: 'POST', url: '/business-segment', headers: json, payload: '{}' }), BS));
    record('B GET /business-segment → 501', contained(await app.inject({ method: 'GET', url: '/business-segment' }), BS));
    record('C PATCH /business-segment → 501', contained(await app.inject({ method: 'PATCH', url: '/business-segment', headers: json, payload: '{}' }), BS));

    console.log('\n— tax-profile (schema-ghost) contido (501) —');
    record('D POST /tax-profile → 501 ' + TP, contained(await app.inject({ method: 'POST', url: '/tax-profile', headers: json, payload: '{}' }), TP));
    record('E GET /tax-profile → 501', contained(await app.inject({ method: 'GET', url: '/tax-profile' }), TP));
    record('F PATCH /tax-profile → 501', contained(await app.inject({ method: 'PATCH', url: '/tax-profile', headers: json, payload: '{}' }), TP));

    console.log('\n— Guards —');
    let gWave = 0; try { execSync('node scripts/audit-canal1-ghost-wave-r8e-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gWave = 1; }
    record('G guard wave-r8e-containment verde', gWave === 0);
    let gBaseline = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBaseline = 1; }
    record('H baseline canal-1 verde (business-segment + tax-profile removidos honestamente)', gBaseline === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8E onda: business-segment + tax-profile SCHEMA-GHOST contidas fail-closed (501); zero DB/service; canal-1 eliminado dos arquivos.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
