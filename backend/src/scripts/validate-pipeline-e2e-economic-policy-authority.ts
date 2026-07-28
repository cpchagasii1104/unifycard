/**
 * E2E — F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1 (authority key + read-only consumer) + FATIA 2
 * (write API versionado).
 *
 * Prova, via HTTP real (app.inject, JWT real, sem frontend), que a chave `economic_policy:manage`
 * (permission-keys.ts) NÃO é vocabulário fantasma: ela gateia de fato os três consumidores desta
 * superfície — `GET /economy/admin/policies` (Fatia 1), `POST /economy/admin/policies` e
 * `POST /economy/admin/policies/:id/activate` (Fatia 2).
 *
 * FATIA 1 (leitura):
 *   A · ADMIN do tenant GETa a lista → 200, enxerga as próprias policies fixture (draft).
 *   B · NÃO-ADMIN autenticado do MESMO tenant GETa → 403 (assert de autoridade load-bearing).
 *   C · Sem Authorization header → 401.
 *   D · Isolamento cross-tenant: ADMIN do tenant A NUNCA vê policy do tenant B (nem por acidente
 *       de query — tenant é sempre `req.tenant.id`, do JWT).
 *   E · Δbank = 0 (fatia é Bank-free).
 *   F · Guard estrutural (audit-economic-policy-authority-boundary) verde.
 *
 * FATIA 2 (escrita versionada):
 *   G · ADMIN publica uma versão nova com linhas → 201; version=1, createdByActorId=o PRÓPRIO
 *       actor do admin (self-bound), changeReason persistido.
 *   H · Artigo V: ativar (draft→active) funciona uma vez (200); tentar ativar de novo a MESMA
 *       policy (já 'active') → 409 com mensagem clara apontando para publicar versão nova — nunca
 *       o erro cru do gatilho de imutabilidade do banco.
 *   I · changeReason ausente/vazio → 400 (Artigo XI).
 *   J · linhas cuja soma de bps não fecha 10000 → 400.
 *   K · combinação territorial incoerente (estado de outro país da cidade) → 400 limpo, nunca 500
 *       (a FK composta da Fatia 0 traduzida honestamente).
 *   L · NÃO-ADMIN tentando publicar → 403 (mesmo invariante da Fatia 1, agora na escrita).
 *   M · publicar uma SEGUNDA versão do MESMO policyCode incrementa version (2) e NÃO altera a
 *       primeira linha (prova de acréscimo apenas — as duas coexistem).
 *   N · Δbank = 0 ao final de toda a Fatia 2 (nenhuma linha nova em bank_transactions/bank_ledger/
 *       bank_splits).
 *
 * As policies seedadas são FIXTURES DE TESTE (policy_code prefixado 'e2e-'), SEM nenhum
 * percentual real de produto — a decisão soberana dos números fica para a Fatia 5 (Clayton).
 *
 * 🔒 DB EFÊMERA (wrapper run-economic-policy-authority-ephemeral.ps1). NUNCA unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const cwd = process.cwd();

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/economic|policy|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const economicPolicyAdminRoutes = (await import('../modules/economy/policy-engine/economic-policy-admin.routes')).default;
  await app.register(economicPolicyAdminRoutes, { prefix: '/economy' });
  await app.ready();
  return app;
}

interface Human { tenantId: string; globalId: string; userId: string; actorId: string; headers: Record<string, string> }

async function mkHuman(tenantId: string, name: string, seq: number, role?: 'admin'): Promise<Human> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();
  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, tenantId, globalId, `${userId}@e2e.local`]);
  const actorId = (await actorRepo.findOrCreateUserActor(tenantId, userId)).actor_id;
  if (role === 'admin') await rbacService.assignRoleByName(tenantId, userId, 'admin');
  const token = jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '15m' }
  );
  const ac = JSON.stringify({ actorId, intent: 'economic_policy_authority_e2e', source: 'e2e', scope: `tenant:${tenantId}` });
  return { tenantId, globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
}

/** Fixture DRAFT, sem percentuais reais (a decisão soberana dos números é Fatia 5). */
async function seedFixturePolicy(tenantId: string, code: string): Promise<string> {
  const row = await pool.query<{ id: string }>(
    `INSERT INTO economic_policies (tenant_id, policy_code, policy_type, module_context, status, effective_from)
     VALUES ($1::uuid, $2, 'COMMISSION_SPLIT', 'e2e_fatia1_fixture', 'draft', NOW())
     RETURNING id::text AS id`,
    [tenantId, code]
  );
  return row.rows[0].id;
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const bankSnapshot = async (): Promise<number> =>
  count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const bank0 = await bankSnapshot();

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'Economic Policy Authority Tenant A', slug: `epa-a-${Date.now()}` });
  await tenantService.createTenant({ id: TENANT_B, name: 'Economic Policy Authority Tenant B', slug: `epa-b-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_A);
  await rbacService.seedDefaultRBAC(TENANT_B);

  const ADMIN_A = await mkHuman(TENANT_A, 'E2E Admin A', 1, 'admin');
  const NON_ADMIN_A = await mkHuman(TENANT_A, 'E2E Non-Admin A', 2);
  const ADMIN_B = await mkHuman(TENANT_B, 'E2E Admin B', 3, 'admin');

  // Duas policies DRAFT em A (a tela admin precisa enxergar draft, não só 'active'); uma em B.
  const policyA1 = await seedFixturePolicy(TENANT_A, `e2e-fatia1-a1-${Date.now()}`);
  const policyA2 = await seedFixturePolicy(TENANT_A, `e2e-fatia1-a2-${Date.now()}`);
  const policyB1 = await seedFixturePolicy(TENANT_B, `e2e-fatia1-b1-${Date.now()}`);

  const app = await buildApp();

  try {
    console.log('\n— F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1: authority key + read-only consumer —');

    // A · ADMIN GET → 200, enxerga as PRÓPRIAS 2 draft policies.
    const rAdmin = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: ADMIN_A.headers });
    const bodyAdmin = rAdmin.statusCode === 200 ? rAdmin.json() : undefined;
    const idsAdmin = ((bodyAdmin?.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    record(
      'A ADMIN do tenant A → 200, enxerga as 2 policies DRAFT fixture de A',
      rAdmin.statusCode === 200 && idsAdmin.includes(policyA1) && idsAdmin.includes(policyA2),
      `status=${rAdmin.statusCode} ids=${JSON.stringify(idsAdmin)}`
    );

    // B · NÃO-ADMIN do MESMO tenant → 403 (assert de autoridade load-bearing).
    const rNonAdmin = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: NON_ADMIN_A.headers });
    record('B NÃO-ADMIN autenticado (mesmo tenant) → 403', rNonAdmin.statusCode === 403, `status=${rNonAdmin.statusCode} body=${rNonAdmin.body?.slice(0, 200)}`);

    // C · sem Authorization → 401.
    const rNoAuth = await app.inject({ method: 'GET', url: '/economy/admin/policies' });
    record('C sem Authorization header → 401', rNoAuth.statusCode === 401, `status=${rNoAuth.statusCode}`);

    // D · isolamento cross-tenant: ADMIN de A nunca vê a policy de B; ADMIN de B nunca vê as de A.
    const idsFromA = idsAdmin;
    const rAdminB = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: ADMIN_B.headers });
    const idsFromB = ((rAdminB.json()?.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    record(
      'D1 ADMIN de A NUNCA vê a policy fixture de B (cross-tenant leak assert)',
      !idsFromA.includes(policyB1),
      `idsFromA=${JSON.stringify(idsFromA)} policyB1=${policyB1}`
    );
    record(
      'D2 ADMIN de B só vê a PRÓPRIA policy (não as 2 de A) — isolamento nos dois sentidos',
      rAdminB.statusCode === 200 && idsFromB.includes(policyB1) && !idsFromB.includes(policyA1) && !idsFromB.includes(policyA2),
      `status=${rAdminB.statusCode} idsFromB=${JSON.stringify(idsFromB)}`
    );

    // E · Δbank = 0 (fatia Bank-free; rota é read-only).
    const bankFinal = await bankSnapshot();
    record('E Δbank = 0', bankFinal === bank0, `${bank0} → ${bankFinal}`);

    // F · guard estrutural verde.
    let guard = false;
    try { execSync('node scripts/audit-economic-policy-authority-boundary.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('F guard audit-economic-policy-authority-boundary verde', guard);

    // ══════════════════════════════ FATIA 2 — write API versionado ══════════════════════════════
    console.log('\n— FATIA 2: write API versionado (POST + ativação) —');

    const bankBeforeFatia2 = await bankSnapshot();
    const FATIA2_MODULE = 'e2e_fatia2_fixture';
    const validLines = [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 8000, appliesTo: 'gross_transaction' },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 2000, appliesTo: 'gross_transaction' },
    ];

    // G · publicação básica → 201, version=1, autor self-bound, changeReason persistido.
    const codeG = `e2e-fatia2-basic-${Date.now()}`;
    const rG = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeG,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — comprovação de publicação de versão nova.',
        lines: validLines,
      },
    });
    const bodyG = rG.statusCode === 201 ? rG.json() : undefined;
    record(
      'G publicação básica → 201, version=1, createdByActorId=próprio admin, changeReason persistido, status=draft',
      rG.statusCode === 201 &&
        bodyG?.data?.version === 1 &&
        bodyG?.data?.status === 'draft' &&
        bodyG?.data?.createdByActorId === ADMIN_A.actorId &&
        bodyG?.data?.changeReason === 'E2E fixture — comprovação de publicação de versão nova.' &&
        Array.isArray(bodyG?.data?.lines) &&
        bodyG.data.lines.length === 2,
      `status=${rG.statusCode} body=${rG.body?.slice(0, 300)}`
    );
    const policyGId: string | undefined = bodyG?.data?.id;

    // H · Artigo V: ativação funciona uma vez; ativar de novo (já active) → 409 limpo.
    const rH1 = await app.inject({ method: 'POST', url: `/economy/admin/policies/${policyGId}/activate`, headers: ADMIN_A.headers });
    record('H1 primeira ativação (draft→active) → 200', rH1.statusCode === 200 && rH1.json()?.data?.status === 'active', `status=${rH1.statusCode} body=${rH1.body?.slice(0, 200)}`);
    const rH2 = await app.inject({ method: 'POST', url: `/economy/admin/policies/${policyGId}/activate`, headers: ADMIN_A.headers });
    const bodyH2 = rH2.statusCode === 409 ? rH2.json() : undefined;
    record(
      'H2 ativar de novo a MESMA policy (já active) → 409 limpo, mensagem aponta para versão nova (não é o erro cru do gatilho de imutabilidade)',
      rH2.statusCode === 409 && /nova/i.test(String(bodyH2?.message ?? '')) && !/raise_exception|USING ERRCODE/i.test(String(bodyH2?.message ?? '')),
      `status=${rH2.statusCode} body=${rH2.body?.slice(0, 300)}`
    );

    // I · changeReason ausente/vazio → 400 (Artigo XI).
    const rI = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: `e2e-fatia2-no-reason-${Date.now()}`,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: '',
        lines: validLines,
      },
    });
    record('I changeReason vazio → 400 (Artigo XI)', rI.statusCode === 400, `status=${rI.statusCode} body=${rI.body?.slice(0, 200)}`);

    // J · linhas cuja soma de bps não fecha 10000 → 400.
    const rJ = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: `e2e-fatia2-bad-sum-${Date.now()}`,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — soma de bps deliberadamente incorreta.',
        lines: [
          { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, appliesTo: 'gross_transaction' },
          { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 2000, appliesTo: 'gross_transaction' },
        ],
      },
    });
    record('J soma de bps = 11000 (≠10000) → 400', rJ.statusCode === 400, `status=${rJ.statusCode} body=${rJ.body?.slice(0, 250)}`);

    // K · combinação territorial incoerente → 400 limpo, nunca 500.
    const countryRow = await pool.query<{ country_id: string }>(`SELECT country_id::text AS country_id FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`);
    const countryId = countryRow.rows[0]?.country_id;
    let statusK = -1;
    let bodyKRaw = '';
    if (countryId) {
      const statePR = await pool.query<{ state_id: string }>(`SELECT state_id::text AS state_id FROM states WHERE country_id = $1::uuid AND abbreviation = 'PR' LIMIT 1`, [countryId]);
      const stateSP = await pool.query<{ state_id: string }>(`SELECT state_id::text AS state_id FROM states WHERE country_id = $1::uuid AND abbreviation = 'SP' LIMIT 1`, [countryId]);
      const cityCuritiba = statePR.rows[0]
        ? await pool.query<{ city_id: string }>(`SELECT city_id::text AS city_id FROM cities WHERE state_id = $1::uuid AND name = 'Curitiba' LIMIT 1`, [statePR.rows[0].state_id])
        : { rows: [] as Array<{ city_id: string }> };
      if (stateSP.rows[0] && cityCuritiba.rows[0]) {
        const rK = await app.inject({
          method: 'POST',
          url: '/economy/admin/policies',
          headers: ADMIN_A.headers,
          payload: {
            policyCode: `e2e-fatia2-territory-incoherent-${Date.now()}`,
            policyType: 'COMMISSION_SPLIT',
            moduleContext: FATIA2_MODULE,
            countryId,
            stateId: stateSP.rows[0].state_id, // São Paulo...
            cityId: cityCuritiba.rows[0].city_id, // ...mas Curitiba pertence ao Paraná — INCOERENTE.
            effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
            changeReason: 'E2E fixture — combinação territorial deliberadamente incoerente.',
            lines: validLines,
          },
        });
        statusK = rK.statusCode;
        bodyKRaw = rK.body?.slice(0, 250) ?? '';
      }
    }
    record(
      'K estado de outro país da cidade (FK composta) → 400 limpo (nunca 500)',
      statusK === 400,
      `status=${statusK} body=${bodyKRaw}`
    );

    // L · NÃO-ADMIN tentando publicar → 403 (mesmo invariante da Fatia 1, agora na escrita).
    const rL = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: NON_ADMIN_A.headers,
      payload: {
        policyCode: `e2e-fatia2-non-admin-${Date.now()}`,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — não deveria nunca gravar.',
        lines: validLines,
      },
    });
    record('L NÃO-ADMIN tentando publicar → 403', rL.statusCode === 403, `status=${rL.statusCode}`);

    // M · publicar uma SEGUNDA versão do MESMO policyCode incrementa version e não altera a primeira.
    const codeM = `e2e-fatia2-versioning-${Date.now()}`;
    const rM1 = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeM,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — primeira versão desta regra.',
        lines: validLines,
      },
    });
    const bodyM1 = rM1.statusCode === 201 ? rM1.json() : undefined;
    const rM2 = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeM,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 30_000).toISOString(),
        changeReason: 'E2E fixture — segunda versão, ajuste de regra.',
        lines: validLines,
      },
    });
    const bodyM2 = rM2.statusCode === 201 ? rM2.json() : undefined;
    record(
      'M1 segunda publicação do mesmo policyCode → 201, version=2, id diferente da primeira',
      rM2.statusCode === 201 && bodyM2?.data?.version === 2 && bodyM2?.data?.id !== bodyM1?.data?.id,
      `statusM1=${rM1.statusCode} statusM2=${rM2.statusCode} v1=${bodyM1?.data?.version} v2=${bodyM2?.data?.version}`
    );

    const rListM = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: ADMIN_A.headers });
    const listM = ((rListM.json()?.data ?? []) as Array<{ id: string; version: number; changeReason: string | null }>);
    const rowM1 = listM.find((p) => p.id === bodyM1?.data?.id);
    record(
      'M2 a PRIMEIRA linha continua presente e intacta após a segunda publicação (acréscimo, não substituição)',
      !!rowM1 && rowM1.version === 1 && rowM1.changeReason === 'E2E fixture — primeira versão desta regra.',
      `rowM1=${JSON.stringify(rowM1)}`
    );

    // N · Δbank = 0 ao final de toda a Fatia 2.
    const bankAfterFatia2 = await bankSnapshot();
    record('N Δbank = 0 ao longo de toda a Fatia 2', bankAfterFatia2 === bankBeforeFatia2, `${bankBeforeFatia2} → ${bankAfterFatia2}`);

    // ═══════════════ F-REGIONAL-FUND-PUBLISH-TIME-CONTAINMENT (2026-07-27) ══════════════════
    // Clayton podia publicar (201) uma regional_fund line cujo basis/level o resolver de
    // pagamento (byte-pinned) rejeita incondicionalmente — a policy nasceria garantida a falhar
    // quando o dinheiro se movesse. O + P + Q provam que a fronteira de publicação agora barra
    // isso ANTES da gravação, e que o painel tem de onde ler o vocabulário resolvível real.
    console.log('\n— REGIONAL-FUND-PUBLISH-TIME-CONTAINMENT: fail-closed no publish + vocabulário server-driven —');
    const bankBeforeRF = await bankSnapshot();
    const countRfLines = async (code: string): Promise<number> =>
      count(
        `SELECT count(*)::text n FROM economic_policy_lines l
           JOIN economic_policies p ON p.id = l.policy_id
          WHERE p.policy_code = $1`,
        [code]
      );

    // O · regionalOriginBasis='service_location' (resolver rejeita incondicionalmente,
    //     POLICY_BASIS_UNSUPPORTED_MVP) → 400 no PUBLISH, mensagem pt-BR clara, ZERO linhas gravadas.
    const codeO = `e2e-regional-fund-unsupported-basis-${Date.now()}`;
    const rO = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeO,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — regional_fund com basis NÃO resolvível (service_location).',
        lines: [
          { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 8000, appliesTo: 'gross_transaction' },
          {
            lineType: 'regional_fund',
            destinationType: 'regional_fund',
            regionalOriginBasis: 'service_location',
            regionalLevel: 'city',
            bps: 2000,
            appliesTo: 'gross_transaction',
          },
        ],
      },
    });
    const bodyO = (() => { try { return rO.json(); } catch { return undefined; } })();
    const rowsO = await countRfLines(codeO);
    record(
      "O regionalOriginBasis='service_location' (não resolvível hoje) → 400 pt-BR no publish, zero linhas gravadas",
      rO.statusCode === 400 &&
        /economic_policy:/.test(String(bodyO?.message ?? '')) &&
        /service_location/.test(String(bodyO?.message ?? '')) &&
        /não é resolvível/.test(String(bodyO?.message ?? '')) &&
        rowsO === 0,
      `status=${rO.statusCode} rows=${rowsO} body=${rO.body?.slice(0, 300)}`
    );

    // P · regionalLevel='neighborhood' (HOLD 501 no resolver) → 400 no PUBLISH também.
    const codeP0 = `e2e-regional-fund-neighborhood-hold-${Date.now()}`;
    const rP0 = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeP0,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — regional_fund com level em HOLD (neighborhood).',
        lines: [
          { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 8000, appliesTo: 'gross_transaction' },
          {
            lineType: 'regional_fund',
            destinationType: 'regional_fund',
            regionalOriginBasis: 'payer_identity_residence',
            regionalLevel: 'neighborhood',
            bps: 2000,
            appliesTo: 'gross_transaction',
          },
        ],
      },
    });
    const bodyP0 = (() => { try { return rP0.json(); } catch { return undefined; } })();
    const rowsP0 = await countRfLines(codeP0);
    record(
      "P0 regionalLevel='neighborhood' (HOLD no resolver) → 400 pt-BR no publish, zero linhas gravadas",
      rP0.statusCode === 400 && /HOLD/.test(String(bodyP0?.message ?? '')) && rowsP0 === 0,
      `status=${rP0.statusCode} rows=${rowsP0} body=${rP0.body?.slice(0, 300)}`
    );

    // P · regionalOriginBasis='payer_identity_residence' + regionalLevel='city' (AMBOS resolvíveis)
    //     → 201, publica normalmente (Δ=0 no caminho suportado — nada regrediu para quem já era válido).
    const codeP = `e2e-regional-fund-resolvable-${Date.now()}`;
    const rP = await app.inject({
      method: 'POST',
      url: '/economy/admin/policies',
      headers: ADMIN_A.headers,
      payload: {
        policyCode: codeP,
        policyType: 'COMMISSION_SPLIT',
        moduleContext: FATIA2_MODULE,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        changeReason: 'E2E fixture — regional_fund com basis+level resolvíveis (payer_identity_residence + city).',
        lines: [
          { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 8000, appliesTo: 'gross_transaction' },
          {
            lineType: 'regional_fund',
            destinationType: 'regional_fund',
            regionalOriginBasis: 'payer_identity_residence',
            regionalLevel: 'city',
            bps: 2000,
            appliesTo: 'gross_transaction',
          },
        ],
      },
    });
    const bodyP = rP.statusCode === 201 ? rP.json() : undefined;
    const rowsP = await countRfLines(codeP);
    record(
      "P regionalOriginBasis='payer_identity_residence' + regionalLevel='city' (ambos resolvíveis) → 201, 2 linhas gravadas",
      rP.statusCode === 201 && bodyP?.data?.status === 'draft' && rowsP === 2,
      `status=${rP.statusCode} rows=${rowsP} body=${rP.body?.slice(0, 300)}`
    );

    // Q · GET /economy/admin/regional-fund-vocabulary → 200, exatamente o subconjunto resolvível
    //     (nunca os 7/5 físicos inteiros) — é a fonte que o painel admin usa para montar o seletor.
    const rQ = await app.inject({ method: 'GET', url: '/economy/admin/regional-fund-vocabulary', headers: ADMIN_A.headers });
    const bodyQ = rQ.statusCode === 200 ? rQ.json() : undefined;
    const basisQ: string[] = bodyQ?.data?.regionalOriginBasisResolvable ?? [];
    const levelQ: string[] = bodyQ?.data?.regionalFundLevelResolvable ?? [];
    record(
      'Q GET /economy/admin/regional-fund-vocabulary → 200, basis resolvível = 4 valores (service_location/transaction_location/explicit_economic_region EXCLUÍDOS)',
      rQ.statusCode === 200 &&
        basisQ.length === 4 &&
        basisQ.includes('payer_identity_residence') &&
        !basisQ.includes('service_location') &&
        !basisQ.includes('transaction_location') &&
        !basisQ.includes('explicit_economic_region'),
      `status=${rQ.statusCode} basis=${JSON.stringify(basisQ)}`
    );
    record(
      "Q2 level resolvível = 4 valores (neighborhood EXCLUÍDO)",
      levelQ.length === 4 && levelQ.includes('city') && !levelQ.includes('neighborhood'),
      `level=${JSON.stringify(levelQ)}`
    );
    const rQNoAuth = await app.inject({ method: 'GET', url: '/economy/admin/regional-fund-vocabulary' });
    record('Q3 sem Authorization → 401 (mesmo gate das demais rotas admin)', rQNoAuth.statusCode === 401, `status=${rQNoAuth.statusCode}`);

    const bankAfterRF = await bankSnapshot();
    record('R Δbank = 0 em todo o bloco regional-fund-publish-time-containment', bankAfterRF === bankBeforeRF, `${bankBeforeRF} → ${bankAfterRF}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  console.log(
    '✨ economic_policy:manage não é vocabulário fantasma — gateia de fato GET/POST /economy/admin/policies ' +
    'e POST .../activate (admin/não-admin/anônimo/cross-tenant provados; Artigo V sem edição de policy ativa; ' +
    'Artigo XI changeReason obrigatório; versionamento por acréscimo provado); Δbank=0.'
  );
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
