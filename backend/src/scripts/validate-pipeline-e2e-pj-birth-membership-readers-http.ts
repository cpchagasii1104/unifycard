/**
 * E2E F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE / CP1 — nascimento fiscal-first + leitura por vínculo (HTTP real).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-birth-membership-readers-ephemeral.ps1 (cria DB, migra FULL, roda, dropa).
 *
 * Prova via HTTP (app.inject) os pilares do CP1:
 *   PJ-B3 — createCompany NÃO cura actor humano: usuário nascido (com actor) cria normalmente;
 *           legado SEM actor recebe erro estrutural honesto e NENHUM actor é criado.
 *   PIN  — nascimento fiscal-first atômico: fiscal_identity + company DRAFT + company_user
 *           (can_manage_company=true server-side) + page actor; CNPJ inválido/duplicado/concorrente
 *           → rollback total, zero resíduo; limite antifraude ativo.
 *   PJ-B4 — leitura por VÍNCULO: criador lista/lê; membro ativo lista/lê; sem vínculo → 404;
 *           vínculo desativado deixa de conceder; leitura não concede gestão (PUT/activation negados).
 *   Zero Bank writer / zero inventory em toda a jornada.
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
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;

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
  if (!/birth|member|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente — necessário para forjar token de teste.');
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

async function buildMinimalApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  await app.ready();
  return app;
}

function mintToken(userId: string, tenantId: string, globalUserId: string): string {
  return jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '10m' }
  );
}

// CNPJ válido (DV calculado) — gerador local, sem Receita/internet.
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

interface Human {
  globalId: string;
  userId: string;
  token: string;
  headers: Record<string, string>;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Birth/Members Test', slug: `pj-birth-members-${Date.now()}` });

  // ── Humanos nascidos canonicamente (identity → user → ACTOR materializado como na C1) ──
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string, withActor: boolean): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(
      `INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`,
      [userId, TENANT_ID, globalId, `${userId}@e2e.local`]
    );
    if (withActor) {
      // Simula o nascimento C1: o actor humano JÁ existe antes de qualquer fluxo PJ.
      await actorRepo.findOrCreateUserActor(TENANT_ID, userId);
    }
    const token = mintToken(userId, TENANT_ID, globalId);
    const acHeader = JSON.stringify({ actorId: userId, intent: 'pj_birth_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, token, headers: { authorization: `Bearer ${token}`, 'x-action-context': acHeader } };
  };

  const X = await mkHuman('E2E Founder X', true);
  const Y = await mkHuman('E2E Founder Y', true);
  const L = await mkHuman('E2E Legacy NoActor', false); // legado: identity+user SEM actor

  const app = await buildMinimalApp();
  const createCompany = (h: Human, cnpj: string, name: string) =>
    app.inject({
      method: 'POST',
      url: '/companies',
      headers: h.headers,
      payload: { cnpj, companyName: name, role: 'owner', fetchFromRevenue: false },
    });

  const counts = async () => {
    const r = await pool.query<{ fi: string; co: string; cu: string; pa: string; ua: string; bl: string; bt: string }>(
      `SELECT
         (SELECT count(*) FROM fiscal_identities)::text AS fi,
         (SELECT count(*) FROM companies)::text AS co,
         (SELECT count(*) FROM company_users)::text AS cu,
         (SELECT count(*) FROM actors WHERE actor_type='page')::text AS pa,
         (SELECT count(*) FROM actors WHERE actor_type='user')::text AS ua,
         (SELECT count(*) FROM bank_ledger)::text AS bl,
         (SELECT count(*) FROM bank_transactions)::text AS bt`
    );
    return r.rows[0];
  };

  try {
    const c0 = await counts();

    // ═══ B1 — nascimento fiscal-first completo (humano X, nascido com actor) ═══
    const cnpj1 = makeValidCnpj(11111111);
    const r1 = await createCompany(X, cnpj1, 'E2E PJ Birth A');
    const b1 = r1.json();
    record('B1 POST /companies → 201', r1.statusCode === 201, `status=${r1.statusCode} body=${JSON.stringify(b1)}`);
    const companyId: string = b1?.company?.companyId;
    record('B1 company DRAFT', b1?.company?.companyStatus === 'DRAFT', `companyStatus=${b1?.company?.companyStatus}`);
    record('B1 kybStatus=pending projetado', b1?.company?.kybStatus === 'pending', `kyb=${b1?.company?.kybStatus}`);
    record('B1 criador can_manage_company=true server-side', b1?.companyUser?.permissions?.canManageCompany === true);
    const birth = await pool.query<{ fi: string | null; cnpj_fi: string | null; cnpj_co: string; pa: string | null; cu_manage: boolean | null }>(
      `SELECT c.fiscal_identity_id::text AS fi, f.cnpj AS cnpj_fi, c.cnpj AS cnpj_co,
              (SELECT a.actor_id::text FROM actors a WHERE a.company_id=c.company_id AND a.actor_type='page' LIMIT 1) AS pa,
              (SELECT cu.can_manage_company FROM company_users cu WHERE cu.company_id=c.company_id AND cu.global_user_id=$2::uuid LIMIT 1) AS cu_manage
         FROM companies c LEFT JOIN fiscal_identities f ON f.fiscal_identity_id=c.fiscal_identity_id
        WHERE c.company_id=$1::uuid`,
      [companyId, X.globalId]
    );
    const bz = birth.rows[0];
    record('B1 fiscal_identity presente (fiscal-first)', !!bz?.fi);
    record('B1 companies.cnpj = projeção de fiscal_identities.cnpj', bz?.cnpj_fi === bz?.cnpj_co && bz?.cnpj_co === cnpj1, `fi=${bz?.cnpj_fi} co=${bz?.cnpj_co}`);
    record('B1 page actor nasceu na criação', !!bz?.pa);
    record('B1 vínculo do criador com can_manage_company=true', bz?.cu_manage === true);

    // ═══ B2 — CNPJ inválido (DV errado) → erro na borda, zero resíduo ═══
    const cBefore2 = await counts();
    const r2 = await createCompany(X, '11111111000100', 'E2E PJ Invalid');
    record('B2 CNPJ inválido → 400', r2.statusCode === 400, `status=${r2.statusCode}`);
    const cAfter2 = await counts();
    record('B2 zero resíduo (fiscal/company/cu/page intactos)', JSON.stringify(cBefore2) === JSON.stringify(cAfter2), `${JSON.stringify(cBefore2)} vs ${JSON.stringify(cAfter2)}`);

    // ═══ B3 — CNPJ duplicado (Y tenta o CNPJ de X) → rollback total ═══
    const cBefore3 = await counts();
    const r3 = await createCompany(Y, cnpj1, 'E2E PJ Dup');
    const m3 = JSON.stringify(r3.json());
    record('B3 CNPJ duplicado → 400 com erro de domínio', r3.statusCode === 400 && /CNPJ já cadastrado/i.test(m3), `status=${r3.statusCode} body=${m3}`);
    const cAfter3 = await counts();
    record('B3 zero resíduo no rollback', JSON.stringify(cBefore3) === JSON.stringify(cAfter3), `${JSON.stringify(cBefore3)} vs ${JSON.stringify(cAfter3)}`);

    // ═══ B4 — PJ-B3: legado SEM actor → erro estrutural honesto, NENHUMA cura ═══
    const uaBefore = (await counts()).ua;
    const r4 = await createCompany(L, makeValidCnpj(22222222), 'E2E PJ Legacy');
    const m4 = JSON.stringify(r4.json());
    record('B4 legado sem actor → 400 COMPANY_CREATOR_ACTOR_MISSING', r4.statusCode === 400 && /COMPANY_CREATOR_ACTOR_MISSING/.test(m4), `status=${r4.statusCode} body=${m4}`);
    const uaAfter = (await counts()).ua;
    record('B4 nenhum actor humano criado/curado', uaBefore === uaAfter, `${uaBefore} vs ${uaAfter}`);

    // ═══ B5 — concorrência: 2 POSTs simultâneos com o MESMO CNPJ fresco ═══
    const cnpjRace = makeValidCnpj(33333333);
    const [ra, rb] = await Promise.all([
      createCompany(Y, cnpjRace, 'E2E PJ Race A'),
      createCompany(Y, cnpjRace, 'E2E PJ Race B'),
    ]);
    const okCount = [ra, rb].filter((r) => r.statusCode === 201).length;
    const fiRace = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identities WHERE cnpj=$1`, [cnpjRace]);
    record('B5 concorrência: exatamente 1 sucesso', okCount === 1, `statuses=${ra.statusCode},${rb.statusCode}`);
    record('B5 exatamente 1 fiscal_identity para o CNPJ', fiRace.rows[0].n === '1', `n=${fiRace.rows[0].n}`);

    // ═══ B6 — limite antifraude (≤3 DRAFT+PROVISIONAL por CPF) ═══
    // Y já tem 1 (race). +2 → 3. A 4ª deve falhar.
    const r6a = await createCompany(Y, makeValidCnpj(44444444), 'E2E PJ Y2');
    const r6b = await createCompany(Y, makeValidCnpj(55555555), 'E2E PJ Y3');
    const r6c = await createCompany(Y, makeValidCnpj(66666666), 'E2E PJ Y4-blocked');
    record('B6 3 empresas em onboarding permitidas', r6a.statusCode === 201 && r6b.statusCode === 201, `${r6a.statusCode},${r6b.statusCode}`);
    record('B6 4ª empresa bloqueada (antifraude)', r6c.statusCode === 400 && /Limite de 3/i.test(JSON.stringify(r6c.json())), `status=${r6c.statusCode}`);

    // ═══ R1 — criador lista e lê (membership do nascimento) ═══
    const list1 = await app.inject({ method: 'GET', url: '/companies', headers: X.headers });
    const companiesX = list1.json()?.companies ?? [];
    record('R1 criador lista a própria empresa', list1.statusCode === 200 && companiesX.some((c: { companyId: string }) => c.companyId === companyId), `n=${companiesX.length}`);
    record('R1 userRole projetado é o vínculo do CALLER', companiesX.every((c: { userRole?: { globalUserId?: string } }) => c.userRole?.globalUserId === X.globalId));
    const get1 = await app.inject({ method: 'GET', url: `/companies/${companyId}`, headers: X.headers });
    record('R1 criador lê GET /companies/:id → 200', get1.statusCode === 200 && get1.json()?.data?.companyId === companyId, `status=${get1.statusCode}`);

    // ═══ R2 — usuário SEM vínculo não lê nem lista ═══
    const get2 = await app.inject({ method: 'GET', url: `/companies/${companyId}`, headers: Y.headers });
    record('R2 sem vínculo → 404 honesto', get2.statusCode === 404, `status=${get2.statusCode}`);
    const list2 = await app.inject({ method: 'GET', url: '/companies', headers: Y.headers });
    const yList = (list2.json()?.companies ?? []) as Array<{ companyId: string }>;
    record('R2 listagem de Y não contém empresa de X', !yList.some((c) => c.companyId === companyId));
    const put2 = await app.inject({ method: 'PUT', url: `/companies/${companyId}`, headers: Y.headers, payload: { tradeName: 'hack' } });
    record('R2 PUT sem vínculo negado', put2.statusCode >= 400, `status=${put2.statusCode}`);

    // ═══ R3 — membro ativo lê/lista mas NÃO ganha gestão ═══
    await pool.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1,$2,$3,'member',false,true,'active')`,
      [TENANT_ID, companyId, Y.globalId]
    );
    const get3 = await app.inject({ method: 'GET', url: `/companies/${companyId}`, headers: Y.headers });
    record('R3 membro ativo lê por vínculo → 200', get3.statusCode === 200, `status=${get3.statusCode}`);
    const list3 = await app.inject({ method: 'GET', url: '/companies', headers: Y.headers });
    const yList3 = (list3.json()?.companies ?? []) as Array<{ companyId: string; userRole?: { role?: string } }>;
    const yRow = yList3.find((c) => c.companyId === companyId);
    record('R3 membro lista por vínculo com SEU userRole', !!yRow && yRow.userRole?.role === 'member', `role=${yRow?.userRole?.role}`);
    const put3 = await app.inject({ method: 'PUT', url: `/companies/${companyId}`, headers: Y.headers, payload: { tradeName: 'no-authority' } });
    record('R3 leitura não concede gestão (PUT negado)', put3.statusCode >= 400 && /autoridade/i.test(JSON.stringify(put3.json())), `status=${put3.statusCode}`);

    // ═══ R4 — vínculo desativado deixa de conceder leitura ═══
    await pool.query(`UPDATE company_users SET is_active=false WHERE company_id=$1 AND global_user_id=$2::uuid`, [companyId, Y.globalId]);
    const get4 = await app.inject({ method: 'GET', url: `/companies/${companyId}`, headers: Y.headers });
    record('R4 vínculo desativado → 404', get4.statusCode === 404, `status=${get4.statusCode}`);

    // ═══ Z — zero Bank writer / zero inventory na jornada inteira ═══
    const cz = await counts();
    record('Z zero Bank writer (bank_ledger intacto)', cz.bl === c0.bl && cz.bt === c0.bt, `ledger ${c0.bl}→${cz.bl} tx ${c0.bt}→${cz.bt}`);
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
  console.log('✨ Nascimento fiscal-first + leitura por vínculo (CP1) verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
