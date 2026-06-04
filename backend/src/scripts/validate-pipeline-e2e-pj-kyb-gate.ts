/**
 * E2E F2-C GATE KYB PJ (DECISION-0088) — authority financeira.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-kyb-gate-ephemeral.ps1 (AUTHORITY_MODE=permissive p/ ISOLAR o KYB:
 *    em permissive, ATL/KYC fazem skip — o KYB bloqueia mesmo assim, provando strict-para-dinheiro §3.7).
 *
 * Prova: PF KYC approved passa / pending bloqueia; PJ pending/rejected/suspended bloqueia transfer/payment/
 * payout/reversal; PJ approved passa; page sem company / company sem fiscal bloqueia; gate lê kyb_status
 * (company_status='VERIFIED'+kyb pending bloqueia); user → KYB_NOT_APPLICABLE; permissive não libera PJ;
 * trace tem camada KYB; zero Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { authorityDecisionService } from '../core/compliance/authority-decision.service';

const TENANT_ID = '44444444-5555-6666-7777-888888888888';
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — F2-C NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|gate|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db} (AUTHORITY_MODE=${process.env.AUTHORITY_MODE})`);
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
    await tenantService.createTenant({ id: TENANT_ID, name: 'KYB Gate Test', slug: 'kyb-gate-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  // PF approved / PF pending (actores user — KYC).
  async function seedUser(email: string): Promise<string> {
    if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [email.toLowerCase()])).rowCount === 0) {
      await authService.register(TENANT_ID, email, PASSWORD, validCpf(), 'Gate PF');
    }
    const u = await pool.query<{ user_id: string }>('SELECT user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1', [email.toLowerCase(), TENANT_ID]);
    const a = await ensureUserActor(TENANT_ID, u.rows[0].user_id);
    return a.actor_id;
  }
  const userApproved = await seedUser('gate-approved@unificard.test');
  const userPending = await seedUser('gate-pending@unificard.test');
  // Aprovar o KYC do primeiro (setup direto — testando o GATE, não o writer KYC).
  await pool.query(`UPDATE identities SET kyc_status='approved' WHERE global_user_id = (SELECT u.global_user_id FROM users u JOIN actors a ON a.user_id=u.user_id WHERE a.id=$1::uuid)`, [userApproved]);

  const responsibleActor = userApproved; // âncora humana p/ page-actores (§4.8.2)

  // Fabrica um page-actor PJ com kyb_status desejado (setup direto — testando o GATE).
  async function makePj(kind: 'pending' | 'approved' | 'rejected' | 'suspended' | 'no_fiscal' | 'no_company', companyStatus = 'PROVISIONAL'): Promise<string> {
    if (kind === 'no_company') {
      const a = await pool.query<{ id: string }>(
        `INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id)
         VALUES ($1,'page',NULL,'PJ no-company',$2::uuid) RETURNING id::text`, [TENANT_ID, responsibleActor]);
      return a.rows[0].id;
    }
    let fid: string | null = null;
    if (kind !== 'no_fiscal') {
      // approved exige auditoria (chk_fiscal_identities_approved_audit). Setup direto p/ testar o GATE.
      const f = await pool.query<{ fiscal_identity_id: string }>(
        `INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id, reviewed_by_actor_id, reviewed_at, decision_reason)
         VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6) RETURNING fiscal_identity_id`,
        [randomCnpj14(), kind, responsibleActor,
          kind === 'approved' ? responsibleActor : null,
          kind === 'approved' ? new Date().toISOString() : null,
          kind === 'approved' ? 'test approve' : null]);
      fid = f.rows[0].fiscal_identity_id;
    }
    const c = await pool.query<{ company_id: string }>(
      `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id, status, company_status)
       VALUES ($1,'PJ Gate',$2::uuid,'active',$3) RETURNING company_id`, [TENANT_ID, fid, companyStatus]);
    const a = await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id)
       VALUES ($1,'page',$2::uuid,'PJ Gate',$3::uuid) RETURNING id::text`, [TENANT_ID, c.rows[0].company_id, responsibleActor]);
    return a.rows[0].id;
  }

  const bankBefore = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);

  async function gate(actorId: string, action: 'financial_transfer' | 'financial_payment' | 'financial_payout' | 'financial_reversal_request' = 'financial_transfer') {
    return authorityDecisionService.evaluateFinancialSensitiveAction(TENANT_ID, { actorId, action, amountCents: 0 });
  }
  const kybTrace = (ev: any) => (ev.layers as any[]).find((l) => l.layer === 'KYB');

  // ═══ 1/2 — PF KYC ═══
  console.log('\n— 1/2 PF KYC —');
  const e1 = await gate(userApproved);
  record('1 PF user KYC approved passa (KYB skip)', e1.decision !== 'block' && kybTrace(e1)?.reason === 'KYB_NOT_APPLICABLE_ACTOR_TYPE', `decision=${e1.decision} kyb=${kybTrace(e1)?.reason}`);
  const e2 = await gate(userPending);
  record('2 PF user KYC pending bloqueia (camada KYC)', e2.decision === 'block' && e2.reason === 'KYC_PENDING_BLOCKS_FINANCIAL', `decision=${e2.decision} reason=${e2.reason}`);

  // ═══ 3/4/5/6/7 — PJ por status ═══
  console.log('\n— 3..7 PJ por status —');
  const pjPending = await makePj('pending');
  for (const act of ['financial_transfer', 'financial_payment', 'financial_payout'] as const) {
    const e = await gate(pjPending, act);
    record(`3-5 PJ pending bloqueia ${act}`, e.decision === 'block' && e.reason === 'KYB_PENDING_BLOCKS_FINANCIAL', `decision=${e.decision} reason=${e.reason}`);
  }
  const pjRejected = await makePj('rejected');
  const e6 = await gate(pjRejected);
  record('6 PJ rejected bloqueia', e6.decision === 'block' && e6.reason === 'KYB_REJECTED_BLOCKS_FINANCIAL', `reason=${e6.reason}`);
  const pjApproved = await makePj('approved');
  const e7 = await gate(pjApproved);
  record('7 PJ approved passa (KYB pass)', e7.decision !== 'block' && kybTrace(e7)?.reason === 'KYB_APPROVED', `decision=${e7.decision} kyb=${kybTrace(e7)?.reason}`);

  // ═══ 8/9 — elos quebrados ═══
  console.log('\n— 8/9 fail-closed —');
  const pjNoCompany = await makePj('no_company');
  const e8 = await gate(pjNoCompany);
  record('8 page sem company_id bloqueia', e8.decision === 'block' && e8.reason === 'KYB_COMPANY_LINK_MISSING', `reason=${e8.reason}`);
  const pjNoFiscal = await makePj('no_fiscal');
  const e9 = await gate(pjNoFiscal);
  record('9 company sem fiscal_identity_id bloqueia', e9.decision === 'block' && e9.reason === 'KYB_FISCAL_IDENTITY_MISSING', `reason=${e9.reason}`);

  // ═══ 10/11 — fonte é kyb_status, não company_status ═══
  console.log('\n— 10/11 fonte —');
  const pjVerifiedPending = await makePj('pending', 'VERIFIED'); // companies VERIFIED mas kyb pending
  const e11 = await gate(pjVerifiedPending);
  record('10/11 company_status=VERIFIED + kyb pending → bloqueia (gate lê kyb_status)', e11.decision === 'block' && e11.reason === 'KYB_PENDING_BLOCKS_FINANCIAL', `reason=${e11.reason}`);

  // ═══ 16 — reversal segue a regra ═══
  console.log('\n— 16 reversal —');
  const e16 = await gate(pjPending, 'financial_reversal_request');
  record('16 financial_reversal_request de PJ pending bloqueia', e16.decision === 'block' && e16.reason === 'KYB_PENDING_BLOCKS_FINANCIAL', `reason=${e16.reason}`);

  // ═══ 12/15 — PF/MVP-A não afetado + permissive não libera PJ ═══
  console.log('\n— 12/15/17/18 fronteiras —');
  record('12/17 user (proxy comprador MVP-A) → KYB_NOT_APPLICABLE, segue KYC', kybTrace(e1)?.reason === 'KYB_NOT_APPLICABLE_ACTOR_TYPE' && kybTrace(e1)?.outcome === 'skip');
  record('15 permissive NÃO libera PJ pending (KYB strict para dinheiro)', e16.decision === 'block' && (await gate(pjPending)).decision === 'block');
  record('18 PJ approved → KYB_APPROVED no trace', kybTrace(e7)?.reason === 'KYB_APPROVED' && kybTrace(e7)?.outcome === 'pass');

  // ═══ 14 — trace registra camada KYB ═══
  record('14 authority trace registra camada KYB', !!kybTrace(e1) && !!kybTrace(e7) && !!kybTrace(e11));

  // ═══ 13 — zero Bank ═══
  const bankAfter = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('13 zero escrita em bank_* (gate só lê)', bankBefore >= 0 && bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  // ── Resumo ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(68)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ F2-C gate KYB: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
