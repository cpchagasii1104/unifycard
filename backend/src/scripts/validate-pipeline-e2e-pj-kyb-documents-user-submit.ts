/**
 * E2E — F-PJ-KYB-DOCUMENTS-USER-SUBMIT (DECISION-0112 §10 A4, autoria B / IA-DECISOES)
 *
 * Submissão documental KYB user-facing: autoria AUTH-DERIVED (ensureUserActor, NÃO actionContext) +
 * autoridade canManageCompany + validate(MIME+magic) → scan(clean-only) → storage(privado) → SSOT.
 *
 *   U1  actor autorizado submete PDF válido → linha em fiscal_identity_documents (status submitted)
 *   U2  fiscal_identity_id da linha = o da empresa
 *   U3  submitted_by_actor_id = ensureUserActor(req.user.userId).actor_id (auth-derived)
 *   U4  fileReference opaco (32 hex, sem path/filename)
 *   U5  file_hash = sha256(conteúdo)
 *   U6  MIME ok + magic ok passa; magic incompatível falha (sem linha)
 *   U7  MIME fora da allowlist falha; U8 vazio falha; U9 acima do limite falha
 *   U10 filename "../" não controla path (ref opaca; grava ok)
 *   U11 scan != clean (fake scanner infected) → NÃO grava no SSOT
 *   U12 actor sem autoridade (sem company_users) → 403
 *   U13 company inexistente → 404
 *   U14 company sem fiscal_identity_id → 422
 *   U15 submit não muda company_status; U16 não muda kyb_status
 *   U17 (estrutural) o serviço NÃO usa actionContext; usa ensureUserActor; não toca company_documents/Bank
 *
 * Base: tenant DEV + PF canônica. create→assert→delete por empresa (robusto ao anti-fraude). DEV intacto.
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { createHash } from 'crypto';
import { promises as fsp } from 'fs';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { submitKybDocument } from '../core/kyb-documents/kyb-document-submit.service';
import type { MalwareScanPort } from '../core/document-malware-scan/document-malware-scan.port';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
async function expectStatus(label: string, fn: () => Promise<unknown>, status: number, code?: string): Promise<void> {
  let s = 0; let c = '';
  try { await fn(); } catch (e) { s = (e as { statusCode?: number }).statusCode ?? -1; c = (e as { code?: string }).code ?? ''; }
  record(label, s === status && (!code || c === code), `status=${s} code=${c}`);
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
  const n: number[] = []; for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (b: number[]): number => { const w = b.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = b.reduce((a, d, i) => a + d * w[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(n); const d2 = dv([...n, d1]); return [...n, d1, d2].join('');
}
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n', 'ascii'), Buffer.from('x'.repeat(400), 'ascii')]);
const infectedScanner: MalwareScanPort = { async scanDocument() { return { status: 'infected', scanner: 'test-fake' }; } };

async function main(): Promise<void> {
  await bootstrap();
  const dev = await pool.query<{ user_id: string; global_user_id: string }>(
    `SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].user_id;
  const devGlobalUserId = dev.rows[0].global_user_id;
  const expectedActor = await ensureUserActor(TENANT_ID, devUserId);

  const fiscalIds: string[] = [];
  const companyIds: string[] = [];

  async function makeCompany(name: string): Promise<{ companyId: string; fiscalIdentityId: string }> {
    const c = await companiesService.createCompany(devGlobalUserId, { cnpj: validCnpj(), companyName: name, role: 'owner', fetchFromRevenue: false, isPrimary: false }, TENANT_ID);
    const companyId = c.company.companyId; companyIds.push(companyId);
    const fi = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f;
    if (fi) fiscalIds.push(fi);
    return { companyId, fiscalIdentityId: fi };
  }

  try {
    // ═══ Bloco principal (1 empresa) — U1..U11, U15..U17 ═════════════════════
    const A = await makeCompany('E2E KYB Submit A');
    const statusBefore = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [A.companyId])).rows[0].s;
    const kybBefore = (await pool.query<{ k: string | null }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1`, [A.fiscalIdentityId])).rows[0]?.k ?? null;

    const r = await submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf', originalFilename: 'cartao_cnpj.pdf' });
    const row = (await pool.query<{ fi: string; actor: string; st: string }>(
      `SELECT fiscal_identity_id::text fi, submitted_by_actor_id::text actor, document_status st FROM fiscal_identity_documents WHERE document_id=$1`, [r.documentId])).rows[0];
    record('U1 actor autorizado submete PDF válido → linha SSOT (submitted)', !!row && row.st === 'submitted', `st=${row?.st}`);
    record('U2 fiscal_identity_id da linha = o da empresa', row?.fi === A.fiscalIdentityId, `${row?.fi} vs ${A.fiscalIdentityId}`);
    record('U3 submitted_by_actor_id = ensureUserActor(userId) (auth-derived)', row?.actor === expectedActor.actor_id, `${row?.actor} vs ${expectedActor.actor_id}`);
    record('U4 fileReference opaco (32 hex)', /^[0-9a-f]{32}$/.test(r.fileReference), r.fileReference);
    record('U5 file_hash = sha256(conteúdo)', r.fileHash === createHash('sha256').update(PDF).digest('hex'));

    await expectStatus('U6 magic incompatível (pdf mime, buffer não-PDF) falha', () => submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: Buffer.from('NAO-EH-PDF '.repeat(20)), mimeType: 'application/pdf' }), 400, 'KYB_DOC_MAGIC_MISMATCH');
    await expectStatus('U7 MIME fora da allowlist falha', () => submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/x-msdownload' }), 400, 'KYB_DOC_MIME_NOT_ALLOWED');
    await expectStatus('U8 arquivo vazio falha', () => submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: Buffer.alloc(0), mimeType: 'application/pdf' }), 400, 'KYB_DOC_EMPTY_FILE');
    await expectStatus('U9 acima do limite falha', () => submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(11 * 1024 * 1024)]), mimeType: 'application/pdf' }), 400, 'KYB_DOC_TOO_LARGE');

    // U10 filename malicioso
    const r10 = await submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'articles_of_association', buffer: PDF, mimeType: 'application/pdf', originalFilename: '../../../etc/passwd' });
    record('U10 filename "../" não controla path (ref opaca, grava ok)', /^[0-9a-f]{32}$/.test(r10.fileReference) && !!r10.documentId);

    // U11 scan infected (fake) → NÃO grava
    const countBefore = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM fiscal_identity_documents WHERE fiscal_identity_id=$1`, [A.fiscalIdentityId])).rows[0].n;
    await expectStatus('U11a scan infected falha fechado', () => submitKybDocument({ tenantId: TENANT_ID, companyId: A.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf' }, { scanner: infectedScanner }), 422, 'KYB_DOC_SCAN_NOT_CLEAN');
    const countAfter = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM fiscal_identity_documents WHERE fiscal_identity_id=$1`, [A.fiscalIdentityId])).rows[0].n;
    record('U11b scan infected NÃO criou linha no SSOT', countBefore === countAfter, `${countBefore} vs ${countAfter}`);

    // U15/U16 lifecycle/kyb imóveis
    const statusAfter = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [A.companyId])).rows[0].s;
    record('U15 submit não muda company_status', statusBefore === statusAfter, `${statusBefore} vs ${statusAfter}`);
    const kybAfter = (await pool.query<{ k: string | null }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1`, [A.fiscalIdentityId])).rows[0]?.k ?? null;
    record('U16 submit não muda kyb_status', kybBefore === kybAfter, `${kybBefore} vs ${kybAfter}`);

    // ═══ U12 — sem autoridade (remove company_users do dev) ═══════════════════
    const B = await makeCompany('E2E KYB Submit B');
    await pool.query(`DELETE FROM company_users WHERE company_id=$1`, [B.companyId]);
    await expectStatus('U12 actor sem autoridade → 403', () => submitKybDocument({ tenantId: TENANT_ID, companyId: B.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf' }), 403, 'KYB_DOC_FORBIDDEN');

    // ═══ U13 — company inexistente ═══════════════════════════════════════════
    await expectStatus('U13 company inexistente → 404', () => submitKybDocument({ tenantId: TENANT_ID, companyId: '00000000-0000-0000-0000-0000000000cc', globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf' }), 404, 'KYB_DOC_COMPANY_NOT_FOUND');

    // ═══ U14 — company sem fiscal_identity_id ════════════════════════════════
    const C = await makeCompany('E2E KYB Submit C');
    await pool.query(`UPDATE companies SET fiscal_identity_id=NULL WHERE company_id=$1`, [C.companyId]);
    await expectStatus('U14 company sem fiscal_identity_id → 422', () => submitKybDocument({ tenantId: TENANT_ID, companyId: C.companyId, globalUserId: devGlobalUserId, userId: devUserId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf' }), 422, 'KYB_DOC_FISCAL_IDENTITY_MISSING');

    // ═══ U17 — estrutural ════════════════════════════════════════════════════
    const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const svc = stripComments(await fsp.readFile(join(process.cwd(), 'src/core/kyb-documents/kyb-document-submit.service.ts'), 'utf8'));
    const noActionContext = !svc.includes('actionContext');
    const usesEnsureUserActor = svc.includes('ensureUserActor');
    const noGhostNoBank = !svc.includes('company_documents') && !/\bbank_/.test(svc) && !svc.includes("UPDATE companies SET company_status") && !svc.includes('kyb_status');
    record('U17 serviço: sem actionContext, usa ensureUserActor, sem company_documents/Bank/status', noActionContext && usesEnsureUserActor && noGhostNoBank, `actCtx=${!noActionContext} ensure=${usesEnsureUserActor} clean=${noGhostNoBank}`);
  } finally {
    console.log('\n— cleanup —');
    if (fiscalIds.length > 0) await pool.query(`DELETE FROM fiscal_identity_documents WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
    if (companyIds.length > 0) {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [companyIds]); } catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [companyIds]);
      await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds]);
    }
    if (fiscalIds.length > 0) await pool.query(`DELETE FROM fiscal_identities WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
    const left = companyIds.length > 0 ? (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds])).rows[0].n : '0';
    record('CLEANUP DEV intacto (companies de teste = 0)', left === '0', `restantes=${left}`);
    await pool.end();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ Submit documental KYB user-facing (autoria B) — verde.');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
