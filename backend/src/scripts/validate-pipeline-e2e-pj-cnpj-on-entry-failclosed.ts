/**
 * E2E F-PJ-CNPJ-ON-ENTRY — fonte fail-closed que o frontend projeta.
 *
 * O frontend (CompaniesManager) valida dígito verificador NA ENTRADA e projeta, no campo CNPJ,
 * o veredito de duplicidade/validade vindo do backend. Este e2e prova a FONTE: createCompany
 * rejeita CNPJ inválido e duplicado contra a fonte fiscal canônica (companies same-user +
 * UNIQUE uq_fiscal_identities_cnpj global), SEM criar empresa/fiscal_identity no caso ruim.
 *
 * Prova:
 *   E1 — CNPJ inválido (dígito verificador) → erro limpo; nada criado.
 *   E2 — CPF (11 dígitos) NÃO é aceito como CNPJ → erro limpo; nada criado.
 *   E3 — CNPJ válido novo → cria 1 company + 1 fiscal_identity.
 *   E4 — mesmo CNPJ de novo (same-user) → "já está cadastrada"; continua 1/1 (não duplica).
 *   E5 — UNIQUE canônico uq_fiscal_identities_cnpj existe (fail-closed global).
 *
 * Base: tenant DEV + PF canônica (dev@unificard.local). LIMPO ao fim (DEV intacto).
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-cnpj-on-entry-failclosed.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
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

async function countByCnpj(cnpj: string): Promise<{ companies: number; fiscal: number }> {
  const c = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE cnpj = $1 AND tenant_id = $2`, [cnpj, TENANT_ID]);
  const f = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identities WHERE cnpj = $1`, [cnpj]);
  return { companies: parseInt(c.rows[0].n, 10), fiscal: parseInt(f.rows[0].n, 10) };
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

  const createdCnpjs: string[] = [];

  try {
    console.log('\n— E (CNPJ on-entry fail-closed) —');

    // E1 — CNPJ inválido (dígito verificador)
    const bad = '11222333000100'; // 14 dígitos, DV incorreto
    let e1ok = false;
    try {
      await companiesService.createCompany(devGlobalUserId, { cnpj: bad, companyName: 'E2E Bad DV', role: 'owner', fetchFromRevenue: false }, TENANT_ID);
    } catch (e) {
      e1ok = /dígito verificador|CNPJ inválido/i.test((e as Error).message);
    }
    const e1count = await countByCnpj(bad);
    record('E1 CNPJ inválido (dígito) rejeitado, nada criado', e1ok && e1count.companies === 0 && e1count.fiscal === 0, `throw=${e1ok} comp=${e1count.companies} fisc=${e1count.fiscal}`);

    // E2 — CPF (11 dígitos) não é CNPJ
    const cpf = '52998224725'; // CPF válido, mas 11 dígitos
    let e2ok = false;
    let e2msg = '';
    try {
      await companiesService.createCompany(devGlobalUserId, { cnpj: cpf, companyName: 'E2E CPF', role: 'owner', fetchFromRevenue: false }, TENANT_ID);
    } catch (e) {
      e2msg = (e as Error).message;
      e2ok = /CNPJ inválido|14 dígitos/i.test(e2msg);
    }
    const e2count = await countByCnpj(cpf);
    record('E2 CPF (11 díg.) não aceito como CNPJ, nada criado', e2ok && e2count.companies === 0 && e2count.fiscal === 0, `msg="${e2msg}" comp=${e2count.companies}`);

    // E3 — CNPJ válido novo cria 1/1
    const good = validCnpj();
    createdCnpjs.push(good);
    const r3 = await companiesService.createCompany(devGlobalUserId, { cnpj: good, companyName: 'E2E CNPJ Good', role: 'owner', fetchFromRevenue: false, isPrimary: false }, TENANT_ID);
    const e3count = await countByCnpj(good);
    record('E3 CNPJ válido novo cria 1 company + 1 fiscal_identity', !!r3.company.companyId && e3count.companies === 1 && e3count.fiscal === 1, `comp=${e3count.companies} fisc=${e3count.fiscal}`);

    // E4 — mesmo CNPJ de novo (same-user) → rejeitado, não duplica
    let e4msg = '';
    try {
      await companiesService.createCompany(devGlobalUserId, { cnpj: good, companyName: 'E2E CNPJ Dup', role: 'owner', fetchFromRevenue: false, isPrimary: false }, TENANT_ID);
    } catch (e) {
      e4msg = (e as Error).message;
    }
    const e4count = await countByCnpj(good);
    record('E4 CNPJ duplicado rejeitado com msg limpa, sem duplicar', /já\s+(está\s+)?cadastrad/i.test(e4msg) && e4count.companies === 1 && e4count.fiscal === 1, `msg="${e4msg}" comp=${e4count.companies} fisc=${e4count.fiscal}`);

    // E5 — UNIQUE canônico global existe
    const uq = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_constraint WHERE conname = 'uq_fiscal_identities_cnpj'`
    );
    record('E5 UNIQUE uq_fiscal_identities_cnpj existe (fail-closed global)', uq.rows[0].n === '1', `n=${uq.rows[0].n}`);
  } finally {
    console.log('\n— cleanup —');
    if (createdCnpjs.length > 0) {
      const compRows = await pool.query<{ company_id: string }>(
        `SELECT company_id::text FROM companies WHERE cnpj = ANY($1::text[]) AND tenant_id = $2`,
        [createdCnpjs, TENANT_ID]
      );
      const ids = compRows.rows.map((r) => r.company_id);
      if (ids.length > 0) {
        const tables = ['company_opportunity_preferences', 'company_domains', 'company_users'];
        for (const t of tables) {
          try {
            await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]);
          } catch (e) {
            if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message);
          }
        }
        await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
        await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      }
      // fiscal_identities órfãs dos CNPJs de teste
      await pool.query(`DELETE FROM fiscal_identities WHERE cnpj = ANY($1::text[])`, [createdCnpjs]);
      let left = 0;
      for (const c of createdCnpjs) {
        const k = await countByCnpj(c);
        left += k.companies + k.fiscal;
      }
      console.log(`  resíduo dos CNPJs de teste (company+fiscal) = ${left}`);
      record('CLEANUP DEV intacto (CNPJs de teste = 0)', left === 0);
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
  console.log('✨ CNPJ on-entry fail-closed verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
