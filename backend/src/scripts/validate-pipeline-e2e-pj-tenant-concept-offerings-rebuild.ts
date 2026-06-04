/**
 * E2E F-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD-SCRIPT — reconciliação idempotente do read-model.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-tenant-concept-offerings-rebuild-ephemeral.ps1.
 *
 * Prova rebuildTenantConceptOfferings: dry-run detecta sem alterar; apply reconcilia (cria/reativa/
 * desativa) derivando SÓ de company_concept_publications.status='active'; idempotente; nunca deleta;
 * nunca cria inactive nova; NÃO filtra KYB; não toca Bank/marketplace/hybrid.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rebuildTenantConceptOfferings } from './rebuild-tenant-concept-offerings';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/offerings|rebuild|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ TCO Rebuild Test', slug: `pj-tco-rebuild-${Date.now()}` });

  // Owner (chain identity p/ chk_actor_requires_identity) + user-actor (responsible/created_by).
  const gid = randomUUID();
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'TCO Owner','{}'::jsonb)`, [gid, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gid, cpf]);
  const ownerActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, global_user_id, display_name) VALUES ($1,'user',$2,'TCO owner actor') RETURNING id::text AS id`, [TENANT_ID, gid])).rows[0].id;

  // Empresa com KYB PENDING de propósito (prova que rebuild segue ccp, NÃO filtra KYB).
  const fiscalId = (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,'pending') RETURNING fiscal_identity_id::text AS f`, [String(Date.now()).padStart(14, '0').slice(-14)])).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(`INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1,'TCO Co',$2) RETURNING company_id::text AS c`, [TENANT_ID, fiscalId])).rows[0].c;
  const pageActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'TCO page',$3) RETURNING id::text AS id`, [TENANT_ID, companyId, ownerActorId])).rows[0].id;

  // 5 concepts distintos (migration-seeded).
  const concepts = (await pool.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts LIMIT 5`)).rows.map((r) => r.c);
  if (concepts.length < 5) throw new Error('precisa de ≥5 concepts seedados');
  const [cA, cB, cC, cD, cE] = concepts;

  // ccp active (INSERT direto): A, B, D. (UNIQUE é por company×concept active → concepts distintos OK.)
  for (const cc of [cA, cB, cD]) {
    await pool.query(
      `INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, status, created_by_actor_id)
       VALUES ($1,$2,$3,$4,'active',$5)`,
      [TENANT_ID, companyId, pageActorId, cc, ownerActorId]
    );
  }
  // tco seed: B inactive, C active(legado sem ccp), D active, E inactive(sem ccp). A ausente.
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,false)`, [TENANT_ID, cB]);
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,true)`, [TENANT_ID, cC]);
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,true)`, [TENANT_ID, cD]);
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,false)`, [TENANT_ID, cE]);

  const tcoState = async (cc: string) => {
    const r = await pool.query<{ a: string | null }>(`SELECT is_active::text AS a FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, cc]);
    return r.rowCount === 0 ? 'absent' : r.rows[0].a; // 'true' | 'false' | 'absent'
  };
  const totalRows = async () => Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings WHERE tenant_id=$1`, [TENANT_ID])).rows[0].n);
  const bankBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n);
  const rowsBefore = await totalRows();

  try {
    // ── T1 — dry-run detecta divergências e NÃO altera ───────────────────────
    const dry = await rebuildTenantConceptOfferings({ apply: false });
    record('T1 dry-run conta: 1 a criar / 1 a reativar / 1 a desativar / 1 já-ativa / 1 inactive-mantida',
      dry.applied === false && dry.toCreate === 1 && dry.toReactivate === 1 && dry.toDeactivate === 1 && dry.alreadyActive === 1 && dry.inactiveStays === 1,
      JSON.stringify(dry));
    record('T1 dry-run NÃO alterou nada (estados intactos)',
      (await tcoState(cA)) === 'absent' && (await tcoState(cB)) === 'false' && (await tcoState(cC)) === 'true' && (await tcoState(cD)) === 'true' && (await tcoState(cE)) === 'false' && (await totalRows()) === rowsBefore);

    // ── T2 — apply reconcilia ────────────────────────────────────────────────
    const ap = await rebuildTenantConceptOfferings({ apply: true });
    record('T2 apply: created=1 reactivated=1 deactivated=1', ap.applied === true && ap.created === 1 && ap.reactivated === 1 && ap.deactivated === 1, JSON.stringify(ap));
    record('T2 estado pós-apply: A active(criada), B active(reativada), C inactive(desativada), D active, E inactive',
      (await tcoState(cA)) === 'true' && (await tcoState(cB)) === 'true' && (await tcoState(cC)) === 'false' && (await tcoState(cD)) === 'true' && (await tcoState(cE)) === 'false',
      `A=${await tcoState(cA)} B=${await tcoState(cB)} C=${await tcoState(cC)} D=${await tcoState(cD)} E=${await tcoState(cE)}`);

    // ── T3 — nunca deleta (rows = 4 seed + 1 criada A = 5) ───────────────────
    record('T3 nunca deleta (total rows = 5: 4 seed + A criada)', (await totalRows()) === rowsBefore + 1, `before=${rowsBefore} after=${await totalRows()}`);

    // ── T4 — nunca cria inactive nova (a única criação foi A active) ─────────
    //   inactive após apply = C + E = 2; nenhuma inactive NOVA foi inserida (só A active inserida).
    const inactiveN = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings WHERE tenant_id=$1 AND NOT is_active`, [TENANT_ID])).rows[0].n);
    record('T4 não cria inactive nova (inactive=2: C,E)', inactiveN === 2, `inactive=${inactiveN}`);

    // ── T5 — KYB não filtrado: A foi ativada apesar do KYB pending da empresa ──
    record('T5 NÃO filtra KYB (A active mesmo com empresa KYB pending)', (await tcoState(cA)) === 'true');

    // ── T6 — idempotência: 2ª apply muda 0 ───────────────────────────────────
    const ap2 = await rebuildTenantConceptOfferings({ apply: true });
    record('T6 idempotente: 2ª apply created=0 reactivated=0 deactivated=0', ap2.created === 0 && ap2.reactivated === 0 && ap2.deactivated === 0, JSON.stringify(ap2));
    record('T6 estados estáveis após 2ª apply', (await tcoState(cA)) === 'true' && (await tcoState(cC)) === 'false' && (await totalRows()) === rowsBefore + 1);

    // ── T7 — Bank intocado ───────────────────────────────────────────────────
    record('T7 Bank intocado (bank_transactions inalterado)', Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n) === bankBefore);

    // ── T8 — marketplace/hybrid intocado (actors só user/page) ───────────────
    const actorTypes = await pool.query<{ t: string }>(`SELECT DISTINCT actor_type AS t FROM actors`);
    record('T8 actors só user/page (marketplace/hybrid intocado)', actorTypes.rows.every((r) => r.t === 'user' || r.t === 'page'), JSON.stringify(actorTypes.rows.map((r) => r.t)));
  } finally {
    /* sem app; pool fechado no fim */
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Rebuild de tenant_concept_offerings verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
