/**
 * E2E — F-PJ-KYB-RELEASE-GATE (DECISION-0112 §3.10 / 0087 / 0088)
 *
 * Prova que `reviewFiscalKybRequest('approved')` SÓ aprova com lastro documental mínimo:
 * cnpj_registration + articles_of_association ambos `document_status='accepted'` na MESMA fiscal_identity.
 * O gate é fail-closed (rollback total se faltar). Aprovação altera `fiscal_identities.kyb_status`,
 * NÃO `companies.company_status`, NÃO Bank, NÃO ACTIVE. (O gate já existia; esta fatia o PROVA.)
 *
 *   R1 approve com 0 docs aceitos → falha (KYB_APPROVAL_REQUIRES_DOCUMENTS); kyb segue pending
 *   R2 approve com só cnpj_registration aceito → falha
 *   R3 approve com cnpj aceito + articles SUBMITTED (não aceito) → falha (submitted não conta)
 *   R4 approve com ambos aceitos → SUCESSO; kyb_status='approved'
 *   R5 approval NÃO muda company_status
 *   R6 só articles_of_association aceito (outra empresa) → falha
 *   R7 reject de KYB não exige docs; kyb_status='rejected'
 *   R8 (estrutural) kyb service não toca company_status/Bank; revoke writer existe
 *
 * Base: tenant DEV. create→prova→delete por empresa. DEV intacto.
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { promises as fsp } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { fiscalIdentityDocumentService } from '../core/identity/fiscal-identity-document.service';
import { fiscalIdentityKybService } from '../core/identity/fiscal-identity-kyb.service';

dotenv.config({ path: join(process.cwd(), '.env') });
const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); }
async function expectThrow(label: string, fn: () => Promise<unknown>, re: RegExp): Promise<void> { let m = ''; try { await fn(); } catch (e) { m = (e as Error).message; } record(label, re.test(m), m.slice(0, 70)); }

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter); socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(a.socialRepositoryAdapter); socialPortsRegistry.setSocialService(a.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(a.eventFeedHandlersAdapter);
}
function validCnpj(): string { const n: number[] = []; for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10)); const dv = (b: number[]): number => { const w = b.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = b.reduce((x, d, i) => x + d * w[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; }; const d1 = dv(n); const d2 = dv([...n, d1]); return [...n, d1, d2].join(''); }

async function main(): Promise<void> {
  await bootstrap();
  const dev = await pool.query<{ user_id: string; global_user_id: string }>(`SELECT user_id::text, global_user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const actor = await ensureUserActor(TENANT_ID, dev.rows[0].user_id);
  const devGlobalUserId = dev.rows[0].global_user_id;

  const companyIds: string[] = []; const fiscalIds: string[] = [];
  async function makeCompany(name: string): Promise<{ companyId: string; fiscalIdentityId: string }> {
    const c = await companiesService.createCompany(devGlobalUserId, { cnpj: validCnpj(), companyName: name, role: 'owner', fetchFromRevenue: false, isPrimary: false }, TENANT_ID);
    const companyId = c.company.companyId; companyIds.push(companyId);
    const fid = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f; fiscalIds.push(fid);
    return { companyId, fiscalIdentityId: fid };
  }
  async function submitDoc(fid: string, type: string): Promise<string> {
    const d = await fiscalIdentityDocumentService.submitFiscalIdentityDocument({ fiscalIdentityId: fid, documentType: type, fileReference: randomUUID().replace(/-/g, ''), fileHash: 'h'.repeat(64), submittedByActorId: actor.actor_id });
    return d.documentId;
  }
  const accept = (docId: string) => fiscalIdentityDocumentService.reviewFiscalIdentityDocument(docId, 'accepted', 'ok', actor.actor_id);
  const kybOf = async (fid: string): Promise<string> => (await pool.query<{ k: string }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1`, [fid])).rows[0].k;

  try {
    // ═══ Empresa A — R1..R5 (mesma request; rollback mantém pending) ═════════
    const A = await makeCompany('E2E KYB Gate A');
    const compStatusBefore = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [A.companyId])).rows[0].s;
    const reqA = await fiscalIdentityKybService.submitFiscalKybRequest(A.fiscalIdentityId, actor.actor_id);

    await expectThrow('R1 approve com 0 docs aceitos → falha', () => fiscalIdentityKybService.reviewFiscalKybRequest(reqA.kybRequestId, 'approved', 'aprovado', actor.actor_id), /KYB_APPROVAL_REQUIRES_DOCUMENTS/);
    record('R1b kyb segue pending após falha', (await kybOf(A.fiscalIdentityId)) === 'pending');

    const cnpjDoc = await submitDoc(A.fiscalIdentityId, 'cnpj_registration'); await accept(cnpjDoc);
    await expectThrow('R2 approve com só cnpj aceito → falha', () => fiscalIdentityKybService.reviewFiscalKybRequest(reqA.kybRequestId, 'approved', 'aprovado', actor.actor_id), /KYB_APPROVAL_REQUIRES_DOCUMENTS/);

    const artDoc = await submitDoc(A.fiscalIdentityId, 'articles_of_association'); // SUBMITTED, não aceito
    await expectThrow('R3 cnpj aceito + articles SUBMITTED → falha (submitted não conta)', () => fiscalIdentityKybService.reviewFiscalKybRequest(reqA.kybRequestId, 'approved', 'aprovado', actor.actor_id), /KYB_APPROVAL_REQUIRES_DOCUMENTS/);

    await accept(artDoc);
    const approved = await fiscalIdentityKybService.reviewFiscalKybRequest(reqA.kybRequestId, 'approved', 'docs conferem', actor.actor_id);
    record('R4 approve com ambos aceitos → SUCESSO (kyb approved)', approved.status === 'approved' && (await kybOf(A.fiscalIdentityId)) === 'approved');

    const compStatusAfter = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1`, [A.companyId])).rows[0].s;
    record('R5 approval NÃO muda company_status', compStatusBefore === compStatusAfter, `${compStatusBefore} vs ${compStatusAfter}`);

    // ═══ Empresa B — R6 (só articles aceito) ═════════════════════════════════
    const B = await makeCompany('E2E KYB Gate B');
    const reqB = await fiscalIdentityKybService.submitFiscalKybRequest(B.fiscalIdentityId, actor.actor_id);
    await accept(await submitDoc(B.fiscalIdentityId, 'articles_of_association'));
    await expectThrow('R6 só articles aceito → falha', () => fiscalIdentityKybService.reviewFiscalKybRequest(reqB.kybRequestId, 'approved', 'aprovado', actor.actor_id), /KYB_APPROVAL_REQUIRES_DOCUMENTS/);

    // ═══ Empresa C — R7 (reject não exige docs) ══════════════════════════════
    const C = await makeCompany('E2E KYB Gate C');
    const reqC = await fiscalIdentityKybService.submitFiscalKybRequest(C.fiscalIdentityId, actor.actor_id);
    const rejected = await fiscalIdentityKybService.reviewFiscalKybRequest(reqC.kybRequestId, 'rejected', 'documentação insuficiente', actor.actor_id);
    record('R7 reject KYB não exige docs (kyb rejected)', rejected.status === 'rejected' && (await kybOf(C.fiscalIdentityId)) === 'rejected');

    // ═══ R8 estrutural ═══════════════════════════════════════════════════════
    const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const kybSrc = stripComments(await fsp.readFile(join(process.cwd(), 'src/core/identity/fiscal-identity-kyb.service.ts'), 'utf8'));
    const noCompanyStatus = !/\bcompany_status\b/.test(kybSrc);
    const noBank = !/\bbank_/.test(kybSrc);
    const hasRevoke = typeof fiscalIdentityKybService.revokeFiscalKybApproval === 'function';
    record('R8 kyb service não toca company_status/Bank + revoke writer existe', noCompanyStatus && noBank && hasRevoke, `compStatus=${!noCompanyStatus} bank=${!noBank} revoke=${hasRevoke}`);
  } finally {
    console.log('\n— cleanup —');
    if (fiscalIds.length) { await pool.query(`DELETE FROM fiscal_identity_documents WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]); await pool.query(`DELETE FROM fiscal_identity_kyb_requests WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]); }
    if (companyIds.length) {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) { try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [companyIds]); } catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); } }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [companyIds]);
      await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds]);
    }
    if (fiscalIds.length) await pool.query(`DELETE FROM fiscal_identities WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
    const left = companyIds.length ? (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM companies WHERE company_id = ANY($1::uuid[])`, [companyIds])).rows[0].n : '0';
    record('CLEANUP DEV intacto (companies de teste = 0)', left === '0', `restantes=${left}`);
    await pool.end();
  }

  const passed = results.filter((r) => r.ok).length; const total = results.length;
  console.log('\n' + '═'.repeat(60)); console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ Release gate KYB (aprovação só com lastro documental) — verde.');
  process.exit(passed === total ? 0 : 1);
}
main().catch((e) => { console.error('💥', e); process.exit(1); });
