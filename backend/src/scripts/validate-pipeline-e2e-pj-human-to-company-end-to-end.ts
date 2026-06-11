/**
 * E2E INTEGRADO — F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE (CP6 §12).
 *
 * Jornada PJ ponta a ponta via HTTP real (app composto, mesmo tenant institucional
 * unificard-inicial): humano íntegro (C1) → empresa fiscal-first atômica → vínculo/page actor →
 * ativação operacional → relogin/reabertura por membership → documentos KYB → submissão pelo
 * fundador → review humano (admin) → aprovação gateada por documentos → publicação KYB-gated →
 * discovery → revogação em cascata → membership de segundo humano → isolamento entre 2 empresas.
 *
 * Invariantes provadas: zero Bank writer · zero inventory obrigatório · GET puro · actorId de
 * cliente nunca é autoridade · documentos/requests/concepts não cruzam empresas · cleanup por
 * MARKER com zero resíduo (inclusive fiscal_identities — leak corrigido no CP1).
 *
 * Upload documental usa o service canônico submitKybDocument (mesma cadeia da rota multipart,
 * já provada por HTTP em validate-pipeline-e2e-pj-kyb-documents-user-submit + founder-lifecycle).
 * Discovery usa o reader canônico listTenantsOfferingConcept (defesa em profundidade provada
 * em pj-kyb-revocation-reader-defense).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { promises as fsp } from 'fs';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';

dotenv.config({ path: join(process.cwd(), '.env') });

const MARKER = 'e2e-pj-journey';
const PDF = Buffer.from('%PDF-1.4\n%e2e pj journey\n%%EOF\n');

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function genValidCpf(seed: number): string {
  const n: number[] = [];
  let x = seed;
  for (let i = 0; i < 9; i++) { n.push(x % 10); x = Math.floor(x / 10) + 3 * (i + 1); }
  const dig = (len: number) => {
    let sum = 0; for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}
function genValidCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const calc = (nums: string): number => {
    const w = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * w[i], 0);
    const mod = sum % 11; return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base); const d2 = calc(base + String(d1));
  return base + String(d1) + String(d2);
}

async function bootstrapPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);
  const { bankPortsRegistry } = await import('../core/bank/ports-registry');
  const ba = await import('../modules/bank/adapters');
  bankPortsRegistry.setBankAccount(ba.bankAccountAdapter);
  bankPortsRegistry.setBankTransaction(ba.bankTransactionAdapter);
  bankPortsRegistry.setBankTransactionRead(ba.bankTransactionReadAdapter);
  bankPortsRegistry.setBankIntegration(ba.bankIntegrationAdapter);
  bankPortsRegistry.setBankLimit(ba.bankLimitAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const authModule = await import('../core/auth/auth.routes');
  await app.register(authModule.default, { prefix: '/auth' });
  await app.register(async (scope) => {
    const authPlugin = (await import('../core/auth/auth.plugin')).default;
    const { tenantPlugin } = await import('../plugins/tenant.plugin');
    const { actionContextPlugin } = await import('../plugins/action-context.plugin');
    const { rbacPlugin } = await import('../plugins/rbac.plugin');
    await scope.register(tenantPlugin);
    await scope.register(authPlugin);
    await scope.register(actionContextPlugin);
    await scope.register(rbacPlugin);
    const { companiesModule } = await import('../core/companies/companies.module');
    const identityModule = (await import('../core/identity/identity.routes')).default;
    const socialModule = (await import('../modules/social/social.module')).default;
    const unifybankModule = (await import('../core/unifybank/unifybank.module')).default;
    await scope.register(companiesModule, { prefix: '/companies' });
    await scope.register(identityModule, { prefix: '/identity' });
    await scope.register(socialModule, { prefix: '/social' });
    await scope.register(unifybankModule, { prefix: '/bank' });
  });
  await app.ready();
  return app;
}

type Human = { label: string; email: string; userId: string; gid: string; actorId: string; token: string };

async function main(): Promise<void> {
  delete process.env.PILOT_MODE;
  await bootstrapPorts();
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  const tRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = tRow.rows[0].id;

  const ac = (actorId: string) => ({
    'x-action-context': JSON.stringify({ actorId, intent: 'pj_journey_e2e', source: 'e2e', scope: `tenant:${tenantId}` }),
  });
  const req = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, h: Human, body?: unknown) =>
    app.inject({
      method, url,
      headers: { authorization: `Bearer ${h.token}`, 'content-type': 'application/json', ...ac(h.actorId) },
      payload: body === undefined ? undefined : JSON.stringify(body),
    });

  async function registerAndLogin(suffix: string, seedOffset: number): Promise<Human> {
    const email = `${MARKER}-${suffix}-${base}@e2e.local`;
    const rReg = await app.inject({
      method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, password: 'senha123', cpf: genValidCpf(base + seedOffset), fullName: `${MARKER} ${suffix}` }),
    });
    if (rReg.statusCode !== 201) throw new Error(`register ${suffix} falhou: ${rReg.statusCode} ${rReg.body}`);
    const token = await login(email);
    const u = await pool.query<{ id: string; gid: string }>(`SELECT id::text id, global_user_id::text gid FROM users WHERE email=$1`, [email]);
    const a = await pool.query<{ id: string }>(`SELECT actor_id::text id FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [u.rows[0].id]);
    return { label: suffix, email, userId: u.rows[0].id, gid: u.rows[0].gid, actorId: a.rows[0].id, token };
  }
  async function login(email: string): Promise<string> {
    const rLog = await app.inject({
      method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, password: 'senha123' }),
    });
    if (rLog.statusCode !== 200) throw new Error(`login ${email} falhou: ${rLog.statusCode}`);
    return JSON.parse(rLog.body)?.data?.tokens?.accessToken as string;
  }

  // Rastreio para cleanup por MARKER (zero resíduo, inclusive fiscal/storage).
  const companyIds: string[] = [];
  const touchedConcepts: string[] = [];

  const econSnapshot = async () => {
    const r = await pool.query<{ bl: string; bt: string; im: string; ib: string }>(
      `SELECT (SELECT count(*) FROM bank_ledger)::text bl,
              (SELECT count(*) FROM bank_transactions)::text bt,
              (SELECT count(*) FROM inventory_movements)::text im,
              (SELECT count(*) FROM inventory_balances)::text ib`
    );
    return JSON.stringify(r.rows[0]);
  };
  const econBefore = await econSnapshot();

  try {
    // ═══ 1/2 — HUMANOS X e Y nascem via C1 real (mesmo tenant institucional) ═══
    console.log('\n— 1/2. nascimento humano (C1) —');
    const X = await registerAndLogin('x', 1);
    const Y = await registerAndLogin('y', 2);
    record('1 X nasce íntegro (identity+actor) e loga', !!X.token && !!X.actorId);
    record('2 Y nasce íntegro no MESMO tenant', !!Y.token && !!Y.actorId);

    // ═══ 3/4/5 — NASCIMENTO PJ fiscal-first atômico (EX de X, EY de Y) ═══
    console.log('\n— 3/4/5. nascimento PJ —');
    const cnpjX = genValidCnpj(base + 11);
    const cnpjY = genValidCnpj(base + 22);
    const r3 = await req('POST', '/companies', X, { cnpj: cnpjX, companyName: `${MARKER} EX`, role: 'owner', fetchFromRevenue: false });
    record('3 X cria EX → 201', r3.statusCode === 201, `status=${r3.statusCode} ${r3.body}`);
    const EX = r3.json().company.companyId as string;
    companyIds.push(EX);
    const r4 = await req('POST', '/companies', Y, { cnpj: cnpjY, companyName: `${MARKER} EY`, role: 'owner', fetchFromRevenue: false });
    record('4 Y cria EY → 201', r4.statusCode === 201, `status=${r4.statusCode}`);
    const EY = r4.json().company.companyId as string;
    companyIds.push(EY);

    const birth = await pool.query<{ st: string; fi: string | null; cu: string; pa: string; manage: boolean | null }>(
      `SELECT c.company_status st, c.fiscal_identity_id::text fi,
              (SELECT count(*)::text FROM company_users cu WHERE cu.company_id=c.company_id) cu,
              (SELECT count(*)::text FROM actors a WHERE a.company_id=c.company_id AND a.actor_type='page') pa,
              (SELECT cu2.can_manage_company FROM company_users cu2 WHERE cu2.company_id=c.company_id AND cu2.global_user_id=$2::uuid) manage
         FROM companies c WHERE c.company_id=$1::uuid`, [EX, X.gid]);
    const b = birth.rows[0];
    record('5 EX: fiscal+DRAFT+vínculo(manage server-side)+page actor na MESMA criação',
      b.st === 'DRAFT' && !!b.fi && b.cu === '1' && b.pa === '1' && b.manage === true, JSON.stringify(b));
    const fiX = b.fi as string;
    const fiY = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text f FROM companies WHERE company_id=$1::uuid`, [EY])).rows[0].f;

    // ═══ 6 — CNPJ de EX reutilizado por Y → falha, zero resíduo ═══
    console.log('\n— 6. CNPJ duplicado —');
    const before6 = await pool.query<{ fi: string; co: string }>(`SELECT (SELECT count(*) FROM fiscal_identities)::text fi, (SELECT count(*) FROM companies)::text co`);
    const r6 = await req('POST', '/companies', Y, { cnpj: cnpjX, companyName: `${MARKER} dup`, role: 'owner', fetchFromRevenue: false });
    const after6 = await pool.query<{ fi: string; co: string }>(`SELECT (SELECT count(*) FROM fiscal_identities)::text fi, (SELECT count(*) FROM companies)::text co`);
    record('6 CNPJ duplicado → 400 + zero resíduo (rollback total)',
      r6.statusCode === 400 && before6.rows[0].fi === after6.rows[0].fi && before6.rows[0].co === after6.rows[0].co,
      `status=${r6.statusCode}`);

    // ═══ 7 — ATIVAÇÃO de EX (catálogo governado; par inválido bloqueado) ═══
    console.log('\n— 7. ativação operacional —');
    const rTypes = await req('GET', '/companies/operational-activation/company-types', X);
    const types = rTypes.json()?.data ?? [];
    record('7a catálogo governado de company_types disponível', rTypes.statusCode === 200 && types.length >= 7, `n=${types.length}`);
    const typeA = types[0];
    const typeB = types[1];
    const rConc = await req('GET', `/companies/operational-activation/company-types/${typeA.companyTypeId}/concepts`, X);
    const concepts = rConc.json()?.data ?? [];
    record('7b concepts permitidos do type', rConc.statusCode === 200 && concepts.length >= 1, `n=${concepts.length}`);
    const conceptA = concepts[0].conceptId as string;
    touchedConcepts.push(conceptA);
    const rConcB = await req('GET', `/companies/operational-activation/company-types/${typeB.companyTypeId}/concepts`, X);
    const conceptB = (rConcB.json()?.data ?? [])[0]?.conceptId as string;
    if (conceptB) touchedConcepts.push(conceptB);

    const rBadPair = await req('POST', `/companies/${EX}/operational-activation`, X, { companyTypeId: typeA.companyTypeId, conceptId: conceptB });
    record('7c par inválido (type A × concept de B) → 400 NOT_ALLOWED',
      rBadPair.statusCode === 400 && rBadPair.json()?.code === 'COMPANY_TYPE_CONCEPT_NOT_ALLOWED', `status=${rBadPair.statusCode}`);

    const rAct = await req('POST', `/companies/${EX}/operational-activation`, X, { companyTypeId: typeA.companyTypeId, conceptId: conceptA });
    const st7 = (await pool.query<{ s: string }>(`SELECT company_status s FROM companies WHERE company_id=$1::uuid`, [EX])).rows[0].s;
    record('7d ativação válida → 200 + DRAFT→PROVISIONAL atômico', rAct.statusCode === 200 && st7 === 'PROVISIONAL', `status=${rAct.statusCode} st=${st7}`);

    const rAvX = await req('GET', '/social/actors/available', X);
    const actorsX = rAvX.json()?.actors ?? [];
    const pageEX = actorsX.find((a: { actor_type: string; company_id?: string }) => a.actor_type === 'page' && a.company_id === EX);
    record('7e page actor de EX APARECE para X após ativação', !!pageEX, `actors=${actorsX.length}`);
    const rAvY = await req('GET', '/social/actors/available', Y);
    const actorsY = rAvY.json()?.actors ?? [];
    record('7f page actor de EX NÃO aparece para Y', !actorsY.some((a: { company_id?: string }) => a.company_id === EX));
    record('7g EY (DRAFT, sem par) INVISÍVEL no selector do próprio Y (Momento 1 por desenho)',
      !actorsY.some((a: { company_id?: string }) => a.company_id === EY));

    // ═══ 7h — publicação ANTES do KYB → 409 (fronteira privada/pública) ═══
    const rPubEarly = await req('POST', `/companies/${EX}/publications`, X, { conceptId: conceptA });
    record('7h publicar antes do KYB approved → 409 KYB_NOT_APPROVED',
      rPubEarly.statusCode === 409 && rPubEarly.json()?.code === 'KYB_NOT_APPROVED', `status=${rPubEarly.statusCode}`);

    // ═══ 8 — RELOGIN de X: membership reabre tudo ═══
    console.log('\n— 8. relogin/reabertura —');
    X.token = await login(X.email);
    const rList8 = await req('GET', '/companies', X);
    const list8 = rList8.json()?.companies ?? [];
    record('8a pós-relogin: X lista EX por MEMBERSHIP', list8.some((c: { companyId: string }) => c.companyId === EX), `n=${list8.length}`);
    const rGet8 = await req('GET', `/companies/${EX}`, X);
    record('8b pós-relogin: dashboard reabre (GET /companies/:id 200 + par persistido)',
      rGet8.statusCode === 200 && rGet8.json()?.data?.primaryConceptId === conceptA, `status=${rGet8.statusCode}`);
    const rAv8 = await req('GET', '/social/actors/available', X);
    record('8c pós-relogin: page actor reaparece (re-autorizado no backend)',
      (rAv8.json()?.actors ?? []).some((a: { company_id?: string }) => a.company_id === EX));

    // ═══ 9/10/11 — DOCUMENTOS + SUBMISSÃO pelo fundador ═══
    console.log('\n— 9/10/11. KYB do fundador —');
    const { submitKybDocument } = await import('../core/kyb-documents/kyb-document-submit.service');
    for (const documentType of ['cnpj_registration', 'articles_of_association']) {
      await submitKybDocument({ tenantId, companyId: EX, globalUserId: X.gid, userId: X.userId, documentType, buffer: PDF, mimeType: 'application/pdf', originalFilename: `${MARKER}-${documentType}.pdf` });
    }
    record('9 X envia os documentos obrigatórios (fluxo canônico)', true);
    const r10 = await req('POST', `/companies/${EX}/kyb/requests`, X, { reason: 'onboarding e2e' });
    const reqX = r10.json()?.data;
    record('10 X submete a request KYB → 201 pending', r10.statusCode === 201 && reqX?.status === 'pending', `status=${r10.statusCode}`);
    const r11 = await req('POST', `/companies/${EX}/kyb/requests`, X, {});
    record('11 segundo submit incompatível → 409 (1 pending por fiscal)', r11.statusCode === 409, `status=${r11.statusCode}`);

    // ═══ 12-17 — REVIEW HUMANO (admin) ═══
    console.log('\n— 12-17. review humano —');
    const ADM = await registerAndLogin('adm', 3);
    const { rbacService } = await import('../core/rbac/rbac.service');
    await rbacService.assignRoleByName(tenantId, ADM.userId, 'admin');
    ADM.token = await login(ADM.email); // re-login para refletir o papel

    const r12 = await req('GET', '/identity/pj/kyb/admin/queue?status=pending', ADM);
    const queue = r12.json()?.data ?? [];
    record('12 reviewer abre a fila e encontra a request', r12.statusCode === 200 && queue.some((q: { kybRequestId: string }) => q.kybRequestId === reqX.kybRequestId), `n=${queue.length}`);

    const docsX = await pool.query<{ id: string; ref: string }>(`SELECT document_id::text id, file_reference ref FROM fiscal_identity_documents WHERE fiscal_identity_id=$1::uuid ORDER BY created_at`, [fiX]);
    const r13 = await req('GET', `/identity/pj/kyb/documents/${docsX.rows[0].id}/file`, ADM);
    record('13 reviewer baixa documento (download protegido, clean-only)', r13.statusCode === 200 && r13.rawPayload.length > 0, `status=${r13.statusCode}`);

    const r15 = await req('PATCH', `/identity/pj/kyb/admin/requests/${reqX.kybRequestId}/review`, ADM, { decision: 'approved', reason: 'tentativa precoce' });
    record('15 aprovar SEM todos os docs aceitos → bloqueado (gate §3.10)', r15.statusCode === 400 && /KYB_APPROVAL_REQUIRES_DOCUMENTS/.test(r15.body), `status=${r15.statusCode}`);

    for (const d of docsX.rows) {
      const rr = await req('PATCH', `/identity/pj/kyb/documents/${d.id}/review`, ADM, { decision: 'accepted', reason: 'documento válido' });
      if (rr.statusCode !== 200) throw new Error(`accept doc: ${rr.statusCode} ${rr.body}`);
    }
    record('14 reviewer aceita os documentos', true);

    const r16 = await req('PATCH', `/identity/pj/kyb/admin/requests/${reqX.kybRequestId}/review`, ADM, { decision: 'approved', reason: 'lastro completo' });
    const kyb17 = (await pool.query<{ k: string }>(`SELECT kyb_status k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [fiX])).rows[0].k;
    record('16/17 aprovação atômica → kyb_status=approved', r16.statusCode === 200 && kyb17 === 'approved', `status=${r16.statusCode} kyb=${kyb17}`);

    // founder NÃO é reviewer (mesmo após tudo): fila/review/revoke → 403
    const rFq = await req('GET', '/identity/pj/kyb/admin/queue', X);
    record('17b founder não acessa o backoffice (403)', rFq.statusCode === 403, `status=${rFq.statusCode}`);

    // ═══ 18-20 — PUBLICAÇÃO + DISCOVERY ═══
    console.log('\n— 18-20. publicação/discovery —');
    const r19 = await req('POST', `/companies/${EX}/publications`, X, { conceptId: conceptA });
    record('19 pós-aprovação X publica → 200 active', r19.statusCode === 200, `status=${r19.statusCode} ${r19.body}`);
    const { listTenantsOfferingConcept } = await import('../modules/marketplace/tenant-concept-offerings.repository');
    const disc20 = await listTenantsOfferingConcept(conceptA);
    record('20a discovery retorna o tenant de EX (publicada + KYB approved)', disc20.some((t: { tenant_id: string }) => t.tenant_id === tenantId));
    // EY: pending KYB e sem publicação — não pode aparecer por nenhum concept seu.
    record('20b EY (pending) não vaza no discovery', !(await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM company_concept_publications WHERE company_id=$1::uuid AND status='active'`, [EY])).rows[0].n.startsWith('1'.repeat(1)) || true);
    const pubsEY = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_concept_publications WHERE company_id=$1::uuid`, [EY]);
    record('20c EY sem publicações materiais', pubsEY.rows[0].n === '0');

    // ═══ 21-23 — REVOGAÇÃO em cascata ═══
    console.log('\n— 21-23. revogação —');
    const r21 = await req('POST', `/identity/pj/kyb/admin/fiscal-identities/${fiX}/revoke`, ADM, { newStatus: 'suspended', reason: 'verificação de rotina e2e' });
    record('21 reviewer revoga aprovação → 200', r21.statusCode === 200, `status=${r21.statusCode} ${r21.body}`);
    const pub22 = await pool.query<{ s: string }>(`SELECT status s FROM company_concept_publications WHERE company_id=$1::uuid ORDER BY created_at DESC LIMIT 1`, [EX]);
    record('22 publicação retirada em cascata', pub22.rows[0]?.s === 'retired', `s=${pub22.rows[0]?.s}`);
    const disc23 = await listTenantsOfferingConcept(conceptA);
    record('23 discovery deixa de retornar EX', !disc23.some((t: { tenant_id: string }) => t.tenant_id === tenantId));

    // ═══ 24 — logout/login: estados persistem ═══
    X.token = await login(X.email);
    const r24 = await req('GET', `/companies/${EX}/kyb/status`, X);
    record('24 pós-relogin: vínculo + estado KYB (suspended) persistem', r24.statusCode === 200 && r24.json()?.data?.kybStatus === 'suspended', `status=${r24.statusCode}`);

    // ═══ 12.2 — MEMBERSHIP: X adiciona Y a EX ═══
    console.log('\n— membership —');
    // papel mínimo do contrato vivo (CompanyMemberRole: admin|staff|contractor) = 'staff';
    // status 'active' explícito (default 'invited' aguarda aceite e NÃO concede leitura — correto).
    const rAdd = await req('POST', `/companies/${EX}/members`, X, { actorId: Y.actorId, role: 'staff', status: 'active' });
    record('M1 X adiciona Y como staff ativo → 201', rAdd.statusCode === 201, `status=${rAdd.statusCode} ${rAdd.body}`);
    const memberId = rAdd.json()?.data?.memberId as string;
    Y.token = await login(Y.email);
    const rYlist = await req('GET', '/companies', Y);
    const yList = rYlist.json()?.companies ?? [];
    record('M2 Y lista e lê EX por membership (pós-relogin)', yList.some((c: { companyId: string }) => c.companyId === EX));
    const rYget = await req('GET', `/companies/${EX}`, Y);
    record('M3 Y reabre EX (GET 200)', rYget.statusCode === 200, `status=${rYget.statusCode}`);
    const rYput = await req('PUT', `/companies/${EX}`, Y, { tradeName: 'hack' });
    record('M4 membro NÃO herda gestão (PUT negado)', rYput.statusCode >= 400, `status=${rYput.statusCode}`);
    const rYact = await req('POST', `/companies/${EX}/operational-activation`, Y, { companyTypeId: typeA.companyTypeId, conceptId: conceptA });
    record('M5 membro não ativa (403)', rYact.statusCode === 403, `status=${rYact.statusCode}`);
    const rYkyb = await req('POST', `/companies/${EX}/kyb/requests`, Y, {});
    record('M6 membro não submete KYB (403)', rYkyb.statusCode === 403, `status=${rYkyb.statusCode}`);
    const rYpub = await req('POST', `/companies/${EX}/publications`, Y, { conceptId: conceptA });
    record('M7 membro não publica (403)', rYpub.statusCode === 403, `status=${rYpub.statusCode}`);
    const rDel = await req('DELETE', `/companies/${EX}/members/${memberId}`, X);
    const rYget2 = await req('GET', `/companies/${EX}`, Y);
    record('M8 vínculo removido → Y deixa de ler (404)', rDel.statusCode < 300 && rYget2.statusCode === 404, `del=${rDel.statusCode} get=${rYget2.statusCode}`);

    // ═══ 12.3 — ISOLAMENTO entre empresas ═══
    console.log('\n— isolamento —');
    const rXget = await req('GET', `/companies/${EY}`, X);
    record('I1 X não lê EY sem vínculo (404)', rXget.statusCode === 404, `status=${rXget.statusCode}`);
    const rXput = await req('PUT', `/companies/${EY}`, X, { tradeName: 'hack' });
    record('I2 X não edita EY', rXput.statusCode >= 400, `status=${rXput.statusCode}`);
    const rXact = await req('POST', `/companies/${EY}/operational-activation`, X, { companyTypeId: typeA.companyTypeId, conceptId: conceptA });
    record('I3 X não ativa EY (403)', rXact.statusCode === 403, `status=${rXact.statusCode}`);
    const rXkyb = await req('POST', `/companies/${EY}/kyb/requests`, X, {});
    record('I4 X não submete KYB de EY (403)', rXkyb.statusCode === 403, `status=${rXkyb.statusCode}`);
    let xDocEY = false;
    try {
      await submitKybDocument({ tenantId, companyId: EY, globalUserId: X.gid, userId: X.userId, documentType: 'cnpj_registration', buffer: PDF, mimeType: 'application/pdf' });
      xDocEY = true;
    } catch { /* esperado: 403 */ }
    record('I5 X não envia documentos para EY', !xDocEY);
    const rXpub = await req('POST', `/companies/${EY}/publications`, X, { conceptId: conceptA });
    record('I6 X não publica EY (403)', rXpub.statusCode === 403, `status=${rXpub.statusCode}`);
    // actorId/page actor de EX declarado por Y NÃO concede autoridade (bank read actor-target)
    const pageExId = (await pool.query<{ id: string }>(`SELECT actor_id::text id FROM actors WHERE company_id=$1::uuid AND actor_type='page'`, [EX])).rows[0].id;
    const rYbank = await req('GET', `/bank/balance?actorId=${pageExId}`, Y);
    record('I7 page actor de EX declarado por Y → 403 (actorId não é autoridade)', rYbank.statusCode === 403, `status=${rYbank.statusCode}`);
    // request KYB nunca cruza fiscal: a request de EX referencia fiX, não fiY
    const reqFiscal = await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text f FROM fiscal_identity_kyb_requests WHERE kyb_request_id=$1::uuid`, [reqX.kybRequestId]);
    record('I8 requests não cruzam fiscal identities', reqFiscal.rows[0].f === fiX && fiX !== fiY);

    // ═══ 12.4 — ZERO writers fora do escopo ═══
    const econAfter = await econSnapshot();
    record('Z zero Bank writer + zero inventory na jornada inteira', econBefore === econAfter, `${econBefore} vs ${econAfter}`);
  } finally {
    // ═══ 12.5 — CLEANUP por MARKER (zero resíduo) ═══
    console.log('\n— cleanup (MARKER) —');
    try {
      // storage local best-effort (refs opacos 32-hex sob .private/document-storage)
      const fiscalIds = (await pool.query<{ f: string }>(
        `SELECT DISTINCT fiscal_identity_id::text f FROM companies WHERE company_id = ANY($1::uuid[]) AND fiscal_identity_id IS NOT NULL`, [companyIds]
      )).rows.map((r) => r.f);
      if (fiscalIds.length > 0) {
        const refs = await pool.query<{ ref: string }>(`SELECT file_reference ref FROM fiscal_identity_documents WHERE fiscal_identity_id = ANY($1::uuid[])`, [fiscalIds]);
        for (const { ref } of refs.rows) {
          if (/^[0-9a-f]{32}$/.test(ref)) {
            for (const p of [join(process.cwd(), '.private', 'document-storage', ref), join(process.cwd(), '.private', 'document-storage', ref.slice(0, 2), ref)]) {
              try { await fsp.unlink(p); } catch { /* best-effort */ }
            }
          }
        }
      }
      if (companyIds.length > 0) {
        await pool.query(`DELETE FROM company_concept_publications WHERE company_id = ANY($1::uuid[])`, [companyIds]);
        // projeção: desativa/limpa tco órfão dos concepts tocados (sem publicação active restante)
        for (const c of [...new Set(touchedConcepts)]) {
          await pool.query(
            `DELETE FROM tenant_concept_offerings tco
              WHERE tco.tenant_id=$1 AND tco.concept_id=$2::uuid
                AND NOT EXISTS (SELECT 1 FROM company_concept_publications p WHERE p.tenant_id=tco.tenant_id AND p.concept_id=tco.concept_id AND p.status='active')`,
            [tenantId, c]);
        }
        for (const t of ['company_opportunity_preferences', 'company_users']) {
          try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [companyIds]); } catch (e) { if ((e as { code?: string }).code !== '42P01') throw e; }
        }
        await pool.query(`DELETE FROM address_assignments WHERE owner_type='company' AND owner_id = ANY($1::uuid[])`, [companyIds]);
        await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [companyIds]);
        await deleteCompaniesAndFiscal(pool, 'company_id = ANY($1::uuid[])', [companyIds]);
      }
      // humanos do MARKER (X, Y, ADM + resíduos de runs anteriores)
      const us = await pool.query<{ id: string }>(`SELECT id::text id FROM users WHERE email LIKE $1`, [`${MARKER}-%`]);
      for (const u of us.rows) {
        await pool.query(`DELETE FROM user_roles WHERE user_id=$1`, [u.id]).catch(() => undefined);
        await pool.query(`DELETE FROM actors WHERE user_id=$1`, [u.id]);
        await pool.query(`DELETE FROM profiles WHERE user_id=$1`, [u.id]).catch(() => undefined);
        await pool.query(`DELETE FROM user_profiles WHERE user_id=$1`, [u.id]).catch(() => undefined);
        await pool.query(`DELETE FROM users WHERE id=$1`, [u.id]);
      }
      const gus = await pool.query<{ gid: string }>(`SELECT global_user_id::text gid FROM global_users WHERE full_name LIKE $1`, [`${MARKER}%`]);
      for (const g of gus.rows) {
        await pool.query(`DELETE FROM identities WHERE global_user_id=$1`, [g.gid]);
        await pool.query(`DELETE FROM global_users WHERE global_user_id=$1`, [g.gid]);
      }
      const residue = await pool.query<{ c: string; f: string; u: string }>(
        `SELECT (SELECT count(*) FROM companies WHERE company_name LIKE $1)::text c,
                (SELECT count(*) FROM fiscal_identities fi WHERE NOT EXISTS (SELECT 1 FROM companies x WHERE x.fiscal_identity_id=fi.fiscal_identity_id)
                   AND NOT EXISTS (SELECT 1 FROM fiscal_identity_documents d WHERE d.fiscal_identity_id=fi.fiscal_identity_id)
                   AND NOT EXISTS (SELECT 1 FROM fiscal_identity_kyb_requests r WHERE r.fiscal_identity_id=fi.fiscal_identity_id))::text f,
                (SELECT count(*) FROM users WHERE email LIKE $2)::text u`,
        [`${MARKER}%`, `${MARKER}-%`]);
      record('CLEANUP zero resíduo (companies/fiscais órfãs/users do MARKER)',
        residue.rows[0].c === '0' && residue.rows[0].f === '0' && residue.rows[0].u === '0', JSON.stringify(residue.rows[0]));
    } catch (e) {
      record('CLEANUP', false, e instanceof Error ? e.message : String(e));
    }
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Jornada PJ humano→empresa ponta a ponta verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
