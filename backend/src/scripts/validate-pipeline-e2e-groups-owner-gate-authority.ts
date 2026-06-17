/**
 * E2E — F-AUTHORITY-Z2-R1-GROUPS-HANDROLLED-BYPASS-CONTAINMENT (DECISION-0113 / Z2).
 *
 * Prova que o owner-bypass de groups NÃO depende mais de `group.ownerActorId === actionContext.actorId`
 * (actorId declarado = authority, spoofável), e sim de `canRepresentActor(usuário autenticado, ownerActor)`.
 *
 * (A) ESTRUTURAL (data-flow do gate `requireGroupOwnerOrPermission`):
 *     A1 ownership = canRepresentActor(tenantId, userIdForCheck, group.ownerActorId).
 *     A2 userIdForCheck = req.user.userId (autenticado), não actor.user_id do actor declarado.
 *     A3 NÃO existe `ownerActorId === actionContext.actorId` (bypass removido).
 * (B) RUNTIME (a decisão EXATA que o gate faz quando ownerActorId = A.actor):
 *     B1 canRepresentActor(A.userId, A.actor) === true  (dono real / representação válida → autorizado).
 *     B2 canRepresentActor(C.userId, A.actor) === false (terceiro declarando o actor de A → NEGADO/403).
 *     B3 canRepresentActor sem representação não passa só por "declarar" o actorId.
 *
 * 🔒 DB EFÊMERA (run-groups-owner-gate-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';
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
  if (!/group|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── (A) Estrutural — data-flow do gate ────────────────────────────────────────────────────
  const src = readFileSync(join(process.cwd(), 'src/modules/groups/groups.routes.ts'), 'utf8');
  record('A1 ownership = canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)',
    /canRepresentActor\s*\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(src));
  record('A2 userIdForCheck = req.user.userId (autenticado), não actor.user_id do declarado',
    /const\s+userIdForCheck\s*=\s*req\.user\.userId/.test(src) && !/userIdForCheck\s*=\s*actor\.user_id/.test(src));
  record('A3 bypass removido: nenhum `ownerActorId === actionContext.actorId`',
    !/ownerActorId\s*===\s*(req\.)?actionContext\.actorId/.test(src));

  // ── (B) Runtime — a decisão exata do gate ─────────────────────────────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Groups Gate E2E', $1) RETURNING id::text AS id`, [`groups-gate-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const A = await mkUserActor(tenantId, 'alice');
  const C = await mkUserActor(tenantId, 'carol');

  // ownerActorId do grupo = A.actor. O gate computa isOwner = canRepresentActor(authUser, ownerActor).
  const aReprA = await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId);
  const cReprA = await authorizationService.canRepresentActor(tenantId, C.userId, A.actorId);
  record('B1 dono real: canRepresentActor(A.userId, A.actor) === true (representação válida → autorizado)', aReprA === true, `got=${aReprA}`);
  record('B2 spoof: canRepresentActor(C.userId, A.actor) === false (declarar o actor de A NÃO autoriza C → 403)', cReprA === false, `got=${cReprA}`);
  record('B3 actionContext.actorId sozinho não autoriza (só representação server-side resolve)', aReprA === true && cReprA === false);

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ Owner-bypass de groups bind ao USUÁRIO AUTENTICADO (canRepresentActor); actionContext.actorId declarado não é mais authority.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
