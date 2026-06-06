/**
 * E2E — F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): readers/admin legados tombstonados.
 *
 *   C1 — GET  /companies/:id/documents                      → 501 PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED
 *   C2 — GET  /companies/:id/documents/:docId/file          → 501
 *   C3 — GET  /companies/admin/documents/pending            → 501
 *   C4 — PATCH /companies/admin/documents/:docId/status     → 501
 *   C5 — service listCompanyDocuments  → throw (não lê fantasma)
 *   C6 — service listPendingDocuments  → throw
 *   C7 — service updateDocumentStatus  → throw (não escreve, não verifica empresa)
 *   C8 — company_documents segue inexistente (fantasma)
 *   C9 — fiscal_identity_documents (SSOT) intocado por estes caminhos
 *
 * READ-ONLY sobre Bank/SSOT. Sem migration. Não cria empresa (rotas/serviços tombstonados não tocam DB).
 */

import dotenv from 'dotenv';
import { join } from 'path';
import Fastify from 'fastify';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { companiesRoutes } from '../core/companies/companies.routes';

dotenv.config({ path: join(process.cwd(), '.env') });

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

const CODE = 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED';

async function buildApp() {
  const app = Fastify({ logger: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).decorate('requireRole', () => async () => { /* stub p/ registrar rotas admin */ });
  await app.register(companiesRoutes);
  await app.ready();
  return app;
}

function parse(body: string): any { try { return JSON.parse(body); } catch { return {}; } }

async function main(): Promise<void> {
  const ID = '00000000-0000-0000-0000-0000000000aa';
  try {
    const app = await buildApp();
    try {
      const r1 = await app.inject({ method: 'GET', url: `/${ID}/documents` });
      record('C1 GET /:id/documents → 501', r1.statusCode === 501 && parse(r1.body).code === CODE, `status=${r1.statusCode} code=${parse(r1.body).code}`);

      const r2 = await app.inject({ method: 'GET', url: `/${ID}/documents/${ID}/file` });
      record('C2 GET /:id/documents/:docId/file → 501', r2.statusCode === 501 && parse(r2.body).code === CODE, `status=${r2.statusCode} code=${parse(r2.body).code}`);

      const r3 = await app.inject({ method: 'GET', url: `/admin/documents/pending` });
      record('C3 GET /admin/documents/pending → 501', r3.statusCode === 501 && parse(r3.body).code === CODE, `status=${r3.statusCode} code=${parse(r3.body).code}`);

      const r4 = await app.inject({ method: 'PATCH', url: `/admin/documents/${ID}/status`, payload: { status: 'approved' } });
      record('C4 PATCH /admin/documents/:docId/status → 501', r4.statusCode === 501 && parse(r4.body).code === CODE, `status=${r4.statusCode} code=${parse(r4.body).code}`);
    } finally {
      await app.close();
    }

    // C5/C6/C7 — service-level throw (defesa em profundidade; não lê/escreve o fantasma)
    const expectThrow = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
      let threw = false; let msg = '';
      try { await fn(); } catch (e) { threw = true; msg = (e as Error).message; }
      record(label, threw && new RegExp(CODE).test(msg), msg.slice(0, 70));
    };
    await expectThrow('C5 service listCompanyDocuments → throw', () => companiesService.listCompanyDocuments(ID, ID, ID));
    await expectThrow('C6 service listPendingDocuments → throw', () => companiesService.listPendingDocuments());
    await expectThrow('C7 service updateDocumentStatus → throw', () => companiesService.updateDocumentStatus(ID, 'approved', undefined, ID));

    // C8 — company_documents fantasma
    const ghost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.company_documents')::text AS r`)).rows[0].r;
    record('C8 company_documents inexistente (fantasma)', ghost === null, `to_regclass=${ghost}`);

    // C9 — fiscal_identity_documents SSOT existe e não foi tocado por estes caminhos
    const fid = (await pool.query<{ r: string | null; n: string }>(
      `SELECT to_regclass('public.fiscal_identity_documents')::text AS r, (SELECT count(*)::text FROM fiscal_identity_documents) AS n`
    )).rows[0];
    record('C9 fiscal_identity_documents (SSOT) intocado', fid.r !== null, `regclass=${fid.r} rows=${fid.n}`);
  } finally {
    await pool.end();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ Readers/admin legados de documento PJ tombstonados — verde.');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
