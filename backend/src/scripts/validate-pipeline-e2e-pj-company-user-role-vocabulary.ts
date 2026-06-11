/**
 * E2E F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH — todo papel visível grava valor aceito pelo banco.
 *
 * Antes: o formulário/contrato ofereciam owner/partner/director/manager/employee/other, mas o CHECK
 * vivo chk_company_users_role_valid só aceita owner/admin/staff/contractor/member — criar empresa com
 * qualquer papel ≠ owner VIOLAVA o CHECK (23514), buraco na porta de entrada PJ. Agora o vocabulário
 * é único (= banco).
 *
 * Prova:
 *   V1..V5 — createCompany com cada papel visível (owner/admin/staff/contractor/member) NÃO falha no
 *            CHECK; company_users.role grava o valor; getCompanyById.userRole.role projeta o valor.
 *   P1 — tiers de permissão: owner → canManageCompany; owner/admin → financial/employees/services;
 *        staff/contractor/member → sem manage. (autoridade material em can_manage_*, não no rótulo.)
 *   N1 — papel LEGADO 'manager' (fora do vocabulário) é REJEITADO pelo banco (CHECK), nada criado.
 *
 * Base: tenant DEV + PF canônica. create→assert→delete um a um (robusto ao anti-fraude). DEV intacto.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-company-user-role-vocabulary.ts
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

  async function deleteCompany(id: string): Promise<void> {
    for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
      try { await pool.query(`DELETE FROM ${t} WHERE company_id = $1::uuid`, [id]); }
      catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
    }
    await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
    // PJ-B7: companies de fixture são FISCAL-FIRST — apagar a company sem a fonte fiscal
    // vazava 1 órfã por role (5/run, medido). Helper canônico captura e limpa a cadeia.
    await deleteCompaniesAndFiscal(pool, 'company_id = $1::uuid', [id]);
  }

  // expected manage tiers por papel.
  // 🔴 F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED (Opção B): para o CRIADOR INICIAL via createCompany,
  // `can_manage_company` é imposto SERVER-SIDE = true em QUALQUER role (governança de nascimento da PJ;
  // o role é só rótulo, a autoridade vive no flag). Por isso a coluna `company` é true para todos os roles
  // AQUI (caso especial do criador). `financial/employees/services` seguem role-derived (vocabulário vigente).
  // Membros adicionados depois (company-members) NÃO ganham governança por este caminho — não enfraquecido.
  const tier: Record<string, { company: boolean; financial: boolean; employees: boolean; services: boolean }> = {
    owner:      { company: true,  financial: true,  employees: true,  services: true },
    admin:      { company: true,  financial: true,  employees: true,  services: true },
    staff:      { company: true,  financial: false, employees: false, services: false },
    contractor: { company: true,  financial: false, employees: false, services: false },
    member:     { company: true,  financial: false, employees: false, services: false },
  };

  try {
    console.log('\n— V (vocabulário aceito pelo banco) —');
    let idx = 0;
    for (const role of ['owner', 'admin', 'staff', 'contractor', 'member']) {
      idx += 1;
      let id: string | null = null;
      try {
        const c = await companiesService.createCompany(
          devGlobalUserId,
          { cnpj: validCnpj(), companyName: `E2E Role ${role}`, role: role as never, fetchFromRevenue: false, isPrimary: false },
          TENANT_ID
        );
        id = c.company.companyId;
        createdCompanyIds.push(id);

        const cu = await pool.query<{ role: string; cc: boolean; cf: boolean; ce: boolean; cs: boolean }>(
          `SELECT role, can_manage_company cc, can_manage_financial cf, can_manage_employees ce, can_manage_services cs
             FROM company_users WHERE tenant_id=$1 AND company_id=$2::uuid AND global_user_id=$3::uuid AND is_active=true LIMIT 1`,
          [TENANT_ID, id, devGlobalUserId]
        );
        const g = await companiesService.getCompanyById(id, devGlobalUserId, TENANT_ID);
        const projected = (g as { userRole?: { role?: string } } | null)?.userRole?.role;
        const t = tier[role];
        const okStore = cu.rows[0]?.role === role;
        const okProj = projected === role;
        const okPerm = cu.rows[0]?.cc === t.company && cu.rows[0]?.cf === t.financial && cu.rows[0]?.ce === t.employees && cu.rows[0]?.cs === t.services;
        record(`V${idx} role='${role}' grava+projeta+tier`, okStore && okProj && okPerm,
          `store=${cu.rows[0]?.role} proj=${projected} perm[c/f/e/s]=${cu.rows[0]?.cc}/${cu.rows[0]?.cf}/${cu.rows[0]?.ce}/${cu.rows[0]?.cs}`);
      } finally {
        if (id) { await deleteCompany(id); createdCompanyIds.splice(createdCompanyIds.indexOf(id), 1); }
      }
    }

    // N1 — papel legado fora do vocabulário é rejeitado pelo banco; nada criado
    console.log('\n— N (papel legado rejeitado) —');
    const ghostCnpj = validCnpj();
    let n1threw = false;
    let n1code = '';
    try {
      await companiesService.createCompany(
        devGlobalUserId,
        { cnpj: ghostCnpj, companyName: 'E2E Legacy manager', role: 'manager' as never, fetchFromRevenue: false, isPrimary: false },
        TENANT_ID
      );
    } catch (e) {
      n1threw = true;
      n1code = (e as { code?: string }).code ?? '';
    }
    const leftover = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM companies WHERE cnpj=$1 AND tenant_id=$2`, [ghostCnpj, TENANT_ID]);
    // limpa qualquer fiscal_identity órfã do CNPJ fantasma
    await pool.query(`DELETE FROM fiscal_identities WHERE cnpj=$1`, [ghostCnpj]);
    record(`N1 papel legado 'manager' rejeitado (CHECK), nada criado`, n1threw && leftover.rows[0].n === '0', `threw=${n1threw} code=${n1code} companies=${leftover.rows[0].n}`);
  } finally {
    console.log('\n— cleanup —');
    const ids = [...createdCompanyIds];
    for (const id of ids) await deleteCompany(id);
    let left = 0;
    if (ids.length > 0) {
      const r = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      left = parseInt(r.rows[0].n, 10);
    }
    record('CLEANUP DEV intacto (companies de teste = 0)', left === 0, `restantes=${left}`);
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
  console.log('✨ Vocabulário de papel alinhado ao banco — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
