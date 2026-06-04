/**
 * E2E DECISION-0092 Fase 3.0 — capability social e CNPJ-lock derivam de kyb_status.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-capability-kyb-ephemeral.ps1.
 *
 * Prova o caminho REAL:
 *   reputationService.getPermissions:
 *     - page-actor kyb='approved' → canPost true (capability liberada);
 *     - page-actor kyb='pending' + company_status='VERIFIED' → canPost false (company_status NÃO libera);
 *     - page-actor sem fiscal → canPost false (fail-closed);
 *     - user/PF → canPost true (inalterado).
 *   companiesService.updateCompany (CNPJ-lock):
 *     - company kyb='approved' → bloqueia edição de CNPJ (KYB approved);
 *     - company kyb='pending' → NÃO bloqueia por company_status.
 *   zero Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { reputationService } from '../modules/social/reputation.service';
import { companiesService } from '../core/companies/companies.service';

const TENANT_ID = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
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
// CNPJ com DV válido (updateCompany valida formato após o CNPJ-lock).
function validCnpj(seed: number): string {
  const base = String(seed).padStart(12, '0').slice(-12);
  const dv = (nums: string, w: number[]) => { let s = 0; for (let i = 0; i < w.length; i++) s += parseInt(nums[i]!, 10) * w[i]!; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + String(d1) + String(d2);
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/capability|kyb|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ capability KYB Test', slug: 'pj-capability-kyb-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const ownerEmail = 'capability-owner@unificard.test';
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [ownerEmail.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, ownerEmail, PASSWORD, validCpf(), 'Cap Owner');
  }
  const ownerRow = await pool.query<{ global_user_id: string; user_id: string }>(
    'SELECT global_user_id::text, user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1',
    [ownerEmail.toLowerCase(), TENANT_ID]
  );
  const ownerGlobalUserId = ownerRow.rows[0].global_user_id;
  const userActorId = (await ensureUserActor(TENANT_ID, ownerRow.rows[0].user_id)).actor_id;

  // Fabrica fiscal + company (owner) + page-actor com kyb_status desejado.
  async function makePj(kind: 'approved' | 'pending' | 'no_fiscal', companyStatus: string): Promise<{ companyId: string; pageActorId: string }> {
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
       VALUES ($1,$2::uuid,'PJ Cap',$3::uuid,'active',$4,false) RETURNING company_id::text`,
      [TENANT_ID, ownerGlobalUserId, fid, companyStatus]);
    const companyId = c.rows[0].company_id;
    const a = await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id)
       VALUES ($1,'page',$2::uuid,'PJ Cap',$3::uuid) RETURNING id::text`,
      [TENANT_ID, companyId, userActorId]);
    return { companyId, pageActorId: a.rows[0].id };
  }

  const pjApproved = await makePj('approved', 'PROVISIONAL');         // approved mas company_status PROVISIONAL
  const pjPendingLie = await makePj('pending', 'VERIFIED');           // pending mas company_status='VERIFIED' (mentira)
  const pjNoFiscal = await makePj('no_fiscal', 'VERIFIED');           // sem fiscal

  const bankBefore = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);

  // ═══ getPermissions — capability deriva de kyb_status ═══
  console.log('\n— getPermissions (capability via kyb_status) —');
  // Passa company_status='VERIFIED' de propósito para provar que é IGNORADO.
  const pApproved = await reputationService.getPermissions(TENANT_ID, pjApproved.pageActorId, 'page', 'VERIFIED');
  record('1 PJ kyb=approved → canPost=true (capability liberada)', pApproved.canPost === true, `canPost=${pApproved.canPost}`);

  const pPending = await reputationService.getPermissions(TENANT_ID, pjPendingLie.pageActorId, 'page', 'VERIFIED');
  record('2 PJ kyb=pending + company_status=VERIFIED → canPost=false (company_status NÃO libera)',
    pPending.canPost === false && pPending.canVote === false && pPending.canCreateProject === false && pPending.canCreateCTA === false,
    `canPost=${pPending.canPost} canVote=${pPending.canVote}`);

  const pNoFiscal = await reputationService.getPermissions(TENANT_ID, pjNoFiscal.pageActorId, 'page', 'APPROVED');
  record('3 PJ sem fiscal → canPost=false (fail-closed)', pNoFiscal.canPost === false, `canPost=${pNoFiscal.canPost}`);

  const pUser = await reputationService.getPermissions(TENANT_ID, userActorId, 'user', undefined);
  record('4 PF/user → canPost=true (inalterado)', pUser.canPost === true, `canPost=${pUser.canPost}`);

  // ═══ CNPJ-lock — deriva de kybStatus ═══
  console.log('\n— CNPJ-lock (via kybStatus) —');
  let approvedLocked = false; let approvedMsg = '';
  try {
    await companiesService.updateCompany(pjApproved.companyId, ownerGlobalUserId, { cnpj: randomCnpj14() }, TENANT_ID);
  } catch (e: any) { approvedLocked = true; approvedMsg = e?.message ?? ''; }
  record('5 company kyb=approved → CNPJ bloqueado (lock por KYB)',
    approvedLocked && /KYB approved|casa fiscal|não pode ser editado/i.test(approvedMsg), `locked=${approvedLocked} msg=${approvedMsg}`);

  // company pending: lock por company_status NÃO dispara (CNPJ válido → edição passa do lock).
  let pendingKybLock = false; let pendingMsg = '';
  try {
    await companiesService.updateCompany(pjPendingLie.companyId, ownerGlobalUserId, { cnpj: validCnpj(424242424242) }, TENANT_ID);
  } catch (e: any) { pendingMsg = e?.message ?? ''; pendingKybLock = /KYB approved|casa fiscal/i.test(pendingMsg); }
  record('6 company kyb=pending (company_status=VERIFIED) → NÃO bloqueia por KYB/company_status',
    pendingKybLock === false, `kybLock=${pendingKybLock} msg=${pendingMsg}`);

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
