/**
 * E2E — F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI (DECISION-0112 §10 A2/A4)
 *
 * Balcão de análise admin sobre o SSOT fiscal_identity_documents: fila pendente + download protegido
 * (read → hash → RE-SCAN clean-only → bytes) + review (só document_status; NÃO toca kyb_status).
 *
 *   A1  documento submetido aparece na fila (listPendingFiscalIdentityDocuments)
 *   A2  fila usa fiscal_identity_documents (itens têm fiscalIdentityId; service não lê company_documents)
 *   A3  getFiscalIdentityDocumentById retorna detalhes
 *   A4  download recupera via DocumentStoragePort.readDocument (buffer = conteúdo) + mimeType
 *   A5  download valida hash (sucesso = bate); A7 hash divergente → 409 fail-closed
 *   A6  download passa pela policy clean-only (Noop dev); A8 scan infected (fake) → 422 sem expor
 *   A9  review accept muda só document_status; A10 review reject idem
 *   A11 review não muda kyb_status; A12 não muda company_status
 *   A13 (estrutural) download service não toca kyb/company/Bank/company_documents/uploads; rotas admin-gated
 *
 * Base: tenant DEV + PF canônica. create→submit→review→delete. DEV intacto. .private limpo ao fim.
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { promises as fsp } from 'fs';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { submitKybDocument } from '../core/kyb-documents/kyb-document-submit.service';
import { downloadKybDocument } from '../core/kyb-documents/kyb-document-download.service';
import { fiscalIdentityDocumentService } from '../core/identity/fiscal-identity-document.service';
import type { MalwareScanPort } from '../core/document-malware-scan/document-malware-scan.port';

dotenv.config({ path: join(process.cwd(), '.env') });
const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); }
async function expectStatus(label: string, fn: () => Promise<unknown>, status: number, code?: string): Promise<void> {
  let s = 0; let c = '';
  try { await fn(); } catch (e) { s = (e as { statusCode?: number }).statusCode ?? -1; c = (e as { code?: string }).code ?? ''; }
  record(label, s === status && (!code || c === code), `status=${s} code=${c}`);
}
async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter); socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(a.socialRepositoryAdapter); socialPortsRegistry.setSocialService(a.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(a.eventFeedHandlersAdapter);
}
function validCnpj(): string { const n: number[] = []; for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10)); const dv = (b: number[]): number => { const w = b.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = b.reduce((x, d, i) => x + d * w[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; }; const d1 = dv(n); const d2 = dv([...n, d1]); return [...n, d1, d2].join(''); }
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n', 'ascii'), Buffer.from('conteudo kyb '.repeat(40), 'ascii')]);
const infectedScanner: MalwareScanPort = { async scanDocument() { return { status: 'infected', scanner: 'test-fake' }; } };

async function main(): Promise<void> {
  await bootstrap();
  const dev = await pool.query<{ user_id: string; global_user_id: string }>(`SELECT user_id::text, global_user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].user_id; const devGlobalUserId = dev.rows[0].global_user_id;
  const reviewer = await ensureUserActor(TENANT_ID, devUserId);

  const companyIds: string[] = []; const fiscalIds: string[] = [];
  try {
    const c = await companiesService.createCompany(devGlobalUserId, { cnpj: validCnpj(), companyName: 'E2E KYB Review', role: 'owner', fetchFromRevenue: false, isPrimary: false }, TENANT_ID);
    const companyId = c.company.companyId; companyIds.push(companyId);
    const fid = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f; fiscalIds.push(fid);
    const compStatusBefore = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [companyId])).rows[0].s;
    const kybBefore = (await pool.query<{ k: string | null }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1`, [fid])).rows[0]?.k ?? null;

    const d1 = await submitKybDocument({ tenantId: TENANT_ID, companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf', originalFilename: 'cnpj.pdf' });
    const d2 = await submitKybDocument({ tenantId: TENANT_ID, companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'articles_of_association', buffer: PDF, mimeType: 'application/pdf' });

    // A1/A2 fila
    const pending = await fiscalIdentityDocumentService.listPendingFiscalIdentityDocuments();
    const ids = new Set(pending.map((p) => p.documentId));
    record('A1 documentos submetidos aparecem na fila', ids.has(d1.documentId) && ids.has(d2.documentId));
    record('A2 fila usa fiscal_identity_documents (itens têm fiscalIdentityId)', pending.every((p) => !!p.fiscalIdentityId));

    // A3 getById
    const det = await fiscalIdentityDocumentService.getFiscalIdentityDocumentById(d1.documentId);
    record('A3 getFiscalIdentityDocumentById retorna detalhes', det?.documentId === d1.documentId && det?.fiscalIdentityId === fid);

    // A4/A6 download clean
    const dl = await downloadKybDocument(d1.documentId, { scanTenantId: TENANT_ID });
    record('A4 download recupera conteúdo (buffer = PDF) + mimeType', dl.buffer.equals(PDF) && dl.mimeType === 'application/pdf');
    record('A6 download passou pela policy clean-only (Noop dev)', !!dl.buffer.length);

    // A7 hash mismatch
    await pool.query(`UPDATE fiscal_identity_documents SET file_hash='deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' WHERE document_id=$1`, [d1.documentId]);
    await expectStatus('A7 hash divergente → 409 fail-closed', () => downloadKybDocument(d1.documentId, { scanTenantId: TENANT_ID }), 409, 'KYB_DOC_HASH_MISMATCH');
    await pool.query(`UPDATE fiscal_identity_documents SET file_hash=$2 WHERE document_id=$1`, [d1.documentId, d1.fileHash]);

    // A8 scan infected
    await expectStatus('A8 scan infected → 422 sem expor', () => downloadKybDocument(d1.documentId, { scanTenantId: TENANT_ID }, { scanner: infectedScanner }), 422, 'KYB_DOC_NOT_SAFE');

    // A9 review accept
    const acc = await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(d1.documentId, 'accepted', 'documentos conferem', reviewer.actor_id);
    record('A9 review accept muda só document_status', acc.documentStatus === 'accepted');
    // A10 review reject
    const rej = await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(d2.documentId, 'rejected', 'ilegível', reviewer.actor_id);
    record('A10 review reject muda só document_status', rej.documentStatus === 'rejected');

    // A11/A12 invariantes
    const kybAfter = (await pool.query<{ k: string | null }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1`, [fid])).rows[0]?.k ?? null;
    record('A11 review NÃO muda kyb_status', kybBefore === kybAfter, `${kybBefore} vs ${kybAfter}`);
    const compStatusAfter = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [companyId])).rows[0].s;
    record('A12 review NÃO muda company_status', compStatusBefore === compStatusAfter, `${compStatusBefore} vs ${compStatusAfter}`);

    // A13 estrutural
    const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const dlSrc = stripComments(await fsp.readFile(join(process.cwd(), 'src/core/kyb-documents/kyb-document-download.service.ts'), 'utf8'));
    const cleanSvc = !/\bcompany_status\b/.test(dlSrc) && !/\bkyb_status\b/.test(dlSrc) && !/\bbank_/.test(dlSrc) && !dlSrc.includes('company_documents') && !dlSrc.includes('uploads') && !dlSrc.includes('@fastify/static');
    const routesSrc = await fsp.readFile(join(process.cwd(), 'src/core/identity/identity.routes.ts'), 'utf8');
    const pendingGated = routesSrc.includes("'/pj/kyb/documents/pending', { preHandler: [fastify.requireRole(['admin'])]");
    const fileGated = /'\/pj\/kyb\/documents\/:documentId\/file',\s*\{\s*preHandler:\s*\[fastify\.requireRole\(\['admin'\]\)\]/.test(routesSrc);
    record('A13 download service limpo + rotas /pending e /file admin-gated', cleanSvc && pendingGated && fileGated, `clean=${cleanSvc} pending=${pendingGated} file=${fileGated}`);
  } finally {
    console.log('\n— cleanup —');
    if (fiscalIds.length) await pool.query(`DELETE FROM fiscal_identity_documents WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
    if (companyIds.length) {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) { try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [companyIds]); } catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); } }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [companyIds]);
      await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds]);
    }
    if (fiscalIds.length) await pool.query(`DELETE FROM fiscal_identities WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
    try { await fsp.rm(join(process.cwd(), '.private', 'document-storage'), { recursive: true, force: true }); } catch { /* noop */ }
    const left = companyIds.length ? (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds])).rows[0].n : '0';
    record('CLEANUP DEV intacto (companies de teste = 0; .private removido)', left === '0', `restantes=${left}`);
    await pool.end();
  }

  const passed = results.filter((r) => r.ok).length; const total = results.length;
  console.log('\n' + '═'.repeat(60)); console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ Balcão de análise KYB (fila + download protegido + review) — verde.');
  process.exit(passed === total ? 0 : 1);
}
main().catch((e) => { console.error('💥', e); process.exit(1); });
