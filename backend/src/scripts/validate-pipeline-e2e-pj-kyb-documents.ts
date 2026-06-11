/**
 * E2E F2-B KYB DOCUMENTOS PJ (DECISION-0087) — SSOT documental + pré-condição de aprovação.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-kyb-documents-ephemeral.ps1.
 *
 * Prova: migration; submit/list/review/supersede; sem blob/metadata; tipo inválido; CHECK auditoria;
 * pré-condição de approved (min docs); rejected sem docs; rollback mantém pending; identities PF/Bank/
 * company_status intocados; docs de pessoa rejeitados como tipo; queue KYB funciona.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { fiscalIdentityKybService } from '../core/identity/fiscal-identity-kyb.service';
import { fiscalIdentityDocumentService } from '../core/identity/fiscal-identity-document.service';

// C1: hint inicial — o teste adota o tenant real do register orgânico.
let TENANT_ID = '33333333-4444-5555-6666-777777777777';
const EMAIL = 'kyb-docs@unificard.test';
const PASSWORD = '123456';
const CPF = '11144477735';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function randomCnpj14(): string { let s = ''; for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10); return s; }
async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> { try { await fn(); return false; } catch { return true; } }

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — F2-B NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|doc|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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

  // C1: register orgânico → tenant canônico; o teste ADOTA o tenant real do user.
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [EMAIL.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, EMAIL, PASSWORD, CPF, 'KYB Docs PF');
  }
  const u = await pool.query<{ user_id: string; tenant_id: string }>('SELECT user_id::text, tenant_id::text FROM users WHERE email=$1 LIMIT 1', [EMAIL.toLowerCase()]);
  TENANT_ID = u.rows[0].tenant_id;
  await rbacService.seedDefaultRBAC(TENANT_ID);
  const actor = await ensureUserActor(TENANT_ID, u.rows[0].user_id);
  await rbacService.assignRoleByName(TENANT_ID, u.rows[0].user_id, 'admin');
  const actorId = actor.actor_id;

  const bankBefore = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);

  async function newFiscal(): Promise<string> {
    const r = await pool.query<{ fiscal_identity_id: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id) VALUES ($1,'pending',$2::uuid) RETURNING fiscal_identity_id`, [randomCnpj14(), actorId]);
    return r.rows[0].fiscal_identity_id;
  }
  async function submitDoc(fid: string, type: string, ref = 'ref://opaque/' + Math.random().toString(36).slice(2)) {
    return fiscalIdentityDocumentService.submitFiscalIdentityDocument({ fiscalIdentityId: fid, documentType: type, fileReference: ref, submittedByActorId: actorId });
  }
  async function submitAndAccept(fid: string, type: string) {
    const d = await submitDoc(fid, type);
    await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(d.documentId, 'accepted', 'ok', actorId);
    return d.documentId;
  }
  const kybStatus = async (fid: string) => (await pool.query<{ s: string }>('SELECT kyb_status s FROM fiscal_identities WHERE fiscal_identity_id=$1', [fid])).rows[0].s;
  async function approveKyb(fid: string) {
    const sub = await fiscalIdentityKybService.submitFiscalKybRequest(fid, actorId);
    return fiscalIdentityKybService.reviewFiscalKybRequest(sub.kybRequestId, 'approved', 'kyb ok', actorId);
  }

  // ═══ 1 — MIGRATION SCHEMA ═══
  console.log('\n— 1 migration —');
  const hasTable = (await pool.query(`SELECT to_regclass('public.fiscal_identity_documents') IS NOT NULL x`)).rows[0].x;
  const consN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_constraint WHERE conname IN ('fk_fidoc_fiscal_identity','fk_fidoc_kyb_request','fk_fidoc_submitted_by_actor','fk_fidoc_reviewed_by_actor','fk_fidoc_supersedes','chk_fidoc_status','chk_fidoc_type','chk_fidoc_final_audit')`)).rows[0].n;
  const idxN = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM pg_indexes WHERE tablename='fiscal_identity_documents' AND indexname IN ('idx_fidoc_fiscal_identity','idx_fidoc_kyb_request','idx_fidoc_type','idx_fidoc_status')`)).rows[0].n;
  record('1a tabela fiscal_identity_documents existe', hasTable === true);
  record('1b constraints (8) + índices (4)', consN === '8' && idxN === '4', `cons=${consN}/8 idx=${idxN}/4`);

  // ═══ 7 — SEM blob/metadata ═══
  const badCols = (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM information_schema.columns WHERE table_name='fiscal_identity_documents' AND column_name IN ('metadata','blob','file_data','file_blob','base64')`)).rows[0].n;
  record('7 sem coluna metadata/blob/file_data', badCols === '0');

  // ═══ 2/3 — SUBMIT + LIST ═══
  console.log('\n— 2/3 submit/list —');
  const f1 = await newFiscal();
  const d1 = await submitDoc(f1, 'cnpj_registration');
  record('2 submit documento (status submitted, fileReference opaco)', d1.documentStatus === 'submitted' && d1.fileReference.startsWith('ref://'));
  await submitDoc(f1, 'business_address_proof');
  const list = await fiscalIdentityDocumentService.listFiscalIdentityDocuments(f1);
  record('3 lista documentos por fiscal_identity_id', list.length === 2 && list.every(d => d.fiscalIdentityId === f1));

  // ═══ 4/5 — REVIEW accepted/rejected ═══
  console.log('\n— 4/5/6 review/supersede —');
  const rAcc = await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(d1.documentId, 'accepted', 'doc ok', actorId);
  record('4 review accepted + auditoria', rAcc.documentStatus === 'accepted' && rAcc.reviewedByActorId === actorId && rAcc.reviewedAt != null && rAcc.decisionReason === 'doc ok');
  const dRej = await submitDoc(f1, 'complementary_document');
  const rRej = await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(dRej.documentId, 'rejected', 'ilegível', actorId);
  record('5 review rejected (não some, recebe reason)', rRej.documentStatus === 'rejected' && rRej.decisionReason === 'ilegível');

  // ═══ 6 — SUPERSEDE ═══
  const dOld = await submitDoc(f1, 'articles_of_association', 'ref://v1');
  const sup = await fiscalIdentityDocumentService.supersedeFiscalIdentityDocument(dOld.documentId, 'ref://v2', 'hash2', actorId);
  record('6 supersede: nova versão submitted + anterior superseded (trilha)', sup.created.documentStatus === 'submitted' && sup.created.supersedesDocumentId === dOld.documentId && sup.superseded.documentStatus === 'superseded' && sup.created.fileReference === 'ref://v2');

  // ═══ 8 — TIPO INVÁLIDO ═══
  console.log('\n— 8/9/19 validações —');
  const badType = await expectThrow(() => submitDoc(f1, 'random_type'));
  record('8 tipo inválido bloqueado', badType);

  // ═══ 9 — CHECK auditoria-no-final (DB barra status final sem reviewer) ═══
  const dSub = await submitDoc(f1, 'complementary_document');
  const chk = await expectThrow(() => pool.query(`UPDATE fiscal_identity_documents SET document_status='accepted' WHERE document_id=$1::uuid`, [dSub.documentId]));
  record('9 CHECK barra status final sem reviewer/reviewed_at/reason', chk);

  // ═══ 19 — DOCS DE PESSOA não aceitos como tipo ═══
  const personTypes = ['power_of_attorney', 'legal_representative_document', 'partner_document', 'administrator_document'];
  let allPersonRejected = true;
  for (const t of personTypes) { if (!(await expectThrow(() => submitDoc(f1, t)))) allPersonRejected = false; }
  record('19 docs de pessoa (procuração/sócio/...) rejeitados como document_type', allPersonRejected);

  // ═══ 10/11/12/13/14 — PRÉ-CONDIÇÃO DE APROVAÇÃO KYB ═══
  console.log('\n— 10..14 pré-condição approved —');
  const fNone = await newFiscal();
  const t10 = await expectThrow(() => approveKyb(fNone));
  record('10 approved sem docs mínimos falha; kyb_status pending', t10 && (await kybStatus(fNone)) === 'pending');

  const fCnpjOnly = await newFiscal(); await submitAndAccept(fCnpjOnly, 'cnpj_registration');
  const t11 = await expectThrow(() => approveKyb(fCnpjOnly));
  record('11 approved só com cnpj_registration falha; pending', t11 && (await kybStatus(fCnpjOnly)) === 'pending');

  const fArtOnly = await newFiscal(); await submitAndAccept(fArtOnly, 'articles_of_association');
  const t12 = await expectThrow(() => approveKyb(fArtOnly));
  record('12 approved só com articles_of_association falha; pending', t12 && (await kybStatus(fArtOnly)) === 'pending');

  const fBoth = await newFiscal();
  await submitAndAccept(fBoth, 'cnpj_registration'); await submitAndAccept(fBoth, 'articles_of_association');
  const ok13 = await approveKyb(fBoth);
  record('13 approved com ambos aceitos PASSA; kyb_status approved', ok13.status === 'approved' && (await kybStatus(fBoth)) === 'approved');

  const fRej = await newFiscal();
  const subRej = await fiscalIdentityKybService.submitFiscalKybRequest(fRej, actorId);
  const ok14 = await fiscalIdentityKybService.reviewFiscalKybRequest(subRej.kybRequestId, 'rejected', 'sem docs', actorId);
  record('14 rejected KYB sem docs mínimos PASSA; kyb_status rejected', ok14.status === 'rejected' && (await kybStatus(fRej)) === 'rejected');

  // ═══ 15 — falha na pré-condição mantém request E kyb_status pending (atomicidade) ═══
  const f15 = await newFiscal();
  const sub15 = await fiscalIdentityKybService.submitFiscalKybRequest(f15, actorId);
  await expectThrow(() => fiscalIdentityKybService.reviewFiscalKybRequest(sub15.kybRequestId, 'approved', 'x', actorId));
  const req15 = (await pool.query<{ s: string }>('SELECT status s FROM fiscal_identity_kyb_requests WHERE kyb_request_id=$1', [sub15.kybRequestId])).rows[0].s;
  record('15 pré-condição falha → request pending + kyb_status pending (rollback)', req15 === 'pending' && (await kybStatus(f15)) === 'pending');

  // ═══ 16/17/18/20 — FRONTEIRAS ═══
  console.log('\n— 16/17/18/20 fronteiras —');
  record('16 identities PF intacta (0 cnpj)', (await pool.query<{ n: string }>(`SELECT count(*)::text n FROM identities WHERE tax_id_type='cnpj'`)).rows[0].n === '0');
  const bankAfter = await pool.query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`).then(r => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('17 zero escrita em bank_*', bankBefore >= 0 && bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  record('18 companies intocadas (fluxo doc/KYB não toca companies)', (await pool.query<{ n: string }>('SELECT count(*)::text n FROM companies')).rows[0].n === '0');
  const q = await fiscalIdentityKybService.getFiscalKybQueue('approved');
  record('20 queue KYB funciona (lista approved)', q.every(r => r.status === 'approved') && q.some(r => r.fiscalIdentityId === fBoth));

  // ── Resumo ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(68)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ F2-B KYB documentos: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
