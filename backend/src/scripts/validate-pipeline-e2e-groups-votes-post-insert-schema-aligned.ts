/**
 * E2E F-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT (correção funcional).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-groups-votes-post-insert-schema-aligned-ephemeral.ps1.
 *
 * Prova que createVote FUNCIONA ponta-a-ponta após alinhar o posts-insert ao schema vivo (antes falhava 42703 em
 * global_user_id/media). E que os gates de quarentena (8ª–10ª fatias) seguem intactos:
 *   • não-bloqueado cria votação → OK: group_votes + group_vote_options + post inline intent='vote' (mesma trx);
 *   • o post nasce actor-keyed (actor_id = autor; sem global_user_id);
 *   • actor bloqueado cria votação → 403 (gate ainda morde; rollback — nada nasce);
 *   • vote() e closeVote() continuam vivos; Δbank=0; zero payment_intents.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { votesService } from '../modules/groups/votes.service';

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
  if (!/groups|votes|schema|drift|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 139).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);

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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Votes Schema Drift', slug: `vsd-${Date.now()}` });
  const oA = await seedActor(TENANT_ID, 'CreatorA');  // cria votação (ativo)
  const oBlk = await seedActor(TENANT_ID, 'CreatorBlocked'); // cria votação (bloqueado)
  const GROUP_ID = (await pool.query<{ id: string }>(`INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1::uuid,'E2E Group',$2::uuid) RETURNING id::text AS id`, [TENANT_ID, oA.actorId])).rows[0].id;

  const createVote = (userId: string) =>
    votesService.createVote(TENANT_ID, GROUP_ID, { title: `Votação ${seq++}`, options: ['A', 'B', 'C'] } as any, userId)
      .then((v) => ({ ok: true, voteId: (v as any).voteId } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const piBefore = await count(`SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`).catch(() => 0);
  const bankBefore = await count(bankSql);

  // ── createVote FUNCIONA ponta-a-ponta (drift corrigido) ──
  const v1 = await createVote(oA.userId);
  record('T1 createVote não-bloqueado → OK (antes falhava 42703)', v1.ok === true && !!v1.voteId, JSON.stringify(v1.err));
  record('T2 group_votes nasceu', (await count(`SELECT count(*)::int AS n FROM group_votes WHERE id=$1`, [v1.voteId])) === 1);
  record('T3 group_vote_options nasceram (3)', (await count(`SELECT count(*)::int AS n FROM group_vote_options WHERE vote_id=$1`, [v1.voteId])) === 3);
  record('T4 post inline intent=vote nasceu', (await count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1 AND actor_id=$2 AND intent='vote'`, [TENANT_ID, oA.actorId])) === 1);
  record('T5 post é actor-keyed (actor_id=autor; intent_metadata aponta o voteId)', (await count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1 AND actor_id=$2 AND intent='vote' AND intent_metadata->>'voteId'=$3`, [TENANT_ID, oA.actorId, v1.voteId])) === 1);

  // ── gate de quarentena de createVote ainda morde (8ª–9ª fatia não regrediu) ──
  await block(TENANT_ID, oBlk.actorId);
  const votesBlkBefore = await count(`SELECT count(*)::int AS n FROM group_votes WHERE tenant_id=$1 AND created_by_actor_id=$2`, [TENANT_ID, oBlk.actorId]);
  record('T6 createVote bloqueado → 403 (gate intacto)', isBlocked403((await createVote(oBlk.userId)).err));
  record('T7 bloqueado → nenhuma group_votes (rollback/gate antes da escrita)', (await count(`SELECT count(*)::int AS n FROM group_votes WHERE tenant_id=$1 AND created_by_actor_id=$2`, [TENANT_ID, oBlk.actorId])) === votesBlkBefore);

  // ── vote() e closeVote() seguem vivos sobre a votação criada ──
  const optId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM group_vote_options WHERE vote_id=$1 ORDER BY display_order LIMIT 1`, [v1.voteId])).rows[0]?.id;
  record('T8 vote() ativo registra voto na votação criada → OK', optId ? await votesService.vote(TENANT_ID, GROUP_ID, v1.voteId, optId, oA.userId).then(() => true).catch(() => false) : false);
  record('T9 closeVote() ativo fecha a votação criada → OK', await votesService.closeVote(TENANT_ID, GROUP_ID, v1.voteId, oA.userId).then(() => true).catch(() => false));

  // ── MONEY-FREE ──
  record('T10 zero payment_intents', (await count(`SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`).catch(() => 0)) === piBefore);
  record('T11 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ createVote funciona ponta-a-ponta (group_votes+opções+post intent=vote, actor-keyed); gates de quarentena intactos; vote/closeVote vivos; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
