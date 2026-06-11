/**
 * E2E CP2 F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE — lifecycle KYB do FUNDADOR (HTTP real).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-kyb-founder-lifecycle-ephemeral.ps1.
 *
 * Prova (PJ-B1 + PJ-B2 + 8.4):
 *   - fundador NÃO consegue pedir análise sem documentos mínimos (422);
 *   - fundador (canManageCompany) abre a request user-facing (201); membro sem manage → 403;
 *     não-membro → 403/404; segunda request → 409 (1 pending por fiscal);
 *   - fundador NÃO acessa o backoffice (queue/review/revoke = admin-only, 403);
 *   - admin: fila → download protegido → accept/reject documental → gate §3.10 (aprovar sem docs
 *     aceitos = bloqueado) → aprovação flip kyb_status (atômico) → revogação HTTP (0101);
 *   - REENVIO pós-rejeição (contrato GO §3.1/8.4): rejected → nova request → aprovável; histórico
 *     preservado (nenhuma request reaproveitada/apagada);
 *   - zero Bank writer na jornada inteira.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const PDF = Buffer.from('%PDF-1.4\n%e2e kyb founder lifecycle\n%%EOF\n');

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|founder|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  const identityModule = (await import('../core/identity/identity.routes')).default;
  await app.register(identityModule, { prefix: '/identity' });
  await app.ready();
  return app;
}

function makeValidCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const calc = (nums: string): number => {
    const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base);
  const d2 = calc(base + String(d1));
  return base + String(d1) + String(d2);
}

interface Human { globalId: string; userId: string; actorId: string; headers: Record<string, string> }

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ KYB Founder Test', slug: `pj-kyb-founder-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string, role?: 'admin'): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actor = await actorRepo.findOrCreateUserActor(TENANT_ID, userId);
    if (role === 'admin') await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId: actor.actor_id, intent: 'pj_kyb_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId: actor.actor_id, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const F = await mkHuman('E2E KYB Founder');
  const M = await mkHuman('E2E KYB Member');
  const N = await mkHuman('E2E KYB Outsider');
  const A = await mkHuman('E2E KYB Reviewer', 'admin');

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<{ companyId: string; fiscalIdentityId: string }> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    const companyId = r.json().company.companyId as string;
    const fi = await pool.query<{ fid: string }>(`SELECT fiscal_identity_id::text AS fid FROM companies WHERE company_id=$1::uuid`, [companyId]);
    return { companyId, fiscalIdentityId: fi.rows[0].fid };
  };

  const uploadDocs = async (h: Human, companyId: string): Promise<void> => {
    const { submitKybDocument } = await import('../core/kyb-documents/kyb-document-submit.service');
    for (const documentType of ['cnpj_registration', 'articles_of_association']) {
      await submitKybDocument({
        tenantId: TENANT_ID, companyId, globalUserId: h.globalId, userId: h.userId,
        documentType, buffer: PDF, mimeType: 'application/pdf', originalFilename: `${documentType}.pdf`,
      });
    }
  };

  const bank0 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`);

  try {
    const EX = await createCompany(F, 70000001, 'E2E KYB Co A');

    // S1 — pedir análise SEM documentos → 422
    const s1 = await app.inject({ method: 'POST', url: `/companies/${EX.companyId}/kyb/requests`, headers: F.headers, payload: {} });
    record('S1 request sem documentos → 422 KYB_REQUEST_REQUIRES_DOCUMENTS', s1.statusCode === 422 && s1.json()?.code === 'KYB_REQUEST_REQUIRES_DOCUMENTS', `status=${s1.statusCode} body=${s1.body}`);

    // S2 — upload dos 2 documentos mínimos (fluxo canônico)
    await uploadDocs(F, EX.companyId);
    record('S2 documentos mínimos enviados (submitted)', true);

    // S3 — membro SEM manage → 403
    await pool.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1,$2,$3,'member',false,true,'active')`,
      [TENANT_ID, EX.companyId, M.globalId]
    );
    const s3 = await app.inject({ method: 'POST', url: `/companies/${EX.companyId}/kyb/requests`, headers: M.headers, payload: {} });
    record('S3 membro sem manage → 403 KYB_REQUEST_FORBIDDEN', s3.statusCode === 403 && s3.json()?.code === 'KYB_REQUEST_FORBIDDEN', `status=${s3.statusCode}`);

    // S4 — não-membro → 403
    const s4 = await app.inject({ method: 'POST', url: `/companies/${EX.companyId}/kyb/requests`, headers: N.headers, payload: {} });
    record('S4 não-membro → 403', s4.statusCode === 403, `status=${s4.statusCode}`);

    // S5 — fundador abre a request → 201 pending, autoria = actor do fundador
    const s5 = await app.inject({ method: 'POST', url: `/companies/${EX.companyId}/kyb/requests`, headers: F.headers, payload: { reason: 'onboarding' } });
    const req1 = s5.json()?.data;
    record('S5 fundador abre request → 201 pending', s5.statusCode === 201 && req1?.status === 'pending', `status=${s5.statusCode} body=${s5.body}`);
    record('S5 submitted_by = actor humano do fundador (auth-derived)', req1?.submittedByActorId === F.actorId, `${req1?.submittedByActorId} vs ${F.actorId}`);

    // S6 — superfície de status do fundador
    const s6 = await app.inject({ method: 'GET', url: `/companies/${EX.companyId}/kyb/status`, headers: F.headers });
    const st6 = s6.json()?.data;
    record('S6 status: kyb pending + 1 request + 2 docs', s6.statusCode === 200 && st6?.kybStatus === 'pending' && st6?.requests?.length === 1 && st6?.documents?.length === 2, `status=${s6.statusCode} body=${s6.body}`);

    // S7 — segunda request → 409 (1 pending por fiscal)
    const s7 = await app.inject({ method: 'POST', url: `/companies/${EX.companyId}/kyb/requests`, headers: F.headers, payload: {} });
    record('S7 segunda request → 409 ALREADY_PENDING', s7.statusCode === 409 && s7.json()?.code === 'KYB_REQUEST_ALREADY_PENDING', `status=${s7.statusCode}`);

    // S8/S9 — fundador NÃO acessa o backoffice
    const s8 = await app.inject({ method: 'GET', url: '/identity/pj/kyb/admin/queue', headers: F.headers });
    record('S8 fundador na fila admin → 403', s8.statusCode === 403, `status=${s8.statusCode}`);
    const docRows = await pool.query<{ id: string }>(`SELECT document_id::text AS id FROM fiscal_identity_documents WHERE fiscal_identity_id=$1::uuid ORDER BY created_at`, [EX.fiscalIdentityId]);
    const s9 = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/documents/${docRows.rows[0].id}/review`, headers: F.headers, payload: { decision: 'accepted', reason: 'self' } });
    record('S9 fundador revisando documento → 403 (não é reviewer)', s9.statusCode === 403, `status=${s9.statusCode}`);

    // S10 — admin vê a fila
    const s10 = await app.inject({ method: 'GET', url: '/identity/pj/kyb/admin/queue?status=pending', headers: A.headers });
    const queue = s10.json()?.data ?? [];
    record('S10 admin vê a request na fila', s10.statusCode === 200 && queue.some((q: { kybRequestId: string }) => q.kybRequestId === req1.kybRequestId), `n=${queue.length}`);

    // S11 — aprovar ANTES dos docs aceitos → bloqueado (gate §3.10)
    const s11 = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${req1.kybRequestId}/review`, headers: A.headers, payload: { decision: 'approved', reason: 'tentativa precoce' } });
    record('S11 aprovar sem docs aceitos → bloqueado (KYB_APPROVAL_REQUIRES_DOCUMENTS)', s11.statusCode === 400 && /KYB_APPROVAL_REQUIRES_DOCUMENTS/.test(s11.body), `status=${s11.statusCode}`);

    // S12 — download protegido (admin)
    const s12 = await app.inject({ method: 'GET', url: `/identity/pj/kyb/documents/${docRows.rows[0].id}/file`, headers: A.headers });
    record('S12 download protegido admin → 200 + bytes', s12.statusCode === 200 && s12.rawPayload.length > 0, `status=${s12.statusCode} bytes=${s12.rawPayload.length}`);

    // S13 — admin aceita os 2 documentos
    for (const d of docRows.rows) {
      const rr = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/documents/${d.id}/review`, headers: A.headers, payload: { decision: 'accepted', reason: 'documento legível e válido' } });
      if (rr.statusCode !== 200) throw new Error(`accept doc falhou: ${rr.statusCode} ${rr.body}`);
    }
    record('S13 admin aceita os documentos mínimos', true);

    // S14 — admin aprova; fonte fiscal flip atômico
    const s14 = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${req1.kybRequestId}/review`, headers: A.headers, payload: { decision: 'approved', reason: 'lastro documental completo' } });
    const fiAfter = await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [EX.fiscalIdentityId]);
    record('S14 aprovação → kyb_status=approved (fonte)', s14.statusCode === 200 && fiAfter.rows[0].k === 'approved', `status=${s14.statusCode} kyb=${fiAfter.rows[0].k}`);
    const s14b = await app.inject({ method: 'GET', url: `/companies/${EX.companyId}/kyb/status`, headers: F.headers });
    record('S14 fundador vê approved na superfície de status', s14b.json()?.data?.kybStatus === 'approved');

    // S15 — fundador NÃO revoga (admin-only)
    const s15 = await app.inject({ method: 'POST', url: `/identity/pj/kyb/admin/fiscal-identities/${EX.fiscalIdentityId}/revoke`, headers: F.headers, payload: { newStatus: 'suspended', reason: 'self' } });
    record('S15 fundador revogando → 403', s15.statusCode === 403, `status=${s15.statusCode}`);

    // S16 — admin revoga via HTTP (0101) → suspended
    const s16 = await app.inject({ method: 'POST', url: `/identity/pj/kyb/admin/fiscal-identities/${EX.fiscalIdentityId}/revoke`, headers: A.headers, payload: { newStatus: 'suspended', reason: 'verificação de rotina' } });
    const fiRev = await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [EX.fiscalIdentityId]);
    record('S16 revogação HTTP admin → suspended', s16.statusCode === 200 && fiRev.rows[0].k === 'suspended', `status=${s16.statusCode} kyb=${fiRev.rows[0].k}`);

    // ═══ S17 — REENVIO PÓS-REJEIÇÃO (contrato GO §3.1/8.4) — empresa EY ═══════════
    const EY = await createCompany(F, 70000002, 'E2E KYB Co B');
    await uploadDocs(F, EY.companyId);
    const r1 = await app.inject({ method: 'POST', url: `/companies/${EY.companyId}/kyb/requests`, headers: F.headers, payload: {} });
    const reqY1 = r1.json()?.data;
    const rej = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${reqY1.kybRequestId}/review`, headers: A.headers, payload: { decision: 'rejected', reason: 'contrato social ilegível' } });
    const fiY1 = await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [EY.fiscalIdentityId]);
    record('S17a rejeição com reason → kyb_status=rejected', rej.statusCode === 200 && fiY1.rows[0].k === 'rejected', `status=${rej.statusCode} kyb=${fiY1.rows[0].k}`);

    const r2 = await app.inject({ method: 'POST', url: `/companies/${EY.companyId}/kyb/requests`, headers: F.headers, payload: { reason: 'documentos reenviados' } });
    const reqY2 = r2.json()?.data;
    record('S17b reenvio pós-rejeição → 201 nova request (não reaproveita)', r2.statusCode === 201 && reqY2?.kybRequestId && reqY2.kybRequestId !== reqY1.kybRequestId, `status=${r2.statusCode}`);
    const hist = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identity_kyb_requests WHERE fiscal_identity_id=$1::uuid`, [EY.fiscalIdentityId]);
    record('S17c histórico preservado (2 requests, rejeitada intacta)', hist.rows[0].n === '2', `n=${hist.rows[0].n}`);

    const docsY = await pool.query<{ id: string }>(`SELECT document_id::text AS id FROM fiscal_identity_documents WHERE fiscal_identity_id=$1::uuid`, [EY.fiscalIdentityId]);
    for (const d of docsY.rows) {
      await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/documents/${d.id}/review`, headers: A.headers, payload: { decision: 'accepted', reason: 'reenvio legível' } });
    }
    const appr2 = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${reqY2.kybRequestId}/review`, headers: A.headers, payload: { decision: 'approved', reason: 'reenvio válido' } });
    const fiY2 = await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [EY.fiscalIdentityId]);
    record('S17d aprovação pós-reenvio → approved (rejected→approved auditado)', appr2.statusCode === 200 && fiY2.rows[0].k === 'approved', `status=${appr2.statusCode} kyb=${fiY2.rows[0].k}`);

    // S18 — zero Bank writer
    const bank1 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`);
    record('S18 zero Bank writer no lifecycle KYB', bank0.rows[0].n === bank1.rows[0].n, `${bank0.rows[0].n} vs ${bank1.rows[0].n}`);
  } finally {
    await app.close();
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
  console.log('✨ Lifecycle KYB do fundador (CP2) verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
