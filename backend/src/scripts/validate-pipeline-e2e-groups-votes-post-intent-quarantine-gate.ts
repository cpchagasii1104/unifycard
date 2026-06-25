/**
 * E2E F-GROUPS-VOTES-POST-INTENT-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-groups-votes-post-intent-quarantine-gate-ephemeral.ps1.
 *
 * Fecha a porta lateral: votação de grupo cria estado (group_votes/group_vote_options) E post inline intent='vote'
 * FORA do gate canônico de social 2.0. Prova:
 *   • não-bloqueado cria votação → OK (group_votes + opções + post intent='vote');
 *   • actor bloqueado cria votação → 403 ACTOR_EFFECTIVELY_BLOCKED (nenhuma linha parcial; gate ANTES da transação);
 *   • actor bloqueado registra voto → 403;
 *   • actor ativo vota → OK (comportamento vivo preservado);
 *   • canRepresentActor puro; zero payment_intents/bank_*; schedules vazio; Δbank=0.
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
  if (!/groups|votes|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 131).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id, globalUserId: gu };
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Groups Votes Quarantine', slug: `gvq-${Date.now()}` });
  const oA = await seedActor(TENANT_ID, 'CreatorA');  // cria votação — será bloqueado
  const oB = await seedActor(TENANT_ID, 'VoterB');    // vota — será bloqueado
  const oC = await seedActor(TENANT_ID, 'VoterC');    // vota — permanece ativo

  const GROUP_ID = (await pool.query<{ id: string }>(`INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1::uuid,'E2E Group',$2::uuid) RETURNING id::text AS id`, [TENANT_ID, oA.actorId])).rows[0].id;

  const createVote = (a: { userId: string }) =>
    votesService.createVote(TENANT_ID, GROUP_ID, { title: `Votação ${seq++}`, options: ['Opção A', 'Opção B'] } as any, a.userId)
      .then((v) => ({ ok: true, voteId: (v as any).voteId } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const castVote = (voteId: string, optionId: string, userId: string) =>
    votesService.vote(TENANT_ID, GROUP_ID, voteId, optionId, userId).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const votesOf = (actorId: string) => count(`SELECT count(*)::int AS n FROM group_votes WHERE tenant_id=$1 AND created_by_actor_id=$2`, [TENANT_ID, actorId]);
  const optionsCount = () => count(`SELECT count(*)::int AS n FROM group_vote_options gvo JOIN group_votes gv ON gv.id=gvo.vote_id WHERE gv.tenant_id=$1 AND gv.created_by_actor_id=$2`, [TENANT_ID, oA.actorId]);
  const votePostsOf = (actorId: string) => count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1 AND actor_id=$2 AND intent='vote'`, [TENANT_ID, actorId]);

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const piSql = `SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`;
  const bankBefore = await count(bankSql);
  const piBefore = await count(piSql).catch(() => 0);

  // ── T1: createVote NÃO-BLOQUEADO cria votação ponta-a-ponta ──
  // (schema-drift do posts-insert corrigido em F-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT → createVote SUCEDE:
  //  group_votes + group_vote_options + post inline intent='vote', tudo na mesma transação.)
  const v1 = await createVote(oA);
  record('T1 não-bloqueado cria votação → OK (group_votes + opções + post intent=vote)', v1.ok === true && !!v1.voteId, JSON.stringify(v1.err));
  record('T1b post intent=vote nasceu p/ a votação (schema-drift corrigido)', (await votePostsOf(oA.actorId)) === 1);

  const votesBefore = await votesOf(oA.actorId);
  const optionsBefore = await optionsCount();
  const postsBefore = await votePostsOf(oA.actorId);
  await block(TENANT_ID, oA.actorId);
  await block(TENANT_ID, oB.actorId);

  // ── QUARENTENA: createVote (gate ANTES da transação) ──
  record('T2 bloqueado cria votação → 403 ACTOR_EFFECTIVELY_BLOCKED', isBlocked403((await createVote(oA)).err));
  record('T3 bloqueado → nenhuma linha nova em group_votes', (await votesOf(oA.actorId)) === votesBefore, `before=${votesBefore}`);
  record('T4 bloqueado → nenhuma linha nova em group_vote_options', (await optionsCount()) === optionsBefore, `before=${optionsBefore}`);
  record('T5 bloqueado → nenhum post intent=vote novo', (await votePostsOf(oA.actorId)) === postsBefore, `before=${postsBefore}`);

  // ── QUARENTENA: vote() — votação semeada DIRETO (createVote está quebrado pelo drift pré-existente) ──
  const seededVoteId = (await pool.query<{ id: string }>(`INSERT INTO group_votes (tenant_id, group_id, created_by_actor_id, title, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'Seed Vote','open') RETURNING id::text AS id`, [TENANT_ID, GROUP_ID, oC.actorId])).rows[0].id;
  const seededOptId = (await pool.query<{ id: string }>(`INSERT INTO group_vote_options (tenant_id, vote_id, label) VALUES ($1::uuid,$2::uuid,'Opção A') RETURNING id::text AS id`, [TENANT_ID, seededVoteId])).rows[0].id;
  record('T6 actor bloqueado registra voto → 403 (gate antes de createVoteResponse)', isBlocked403((await castVote(seededVoteId, seededOptId, oB.userId)).err));
  record('T7 actor ativo vota → OK (comportamento vivo preservado)', (await castVote(seededVoteId, seededOptId, oC.userId)).ok === true);
  record('T7b bloqueado não deixou response; ativo deixou 1', (await count(`SELECT count(*)::int AS n FROM group_vote_responses WHERE tenant_id=$1 AND vote_id=$2`, [TENANT_ID, seededVoteId])) === 1);

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T8 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oA.userId, oA.actorId)) === true);
  record('T9 zero payment_intents (votação não executa dinheiro)', (await count(piSql).catch(() => 0)) === piBefore, `before=${piBefore}`);
  record('T10 Δbank=0 (nenhum bank_* tocado)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T11 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ actor bloqueado não cria votação/post intent=vote nem vota (gate antes da transação); atomicidade preservada; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
