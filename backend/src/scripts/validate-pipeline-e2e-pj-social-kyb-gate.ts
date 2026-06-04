/**
 * E2E DECISION-0094 Fase Social Gate 1 — gate KYB social (publish_feed / cast_vote).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-social-kyb-gate-ephemeral.ps1.
 *
 * Prova o NÚCLEO de decisão do gate — `isPageActorKybApproved` (helper usado por
 * social-2.0.service[publish_feed] e social-votes.service[cast_vote]):
 *   - page-actor kyb='approved'                          → true  (libera)
 *   - page-actor kyb='pending' + company_status='VERIFIED' → false (company_status NÃO libera)
 *   - page-actor kyb='rejected'/'suspended'              → false (bloqueia)
 *   - page-actor sem fiscal_identity                     → false (fail-closed)
 *   - user/PF                                            → false no helper (mas o GATE guarda por
 *                                                          actor_type='page', então PF NÃO é bloqueado)
 *   - zero Bank.
 *
 * Nível de prova: helper/decisão em DB efêmera. A FIAÇÃO (services chamam o helper só p/ page-actor
 * e bloqueiam quando false) é coberta por typecheck + diff (bloco `if (actor.actor_type==='page')`).
 * Testar o fluxo completo de post/voto exigiria seed de post/poll/ownership/delegação (fora de proporção).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { isPageActorKybApproved } from '../modules/social/pj-kyb-gate';

const TENANT_ID = '88888888-9999-aaaa-bbbb-cccccccccccc';
const PASSWORD = '123456';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function randomCnpj14(): string { let s = ''; for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10); return s; }
function validCpf(): string {
  const n: number[] = []; for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += n[i] * (len + 1 - i); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/social|kyb|gate|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();

  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ social KYB gate Test', slug: 'pj-social-kyb-gate-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const ownerEmail = 'social-kyb-owner@unificard.test';
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [ownerEmail.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, ownerEmail, PASSWORD, validCpf(), 'Social Owner');
  }
  const ownerRow = await pool.query<{ global_user_id: string; user_id: string }>(
    'SELECT global_user_id::text, user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1',
    [ownerEmail.toLowerCase(), TENANT_ID]
  );
  const ownerGlobalUserId = ownerRow.rows[0].global_user_id;
  const userActorId = (await ensureUserActor(TENANT_ID, ownerRow.rows[0].user_id)).actor_id;

  async function makePageActor(kind: 'approved' | 'pending' | 'rejected' | 'suspended' | 'no_fiscal', companyStatus: string): Promise<string> {
    let fid: string | null = null;
    if (kind !== 'no_fiscal') {
      const isApproved = kind === 'approved';
      const f = await pool.query<{ fiscal_identity_id: string }>(
        `INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id, reviewed_by_actor_id, reviewed_at, decision_reason)
         VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6) RETURNING fiscal_identity_id`,
        [randomCnpj14(), kind, userActorId, isApproved ? userActorId : null, isApproved ? new Date().toISOString() : null, isApproved ? 'test' : null]);
      fid = f.rows[0].fiscal_identity_id;
    }
    const c = await pool.query<{ company_id: string }>(
      `INSERT INTO companies (tenant_id, global_user_id, company_name, fiscal_identity_id, status, company_status, is_verified)
       VALUES ($1,$2::uuid,'PJ Social',$3::uuid,'active',$4,false) RETURNING company_id::text`,
      [TENANT_ID, ownerGlobalUserId, fid, companyStatus]);
    const a = await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id)
       VALUES ($1,'page',$2::uuid,'PJ Social',$3::uuid) RETURNING id::text`,
      [TENANT_ID, c.rows[0].company_id, userActorId]);
    return a.rows[0].id;
  }

  const pageApproved = await makePageActor('approved', 'PROVISIONAL');     // approved mas company_status PROVISIONAL
  const pagePendingLie = await makePageActor('pending', 'VERIFIED');       // pending mas company_status='VERIFIED'
  const pageRejected = await makePageActor('rejected', 'PROVISIONAL');
  const pageSuspended = await makePageActor('suspended', 'PROVISIONAL');
  const pageNoFiscal = await makePageActor('no_fiscal', 'VERIFIED');

  const bankBefore = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);

  console.log('\n— isPageActorKybApproved (núcleo do gate publish_feed/cast_vote) —');
  record('1 page kyb=approved → true (libera post/voto)', (await isPageActorKybApproved(TENANT_ID, pageApproved)) === true);
  record('2 page kyb=pending + company_status=VERIFIED → false (company_status NÃO libera)', (await isPageActorKybApproved(TENANT_ID, pagePendingLie)) === false);
  record('3 page kyb=rejected → false (bloqueia)', (await isPageActorKybApproved(TENANT_ID, pageRejected)) === false);
  record('4 page kyb=suspended → false (bloqueia)', (await isPageActorKybApproved(TENANT_ID, pageSuspended)) === false);
  record('5 page sem fiscal_identity → false (fail-closed)', (await isPageActorKybApproved(TENANT_ID, pageNoFiscal)) === false);
  // PF/user: o helper é fail-closed (false), MAS o gate guarda por actor_type='page' → PF NÃO é bloqueado.
  record('6 user/PF → helper=false; gate guarda por actor_type=page → PF inalterado', (await isPageActorKybApproved(TENANT_ID, userActorId)) === false);

  const bankAfter = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('7 zero Bank (ledger/transactions inalterados)', bankBefore === bankAfter, `before=${bankBefore} after=${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✨' : '❌'} ${results.length - failed.length}/${results.length} verdes`);
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
