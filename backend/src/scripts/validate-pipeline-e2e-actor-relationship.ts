/**
 * E2E — F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 (DESENHO_PAGINA_DO_ACTOR.md §5 SELADO;
 * SPEC_FATIA1_RELACAO_TIPADA.md §6; Opção B ratificada por Clayton 2026-07-04).
 * Money-free; MATERIAL (tabela + rotas novas). Roda SÓ em DB efêmera
 * (runner run-actor-relationship-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova as fronteiras da aresta de relação tipada:
 *   A · enviar AS actor alheio → 403, zero linha (canRepresentActor no ENVIO);
 *   B · envio válido PF→PF 'amigo' → 201 pending (classificação no envio);
 *   C · responder sem ser o actor DESTINO → 403 (canRepresentActor + destino, no ACEITE);
 *   D · aceite classificado → accepted com as DUAS óticas (assimetria);
 *   E · label fora do vocabulário governado → 400, zero write;
 *   F · auto-conexão → 400;
 *   G · par duplicado (B→A depois de A→B) → 409, 1 linha só (UNIQUE não-ordenado);
 *   H · 🔴 RELAÇÃO ≠ AUTORIDADE: empresa convida PF como 'colaborador', PF aceita —
 *       company_users NÃO ganha linha (aceite social não concede operação);
 *   I · pareamento do seed: 'fornecedor' entre PF↔PF → 422 (vocabulário por par);
 *   J · responder aresta não-pendente → 409;
 *   K · GET /mine com ?label= projeta a ótica CRM;
 *   L · Δbank=0 (nenhuma tabela de valor tocada).
 *
 * FATIA 2 — a PONTE colaborador→autoridade (grant = ato do dono, roteado pro fluxo vivo):
 *   M · a FUNCIONÁRIA que aceitou tenta se auto-conceder via a ponte → 403, company_users intacto;
 *   N · estranho tenta conceder → 403;
 *   O · o DONO concede (staff/active) → 201; company_users ganha a linha SEM can_manage_company;
 *       a delegação mintada é ESCOPADA (sem '*') e canRepresentActor(funcionária→page) segue FALSE
 *       (relação + membership ≠ representação em branco — contenção de escopo ① preservada);
 *   P · ponte numa aresta que NÃO é colaborador pela ótica da empresa → 422;
 *   Q · ponte numa aresta colaborador ainda PENDENTE → 409 (grant só após aceite).
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/relationship|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 13).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `rel-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
}

async function mkCompanyPageActor(tenantId: string, name: string, ownerGu: string, responsibleActorId: string): Promise<{ companyId: string; pageActorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [tenantId, name])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`,
    [tenantId, name, companyId, `rel-page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId]
  )).rows[0].id;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, ownerGu]);
  return { companyId, pageActorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // canRepresentActor resolve via ports-registry — sem os adapters, autoridade nega fail-closed.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Rel Tenant', slug: `rel-${Date.now()}` });

  const ana = await mkUserActor(TENANT, 'Ana Rel E2E');
  const bia = await mkUserActor(TENANT, 'Bia Rel E2E');
  const carlos = await mkUserActor(TENANT, 'Carlos Dono E2E');
  const padaria = await mkCompanyPageActor(TENANT, 'Padaria Rel E2E', carlos.gu, carlos.actorId);

  const actorRelationshipRoutes = (await import('../modules/relationships/actor-relationship.routes')).default;
  const membershipBridgeRoutes = (await import('../modules/relationships/actor-relationship-membership-bridge.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    const tid = req.headers['x-test-tenant-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(actorRelationshipRoutes);
  await app.register(membershipBridgeRoutes);
  await app.ready();

  const call = (method: 'GET' | 'POST', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  const countEdges = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM actor_relationships`)).rows[0].n;

  try {
    console.log('\n— actor relationship typed edge END-TO-END (relação ≠ autoridade) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    const cuBefore = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM company_users`);

    // A · Ana tenta ENVIAR vestindo o actor da Bia (alheio) → 403, zero linha
    const rA = await call('POST', '/relationships', {
      userId: ana.userId, actorId: bia.actorId, // actor alheio declarado
      body: { toActorId: carlos.actorId, requesterLabel: 'amigo' },
    });
    record('A enviar AS actor alheio → 403, zero linha',
      rA.statusCode === 403 && (await countEdges()) === '0',
      `status=${rA.statusCode} rows=${await countEdges()}`);

    // B · envio válido PF→PF 'amigo' → 201 pending (classificação no envio)
    const rB = await call('POST', '/relationships', {
      userId: ana.userId, actorId: ana.actorId,
      body: { toActorId: bia.actorId, requesterLabel: 'amigo' },
    });
    const edgeAB = (rB.json() as any)?.data;
    record("B envio válido PF→PF 'amigo' → 201 pending, requesterLabel gravado",
      rB.statusCode === 201 && edgeAB?.status === 'pending' && edgeAB?.requesterLabel === 'amigo' && edgeAB?.targetLabel === null,
      `status=${rB.statusCode} body=${JSON.stringify(edgeAB).slice(0, 160)}`);

    // C · responder sem ser o actor DESTINO → 403 (dois vetores: alheio e não-destino)
    const rC1 = await call('POST', `/relationships/${edgeAB.id}/respond`, {
      userId: ana.userId, actorId: bia.actorId, // Ana vestindo Bia → canRepresentActor nega
      body: { action: 'accept', targetLabel: 'amigo' },
    });
    const rC2 = await call('POST', `/relationships/${edgeAB.id}/respond`, {
      userId: carlos.userId, actorId: carlos.actorId, // Carlos representa a si, mas NÃO é o destino
      body: { action: 'accept', targetLabel: 'amigo' },
    });
    const stillPending = await pool.query<{ s: string }>(`SELECT status AS s FROM actor_relationships WHERE id = $1`, [edgeAB.id]);
    record('C responder sem ser o destino → 403 nos dois vetores, aresta segue pending',
      rC1.statusCode === 403 && rC2.statusCode === 403 && stillPending.rows[0].s === 'pending',
      `alheio=${rC1.statusCode} nao-destino=${rC2.statusCode} status=${stillPending.rows[0].s}`);

    // D · Bia aceita classificando (assimetria: as duas óticas na mesma aresta)
    const rD = await call('POST', `/relationships/${edgeAB.id}/respond`, {
      userId: bia.userId, actorId: bia.actorId,
      body: { action: 'accept', targetLabel: 'conhecido' },
    });
    const edgeD = (rD.json() as any)?.data;
    record('D aceite classificado → accepted com as DUAS óticas (amigo/conhecido)',
      rD.statusCode === 200 && edgeD?.status === 'accepted' && edgeD?.requesterLabel === 'amigo' && edgeD?.targetLabel === 'conhecido',
      `status=${rD.statusCode} body=${JSON.stringify(edgeD).slice(0, 160)}`);

    // E · label fora do vocabulário governado → 400, zero write novo
    const before = await countEdges();
    const rE = await call('POST', '/relationships', {
      userId: ana.userId, actorId: ana.actorId,
      body: { toActorId: carlos.actorId, requesterLabel: 'chefe' },
    });
    record('E label fora do vocabulário → 400, zero write',
      rE.statusCode === 400 && (await countEdges()) === before,
      `status=${rE.statusCode}`);

    // F · auto-conexão → 400
    const rF = await call('POST', '/relationships', {
      userId: ana.userId, actorId: ana.actorId,
      body: { toActorId: ana.actorId, requesterLabel: 'amigo' },
    });
    record('F auto-conexão → 400', rF.statusCode === 400, `status=${rF.statusCode}`);

    // G · par duplicado no sentido INVERSO (Bia→Ana) → 409, 1 linha só do par
    const rG = await call('POST', '/relationships', {
      userId: bia.userId, actorId: bia.actorId,
      body: { toActorId: ana.actorId, requesterLabel: 'amigo' },
    });
    const pairCount = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM actor_relationships
        WHERE LEAST(from_actor_id, to_actor_id) = LEAST($1::uuid, $2::uuid)
          AND GREATEST(from_actor_id, to_actor_id) = GREATEST($1::uuid, $2::uuid)`,
      [ana.actorId, bia.actorId]
    );
    record('G par duplicado (sentido inverso) → 409, UNIQUE não-ordenado segura 1 linha',
      rG.statusCode === 409 && pairCount.rows[0].n === '1',
      `status=${rG.statusCode} pair=${pairCount.rows[0].n}`);

    // H · 🔴 RELAÇÃO ≠ AUTORIDADE: a Padaria (page, via Carlos que a gerencia) convida Ana como
    //     'colaborador'; Ana aceita. company_users NÃO pode ganhar linha (grant = ato separado).
    const rH1 = await call('POST', '/relationships', {
      userId: carlos.userId, actorId: padaria.pageActorId, // Carlos representa a page (canManageCompany)
      body: { toActorId: ana.actorId, requesterLabel: 'colaborador' },
    });
    const edgeH = (rH1.json() as any)?.data;
    const rH2 = await call('POST', `/relationships/${edgeH?.id}/respond`, {
      userId: ana.userId, actorId: ana.actorId,
      body: { action: 'accept', targetLabel: 'colaborador' },
    });
    const cuAfter = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM company_users`);
    record('H aceite de colaborador NÃO cria linha em company_users (relação ≠ autoridade)',
      rH1.statusCode === 201 && rH2.statusCode === 200 && cuAfter.rows[0].n === cuBefore.rows[0].n,
      `envio=${rH1.statusCode} aceite=${rH2.statusCode} company_users ${cuBefore.rows[0].n}→${cuAfter.rows[0].n}`);

    // I · pareamento do seed: 'fornecedor' entre PF↔PF → 422 (label válido no vocab, inválido no par)
    const rI = await call('POST', '/relationships', {
      userId: carlos.userId, actorId: carlos.actorId,
      body: { toActorId: bia.actorId, requesterLabel: 'fornecedor' },
    });
    record("I 'fornecedor' entre PF↔PF → 422 (seed por par respeitado)",
      rI.statusCode === 422, `status=${rI.statusCode}`);

    // J · responder aresta não-pendente → 409
    const rJ = await call('POST', `/relationships/${edgeAB.id}/respond`, {
      userId: bia.userId, actorId: bia.actorId,
      body: { action: 'accept', targetLabel: 'amigo' },
    });
    record('J responder aresta já aceita → 409', rJ.statusCode === 409, `status=${rJ.statusCode}`);

    // K · projeção CRM: /mine?label=colaborador pela ótica da PADARIA (requester) e da ANA (target)
    const rK1 = await call('GET', '/relationships/mine?label=colaborador', {
      userId: carlos.userId, actorId: padaria.pageActorId,
    });
    const k1 = (rK1.json() as any)?.data ?? [];
    const rK2 = await call('GET', '/relationships/mine?label=colaborador', {
      userId: ana.userId, actorId: ana.actorId,
    });
    const k2 = (rK2.json() as any)?.data ?? [];
    record("K GET /mine?label=colaborador projeta a ótica CRM dos DOIS lados",
      rK1.statusCode === 200 && k1.length === 1 && k1[0].id === edgeH.id &&
      rK2.statusCode === 200 && k2.length === 1 && k2[0].id === edgeH.id,
      `padaria=${k1.length} ana=${k2.length}`);

    // ══ FATIA 2 — A PONTE colaborador→autoridade ══════════════════════════════

    // M · a FUNCIONÁRIA (ana, que aceitou a conexão) tenta se auto-conceder → 403
    const cuBeforeBridge = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM company_users`);
    const rM = await call('POST', `/relationships/${edgeH.id}/grant-membership`, {
      userId: ana.userId, actorId: ana.actorId,
      body: { role: 'staff', status: 'active' },
    });
    const cuAfterM = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM company_users`);
    record('M funcionária tenta AUTO-GRANT via a ponte → 403, company_users intacto',
      rM.statusCode === 403 && cuAfterM.rows[0].n === cuBeforeBridge.rows[0].n,
      `status=${rM.statusCode} cu=${cuBeforeBridge.rows[0].n}→${cuAfterM.rows[0].n}`);

    // N · estranha (bia) tenta conceder → 403
    const rN = await call('POST', `/relationships/${edgeH.id}/grant-membership`, {
      userId: bia.userId, actorId: bia.actorId,
      body: { role: 'staff', status: 'active' },
    });
    record('N estranho tenta conceder → 403', rN.statusCode === 403, `status=${rN.statusCode}`);

    // O · o DONO (carlos, canManageCompany) concede staff/active → 201; substrato real correto
    const rO = await call('POST', `/relationships/${edgeH.id}/grant-membership`, {
      userId: carlos.userId, actorId: carlos.actorId,
      body: { role: 'staff', status: 'active' },
    });
    const oBody = (rO.json() as any)?.data;
    const memberRow = await pool.query<{ role: string; member_status: string; cmc: boolean | null }>(
      `SELECT role, member_status, can_manage_company AS cmc FROM company_users WHERE tenant_id=$1 AND company_id=$2 AND global_user_id=$3`,
      [TENANT, padaria.companyId, ana.gu]
    );
    const delegRow = await pool.query<{ s: string }>(
      `SELECT scopes_json::text AS s FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND institutional_actor_id=$3 AND status='active'`,
      [TENANT, ana.actorId, padaria.pageActorId]
    );
    const { authorizationService } = await import('../core/authorization/authorization.service');
    const anaRepresentsPage = await authorizationService.canRepresentActor(TENANT, ana.userId, padaria.pageActorId);
    record('O dono concede → 201; company_users staff/active SEM can_manage_company; delegação ESCOPADA (sem *); canRepresentActor(funcionária→page) segue FALSE',
      rO.statusCode === 201 && oBody?.role === 'staff' &&
      memberRow.rows.length === 1 && memberRow.rows[0].role === 'staff' && memberRow.rows[0].member_status === 'active' && memberRow.rows[0].cmc !== true &&
      delegRow.rows.length === 1 && !delegRow.rows[0].s.includes('"*"') &&
      anaRepresentsPage === false,
      `status=${rO.statusCode} member=${JSON.stringify(memberRow.rows[0] ?? null)} deleg=${delegRow.rows[0]?.s} represents=${anaRepresentsPage}`);

    // P · ponte numa aresta que NÃO é colaborador (ana↔bia 'amigo', accepted no caso D) → 422
    const rP = await call('POST', `/relationships/${edgeAB.id}/grant-membership`, {
      userId: carlos.userId, actorId: carlos.actorId,
      body: { role: 'staff' },
    });
    record("P ponte em aresta não-colaborador → 422", rP.statusCode === 422, `status=${rP.statusCode}`);

    // Q · ponte numa aresta colaborador PENDENTE (padaria→bia) → 409
    const rQ0 = await call('POST', '/relationships', {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { toActorId: bia.actorId, requesterLabel: 'colaborador' },
    });
    const edgeQ = (rQ0.json() as any)?.data;
    const rQ = await call('POST', `/relationships/${edgeQ?.id}/grant-membership`, {
      userId: carlos.userId, actorId: carlos.actorId,
      body: { role: 'staff' },
    });
    record('Q ponte em aresta pendente → 409 (grant só após aceite)',
      rQ0.statusCode === 201 && rQ.statusCode === 409, `envio=${rQ0.statusCode} grant=${rQ.statusCode}`);

    // L · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('L Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
