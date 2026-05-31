/**
 * Integração C1 — professionalC1Service (DESENHO_A2 / DECISION-0063).
 * Exercita o service direto contra o DEV (sem HTTP), provando T1–T13 do desenho
 * que são verificáveis em nível de service/repository. Teardown físico no fim (DEV intacto).
 *
 * Modo: npx tsx backend/src/scripts/validate-professional-c1-service.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function statusOf(e: unknown): number | undefined {
  return (e as { statusCode?: number }).statusCode;
}

async function main(): Promise<void> {
  // Fixtures vivos
  const actor = await pool.query<{ actor_id: string }>(
    `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`,
    [TENANT]
  );
  if (actor.rowCount === 0) { console.error('sem actor user em DEV'); process.exit(1); }
  const actorId = actor.rows[0].actor_id;

  const concept = await pool.query<{ concept_id: string }>(
    `SELECT co.concept_id::text FROM concepts co
       JOIN categories c ON c.concept_id=co.concept_id
      WHERE c.scope='professional' AND c.level=2 LIMIT 1`
  );
  if (concept.rowCount === 0) { console.error('sem concept professional L2'); process.exit(1); }
  const conceptId = concept.rows[0].concept_id;

  try {
    // T1 — invariante id=actor_id no actor de teste
    const inv = await pool.query<{ ok: boolean }>(
      `SELECT (id=actor_id) AS ok FROM actors WHERE tenant_id=$1 AND actor_id=$2`, [TENANT, actorId]);
    record('T1 actor sob teste tem id=actor_id', inv.rows[0]?.ok === true);

    // T3 (parte) — contagem antes
    const cntBefore = await pool.query<{ a: string; p: string }>(
      `SELECT (SELECT count(*) FROM actors)::text AS a,
              (SELECT count(*) FROM actor_professional_profiles)::text AS p`);

    // T2 — GET de actor existente sem declaração → vazio
    const empty = await professionalC1Service.getProfessionalC1(TENANT, actorId);
    record('T2 GET sem declaração → {concepts:[], professional_bio:null}',
      Array.isArray(empty.concepts) && empty.concepts.length === 0 && empty.professional_bio === null);

    // T3 — GET não criou actor nem profile
    const cntAfter = await pool.query<{ a: string; p: string }>(
      `SELECT (SELECT count(*) FROM actors)::text AS a,
              (SELECT count(*) FROM actor_professional_profiles)::text AS p`);
    record('T3 GET não cria actor nem profile (count antes=depois)',
      cntBefore.rows[0].a === cntAfter.rows[0].a && cntBefore.rows[0].p === cntAfter.rows[0].p);

    // T4 — POST válido → DTO; concept_id ausente → 400
    const dto = await professionalC1Service.declareConcept(TENANT, actorId, { conceptId, skillLevel: 3 });
    record('T4a declareConcept válido → DTO (conceptId, skillLevel)',
      dto.conceptId === conceptId && dto.skillLevel === 3 && dto.isActive === true);
    try {
      await professionalC1Service.declareConcept(TENANT, actorId, { conceptId: '', skillLevel: 3 });
      record('T4b concept_id ausente → 400', false, 'não lançou');
    } catch (e) { record('T4b concept_id ausente → 400', statusOf(e) === 400, `status=${statusOf(e)}`); }

    // T5 — POST duplicado → 409 (não 500)
    try {
      await professionalC1Service.declareConcept(TENANT, actorId, { conceptId, skillLevel: 4 });
      record('T5 declareConcept duplicado → 409', false, 'não lançou');
    } catch (e) { record('T5 declareConcept duplicado → 409 (não 500)', statusOf(e) === 409, `status=${statusOf(e)}`); }

    // T6 — PATCH skill fora de 1..5 → 400; dentro → 200
    try {
      await professionalC1Service.updateConcept(TENANT, actorId, conceptId, { skillLevel: 9 });
      record('T6a PATCH skill=9 → 400', false, 'não lançou');
    } catch (e) { record('T6a PATCH skill_level fora de 1..5 → 400', statusOf(e) === 400, `status=${statusOf(e)}`); }
    const patched = await professionalC1Service.updateConcept(TENANT, actorId, conceptId, { skillLevel: 5 });
    record('T6b PATCH skill=5 → DTO skillLevel=5', patched.skillLevel === 5);

    // T13 — POST com concept_id inexistente → 400/404 limpo (não 500)
    try {
      await professionalC1Service.declareConcept(TENANT, actorId,
        { conceptId: '00000000-0000-0000-0000-000000000000', skillLevel: 2 });
      record('T13 concept_id inexistente → 400/404', false, 'não lançou');
    } catch (e) {
      const s = statusOf(e);
      record('T13 concept_id inexistente → 400/404 (não 500)', s === 400 || s === 404, `status=${s}`);
    }

    // T11 — actorId inexistente → 404
    try {
      await professionalC1Service.getProfessionalC1(TENANT, '11111111-1111-1111-1111-111111111111');
      record('T11 actor inexistente → 404', false, 'não lançou');
    } catch (e) { record('T11 actorId inexistente → 404 (não 200-vazio, não 500)', statusOf(e) === 404, `status=${statusOf(e)}`); }

    // T7 — DELETE = desativação lógica; linha PERMANECE
    const retired = await professionalC1Service.retireConcept(TENANT, actorId, conceptId);
    record('T7a retireConcept → isActive=false + retiredAt!=null',
      retired.isActive === false && retired.retiredAt !== null);
    const stillThere = await runQueryWithTenant<{ n: string }>(
      TENANT, `SELECT count(*)::text AS n FROM actor_professional_concepts
               WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, actorId, conceptId]);
    record('T7b linha permanece após retire (zero delete físico)', stillThere?.n === '1');

  } finally {
    // Teardown físico (teardown de teste, NÃO o service): DEV intacto.
    await pool.query(`DELETE FROM actor_professional_concepts WHERE tenant_id=$1 AND actor_id=$2`, [TENANT, actorId]);
    await pool.query(`DELETE FROM actor_professional_profiles WHERE tenant_id=$1 AND actor_id=$2`, [TENANT, actorId]);
    const left = await pool.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM actor_professional_concepts WHERE actor_id=$1)::text AS n`, [actorId]);
    console.log(`\n— cleanup — competências restantes do actor de teste: ${left.rows[0].n}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(56)}\nRESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ C1 service — todos os cenários verdes.');
}

main().catch(async (e) => { console.error('💥', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
