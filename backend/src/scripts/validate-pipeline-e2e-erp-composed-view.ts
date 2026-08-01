/**
 * E2E — F-ERP-COMPOSED-VIEW (Fatia 8, GUIA_MESTRE §3/linha 275 — "ERP composto: vista integrada
 * estoque+pedidos+agenda+financeiro pela empresa"). Money-free (financeiro é deeplink, nunca
 * número); sem migration nova. Roda SÓ em DB efêmera (runner run-erp-composed-ephemeral.ps1).
 * NUNCA unificard_dev.
 *
 * Prova o bloco 'erp' do contrato server-driven da página do actor:
 *   A · mode=consuming, DONO atuando como PF → SEM bloco/aba 'erp' (o rótulo antigo dizia
 *       "visitante" e MENTIA: o chamador sempre foi o dono — corrigido em F-ERP-TWO-SIDED);
 *   A2· F-ERP-TWO-SIDED: consuming ATUANDO COMO a empresa → face de COMPRA (side='supply');
 *   A3· estranho em consuming DECLARANDO actionContext da empresa → SEM erp (hint não provado);
 *   A4· isolamento na face de compra (açougue não vê pedido da padaria);
 *   B2· NÃO-REGRESSÃO: face de venda manteve stock+agenda+purchaseOrders+financeiro;
 *   B · mode=operating pelo DONO de uma empresa (page+company_id) → bloco 'erp' aparece com
 *       pedidos de compra REAIS daquela empresa (via listByOwner escopado);
 *   C · mode=operating numa PÁGINA PESSOAL (actor_type='user', sem company_id) → SEM bloco 'erp'
 *       (ERP é conceito empresarial, DECISION-0133);
 *   D · isolamento: pedidos de compra da EMPRESA B não vazam no bloco erp da EMPRESA A;
 *   E · mode=operating tentado por quem NÃO representa a empresa → 403 (regressão de Fatia 3,
 *       confirma que o gate segue intacto com o bloco novo);
 *   F · financeiro do bloco erp é SÓ { deeplink: '/wallet' } — nunca valor monetário embutido;
 *   G · Δbank=0.
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
  if (!/erp|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 37).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `erp-${seq}@e2e.test`, gu]);
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
    [tenantId, name, companyId, `erp-page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId]
  )).rows[0].id;
  // 🔴 REPARO DE PROVA QUEBRADA (F-ERP-TWO-SIDED, 2026-08-01) — NÃO faz parte do desenho desta fatia.
  // O seed gravava `company_users.is_active`, COLUNA QUE NÃO EXISTE (a tabela tem `member_status` e
  // `is_primary`). Presente assim desde o HEAD anterior (linha 67), logo este E2E não conseguia nem
  // semear — a "prova selada" do bloco ERP estava vermelha/não-rodada. Convergido para o padrão vivo
  // (validate-company-lifecycle-cutover.ts:79): member_status ∈ {active,suspended,revoked}.
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, member_status) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,'active')`, [tenantId, companyId, ownerGu]);
  return { companyId, pageActorId };
}

async function mkSupplierAndPO(tenantId: string, ownerActorId: string, createdByActorId: string, name: string): Promise<string> {
  const supplierId = (await pool.query<{ id: string }>(
    `INSERT INTO suppliers (tenant_id, name, owner_actor_id, created_by_actor_id) VALUES ($1::uuid,$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, ownerActorId, createdByActorId]
  )).rows[0].id;
  const poId = (await pool.query<{ id: string }>(
    `INSERT INTO purchase_orders (tenant_id, supplier_id, created_by_actor_id, owner_actor_id) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, supplierId, createdByActorId, ownerActorId]
  )).rows[0].id;
  return poId;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'ERP Composed Tenant', slug: `erp-${Date.now()}` });

  const carlos = await mkUserActor(TENANT, 'Carlos Dono E2E');
  const padaria = await mkCompanyPageActor(TENANT, 'Padaria ERP E2E', carlos.gu, carlos.actorId);
  const beto = await mkUserActor(TENANT, 'Beto Dono Outra Empresa E2E');
  const acougue = await mkCompanyPageActor(TENANT, 'Açougue ERP E2E', beto.gu, beto.actorId);
  const stranger = await mkUserActor(TENANT, 'Stranger E2E');

  const poPadaria1 = await mkSupplierAndPO(TENANT, padaria.pageActorId, carlos.actorId, 'Fornecedor Padaria 1');
  const poPadaria2 = await mkSupplierAndPO(TENANT, padaria.pageActorId, carlos.actorId, 'Fornecedor Padaria 2');
  await mkSupplierAndPO(TENANT, acougue.pageActorId, beto.actorId, 'Fornecedor Açougue 1'); // isolamento (caso D)

  const actorPageRoutes = (await import('../modules/actor-page/actor-page.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const tid = req.headers['x-test-tenant-id'];
    // F-ERP-TWO-SIDED: o harness passa a poder DECLARAR actionContext (atuando-como). A rota NÃO
    // confia nisso — só honra o hint se canRepresentActor provar (DECISION-0113 D4/D9). Sem o
    // header, comportamento idêntico ao anterior (null).
    const acting = req.headers['x-test-acting-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = acting ? { actorId: acting } : null;
  });
  await app.register(actorPageRoutes);
  await app.ready();

  const call = (actorId: string, mode: 'consuming' | 'operating', userId: string, actingActorId?: string) =>
    app.inject({
      method: 'GET',
      url: `/actor-page/${actorId}?mode=${mode}`,
      headers: {
        'x-test-user-id': userId,
        'x-test-tenant-id': TENANT,
        ...(actingActorId ? { 'x-test-acting-actor-id': actingActorId } : {}),
      },
    });

  try {
    console.log('\n— erp composed view END-TO-END (vista integrada estoque+pedidos+agenda+financeiro) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · mode=consuming, DONO atuando como PF (sem actionContext) → sem bloco/aba erp.
    // 🔴 O rótulo antigo dizia "(visitante)" e MENTIA: o chamador sempre foi carlos.userId, o DONO.
    // Corrigido em F-ERP-TWO-SIDED. O caso continua valendo e ficou MAIS forte: nem o dono vê o ERP
    // enquanto estiver atuando como pessoa física — a face de compra exige atuar-como-a-empresa.
    const rA = await call(padaria.pageActorId, 'consuming', carlos.userId);
    const dataA = (rA.json() as any)?.data;
    const hasErpA = dataA?.blocks?.some((b: any) => b.type === 'erp') || dataA?.tabs?.some((t: any) => t.key === 'erp');
    record('A mode=consuming, DONO atuando como PF (sem actionContext) → SEM bloco/aba erp',
      rA.statusCode === 200 && !hasErpA, `status=${rA.statusCode} hasErp=${hasErpA}`);

    // A2 · F-ERP-TWO-SIDED: mode=consuming ATUANDO COMO a empresa → face de COMPRA (side='supply')
    // com os 2 pedidos REAIS da padaria. É o coração da fatia: COMPRAR É CONSUMIR.
    const rA2 = await call(padaria.pageActorId, 'consuming', carlos.userId, padaria.pageActorId);
    const dataA2 = (rA2.json() as any)?.data;
    const erpA2 = dataA2?.blocks?.find((b: any) => b.type === 'erp');
    const poIdsA2 = (erpA2?.data?.purchaseOrders?.items ?? []).map((i: any) => i.id).sort();
    const expectedA2 = [poPadaria1, poPadaria2].sort();
    record('A2 mode=consuming ATUANDO COMO a empresa → bloco erp side=supply com os 2 pedidos de COMPRA',
      rA2.statusCode === 200 && !!erpA2 && erpA2.data?.side === 'supply'
        && JSON.stringify(poIdsA2) === JSON.stringify(expectedA2),
      `status=${rA2.statusCode} side=${erpA2?.data?.side} poIds=${JSON.stringify(poIdsA2)} expected=${JSON.stringify(expectedA2)}`);

    // A3 · a face de compra NÃO afrouxou autoridade: ESTRANHO em consuming, mesmo DECLARANDO
    // actionContext da padaria, não vê ERP — o hint não provado por canRepresentActor é IGNORADO.
    const rA3 = await call(padaria.pageActorId, 'consuming', stranger.userId, padaria.pageActorId);
    const dataA3 = (rA3.json() as any)?.data;
    const hasErpA3 = dataA3?.blocks?.some((b: any) => b.type === 'erp') || dataA3?.tabs?.some((t: any) => t.key === 'erp');
    record('A3 ESTRANHO em consuming DECLARANDO actionContext da padaria → SEM erp (hint não provado é ignorado)',
      rA3.statusCode === 200 && !hasErpA3, `status=${rA3.statusCode} hasErp=${hasErpA3}`);

    // A4 · isolamento na face de COMPRA: o açougue atuando-como-si-mesmo não vê pedido da padaria.
    const rA4 = await call(acougue.pageActorId, 'consuming', beto.userId, acougue.pageActorId);
    const erpA4 = (rA4.json() as any)?.data?.blocks?.find((b: any) => b.type === 'erp');
    const poIdsA4 = (erpA4?.data?.purchaseOrders?.items ?? []).map((i: any) => i.id);
    record('A4 isolamento na face de COMPRA: açougue NÃO vê pedidos da padaria',
      rA4.statusCode === 200 && erpA4?.data?.side === 'supply'
        && !poIdsA4.includes(poPadaria1) && !poIdsA4.includes(poPadaria2) && poIdsA4.length === 1,
      `side=${erpA4?.data?.side} poIdsA4=${JSON.stringify(poIdsA4)}`);

    // B · mode=operating pelo dono → bloco erp com os 2 pedidos reais da padaria
    const rB = await call(padaria.pageActorId, 'operating', carlos.userId);
    const dataB = (rB.json() as any)?.data;
    const erpBlockB = dataB?.blocks?.find((b: any) => b.type === 'erp');
    const poIdsB = (erpBlockB?.data?.purchaseOrders?.items ?? []).map((i: any) => i.id).sort();
    const expectedB = [poPadaria1, poPadaria2].sort();
    record('B mode=operating pelo dono → bloco erp com os 2 pedidos REAIS da padaria',
      rB.statusCode === 200 && !!erpBlockB && JSON.stringify(poIdsB) === JSON.stringify(expectedB),
      `status=${rB.statusCode} poIds=${JSON.stringify(poIdsB)} expected=${JSON.stringify(expectedB)}`);

    // B2 · NÃO-REGRESSÃO de F-ERP-TWO-SIDED: a face de VENDA manteve TUDO que já entregava.
    // Se alguém "mover" estoque/agenda/pedidos para a face de compra, este caso fica vermelho.
    const dB = erpBlockB?.data ?? {};
    const salesKeys = Object.keys(dB).sort();
    record('B2 face de VENDA intacta: side=sales + stock + agenda + purchaseOrders + financeiro (nada sumiu)',
      dB.side === 'sales' && !!dB.stock && !!dB.agenda && !!dB.purchaseOrders
        && dB.financeiro?.deeplink === '/wallet'
        && JSON.stringify(salesKeys) === JSON.stringify(['agenda', 'count', 'financeiro', 'purchaseOrders', 'side', 'stock']),
      `keys=${JSON.stringify(salesKeys)} side=${dB.side}`);

    // B3 · a aba do modo operar continua rotulada 'ERP' (a de compra é 'ERP · Compras').
    const tabB = dataB?.tabs?.find((t: any) => t.key === 'erp');
    record("B3 aba do modo operar continua key='erp' label='ERP'", tabB?.label === 'ERP', `tab=${JSON.stringify(tabB)}`);

    // C · mode=operating numa página pessoal (sem company_id) → sem bloco erp
    const rC = await call(carlos.actorId, 'operating', carlos.userId);
    const dataC = (rC.json() as any)?.data;
    const hasErpC = dataC?.blocks?.some((b: any) => b.type === 'erp');
    record('C mode=operating em página PESSOAL (sem company_id) → SEM bloco erp', rC.statusCode === 200 && !hasErpC,
      `status=${rC.statusCode} hasErp=${hasErpC}`);

    // D · isolamento: pedidos do açougue não aparecem no bloco erp da padaria (já confirmado em B
    // pela igualdade exata dos IDs, mas reforça pelo lado do açougue também)
    const rD = await call(acougue.pageActorId, 'operating', beto.userId);
    const dataD = (rD.json() as any)?.data;
    const erpBlockD = dataD?.blocks?.find((b: any) => b.type === 'erp');
    const poIdsD = (erpBlockD?.data?.purchaseOrders?.items ?? []).map((i: any) => i.id);
    record('D isolamento: bloco erp do açougue NÃO contém pedidos da padaria',
      rD.statusCode === 200 && !poIdsD.includes(poPadaria1) && !poIdsD.includes(poPadaria2) && poIdsD.length === 1,
      `poIdsD=${JSON.stringify(poIdsD)}`);

    // E · estranho tentando operar a padaria → 403 (regressão do gate da Fatia 3)
    const rE = await call(padaria.pageActorId, 'operating', stranger.userId);
    record('E estranho tentando mode=operating na padaria → 403 (gate Fatia 3 intacto)', rE.statusCode === 403,
      `status=${rE.statusCode}`);

    // F · financeiro é só deeplink, nunca valor monetário embutido (a ÚNICA chave é 'deeplink')
    const financeiroB = erpBlockB?.data?.financeiro;
    const financeiroKeys = financeiroB ? Object.keys(financeiroB).sort() : [];
    record("F financeiro do bloco erp é { deeplink: '/wallet' } — nenhuma outra chave (zero valor monetário embutido)",
      financeiroB?.deeplink === '/wallet' && JSON.stringify(financeiroKeys) === JSON.stringify(['deeplink']),
      `financeiro=${JSON.stringify(financeiroB)}`);

    // G · Δbank=0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('G Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
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
