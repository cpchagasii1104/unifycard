/**
 * E2E DECISION-0089 Fase 1 — read-model de verificação PJ (kyb_status como fonte visual).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-verification-display-ephemeral.ps1.
 *
 * Prova o caminho REAL (companiesService.listCompanies / getCompanyById):
 *   - fiscal kyb_status='approved'      → kybStatus='approved',  isKybApproved=true
 *   - company_status='ACTIVE' (lifecycle) + kyb 'pending' → kybStatus='pending', isKybApproved=false (display IGNORA lifecycle)
 *   - sem fiscal_identity               → kybStatus=null,        isKybApproved=false
 *   - fiscal kyb_status='rejected'      → kybStatus='rejected',  isKybApproved=false
 *   - pós-3.3: company_status é lifecycle-only (VERIFIED bloqueado por CHECK 3.3-A); is_verified dropado (3.3-B2); verificação = kyb_status
 *   - getCompanyById deriva igual ao listCompanies
 *   - zero Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';

const TENANT_ID = '33333333-4444-5555-6666-777777777777';
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
  if (!/verification|display|kyb|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Verification Display Test', slug: 'pj-verif-display-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  // Owner real → global_user_id (dono das companies) + responsible actor (âncora humana §4.8.2).
  const ownerEmail = 'verif-owner@unificard.test';
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [ownerEmail.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, ownerEmail, PASSWORD, validCpf(), 'Verif Owner');
  }
  const ownerRow = await pool.query<{ global_user_id: string; user_id: string }>(
    'SELECT global_user_id::text, user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1',
    [ownerEmail.toLowerCase(), TENANT_ID]
  );
  const ownerGlobalUserId = ownerRow.rows[0].global_user_id;
  const responsibleActor = (await ensureUserActor(TENANT_ID, ownerRow.rows[0].user_id)).actor_id;

  // Fabrica company (owner=ownerGlobalUserId) + fiscal_identity opcional. Setup direto: testando o READ-MODEL.
  async function seedCompany(
    kind: 'approved' | 'pending' | 'rejected' | 'no_fiscal',
    companyStatus: string,
  ): Promise<string> {
    let fid: string | null = null;
    if (kind !== 'no_fiscal') {
      const isApproved = kind === 'approved';
      const f = await pool.query<{ fiscal_identity_id: string }>(
        `INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id, reviewed_by_actor_id, reviewed_at, decision_reason)
         VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6) RETURNING fiscal_identity_id`,
        [randomCnpj14(), kind, responsibleActor,
          isApproved ? responsibleActor : null,
          isApproved ? new Date().toISOString() : null,
          isApproved ? 'test approve' : null]);
      fid = f.rows[0].fiscal_identity_id;
    }
    const c = await pool.query<{ company_id: string }>(
      `INSERT INTO companies (tenant_id, global_user_id, company_name, fiscal_identity_id, status, company_status)
       VALUES ($1,$2::uuid,'PJ Verif',$3::uuid,'active',$4) RETURNING company_id::text`,
      [TENANT_ID, ownerGlobalUserId, fid, companyStatus]);
    return c.rows[0].company_id;
  }

  // Pós-3.3: company_status é lifecycle-only. Usamos 'ACTIVE' (lifecycle "mais operacional") com kyb
  // 'pending' para provar que o read-model IGNORA company_status — verificação só vem de kyb_status.
  const idApproved = await seedCompany('approved', 'PROVISIONAL');
  const idActiveButPending = await seedCompany('pending', 'ACTIVE');
  const idNoFiscal = await seedCompany('no_fiscal', 'ACTIVE');
  const idRejected = await seedCompany('rejected', 'PROVISIONAL');

  const bankBefore = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);

  // ═══ listCompanies (caminho real) ═══
  console.log('\n— listCompanies (read-model derivado) —');
  const list = await companiesService.listCompanies(ownerGlobalUserId, TENANT_ID);
  const byId = (id: string) => list.find((c) => c.companyId === id);

  const a = byId(idApproved);
  record('1 approved → kybStatus=approved & isKybApproved=true',
    !!a && a.kybStatus === 'approved' && a.isKybApproved === true,
    `kybStatus=${a?.kybStatus} isKybApproved=${a?.isKybApproved}`);

  const v = byId(idActiveButPending);
  record('2 company_status=ACTIVE (lifecycle) + kyb pending → kybStatus=pending & isKybApproved=false (display IGNORA lifecycle)',
    !!v && v.kybStatus === 'pending' && v.isKybApproved === false,
    `kybStatus=${v?.kybStatus} isKybApproved=${v?.isKybApproved}`);

  const nf = byId(idNoFiscal);
  record('3 sem fiscal_identity → kybStatus=null & isKybApproved=false',
    !!nf && nf.kybStatus === null && nf.isKybApproved === false,
    `kybStatus=${nf?.kybStatus} isKybApproved=${nf?.isKybApproved}`);

  const rj = byId(idRejected);
  record('4 kyb rejected → kybStatus=rejected & isKybApproved=false',
    !!rj && rj.kybStatus === 'rejected' && rj.isKybApproved === false,
    `kybStatus=${rj?.kybStatus} isKybApproved=${rj?.isKybApproved}`);

  // ═══ getCompanyById (mesmo read-model) ═══
  console.log('\n— getCompanyById (mesma derivação) —');
  const gApproved = await companiesService.getCompanyById(idApproved, ownerGlobalUserId, TENANT_ID);
  record('8 getCompanyById(approved) → kybStatus=approved & isKybApproved=true',
    !!gApproved && gApproved.kybStatus === 'approved' && gApproved.isKybApproved === true,
    `kybStatus=${gApproved?.kybStatus} isKybApproved=${gApproved?.isKybApproved}`);
  const gVerif = await companiesService.getCompanyById(idActiveButPending, ownerGlobalUserId, TENANT_ID);
  record('9 getCompanyById(ACTIVE+pending) → kybStatus=pending & isKybApproved=false',
    !!gVerif && gVerif.kybStatus === 'pending' && gVerif.isKybApproved === false,
    `kybStatus=${gVerif?.kybStatus} isKybApproved=${gVerif?.isKybApproved}`);

  // ═══ zero Bank ═══
  const bankAfter = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('10 zero Bank (ledger/transactions inalterados)', bankBefore === bankAfter, `before=${bankBefore} after=${bankAfter}`);

  // ── Sumário ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✨' : '❌'} ${results.length - failed.length}/${results.length} verdes`);
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
