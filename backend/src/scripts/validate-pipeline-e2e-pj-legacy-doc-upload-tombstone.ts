/**
 * E2E — F-PJ-LEGACY-DOC-UPLOAD-TOMBSTONE (DECISION-0087)
 *
 *   T1 — rota POST /companies/:id/documents → 501 PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED (inject; antes de auth/arquivo)
 *   T2 — service uploadCompanyDocument → throw PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED (não escreve)
 *   T3 — empresa DRAFT: chamar o tombstone NÃO promove company_status (segue DRAFT)
 *   T4 — kyb_status (fiscal_identities) inalterado pelo caminho legado
 *   T5 — fiscal_identity_documents NÃO ganhou linha por esse caminho (SSOT intocado)
 *   T6 — company_documents segue inexistente (tabela fantasma) — nada gravado
 *
 * READ-ONLY sobre o Bank. Só lê/cria companies de teste (cleanup ao fim). Sem migration.
 */

import dotenv from 'dotenv';
import { join } from 'path';
import Fastify from 'fastify';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';
import { companiesRoutes } from '../core/companies/companies.routes';

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

function randomCnpj(): string {
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

/** Fastify mínimo registrando as companies routes reais. `requireRole` é stub só p/ permitir o registro
 *  das rotas admin; a rota /:companyId/documents NÃO usa preHandler — o 501 é a 1ª instrução do handler. */
async function buildApp() {
  const app = Fastify({ logger: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).decorate('requireRole', () => async () => { /* stub */ });
  await app.register(companiesRoutes);
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ user_id: string; global_user_id: string }>(
    `SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devGlobalUserId = dev.rows[0].global_user_id;

  const createdCompanyIds: string[] = [];

  try {
    // ═══ T1 — rota retorna 501 honesto (inject) ══════════════════════════════
    const app = await buildApp();
    try {
      const resp = await app.inject({
        method: 'POST',
        url: `/00000000-0000-0000-0000-0000000000aa/documents`,
        payload: {},
      });
      const body = (() => { try { return JSON.parse(resp.body); } catch { return {}; } })();
      record(
        'T1 POST /companies/:id/documents → 501 PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED',
        resp.statusCode === 501 && body.code === 'PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED',
        `status=${resp.statusCode} code=${body.code}`
      );
    } finally {
      await app.close();
    }

    // ═══ cria empresa DRAFT para provar invariantes ══════════════════════════
    const c1 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Tombstone Doc', role: 'owner', fetchFromRevenue: false, isPrimary: true },
      TENANT_ID
    );
    const companyId = c1.company.companyId;
    createdCompanyIds.push(companyId);

    const statusBefore = (await pool.query<{ s: string }>(`SELECT company_status AS s FROM companies WHERE company_id = $1`, [companyId])).rows[0]?.s ?? null;
    const kybBefore = (await pool.query<{ k: string | null }>(
      `SELECT fi.kyb_status AS k FROM companies c LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id WHERE c.company_id = $1`,
      [companyId]
    )).rows[0]?.k ?? null;
    const fidBefore = (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identity_documents`)).rows[0].n;

    // ═══ T2 — service throw, sem escrever ════════════════════════════════════
    let threw = false;
    let msg = '';
    try {
      await companiesService.uploadCompanyDocument(
        companyId,
        devGlobalUserId,
        { filename: 'x.pdf', filepath: '', mimetype: 'application/pdf', size: 100 },
        'cnpj_receita',
        '127.0.0.1',
        TENANT_ID
      );
    } catch (e) {
      threw = true;
      msg = (e as Error).message;
    }
    record('T2 uploadCompanyDocument throw PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED', threw && /PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED/.test(msg), msg.slice(0, 60));

    // ═══ T3/T4/T5 — invariantes inalterados ══════════════════════════════════
    const statusAfter = (await pool.query<{ s: string }>(`SELECT company_status AS s FROM companies WHERE company_id = $1`, [companyId])).rows[0]?.s ?? null;
    record('T3 company_status NÃO promovido (segue DRAFT)', statusBefore === 'DRAFT' && statusAfter === 'DRAFT', `antes=${statusBefore} depois=${statusAfter}`);

    const kybAfter = (await pool.query<{ k: string | null }>(
      `SELECT fi.kyb_status AS k FROM companies c LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id WHERE c.company_id = $1`,
      [companyId]
    )).rows[0]?.k ?? null;
    record('T4 kyb_status inalterado pelo caminho legado', kybBefore === kybAfter, `antes=${kybBefore} depois=${kybAfter}`);

    const fidAfter = (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identity_documents`)).rows[0].n;
    record('T5 fiscal_identity_documents intocado (SSOT não cresceu)', fidBefore === fidAfter, `antes=${fidBefore} depois=${fidAfter}`);

    // ═══ T6 — company_documents segue fantasma ═══════════════════════════════
    const ghost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.company_documents')::text AS r`)).rows[0].r;
    record('T6 company_documents inexistente (fantasma, nada gravado)', ghost === null, `to_regclass=${ghost}`);

  } finally {
    console.log('\n— cleanup —');
    const ids = createdCompanyIds;
    if (ids.length > 0) {
      for (const t of ['company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await deleteCompaniesAndFiscal(pool, "company_id = ANY($1::uuid[])", [ids]);
      const left = (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE company_id = ANY($1::uuid[])`, [ids])).rows[0].n;
      record('CLEANUP DEV intacto (companies de teste = 0)', left === '0', `restantes=${left}`);
    }
    await pool.end();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ Tombstone do upload legado de documento PJ — verde.');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
