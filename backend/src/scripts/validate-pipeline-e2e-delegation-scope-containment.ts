/**
 * E2E — SCOPE-CONTAINMENT FIX (DT-AUTHORITY-LATENTS-PASSO-3 ①, ratifica DECISION-0125 §escopo).
 * `canRepresentActor` (vestir o actor) só é concedido por delegação FULL (scopes inclui '*'); uma
 * delegação ESCOPADA NÃO concede representação em branco. Antes, QUALQUER delegação ativa concedia
 * → over-privilege latente em toda rota canRepresentActor-gated. Money-free; MATERIAL. DB efêmera.
 *
 *   A · sem delegação → canRepresentActor(A→B) = false (baseline);
 *   B · delegação ESCOPADA (['post:create']) → canRepresentActor(A→B) = FALSE (contido);
 *   C · delegação FULL (['*']) → canRepresentActor(A→B) = TRUE (representação ampla legítima);
 *   D · ownership (A→A) = TRUE (self, intocado);
 *   E · Δbank = 0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/delegation|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 41).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `deleg-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function setDelegation(tenantId: string, userActorId: string, institutionalActorId: string, scopes: string[]): Promise<void> {
  await pool.query(`DELETE FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND institutional_actor_id=$3`, [tenantId, userActorId, institutionalActorId]);
  await pool.query(
    `INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status, expires_at, created_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::jsonb,'active',NOW() + INTERVAL '1 day',NOW(),NOW())`,
    [tenantId, userActorId, institutionalActorId, JSON.stringify(scopes)]
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const { authorizationService } = await import('../core/authorization/authorization.service');

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Delegation Scope E2E', slug: `deleg-${Date.now()}` });

  const a = await mkUserActor(TENANT, 'Delegado A');   // o representante
  const b = await mkUserActor(TENANT, 'Alvo B');       // o actor "institucional" representado

  const can = (userId: string, actorId: string) => authorizationService.canRepresentActor(TENANT, userId, actorId);

  const bankBefore = await pool.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
  );

  console.log('\n— delegation scope containment END-TO-END —');

  // A · sem delegação → false
  record('A sem delegação: canRepresentActor(A→B) = false', (await can(a.userId, b.actorId)) === false);

  // B · delegação ESCOPADA → contido (false)
  await setDelegation(TENANT, a.actorId, b.actorId, ['post:create']);
  record('B delegação ESCOPADA (post:create): canRepresentActor(A→B) = FALSE (contido)',
    (await can(a.userId, b.actorId)) === false);

  // C · delegação FULL → representação ampla (true)
  await setDelegation(TENANT, a.actorId, b.actorId, ['*']);
  record('C delegação FULL (*): canRepresentActor(A→B) = TRUE',
    (await can(a.userId, b.actorId)) === true);

  // D · ownership self intocado
  record('D ownership self: canRepresentActor(A→A) = TRUE', (await can(a.userId, a.actorId)) === true);

  // E · Δbank = 0
  const bankAfter = await pool.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
  );
  record('E Δbank=0', bankBefore.rows[0].n === bankAfter.rows[0].n, `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
