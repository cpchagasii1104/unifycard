/**
 * E2E F-PJ-ONBOARDING-ROLE-DEDUP — getCompanyById projeta o vínculo FORMAL (company_users.role).
 *
 * O onboarding parou de REPERGUNTAR o papel: o wizard agora CONFIRMA o papel já definido no
 * cadastro, lido de company.userRole.role. Este e2e prova a FONTE: getCompanyById passou a
 * projetar userRole (mesmo SSOT/shape que listCompanies), que antes vinha undefined.
 *
 * Prova:
 *   R1 — createCompany(role='owner') → getCompanyById.userRole.role === 'owner'.
 *   R2 — createCompany(role='admin') → getCompanyById.userRole.role === 'admin'.
 *        (DB CHECK chk_company_users_role_valid aceita owner/admin/staff/contractor/member.)
 *   R3 — userRole projeta SSOT company_users (role bate com a linha real em company_users).
 *   R4 — projeção é leitura: company_status nasce DRAFT e NÃO muda por getCompanyById.
 *
 * Base: tenant DEV + PF canônica (dev@unificard.local). LIMPO ao fim (DEV intacto).
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-company-userrole-projection.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ global_user_id: string }>(
    `SELECT global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devGlobalUserId = dev.rows[0].global_user_id;

  const createdCompanyIds: string[] = [];

  // cria → roda asserts → apaga imediatamente (mantém DRAFT concorrente em +1; robusto ao anti-fraude).
  async function withCompany(role: string, name: string, fn: (companyId: string) => Promise<void>): Promise<void> {
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: name, role: role as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    const id = c.company.companyId;
    createdCompanyIds.push(id);
    try {
      await fn(id);
    } finally {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = $1::uuid`, [id]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
      await deleteCompaniesAndFiscal(pool, "company_id = $1::uuid", [id]);
      createdCompanyIds.splice(createdCompanyIds.indexOf(id), 1);
    }
  }

  try {
    console.log('\n— R (userRole projection) —');

    // R1 — role='owner'
    await withCompany('owner', 'E2E Role Owner', async (id) => {
      const g1 = await companiesService.getCompanyById(id, devGlobalUserId, TENANT_ID);
      const ur1 = (g1 as { userRole?: { role?: string } } | null)?.userRole;
      record('R1 getCompanyById projeta userRole.role=owner', ur1?.role === 'owner', `userRole=${JSON.stringify(ur1?.role)}`);
    });

    // R2/R3/R4 — role='manager'
    await withCompany('admin', 'E2E Role Admin', async (id) => {
      const g2 = await companiesService.getCompanyById(id, devGlobalUserId, TENANT_ID);
      const ur2 = (g2 as { userRole?: { role?: string } } | null)?.userRole;
      record('R2 getCompanyById projeta userRole.role=admin', ur2?.role === 'admin', `userRole=${JSON.stringify(ur2?.role)}`);

      const dbRole = await pool.query<{ role: string }>(
        `SELECT role FROM company_users WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid AND is_active = true LIMIT 1`,
        [TENANT_ID, id, devGlobalUserId]
      );
      record('R3 userRole.role espelha company_users (SSOT)', ur2?.role === dbRole.rows[0]?.role, `proj=${ur2?.role} db=${dbRole.rows[0]?.role}`);

      const st = await pool.query<{ s: string }>(`SELECT company_status AS s FROM companies WHERE company_id = $1`, [id]);
      record('R4 getCompanyById não muta lifecycle (segue DRAFT)', st.rows[0].s === 'DRAFT', `status=${st.rows[0].s}`);
    });
  } finally {
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      const tables = ['company_opportunity_preferences', 'company_domains', 'company_users'];
      for (const t of tables) {
        try {
          await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]);
        } catch (e) {
          if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message);
        }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await deleteCompaniesAndFiscal(pool, "company_id = ANY($1::uuid[])", [ids]);
      const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      console.log(`  companies restantes=${left.rows[0].n}`);
      record('CLEANUP DEV intacto (companies de teste = 0)', left.rows[0].n === '0');
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ userRole projection verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
