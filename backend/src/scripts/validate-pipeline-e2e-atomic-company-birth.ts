/**
 * E2E F-ATOMIC-COMPANY-BIRTH + F-PJ-FISCAL-IDENTITY-SUBSTRATE (F1) — nascimento PJ fiscal-first.
 * DECISION-0075 §9 (Opção B) + DECISION-0085 (D2-técnica: casa fiscal PJ `fiscal_identities`).
 *
 * 🔒 RODA APENAS EM DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA
 *    'unificard_dev'. Orquestrado por scripts/run-atomic-company-birth-ephemeral.ps1
 *    (cria DB, migra MIGRATION_PROFILE=FULL, roda este script, dropa a DB no fim).
 *
 * Prova:
 *  0  Migration aplicada: fiscal_identities + companies.fiscal_identity_id + UNIQUE/CHECK/FK.
 *  1  Happy path fiscal-first: 1 fiscal_identity (pending, cnpj) + company (fiscal_identity_id →
 *     fiscal; cnpj = projeção) + company_user + page-actor (responsible) pending; zero Bank.
 *  2  CNPJ duplicado GLOBAL (2º usuário) → UNIQUE explode DENTRO da tx → rollback total; 1ª intacta.
 *  3/4/5/6  Rollback TOTAL injetando falha após fiscal / company / company_users / page-actor.
 *  7  Tenant context em `actors` dentro da tx + sem vazamento pós-commit.
 *  8  CNPJ com DV inválido → bloqueado na borda → zero fiscal_identity.
 *  9  CNPJ com formato inválido → bloqueado → zero fiscal_identity.
 * 10  `identities` PF intacta (zero linha cnpj; KYC PF não alterado).
 * 11  Zero escrita em bank_*.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { withTransaction } from '../core/database/transaction.helper';
import { companiesService } from '../core/companies/companies.service';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor, ensurePageActorTx } from '../modules/identity/actor-writer.service';

const TENANT_ID = '11111111-2222-3333-4444-555555555555';
const EMAIL = 'atomic-birth@unificard.test';
const EMAIL2 = 'atomic-birth-2@unificard.test';
const PASSWORD = '123456';
const CPF = '11144477735'; // CPF de teste com dígitos verificadores válidos
const FULLNAME = 'Atomic Birth PF';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

// ── Geradores com dígito verificador válido (DV é validado na borda — DECISION-0085 §4.3) ──
function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => {
    let pos = len - 7, sum = 0;
    for (let i = 0; i < len; i++) { sum += n[i] * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(12));
  n.push(dig(13));
  return n.join('');
}
function validCpf(): string {
  const n: number[] = [];
  for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(9));
  n.push(dig(10));
  return n.join('');
}
function randomCnpj14(): string { let s = ''; for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10); return s; }

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — F1 NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}". Rode pelo orquestrador.`);
  if (!/atomic_birth|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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

async function seedUser(email: string, cpf: string, fullName: string): Promise<{ globalUserId: string; userId: string; actorId: string }> {
  const existing = await pool.query('SELECT user_id FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
  if (existing.rowCount === 0) {
    await authService.register(TENANT_ID, email, PASSWORD, cpf, fullName);
  }
  const u = await pool.query<{ user_id: string; global_user_id: string }>(
    'SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
    [email.toLowerCase(), TENANT_ID]
  );
  if (u.rowCount === 0) throw new Error(`seed: user ${email} não encontrado após register`);
  const userId = u.rows[0].user_id;
  const actor = await ensureUserActor(TENANT_ID, userId);
  await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
  return { globalUserId: u.rows[0].global_user_id, userId, actorId: actor.actor_id };
}

async function countBankRows(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COALESCE(SUM(c),0)::text AS n FROM (
       SELECT (SELECT count(*) FROM bank_ledger) AS c
       UNION ALL SELECT (SELECT count(*) FROM bank_transactions)) s`
  );
  return parseInt(r.rows[0].n, 10);
}

async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();
  const t = await pool.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [TENANT_ID]);
  if (t.rowCount === 0) await tenantService.createTenant({ id: TENANT_ID, name: 'Atomic Birth Test', slug: 'atomic-birth-test' });
  await rbacService.seedDefaultRBAC(TENANT_ID);
  const u1 = await seedUser(EMAIL, CPF, FULLNAME);
  const u2 = await seedUser(EMAIL2, validCpf(), 'Atomic Birth PF 2');
  const { globalUserId, actorId: creatorActorId } = u1;

  const bankBefore = await countBankRows().catch(() => -1);

  // ═══ 0 — MIGRATION APLICADA ════════════════════════════════════════════════
  console.log('\n— 0 migration aplicada —');
  const hasTable = (await pool.query(`SELECT to_regclass('public.fiscal_identities') IS NOT NULL x`)).rows[0].x;
  const hasCol = (await pool.query(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='companies' AND column_name='fiscal_identity_id'`)).rows[0].n;
  const consN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_constraint WHERE conname IN ('uq_fiscal_identities_cnpj','chk_fiscal_identities_cnpj_14','chk_fiscal_identities_kyb_status','fk_companies_fiscal_identity')`)).rows[0].n;
  record('0a fiscal_identities existe + companies.fiscal_identity_id existe', hasTable === true && hasCol === 1);
  record('0b UNIQUE/CHECK/FK presentes (4)', consN === '4', `encontradas=${consN}/4`);

  // ═══ 1 — HAPPY PATH FISCAL-FIRST ═══════════════════════════════════════════
  console.log('\n— 1 happy path fiscal-first —');
  const cnpj1 = validCnpj();
  const r1 = await companiesService.createCompany(globalUserId, { cnpj: cnpj1, companyName: 'Atomic Happy', role: 'owner', fetchFromRevenue: false }, TENANT_ID);
  const companyId = r1.company.companyId;
  const comp = await pool.query<{ company_status: string; primary_company_type_id: string | null; fiscal_identity_id: string | null; cnpj: string }>(
    'SELECT company_status, primary_company_type_id::text, fiscal_identity_id::text, cnpj FROM companies WHERE company_id=$1', [companyId]);
  const fi = await pool.query<{ n: string; kyb: string; cnpj: string; fid: string }>(
    `SELECT count(*)::text n, MAX(kyb_status) kyb, MAX(cnpj) cnpj, MAX(fiscal_identity_id::text) fid FROM fiscal_identities WHERE cnpj=$1`, [cnpj1]);
  record('1a 1 fiscal_identity criada (kyb_status=pending, cnpj correto)', fi.rows[0].n === '1' && fi.rows[0].kyb === 'pending' && fi.rows[0].cnpj === cnpj1);
  record('1b companies.fiscal_identity_id aponta para a fiscal', comp.rows[0].fiscal_identity_id === fi.rows[0].fid);
  record('1c companies.cnpj = fiscal_identities.cnpj (projeção)', comp.rows[0].cnpj === fi.rows[0].cnpj);
  record('1d company PROVISIONAL/pending (não-operacional)', comp.rows[0].company_status === 'PROVISIONAL' && comp.rows[0].primary_company_type_id === null);
  const cu = await pool.query<{ n: string }>('SELECT count(*)::text n FROM company_users WHERE company_id=$1', [companyId]);
  const pa = await pool.query<{ responsible: string | null; n: string }>(`SELECT count(*)::text n, MAX(responsible_actor_id::text) responsible FROM actors WHERE tenant_id=$1 AND company_id=$2 AND actor_type='page'`, [TENANT_ID, companyId]);
  record('1e company_user (1) + page-actor (1, responsible=criador)', cu.rows[0].n === '1' && pa.rows[0].n === '1' && pa.rows[0].responsible === creatorActorId);

  // ═══ 2 — CNPJ DUPLICADO GLOBAL (2º usuário) → ROLLBACK DENTRO DA TX ═════════
  console.log('\n— 2 cnpj duplicado global —');
  const dupThrew = await expectThrow(() => companiesService.createCompany(u2.globalUserId, { cnpj: cnpj1, companyName: 'Atomic Dup', role: 'owner', fetchFromRevenue: false }, TENANT_ID));
  const fiDup = await pool.query<{ n: string }>('SELECT count(*)::text n FROM fiscal_identities WHERE cnpj=$1', [cnpj1]);
  const compDup = await pool.query<{ n: string }>('SELECT count(*)::text n FROM companies WHERE cnpj=$1', [cnpj1]);
  record('2 duplicado global falha + rollback total (1 fiscal, 1 company; 1ª intacta)', dupThrew && fiDup.rows[0].n === '1' && compDup.rows[0].n === '1');

  // ═══ 3/4/5/6 — ROLLBACK TOTAL ENTRE PASSOS (fiscal-first) ══════════════════
  console.log('\n— 3/4/5/6 rollback entre passos —');
  async function birthCoreThenThrow(after: 'fiscal' | 'company' | 'company_users' | 'page_actor', cnpj: string): Promise<void> {
    await withTransaction(TENANT_ID, async (client) => {
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT_ID]);
      const f = await client.query(`INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id) VALUES ($1,'pending',$2::uuid) RETURNING fiscal_identity_id`, [cnpj, creatorActorId]);
      const fid = f.rows[0].fiscal_identity_id as string;
      if (after === 'fiscal') throw new Error('INJECT: falha após fiscal_identities');
      const c = await client.query(`INSERT INTO companies (tenant_id, global_user_id, fiscal_identity_id, cnpj, company_name, status, is_verified, company_status) VALUES ($1,$2,$3,$4,'Rollback Test','active',false,'PROVISIONAL') RETURNING company_id`, [TENANT_ID, globalUserId, fid, cnpj]);
      const cid = c.rows[0].company_id as string;
      if (after === 'company') throw new Error('INJECT: falha após companies');
      await client.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, role_description, can_manage_company, can_manage_financial, can_manage_employees, can_view_reports, can_manage_services, is_active, is_primary, metadata) VALUES ($1,$2,$3,'owner',NULL,true,true,true,true,true,true,false,'{}'::jsonb)`, [TENANT_ID, cid, globalUserId]);
      if (after === 'company_users') throw new Error('INJECT: falha após company_users');
      await ensurePageActorTx(client, TENANT_ID, cid, creatorActorId);
      if (after === 'page_actor') throw new Error('INJECT: falha após page_actor');
    });
  }
  for (const step of ['fiscal', 'company', 'company_users', 'page_actor'] as const) {
    const cx = randomCnpj14();
    const threw = await expectThrow(() => birthCoreThenThrow(step, cx));
    const f = (await pool.query<{ n: string }>('SELECT count(*)::text n FROM fiscal_identities WHERE cnpj=$1', [cx])).rows[0].n;
    const c = (await pool.query<{ n: string }>('SELECT count(*)::text n FROM companies WHERE cnpj=$1', [cx])).rows[0].n;
    const cuN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_users cu JOIN companies co ON co.company_id=cu.company_id WHERE co.cnpj=$1`, [cx])).rows[0].n;
    const paN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM actors a JOIN companies co ON co.company_id=a.company_id WHERE co.cnpj=$1 AND a.actor_type='page'`, [cx])).rows[0].n;
    record(`${step}: rollback TOTAL (fiscal/company/company_user/page-actor = 0)`, threw && f === '0' && c === '0' && cuN === '0' && paN === '0', `threw=${threw} f=${f} c=${c} cu=${cuN} page=${paN}`);
  }

  // ═══ 7 — TENANT CONTEXT DENTRO DA TX ═══════════════════════════════════════
  console.log('\n— 7 tenant context —');
  await withTransaction(TENANT_ID, async (client) => {
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT_ID]);
    const cs = await client.query("SELECT current_setting('app.current_tenant', true) AS t");
    const tv = cs.rows[0].t as string;
    record('7a tenant context ativo dentro da tx', tv === TENANT_ID, `t=[${tv}]`);
  });
  const leak = await pool.query<{ t: string }>("SELECT current_setting('app.current_tenant', true) AS t");
  record('7b tenant context NÃO vaza pós-commit', leak.rows[0].t === '' || leak.rows[0].t == null, `t=[${leak.rows[0].t}]`);

  // ═══ 8 — CNPJ DV INVÁLIDO → BORDA BLOQUEIA ═════════════════════════════════
  console.log('\n— 8/9 validação de borda —');
  const base = validCnpj();
  const lastDigit = base[13];
  const badDv = base.slice(0, 13) + (((parseInt(lastDigit, 10) + 1) % 10).toString()); // flip do último dígito → DV inválido
  const dvThrew = await expectThrow(() => companiesService.createCompany(globalUserId, { cnpj: badDv, companyName: 'Bad DV', role: 'owner', fetchFromRevenue: false }, TENANT_ID));
  const fiDv = (await pool.query<{ n: string }>('SELECT count(*)::text n FROM fiscal_identities WHERE cnpj=$1', [badDv])).rows[0].n;
  record('8 CNPJ DV inválido bloqueado na borda (zero fiscal_identity)', dvThrew && fiDv === '0');

  // ═══ 9 — CNPJ FORMATO INVÁLIDO ═════════════════════════════════════════════
  const fmtThrew = await expectThrow(() => companiesService.createCompany(globalUserId, { cnpj: '123', companyName: 'Bad Fmt', role: 'owner', fetchFromRevenue: false }, TENANT_ID));
  const fiCountBeforeAfter = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM fiscal_identities WHERE cnpj='123'`)).rows[0].n;
  record('9 CNPJ formato inválido bloqueado (zero fiscal_identity)', fmtThrew && fiCountBeforeAfter === '0');

  // ═══ 10 — identities PF INTACTA ════════════════════════════════════════════
  console.log('\n— 10/11 fronteiras —');
  const idCnpj = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM identities WHERE tax_id_type='cnpj'`)).rows[0].n;
  record('10 identities PF intacta (zero linha cnpj em identities)', idCnpj === '0', `cnpj_em_identities=${idCnpj}`);

  // ═══ 11 — ZERO BANK ════════════════════════════════════════════════════════
  const bankAfter = await countBankRows().catch(() => -1);
  record('11 zero escrita em bank_* durante o nascimento', bankBefore >= 0 && bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

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
  console.log('✨ F1 casa fiscal PJ + nascimento fiscal-first: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
