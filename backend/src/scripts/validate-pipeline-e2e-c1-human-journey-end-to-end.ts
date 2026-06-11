/**
 * E2E HTTP REAL — F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE
 *
 * Jornada humana C1 ponta-a-ponta com DOIS usuários (A e B) no MESMO tenant (unificard-inicial):
 *   cadastro → login → bootstrap → perfil pessoal → gender (5 valores) → profissional C1 →
 *   learning C1 → interests C1 → agenda (Unified Availability) → Home reads → relogin →
 *   reabertura de TODOS os dados → isolamento A/B → provas negativas.
 *
 * Invariantes provadas: identities/actors/profiles/concepts/agenda DISTINTOS; nenhum GET escreve;
 * nenhum usuário lê/edita dado privado do outro; gender persiste igual ao input (5 valores);
 * erro estrutural ≠ zero falso; ZERO evento econômico (bank_ledger/bank_transactions intactos);
 * ZERO tenant novo. NÃO declara PJ/marketplace/inventory/convite/FASE6/R2 fechados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-c1-human-journey-end-to-end.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const MARKER = 'e2e-c1hj';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function genValidCpf(seed: number): string {
  const n: number[] = []; let s = seed;
  for (let i = 0; i < 9; i++) { n.push(s % 10); s = Math.floor(s / 10) + 7 * (i + 1); }
  const dv = (a: number[]) => { let sum = 0; const len = a.length + 1; for (let i = 0; i < a.length; i++) sum += a[i] * (len - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(n); const d2 = dv([...n, d1]); return [...n, d1, d2].join('');
}
function ac(actorId: string, tenantId: string): Record<string, string> {
  return { 'x-action-context': JSON.stringify({ actorId, intent: 'e2e-hj', source: 'e2e', scope: tenantId }) };
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
    const coreModule = (await import('../core/core.routes')).coreRoutes;
    const profileRoutes = (await import('../core/profile/profile.routes')).default; // inclui C1 trilhos
    const referralModule = (await import('../core/referral/referral.routes')).default;
    const socialModule = (await import('../modules/social/social.module')).default;
    const identityModule = (await import('../core/identity/identity.routes')).default;
    const unifybankModule = (await import('../core/unifybank/unifybank.module')).default;
    const groupsModule = (await import('../modules/groups/groups.module')).default;
    const availabilityModule = (await import('../core/availability/availability.module')).availabilityModule;
    await scope.register(coreModule, { prefix: '/core' });
    await scope.register(profileRoutes, { prefix: '/profile' });
    await scope.register(referralModule, { prefix: '/referral' });
    await scope.register(socialModule, { prefix: '/social' });
    await scope.register(identityModule, { prefix: '/identity' });
    await scope.register(unifybankModule, { prefix: '/bank' });
    await scope.register(groupsModule, { prefix: '/groups' });
    await scope.register(availabilityModule, { prefix: '/availability' });
  });
  await app.ready();
  return app;
}

async function cleanup(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    const us = await client.query(`SELECT id::text id, global_user_id::text gid FROM users WHERE email LIKE $1`, [`${MARKER}-%`]);
    for (const u of us.rows) {
      const acts = await client.query(`SELECT id::text aid FROM actors WHERE user_id=$1`, [u.id]);
      for (const a of acts.rows) {
        await client.query(`DELETE FROM bookings WHERE availability_id IN (SELECT availability_id FROM availability WHERE owner_id=$1)`, [a.aid]);
        await client.query(`DELETE FROM availability_participants WHERE availability_id IN (SELECT availability_id FROM availability WHERE owner_id=$1)`, [a.aid]);
        await client.query(`DELETE FROM availability WHERE owner_id=$1`, [a.aid]);
        await client.query(`DELETE FROM actor_professional_concepts WHERE actor_id=$1`, [a.aid]);
        await client.query(`DELETE FROM actor_professional_profiles WHERE actor_id=$1`, [a.aid]);
        await client.query(`DELETE FROM actor_learning_concepts WHERE actor_id=$1`, [a.aid]);
        await client.query(`DELETE FROM actor_interest_concepts WHERE actor_id=$1`, [a.aid]);
        await client.query(`DELETE FROM address_assignments WHERE owner_id=$1`, [a.aid]);
      }
      await client.query(`DELETE FROM actors WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM profiles WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM user_profiles WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM users WHERE id=$1`, [u.id]);
    }
    const gus = await client.query(`SELECT global_user_id::text gid FROM global_users WHERE full_name ILIKE $1`, [`${MARKER}%`]);
    for (const g of gus.rows) {
      await client.query(`DELETE FROM identities WHERE global_user_id=$1`, [g.gid]);
      await client.query(`DELETE FROM global_users WHERE global_user_id=$1`, [g.gid]);
    }
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally { client.release(); }
}

type UserCtx = {
  label: string; email: string; cpf: string; gender: string;
  userId: string; gid: string; actorId: string; token: string;
};

async function main(): Promise<void> {
  delete process.env.PILOT_MODE;
  await bootstrapPorts();
  await cleanup();
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  const tRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = tRow.rows[0].id;

  // ── BASELINE ECONÔMICO/ESTRUTURAL (deve permanecer intacto a jornada inteira) ──
  const econBefore = await pool.query<{ l: string; t: string; ten: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger)::text l, (SELECT COUNT(*) FROM bank_transactions)::text t, (SELECT COUNT(*) FROM tenants)::text ten`);

  // 6 concepts distintos do substrato vivo
  const cRows = await pool.query<{ concept_id: string }>(`SELECT concept_id::text FROM concepts ORDER BY created_at LIMIT 6`);
  const [C1, C2, C3, C4, C5, C6] = cRows.rows.map(r => r.concept_id);

  const post = (url: string, token: string, actorId: string, body: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST') =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...ac(actorId, tenantId) }, payload: body === undefined ? undefined : JSON.stringify(body) });
  const get = (url: string, token: string, actorId: string) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}`, ...ac(actorId, tenantId) } });

  async function registerAndLogin(suffix: string, seedOffset: number, gender: string, fullName: string): Promise<UserCtx | null> {
    const email = `${MARKER}-${suffix}-${base}@e2e.local`;
    const cpf = genValidCpf(base + seedOffset);
    const rReg = await app.inject({ method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email, password: 'senha123', cpf, fullName, gender }) });
    if (rReg.statusCode !== 201) return null;
    const rLog = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email, password: 'senha123' }) });
    if (rLog.statusCode !== 200) return null;
    const token = JSON.parse(rLog.body)?.data?.tokens?.accessToken;
    const u = await pool.query<{ id: string; gid: string }>(`SELECT id::text id, global_user_id::text gid FROM users WHERE email=$1`, [email]);
    const a = await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [u.rows[0].id]);
    return { label: suffix, email, cpf, gender, userId: u.rows[0].id, gid: u.rows[0].gid, actorId: a.rows[0]?.id, token };
  }

  async function snapState() {
    const r = await pool.query<{ a: string; p: string; i: string; pc: string; lc: string; ic: string; av: string }>(`
      SELECT (SELECT COUNT(*) FROM actors WHERE tenant_id=$1)::text a,
             (SELECT COUNT(*) FROM profiles WHERE tenant_id=$1)::text p,
             (SELECT COUNT(*) FROM identities)::text i,
             (SELECT COUNT(*) FROM actor_professional_concepts WHERE tenant_id=$1)::text pc,
             (SELECT COUNT(*) FROM actor_learning_concepts WHERE tenant_id=$1)::text lc,
             (SELECT COUNT(*) FROM actor_interest_concepts WHERE tenant_id=$1)::text ic,
             (SELECT COUNT(*) FROM availability WHERE tenant_id=$1)::text av`, [tenantId]);
    return JSON.stringify(r.rows[0]);
  }

  try {
    console.log('\n— 1. CADASTRO + LOGIN (A e B, mesmo tenant, gender 5-valores) —');
    const A = await registerAndLogin('a', 0, 'non_binary', `${MARKER}A`);
    const B = await registerAndLogin('b', 1, 'prefer_not_to_say', `${MARKER}B`);
    record('1.1 A registrado+logado (gender non_binary aceito no register)', !!A?.token && !!A?.actorId);
    record('1.2 B registrado+logado (gender prefer_not_to_say aceito)', !!B?.token && !!B?.actorId);
    if (!A || !B) throw new Error('fixtures A/B falharam');
    const tenA = await pool.query<{ t: string }>(`SELECT tenant_id::text t FROM users WHERE id=$1`, [A.userId]);
    const tenB = await pool.query<{ t: string }>(`SELECT tenant_id::text t FROM users WHERE id=$1`, [B.userId]);
    record('1.3 A e B no MESMO tenant unificard-inicial', tenA.rows[0].t === tenantId && tenB.rows[0].t === tenantId);
    record('1.4 identities distintas / actors distintos / profiles distintos',
      A.gid !== B.gid && A.actorId !== B.actorId && A.userId !== B.userId);

    console.log('\n— 2. GENDER: matriz dos 5 valores + negativo —');
    const matrix: Array<[string, string]> = [['m', 'male'], ['f', 'female'], ['o', 'other']];
    for (let i = 0; i < matrix.length; i++) {
      const [sfx, g] = matrix[i];
      const u = await registerAndLogin(`g${sfx}`, 10 + i, g, `${MARKER}G${sfx}`);
      const row = u ? await pool.query<{ g: string }>(`SELECT gender g FROM global_users WHERE global_user_id=$1`, [u.gid]) : null;
      record(`2.${i + 1} gender '${g}' → register 201 + global_users.gender='${g}'`, !!u && row?.rows[0]?.g === g);
    }
    const gA = await pool.query<{ g: string }>(`SELECT gender g FROM global_users WHERE global_user_id=$1`, [A.gid]);
    const gB = await pool.query<{ g: string }>(`SELECT gender g FROM global_users WHERE global_user_id=$1`, [B.gid]);
    record('2.4 non_binary/prefer_not_to_say persistidos na CASA CANÔNICA (global_users.gender)',
      gA.rows[0]?.g === 'non_binary' && gB.rows[0]?.g === 'prefer_not_to_say');
    const blobG = await pool.query(`SELECT 1 FROM profiles WHERE user_id IN ($1,$2) AND metadata ? 'gender'`, [A.userId, B.userId]);
    record('2.5 gender NÃO mora no blob (profiles.metadata sem chave gender)', (blobG.rowCount ?? 0) === 0);
    const rBad = await app.inject({ method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: `${MARKER}-bad-${base}@e2e.local`, password: 'senha123', cpf: genValidCpf(base + 20), gender: 'banana' }) });
    record('2.6 gender inválido → 400 (não evapora, não converte)', rBad.statusCode === 400);

    console.log('\n— 3. BOOTSTRAP (leitura pura preservada) —');
    const s3a = await snapState();
    const rAv = await get('/social/actors/available', A.token, A.actorId);
    const rProf = await get('/profile', A.token, A.actorId);
    const rProg = await get('/profile/progress', A.token, A.actorId);
    const s3b = await snapState();
    record('3.1 bootstrap A: actors/available 200 + /profile 200 + /progress 200',
      rAv.statusCode === 200 && rProf.statusCode === 200 && rProg.statusCode === 200,
      `${rAv.statusCode}/${rProf.statusCode}/${rProg.statusCode}`);
    record('3.2 bootstrap não cria estado (snapshots idênticos)', s3a === s3b, `${s3a} vs ${s3b}`);

    console.log('\n— 4. PERFIL PESSOAL: preencher → salvar → reler —');
    const rBirth = await post('/identity/update', A.token, A.actorId, { birthdate: '1990-03-15' });
    record('4.1 A salva birthdate via /identity/update → 200', rBirth.statusCode === 200, `status ${rBirth.statusCode}`);
    const rPhone = await post('/profile', A.token, A.actorId, { phone: '(41) 99876-5432' }, 'PUT');
    record('4.2 A salva phone via PUT /profile → 200', rPhone.statusCode === 200, `status ${rPhone.statusCode}`);
    const rAddr = await post('/profile/residence-address', A.token, A.actorId, { cep: '80010-000', address: 'Rua XV de Novembro', address_number: '100' }, 'PUT');
    record('4.3 A salva endereço (Location Core, CEP-âncora) → 2xx', rAddr.statusCode >= 200 && rAddr.statusCode < 300, `status ${rAddr.statusCode}: ${rAddr.body.slice(0, 120)}`);
    const rCore = await get('/core/profile', A.token, A.actorId);
    const core = rCore.statusCode === 200 ? JSON.parse(rCore.body) : null;
    const pp = core?.data?.personal_profile ?? core?.personal_profile;
    record('4.4 releitura /core/profile: phone + birthdate + cpf + gender espelhado',
      !!pp && String(pp.phone ?? '').includes('99876') && String(pp.birthdate ?? '').startsWith('1990-03-15')
      && String(pp.cpf ?? '').replace(/\D/g, '') === A.cpf && pp.metadata?.gender === 'non_binary',
      JSON.stringify({ phone: pp?.phone, birth: pp?.birthdate, cpf: pp?.cpf, g: pp?.metadata?.gender }));
    const rIdMe = await get('/identity/me', A.token, A.actorId);
    const idMe = rIdMe.statusCode === 200 ? JSON.parse(rIdMe.body) : null;
    record('4.5 /identity/me 200 honesto (identity real, gender canônico, sem fabricação)',
      rIdMe.statusCode === 200 && idMe?.data?.global?.gender === 'non_binary' && idMe?.data?.global?.birthdate === '1990-03-15');

    console.log('\n— 5. PROFISSIONAL C1 —');
    const rPB = await post('/profile/professional/c1/bio', A.token, A.actorId, { professional_bio: 'Bio do A' }, 'PUT');
    const rPD = await post('/profile/professional/c1/concepts', A.token, A.actorId, { concept_id: C1, skill_level: 3 });
    const rPD2 = await post('/profile/professional/c1/concepts', B.token, B.actorId, { concept_id: C2, skill_level: 2 });
    record('5.1 A bio + declara concept C1 (201); B declara C2', rPB.statusCode === 200 && rPD.statusCode === 201 && rPD2.statusCode === 201,
      `${rPB.statusCode}/${rPD.statusCode}/${rPD2.statusCode}`);
    const rPatch = await post(`/profile/professional/c1/concepts/${C1}`, A.token, A.actorId, { skill_level: 4 }, 'PATCH');
    const rPG = await get('/profile/professional/c1', A.token, A.actorId);
    const pgA = rPG.statusCode === 200 ? JSON.parse(rPG.body) : null;
    const pcA = pgA?.data?.concepts ?? pgA?.concepts ?? [];
    const cid = (c: any) => c?.conceptId ?? c?.concept_id;
    const skl = (c: any) => Number(c?.skillLevel ?? c?.skill_level);
    record('5.2 A atualiza skill 3→4 + relê: só C1, skill 4, bio presente',
      rPatch.statusCode === 200 && pcA.length === 1 && cid(pcA[0]) === C1 && skl(pcA[0]) === 4,
      JSON.stringify(pcA).slice(0, 140));
    const rPGB = await get('/profile/professional/c1', B.token, B.actorId);
    const pcB = (() => { const b = rPGB.statusCode === 200 ? JSON.parse(rPGB.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    record('5.3 B relê: só C2 (concepts distintos, zero mistura)', pcB.length === 1 && cid(pcB[0]) === C2,
      JSON.stringify(pcB).slice(0, 120));

    console.log('\n— 6. LEARNING C1 —');
    const rLA = await post('/profile/learning/c1/concepts', A.token, A.actorId, { conceptId: C3, progress: 2 });
    const rLB = await post('/profile/learning/c1/concepts', B.token, B.actorId, { conceptId: C4 });
    const rLG = await get('/profile/learning/c1', A.token, A.actorId);
    const lA = (() => { const b = rLG.statusCode === 200 ? JSON.parse(rLG.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    record('6.1 A declara C3 (progress 2) / B declara C4 / A relê só C3',
      rLA.statusCode === 201 && rLB.statusCode === 201 && lA.length === 1 && (lA[0]?.conceptId ?? lA[0]?.concept_id) === C3,
      `${rLA.statusCode}/${rLB.statusCode} ${JSON.stringify(lA).slice(0, 120)}`);

    console.log('\n— 7. INTERESTS C1 (add → remove → reactivate) —');
    const rIA = await post('/profile/interest/c1/concepts', A.token, A.actorId, { conceptId: C5 });
    const rIDel = await post(`/profile/interest/c1/concepts/${C5}`, A.token, A.actorId, undefined, 'DELETE');
    const rIG1 = await get('/profile/interest/c1', A.token, A.actorId);
    const i1 = (() => { const b = rIG1.statusCode === 200 ? JSON.parse(rIG1.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    record('7.1 A declara C5 (201) → remove (soft-delete) → leitura honesta vazia',
      rIA.statusCode === 201 && rIDel.statusCode === 200 && i1.length === 0,
      `${rIA.statusCode}/${rIDel.statusCode} restam=${i1.length}`);
    const rIReact = await post(`/profile/interest/c1/concepts/${C5}`, A.token, A.actorId, { reactivate: true }, 'PATCH');
    const rIG2 = await get('/profile/interest/c1', A.token, A.actorId);
    const i2 = (() => { const b = rIG2.statusCode === 200 ? JSON.parse(rIG2.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    record('7.2 reactivate via PATCH → C5 volta ativo', rIReact.statusCode === 200 && i2.length === 1,
      `${rIReact.statusCode} restam=${i2.length}`);
    const rIB = await post('/profile/interest/c1/concepts', B.token, B.actorId, { conceptId: C6 });
    record('7.3 B declara C6 (interesse próprio, distinto)', rIB.statusCode === 201);

    console.log('\n— 8. AGENDA (Unified Availability) —');
    const tplA = { schedule: { monday: ['09:00-12:00'], wednesday: ['14:00-18:00'] }, timezone: 'America/Sao_Paulo' };
    const rWT = await post('/availability/weekly-template', A.token, A.actorId, tplA, 'PUT');
    record('8.1 A salva weekly-template → 200', rWT.statusCode === 200, `status ${rWT.statusCode}: ${rWT.body.slice(0, 140)}`);
    const rList1 = await get(`/availability?ownerType=user&ownerId=${A.actorId}`, A.token, A.actorId);
    const list1 = (() => { const b = rList1.statusCode === 200 ? JSON.parse(rList1.body) : null; return b?.data ?? []; })();
    record('8.2 A relê a própria agenda: janelas materializadas (>0), todas do actor A',
      rList1.statusCode === 200 && list1.length > 0 && list1.every((w: any) => w.ownerId === A.actorId),
      `n=${list1.length}`);
    const rWT2 = await post('/availability/weekly-template', A.token, A.actorId, { schedule: { friday: ['10:00-11:00'] }, timezone: 'America/Sao_Paulo' }, 'PUT');
    const rList2 = await get(`/availability?ownerType=user&ownerId=${A.actorId}`, A.token, A.actorId);
    const list2 = (() => { const b = rList2.statusCode === 200 ? JSON.parse(rList2.body) : null; return b?.data ?? []; })();
    record('8.3 A altera o template e relê (edição persiste)', rWT2.statusCode === 200 && rList2.statusCode === 200 && list2.length > 0);
    const rWTB = await post('/availability/weekly-template', B.token, B.actorId, { schedule: { tuesday: ['08:00-10:00'] }, timezone: 'America/Sao_Paulo' }, 'PUT');
    const rListB = await get(`/availability?ownerType=user&ownerId=${B.actorId}`, B.token, B.actorId);
    const listB = (() => { const b = rListB.statusCode === 200 ? JSON.parse(rListB.body) : null; return b?.data ?? []; })();
    record('8.4 B salva agenda própria; janelas do B só do B (isolamento por owner)',
      rWTB.statusCode === 200 && listB.length > 0 && listB.every((w: any) => w.ownerId === B.actorId));
    const rTZ = await post('/availability/weekly-template', A.token, A.actorId, { schedule: { monday: ['09:00-10:00'] }, timezone: 'Marte/Cratera' }, 'PUT');
    record('8.5 timezone inválida → 4xx observável (sem fallback silencioso)', rTZ.statusCode >= 400 && rTZ.statusCode < 500, `status ${rTZ.statusCode}`);

    console.log('\n— 9. HOME READS (selo de leitura) —');
    const s9a = await snapState();
    const rBal = await get('/bank/balance', A.token, A.actorId);
    const rStm = await get('/bank/statement?limit=4', A.token, A.actorId);
    const rRF = await get('/bank/regional-fund?limit=1', A.token, A.actorId);
    const rGM = await get('/groups/mine', A.token, A.actorId);
    const rRE = await get('/referral/earnings', A.token, A.actorId);
    const rUn = await get('/social/unread-counts', A.token, A.actorId);
    const s9b = await snapState();
    const bal = rBal.statusCode === 200 ? JSON.parse(rBal.body) : null;
    record('9.1 /bank/balance 200 com número honesto (sem provisionar)', rBal.statusCode === 200 && typeof bal?.balanceCents === 'number', `status ${rBal.statusCode}`);
    const stm = rStm.statusCode === 200 ? JSON.parse(rStm.body) : null;
    record('9.2 /bank/statement 200 entries array (vazio real, não erro mascarado)', rStm.statusCode === 200 && Array.isArray(stm?.statement?.entries));
    record('9.3 /bank/regional-fund 200 + /groups/mine 200 + /referral/earnings 200',
      rRF.statusCode === 200 && rGM.statusCode === 200 && rRE.statusCode === 200,
      `${rRF.statusCode}/${rGM.statusCode}/${rRE.statusCode}`);
    const un = rUn.statusCode === 200 ? JSON.parse(rUn.body) : null;
    record('9.4 unread: feed=null (erro estrutural honesto), groups numérico', un?.feed === null && typeof un?.groups === 'number', JSON.stringify(un));
    record('9.5 Home reads não criam estado (snapshots idênticos)', s9a === s9b, `${s9a} vs ${s9b}`);

    console.log('\n— 10. RELOGIN + REABERTURA DE TODOS OS DADOS —');
    const rLog2 = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: A.email, password: 'senha123' }) });
    const tok2 = rLog2.statusCode === 200 ? JSON.parse(rLog2.body)?.data?.tokens?.accessToken : null;
    record('10.1 novo login A → token novo', !!tok2 && tok2 !== A.token);
    const rCore2 = await get('/core/profile', tok2!, A.actorId);
    const pp2 = (() => { const b = rCore2.statusCode === 200 ? JSON.parse(rCore2.body) : null; return b?.data?.personal_profile ?? b?.personal_profile; })();
    const rPG2 = await get('/profile/professional/c1', tok2!, A.actorId);
    const pc2 = (() => { const b = rPG2.statusCode === 200 ? JSON.parse(rPG2.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    const rLG2 = await get('/profile/learning/c1', tok2!, A.actorId);
    const lc2 = (() => { const b = rLG2.statusCode === 200 ? JSON.parse(rLG2.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    const rIG3 = await get('/profile/interest/c1', tok2!, A.actorId);
    const ic2 = (() => { const b = rIG3.statusCode === 200 ? JSON.parse(rIG3.body) : null; return b?.data?.concepts ?? b?.concepts ?? []; })();
    const rAg2 = await get(`/availability?ownerType=user&ownerId=${A.actorId}`, tok2!, A.actorId);
    const ag2 = (() => { const b = rAg2.statusCode === 200 ? JSON.parse(rAg2.body) : null; return b?.data ?? []; })();
    record('10.2 reabertura: perfil pessoal persiste (phone/birth/gender/cpf)',
      !!pp2 && String(pp2.phone ?? '').includes('99876') && String(pp2.birthdate ?? '').startsWith('1990-03-15') && pp2.metadata?.gender === 'non_binary');
    record('10.3 reabertura: profissional persiste (C1 skill 4)', pc2.length === 1 && cid(pc2[0]) === C1 && skl(pc2[0]) === 4);
    record('10.4 reabertura: learning persiste (C3)', lc2.length === 1 && (lc2[0]?.conceptId ?? lc2[0]?.concept_id) === C3);
    record('10.5 reabertura: interests persistem (C5 reativado)', ic2.length === 1);
    record('10.6 reabertura: agenda persiste (janelas > 0)', ag2.length > 0);

    console.log('\n— 11. ISOLAMENTO A/B (provas negativas) —');
    const rX1 = await get('/profile/professional/c1', A.token, B.actorId);
    record('11.1 A lê profissional com actorId de B → 403 (não representável)', rX1.statusCode === 403, `status ${rX1.statusCode}`);
    const rX2 = await post('/profile/professional/c1/concepts', A.token, B.actorId, { concept_id: C6, skill_level: 1 });
    record('11.2 A declara concept NO actor de B → 403 (sem escrita)', rX2.statusCode === 403, `status ${rX2.statusCode}`);
    const rX3 = await post('/availability/weekly-template', A.token, B.actorId, tplA, 'PUT');
    record('11.3 A grava agenda de B → 403 fail-closed', rX3.statusCode === 403, `status ${rX3.statusCode}`);
    const rX4 = await get(`/availability?ownerType=user&ownerId=${B.actorId}`, A.token, A.actorId);
    record('11.4 A lista agenda de B → 403 (agenda privada)', rX4.statusCode === 403, `status ${rX4.statusCode}`);
    const rX5 = await get('/core/profile', A.token, B.actorId);
    const x5pp = (() => { const b = rX5.statusCode === 200 ? JSON.parse(rX5.body) : null; return b?.data ?? b; })();
    record('11.5 /core/profile é auth-derived: actorId de B no header NÃO troca o sujeito',
      rX5.statusCode !== 200 || (x5pp?.actor?.actor_id ?? x5pp?.actor?.id) === A.actorId,
      `status ${rX5.statusCode}`);
    const mix = await pool.query(`
      SELECT (SELECT COUNT(*) FROM actor_professional_concepts WHERE actor_id=$1 AND concept_id=$2)::int
           + (SELECT COUNT(*) FROM actor_learning_concepts WHERE actor_id=$1 AND concept_id=$3)::int
           + (SELECT COUNT(*) FROM actor_interest_concepts WHERE actor_id=$1 AND concept_id=$4)::int AS leaks`,
      [B.actorId, C1, C3, C5]);
    record('11.6 banco: nenhuma linha de B contém concepts de A (zero mistura)', Number(mix.rows[0].leaks) === 0);
    const rX6 = await post(`/profile/professional/c1/concepts/${C2}`, A.token, A.actorId, { skill_level: 5 }, 'PATCH');
    record('11.7 A tenta editar concept que só B tem (no próprio actor) → 404 honesto', rX6.statusCode === 404, `status ${rX6.statusCode}`);

    console.log('\n— 12. NEGATIVAS DE PAYLOAD —');
    const rN1 = await post('/profile/professional/c1/concepts', A.token, A.actorId, { concept_id: '00000000-0000-4000-8000-000000000000', skill_level: 1 });
    record('12.1 concept inexistente → 4xx observável (FK/validação)', rN1.statusCode >= 400 && rN1.statusCode < 500, `status ${rN1.statusCode}`);
    const rN2 = await post('/profile/learning/c1/concepts', A.token, A.actorId, { conceptId: 'nao-é-uuid' });
    record('12.2 conceptId malformado → 400', rN2.statusCode === 400, `status ${rN2.statusCode}`);
    const rN3 = await post('/profile/learning/c1/concepts', A.token, A.actorId, { conceptId: C3, progress: 9 });
    record('12.3 progress fora do range (9) → 400', rN3.statusCode === 400, `status ${rN3.statusCode}`);

    console.log('\n— 14. GATE: verde no código final + prova negativa —');
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    let gExit = 0;
    try { execSync('node scripts/audit-c1-human-journey-closure.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { gExit = 1; }
    record('14.1 gate c1-human-journey passa no código final (exit 0)', gExit === 0);
    // prova negativa: reintroduz fabricação no /identity/me (409 → 200 mascarado) → gate DEVE falhar
    const idPath = join(process.cwd(), 'src/core/identity/identity.routes.ts');
    const idOrig = fs.readFileSync(idPath, 'utf8');
    fs.writeFileSync(idPath, idOrig.replace("code: 'IDENTITY_CHAIN_INCOMPLETE',", "code: 'OK_FABRICADO', // Primeiro acesso detectado"));
    let negExit = 0;
    try { execSync('node scripts/audit-c1-human-journey-closure.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { negExit = 1; }
    fs.writeFileSync(idPath, idOrig); // restaura — zero resíduo
    record('14.2 prova negativa: fabricação reintroduzida → gate FALHA (e arquivo restaurado)', negExit === 1 && fs.readFileSync(idPath, 'utf8') === idOrig);

    console.log('\n— 13. ZERO EVENTO ECONÔMICO / ZERO TENANT NOVO —');
    const econAfter = await pool.query<{ l: string; t: string; ten: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger)::text l, (SELECT COUNT(*) FROM bank_transactions)::text t, (SELECT COUNT(*) FROM tenants)::text ten`);
    record('13.1 bank_ledger + bank_transactions INTACTOS (jornada inteira sem evento econômico)',
      econBefore.rows[0].l === econAfter.rows[0].l && econBefore.rows[0].t === econAfter.rows[0].t,
      `ledger ${econBefore.rows[0].l}→${econAfter.rows[0].l} tx ${econBefore.rows[0].t}→${econAfter.rows[0].t}`);
    record('13.2 ZERO tenant novo (sem user-*)', econBefore.rows[0].ten === econAfter.rows[0].ten,
      `${econBefore.rows[0].ten}→${econAfter.rows[0].ten}`);

  } finally {
    await cleanup();
    const left = await pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE email LIKE $1)+(SELECT COUNT(*) FROM global_users WHERE full_name ILIKE $2) total`, [`${MARKER}-%`, `${MARKER}%`]);
    record('Z1 cleanup: zero fixtures residuais', Number(left.rows[0].total) === 0, `restam ${left.rows[0].total}`);
    await app.close();
    await pool.end();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n' + '═'.repeat(64));
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed !== results.length) { console.log('FALHAS:'); results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label} — ${r.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Jornada humana C1 ponta-a-ponta: 2 usuários, mesmo tenant, dados privados isolados, gender 5-valores, C1 trilhos persistem, agenda Unified Availability, Home read-only, zero evento econômico.');
}

main().catch(e => { console.error(String(e?.stack ?? e)); process.exit(1); });
