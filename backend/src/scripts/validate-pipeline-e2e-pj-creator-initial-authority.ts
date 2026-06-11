/**
 * E2E F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED (Opção B)
 *
 * O CRIADOR da PJ sempre nasce com governança inicial (`can_manage_company=true`) imposta SERVER-SIDE
 * em createCompany, INDEPENDENTE do `role` do formulário e SEM confiar em `input.permissions`. O `role`
 * é preservado como rótulo/cargo (vocabulário intacto). Clayton/fundador NÃO vira gestor de PJ de terceiro.
 *
 * Casos:
 *   C1 role='owner' → canManageCompany(criador)=true; role gravado='owner'.
 *   C2 role='member' (non-owner) → canManageCompany(criador)=true; role gravado='member' (label preservado);
 *      can_manage_company=true (flag forçado).
 *   C3 input.permissions.canManageCompany=false → backend IMPÕE true p/ o criador → canManageCompany=true.
 *   C4 estranho sem vínculo → canManageCompany=false.
 *   C5 criador passa pelo gate de gestão (canManageCompany=true = decisão de requireCompanyManage).
 *   C6 sem vínculo automático de fundador: company_users do nascimento tem EXATAMENTE 1 linha = o criador.
 *   C7 invariante transacional: toda company criada tem o membership do criador com can_manage_company=true.
 *
 * Base: tenant DEV + PF canônica. create→assert→delete um a um. DEV intacto.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-creator-initial-authority.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_GLOBAL = '00000000-0000-4000-8000-0000000000ee';

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
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devGlobalUserId = dev.rows[0].global_user_id;

  const created: string[] = [];
  async function del(id: string): Promise<void> {
    for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
      try { await pool.query(`DELETE FROM ${t} WHERE company_id = $1::uuid`, [id]); }
      catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
    }
    await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
    await deleteCompaniesAndFiscal(pool, "company_id = $1::uuid", [id]);
  }

  async function newCompany(role: string, name: string, permissions?: Record<string, boolean>): Promise<string> {
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: name, role: role as never, fetchFromRevenue: false, isPrimary: false, permissions } as never,
      TENANT_ID
    );
    created.push(c.company.companyId);
    return c.company.companyId;
  }

  async function row(companyId: string): Promise<{ role: string; cc: boolean; n: number } | null> {
    const r = await pool.query<{ role: string; cc: boolean }>(
      `SELECT role, can_manage_company cc FROM company_users WHERE tenant_id=$1 AND company_id=$2::uuid AND global_user_id=$3::uuid AND is_active=true LIMIT 1`,
      [TENANT_ID, companyId, devGlobalUserId]
    );
    const cnt = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM company_users WHERE tenant_id=$1 AND company_id=$2::uuid AND is_active=true`,
      [TENANT_ID, companyId]
    );
    if (!r.rows[0]) return null;
    return { role: r.rows[0].role, cc: r.rows[0].cc, n: parseInt(cnt.rows[0].n, 10) };
  }

  try {
    console.log('\n— C (creator initial authority) —');

    // C1 owner
    const c1 = await newCompany('owner', 'E2E Creator owner');
    const m1 = await row(c1);
    const cm1 = await companiesService.canManageCompany(TENANT_ID, c1, devGlobalUserId);
    record('C1 role=owner → canManageCompany=true + role gravado owner', cm1 === true && m1?.role === 'owner', `cm=${cm1} role=${m1?.role}`);
    await del(c1); created.splice(created.indexOf(c1), 1);

    // C2 member (non-owner)
    const c2 = await newCompany('member', 'E2E Creator member');
    const m2 = await row(c2);
    const cm2 = await companiesService.canManageCompany(TENANT_ID, c2, devGlobalUserId);
    record('C2 role=member → canManageCompany=true (governança imposta)', cm2 === true, `cm=${cm2}`);
    record('C2b label preservado (role=member) + flag forçado (can_manage_company=true)', m2?.role === 'member' && m2?.cc === true, `role=${m2?.role} cc=${m2?.cc}`);
    await del(c2); created.splice(created.indexOf(c2), 1);

    // C3 input.permissions.canManageCompany=false → backend impõe true
    const c3 = await newCompany('admin', 'E2E Creator admin permfalse', { canManageCompany: false });
    const m3 = await row(c3);
    const cm3 = await companiesService.canManageCompany(TENANT_ID, c3, devGlobalUserId);
    record('C3 input.permissions.canManageCompany=false IGNORADO → can_manage_company=true', cm3 === true && m3?.cc === true, `cm=${cm3} cc=${m3?.cc}`);

    // C4 estranho sem vínculo
    const cm4 = await companiesService.canManageCompany(TENANT_ID, c3, STRANGER_GLOBAL);
    record('C4 estranho sem vínculo → canManageCompany=false', cm4 === false, `cm=${cm4}`);

    // C5 criador passa pelo gate (canManageCompany = decisão de requireCompanyManage)
    record('C5 criador passa pelo gate de gestão (canManageCompany=true)', cm3 === true);

    // C6 sem vínculo automático de fundador: exatamente 1 membership = o criador
    record('C6 nascimento: 1 membership ativo = o criador (sem vínculo automático de fundador/plataforma)',
      m3?.n === 1, `company_users_ativos=${m3?.n}`);
    await del(c3); created.splice(created.indexOf(c3), 1);

    // C7 invariante: toda company criada tem membership do criador com can_manage_company=true
    const c7 = await newCompany('staff', 'E2E Creator staff');
    const m7 = await row(c7);
    record('C7 invariante: company nasce com membership do criador + can_manage_company=true',
      m7 !== null && m7.cc === true && m7.n === 1, `m=${JSON.stringify(m7)}`);
    await del(c7); created.splice(created.indexOf(c7), 1);
  } finally {
    console.log('\n— cleanup —');
    for (const id of [...created]) await del(id);
    const left = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM companies WHERE company_name LIKE 'E2E Creator %'`
    );
    record('CLEANUP DEV intacto (companies de teste = 0)', left.rows[0].n === '0', `restantes=${left.rows[0].n}`);
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
  console.log('✨ Creator initial authority (Opção B) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
