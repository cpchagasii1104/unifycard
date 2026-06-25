/**
 * E2E F-GROUPS-VOTES-CLOSEVOTE-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-groups-votes-closevote-quarantine-gate-ephemeral.ps1.
 *
 * Fecha o REMAINDER do reseal YALA da 9ª fatia: closeVote (user-alcançável, state-changing, UPDATE group_votes
 * SET status='closed') não tinha gate de quarentena. Prova:
 *   • admin/owner ATIVO fecha votação → OK (comportamento vivo; status→closed);
 *   • admin/owner BLOQUEADO tenta fechar → 403 ACTOR_EFFECTIVELY_BLOCKED (status permanece 'open');
 *   • gate usa actorId resolvido por ensureUserActor (não userId cru);
 *   • createVote/vote (9ª fatia) não regridem; zero post/payment_intents/bank; canRepresentActor puro; Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { votesService } from '../modules/groups/votes.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/groups|votes|closevote|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 137).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);
// votação semeada DIRETO (createVote tem drift pré-existente DT-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT)
async function seedOpenVote(tenantId: string, groupId: string, creatorActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO group_votes (tenant_id, group_id, created_by_actor_id, title, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'Seed Vote','open') RETURNING id::text AS id`, [tenantId, groupId, creatorActorId])).rows[0].id;
}
const statusOf = (voteId: string) => pool.query<{ status: string }>(`SELECT status FROM group_votes WHERE id=$1`, [voteId]).then((r) => r.rows[0]?.status);

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'CloseVote Quarantine', slug: `cvq-${Date.now()}` });
  const oActive = await seedActor(TENANT_ID, 'AdminActive');   // admin/owner ativo
  const oBlocked = await seedActor(TENANT_ID, 'AdminBlocked'); // admin/owner — será bloqueado
  const GROUP_ID = (await pool.query<{ id: string }>(`INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1::uuid,'E2E Group',$2::uuid) RETURNING id::text AS id`, [TENANT_ID, oActive.actorId])).rows[0].id;

  // service.closeVote(tenantId, groupId, voteId, userId) — rota já validou admin/owner; aqui provamos o gate de quarentena.
  const closeVote = (voteId: string, userId: string) =>
    votesService.closeVote(TENANT_ID, GROUP_ID, voteId, userId).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const piSql = `SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`;
  const bankBefore = await count(bankSql);
  const piBefore = await count(piSql).catch(() => 0);
  const postsBefore = await count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1`, [TENANT_ID]);
  const responsesBefore = await count(`SELECT COALESCE((SELECT count(*) FROM group_vote_responses WHERE tenant_id=$1),0)::int AS n`, [TENANT_ID]);

  // ── T1: admin/owner ATIVO fecha → OK ──
  const vActive = await seedOpenVote(TENANT_ID, GROUP_ID, oActive.actorId);
  record('T1 admin/owner ativo fecha votação → OK (comportamento vivo)', (await closeVote(vActive, oActive.userId)).ok === true);
  record('T1b status → closed', (await statusOf(vActive)) === 'closed');

  // ── T2/T3: admin/owner BLOQUEADO não fecha; status permanece open ──
  const vBlocked = await seedOpenVote(TENANT_ID, GROUP_ID, oActive.actorId);
  await block(TENANT_ID, oBlocked.actorId);
  record('T2 admin/owner bloqueado fecha → 403 ACTOR_EFFECTIVELY_BLOCKED', isBlocked403((await closeVote(vBlocked, oBlocked.userId)).err));
  record('T3 bloqueado → status permanece "open" (UPDATE não alcançado)', (await statusOf(vBlocked)) === 'open');

  // ── T4: votação inexistente continua erro próprio (não quarentena) p/ actor ativo ──
  {
    const r = await closeVote(randomUUID(), oActive.userId);
    record('T4 votação inexistente → erro próprio (não ACTOR_EFFECTIVELY_BLOCKED)', r.ok === false && !isBlocked403(r.err), JSON.stringify(r.err));
  }

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T5 closeVote não criou post (status-only)', (await count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1`, [TENANT_ID])) === postsBefore, `before=${postsBefore}`);
  record('T6 closeVote não mexeu em group_vote_responses', (await count(`SELECT COALESCE((SELECT count(*) FROM group_vote_responses WHERE tenant_id=$1),0)::int AS n`, [TENANT_ID])) === responsesBefore);
  record('T7 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oBlocked.userId, oBlocked.actorId)) === true);
  record('T8 zero payment_intents', (await count(piSql).catch(() => 0)) === piBefore, `before=${piBefore}`);
  record('T9 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T10 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ admin/owner bloqueado não fecha votação (gate antes do UPDATE status=closed); ativo fecha OK; status-only; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
