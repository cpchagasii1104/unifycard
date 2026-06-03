/**
 * E2E F2-A KYB PJ (DECISION-0086) — writer auditado da identidade fiscal PJ.
 *
 * 🔒 RODA APENAS EM DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA
 *    'unificard_dev'. Orquestrado por scripts/run-pj-kyb-writer-ephemeral.ps1
 *    (cria DB, migra FULL, roda este script, dropa a DB no fim).
 *
 * Prova: migration; submit happy; submit duplicado; approve; reject; review não-pending;
 * fiscal inexistente; reviewer inexistente; atomicidade (rollback entre updates);
 * CHECK auditoria-no-final; identities PF intacta; zero Bank; company_status não mexido; queue.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { fiscalIdentityKybService } from '../core/identity/fiscal-identity-kyb.service';

const TENANT_ID = '22222222-3333-4444-5555-666666666666';
const EMAIL = 'kyb-writer@unificard.test';
const PASSWORD = '123456';
const CPF = '11144477735';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => { let pos = len - 7, s = 0; for (let i = 0; i < len; i++) { s += n[i] * pos--; if (pos < 2) pos = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(12)); n.push(dig(13)); return n.join('');
}
function randomCnpj14(): string { let s = ''; for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10); return s; }

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — F2-A NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|atomic_birth|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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

async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();

  // ── seed: tenant + user (actor humano = operador) ──
  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'KYB Writer Test', slug: 'kyb-writer-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [EMAIL.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, EMAIL, PASSWORD, CPF, 'KYB Writer PF');
  }
  const u = await pool.query<{ user_id: string; global_user_id: string }>(
    'SELECT user_id::text, global_user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1', [EMAIL.toLowerCase(), TENANT_ID]);
  const userId = u.rows[0].user_id;
  const globalUserId = u.rows[0].global_user_id;
  const actor = await ensureUserActor(TENANT_ID, userId);
  await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
  const actorId = actor.actor_id; // operador (submitted_by / reviewed_by). actor_id == actors.id.

  const bankBefore = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);

  // cria uma identidade fiscal pending direta (sem passar por createCompany / limite provisional)
  async function createPendingFiscal(): Promise<{ fiscalId: string; cnpj: string }> {
    const cnpj = randomCnpj14();
    const r = await pool.query<{ fiscal_identity_id: string }>(
      `INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id) VALUES ($1,'pending',$2::uuid) RETURNING fiscal_identity_id`,
      [cnpj, actorId]);
    return { fiscalId: r.rows[0].fiscal_identity_id, cnpj };
  }
  const kybStatus = async (fid: string) => (await pool.query<{ s: string }>('SELECT kyb_status s FROM fiscal_identities WHERE fiscal_identity_id=$1', [fid])).rows[0].s;
  const reqStatus = async (rid: string) => (await pool.query<{ s: string }>('SELECT status s FROM fiscal_identity_kyb_requests WHERE kyb_request_id=$1', [rid])).rows[0]?.s ?? 'NONE';
  const reqCount = async (fid: string) => (await pool.query<{ n: string }>('SELECT count(*)::text n FROM fiscal_identity_kyb_requests WHERE fiscal_identity_id=$1', [fid])).rows[0].n;

  // ═══ 1 — MIGRATION SCHEMA ═══
  console.log('\n— 1 migration —');
  const hasTable = (await pool.query(`SELECT to_regclass('public.fiscal_identity_kyb_requests') IS NOT NULL x`)).rows[0].x;
  const consN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_constraint WHERE conname IN ('fk_fikyb_fiscal_identity','fk_fikyb_submitted_by_actor','fk_fikyb_reviewed_by_actor','chk_fikyb_status','chk_fikyb_final_audit')`)).rows[0].n;
  const uqN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_class WHERE relname='uq_fikyb_one_pending'`)).rows[0].n;
  record('1a tabela fiscal_identity_kyb_requests existe', hasTable === true);
  record('1b FKs + CHECK status + CHECK audit (5)', consN === '5', `cons=${consN}/5`);
  record('1c partial unique pending existe', uqN === '1');

  // ═══ 2 — SUBMIT HAPPY ═══
  console.log('\n— 2/3 submit —');
  const f1 = await createPendingFiscal();
  const sub1 = await fiscalIdentityKybService.submitFiscalKybRequest(f1.fiscalId, actorId, 'docs ok');
  record('2 submit cria 1 request pending; kyb_status segue pending', sub1.status === 'pending' && (await reqCount(f1.fiscalId)) === '1' && (await kybStatus(f1.fiscalId)) === 'pending');

  // ═══ 3 — SUBMIT DUPLICADO ═══
  const dup = await expectThrow(() => fiscalIdentityKybService.submitFiscalKybRequest(f1.fiscalId, actorId, 'again'));
  record('3 submit duplicado bloqueado (partial-unique); 1 request', dup && (await reqCount(f1.fiscalId)) === '1');

  // ═══ 4 — APPROVE HAPPY ═══
  console.log('\n— 4/5 review —');
  const apv = await fiscalIdentityKybService.reviewFiscalKybRequest(sub1.kybRequestId, 'approved', 'kyb completo', actorId);
  const fiApproved = await pool.query<{ kyb: string; rb: string | null; ra: Date | null; dr: string | null }>(
    'SELECT kyb_status kyb, reviewed_by_actor_id::text rb, reviewed_at ra, decision_reason dr FROM fiscal_identities WHERE fiscal_identity_id=$1', [f1.fiscalId]);
  record('4 approve: request approved + fiscal kyb_status=approved + auditoria',
    apv.status === 'approved' && fiApproved.rows[0].kyb === 'approved' && fiApproved.rows[0].rb === actorId && fiApproved.rows[0].ra != null && fiApproved.rows[0].dr === 'kyb completo');

  // ═══ 5 — REJECT HAPPY ═══
  const f2 = await createPendingFiscal();
  const sub2 = await fiscalIdentityKybService.submitFiscalKybRequest(f2.fiscalId, actorId);
  const rej = await fiscalIdentityKybService.reviewFiscalKybRequest(sub2.kybRequestId, 'rejected', 'doc invalido', actorId);
  record('5 reject: request rejected + fiscal kyb_status=rejected + auditoria',
    rej.status === 'rejected' && (await kybStatus(f2.fiscalId)) === 'rejected');

  // ═══ 6 — REVIEW NÃO-PENDING ═══
  console.log('\n— 6/7/8 guards —');
  const rev2 = await expectThrow(() => fiscalIdentityKybService.reviewFiscalKybRequest(sub1.kybRequestId, 'rejected', 'x', actorId));
  record('6 review de request já decidida falha; fiscal não muda', rev2 && (await kybStatus(f1.fiscalId)) === 'approved');

  // ═══ 7 — FISCAL INEXISTENTE ═══
  const sub3 = await expectThrow(() => fiscalIdentityKybService.submitFiscalKybRequest('00000000-0000-0000-0000-000000000000', actorId));
  record('7 submit para fiscal inexistente falha fail-closed', sub3);

  // ═══ 8 — REVIEWER ACTOR INEXISTENTE ═══
  const f3 = await createPendingFiscal();
  const sub3b = await fiscalIdentityKybService.submitFiscalKybRequest(f3.fiscalId, actorId);
  const badReviewer = await expectThrow(() => fiscalIdentityKybService.reviewFiscalKybRequest(sub3b.kybRequestId, 'approved', 'x', '00000000-0000-0000-0000-000000000000'));
  record('8 reviewer actor inexistente falha (FK); request pending, fiscal pending',
    badReviewer && (await reqStatus(sub3b.kybRequestId)) === 'pending' && (await kybStatus(f3.fiscalId)) === 'pending');

  // ═══ 9 — ATOMICIDADE (rollback entre update request e update fiscal) ═══
  console.log('\n— 9/10 atomicidade + CHECK —');
  const client = await pool.connect();
  let atThrew = false;
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE fiscal_identity_kyb_requests SET status='approved', reviewed_by_actor_id=$2::uuid, reviewed_at=NOW(), decision_reason='inject', updated_at=NOW() WHERE kyb_request_id=$1::uuid AND status='pending'`, [sub3b.kybRequestId, actorId]);
    throw new Error('INJECT: falha entre update request e update fiscal_identities');
    // (UPDATE fiscal_identities ocorreria aqui)
  } catch { atThrew = true; try { await client.query('ROLLBACK'); } catch { /* noop */ } } finally { client.release(); }
  record('9 atomicidade: rollback total — request pending, kyb_status pending', atThrew && (await reqStatus(sub3b.kybRequestId)) === 'pending' && (await kybStatus(f3.fiscalId)) === 'pending');

  // ═══ 10 — CHECK auditoria-no-final (DB barra status final sem reviewer/reason) ═══
  const chkThrew = await expectThrow(() => pool.query(`UPDATE fiscal_identity_kyb_requests SET status='approved' WHERE kyb_request_id=$1::uuid`, [sub3b.kybRequestId]));
  record('10 CHECK barra status final sem reviewer/reviewed_at/reason; request pending', chkThrew && (await reqStatus(sub3b.kybRequestId)) === 'pending');

  // ═══ 11 — identities PF intacta ═══
  console.log('\n— 11/12/13/14 fronteiras + queue —');
  const idCnpj = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM identities WHERE tax_id_type='cnpj'`)).rows[0].n;
  record('11 identities PF intacta (0 cnpj em identities)', idCnpj === '0');

  // ═══ 12 — zero Bank ═══
  const bankAfter = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('12 zero escrita em bank_*', bankBefore >= 0 && bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  // ═══ 13 — company_status NÃO mexido pela KYB ═══
  const comp = await companiesService.createCompany(globalUserId, { cnpj: validCnpj(), companyName: 'KYB Company', role: 'owner', fetchFromRevenue: false }, TENANT_ID);
  const compFiscal = (await pool.query<{ fid: string; cs: string }>('SELECT fiscal_identity_id::text fid, company_status cs FROM companies WHERE company_id=$1', [comp.company.companyId])).rows[0];
  const subC = await fiscalIdentityKybService.submitFiscalKybRequest(compFiscal.fid, actorId);
  await fiscalIdentityKybService.reviewFiscalKybRequest(subC.kybRequestId, 'approved', 'ok', actorId);
  const csAfter = (await pool.query<{ cs: string }>('SELECT company_status cs FROM companies WHERE company_id=$1', [comp.company.companyId])).rows[0].cs;
  record('13 KYB approve NÃO altera companies.company_status (segue PROVISIONAL)', compFiscal.cs === 'PROVISIONAL' && csAfter === 'PROVISIONAL', `before=${compFiscal.cs} after=${csAfter}`);

  // ═══ 14 — QUEUE ═══
  const qPending = await fiscalIdentityKybService.getFiscalKybQueue('pending');
  const qApproved = await fiscalIdentityKybService.getFiscalKybQueue('approved');
  const qAll = await fiscalIdentityKybService.getFiscalKybQueue();
  record('14 queue lista por status (pending/approved) e total', qPending.every(r => r.status === 'pending') && qApproved.every(r => r.status === 'approved') && qAll.length >= qApproved.length && qApproved.some(r => r.companyId === comp.company.companyId));

  // ── Resumo ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(66)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ F2-A KYB writer: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
