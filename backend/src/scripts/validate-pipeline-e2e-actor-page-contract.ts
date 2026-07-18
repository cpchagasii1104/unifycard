/**
 * E2E — F-ACTOR-PAGE-SHELL-SLICE-3 (DESENHO_PAGINA_DO_ACTOR.md §2.4 SELADO).
 * Money-free; MATERIAL (contrato server-driven novo). Roda SÓ em DB efêmera
 * (runner run-actor-page-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o coração do desenho — "a aba existe se o bloco está aceso" + autoridade + anti-PII:
 *   A · GET sem req.user → 401;
 *   B · página da ANA (PF com 1 post): aba Posts ACENDE (count=1); Products/Services NÃO;
 *       Tudo+Sobre sempre; Conectar com allowedLabels do par PF↔PF (seed governado);
 *   C · página da BIA (PF vazia): só Tudo+Sobre — nenhum bloco além de about;
 *   D · página da PADARIA (page com 1 serviço ativo): aba Serviços ACENDE; ação Contratar
 *       renderiza DESABILITADA gatedBy='PORTA-1'; Conectar com labels do par PF↔PJ;
 *   E · mode=operating: estranha → 403 fail-closed; dono → 200 com ações de gestão;
 *   F · anti-PII: o JSON do contrato não contém cpf/tax_id/kyc/global_user_id/user_id;
 *   G · Δbank=0.
 *
 * FATIA 4 — conteúdo rico (composição pura, reusa os readers dos módulos donos do pilar):
 *   H · bloco Serviços da Padaria carrega o item real (nome/preço) do serviço ativo;
 *   I · bloco Produtos ESCOPA por merchant — dois merchants ofertam o MESMO canônico, o bloco da
 *       Padaria só lista a oferta DELA (prova o filtro `merchantActorId` novo, não vaza preço alheio);
 *   J · bloco Agenda ISOLA por owner_type — uma janela decoy com o MESMO owner_id mas owner_type
 *       diferente NÃO aparece (prova o fix do achado read-first: sem o filtro, vazaria);
 *   K · bloco Localização projeta cidade/estado reais; header.location espelha o mesmo resumo;
 *       anti-PII: o JSON completo do contrato nunca contém rua/lat/lng/CEP do endereço operacional.
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
  if (!/actor_page|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 19).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `ap-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
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
  await tenantService.createTenant({ id: TENANT, name: 'ActorPage Tenant', slug: `ap-${Date.now()}` });

  const ana = await mkUserActor(TENANT, 'Ana Page E2E');
  const bia = await mkUserActor(TENANT, 'Bia Vazia E2E');
  const carlos = await mkUserActor(TENANT, 'Carlos Dono E2E');
  // Mallory = atacante DECISION-0113: autentica como si mesma, mas declara o actorId de outro
  // (Ana) no actionContext para tentar ler o status privado do par (Ana, alvo).
  const mallory = await mkUserActor(TENANT, 'Mallory Spoof E2E');

  // padaria: page-actor + company_users owner (canRepresentActor via canManageCompany)
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [TENANT, 'Padaria Page E2E'])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`,
    [TENANT, 'Padaria Page E2E', companyId, `ap-page-${Date.now()}`, carlos.actorId]
  )).rows[0].id;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [TENANT, companyId, carlos.gu]);

  // substrato: ana publica 1 post; padaria publica 1 serviço ativo (concept→canonical→service)
  await pool.query(`INSERT INTO posts (tenant_id, actor_id, content, is_published, is_deleted) VALUES ($1::uuid,$2::uuid,'olá página',true,false)`, [TENANT, ana.actorId]);

  // aresta de relação PRIVADA aceita entre Ana e Carlos (dado do PAR que só Ana ou Carlos podem
  // ver). Serve de alvo da prova adversarial: Mallory NÃO pode revelar este 'accepted' declarando o
  // actorId de Ana. (Par ana↔carlos, DELIBERADAMENTE fora do par ana↔bia usado por B2, que exige
  // aresta ausente para projetar os allowedLabels do seed. Vocabulário de label governado.)
  await pool.query(
    `INSERT INTO actor_relationships (tenant_id, from_actor_id, to_actor_id, status, requester_label, target_label, responded_at, created_by_user_id, responded_by_user_id)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'accepted','amigo','amigo', now(), $4::uuid, $5::uuid)`,
    [TENANT, ana.actorId, carlos.actorId, ana.userId, carlos.userId]
  );
  // concepts é GOVERNADO (0075_concept_governance_trigger): INSERT exige app.concept_governance
  // dentro de transação autorizada — mesmo padrão dos e2es de catálogo.
  const gc = await pool.connect();
  let conceptId: string;
  try {
    await gc.query('BEGIN');
    await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
    conceptId = (await gc.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1,'servicos') RETURNING concept_id::text AS id`,
      [`ap-corte-${Date.now()}`]
    )).rows[0].id;
    await gc.query('COMMIT');
  } catch (e) {
    await gc.query('ROLLBACK');
    throw e;
  } finally {
    gc.release();
  }
  const canonicalId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (concept_id, name, slug, scope) VALUES ($1::uuid,'Corte E2E',$2,'global') RETURNING id::text AS id`,
    [conceptId, `ap-corte-canon-${Date.now()}`]
  )).rows[0].id;
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status) VALUES ($1::uuid,$2::uuid,'Corte E2E',$3,$4::uuid,'active') RETURNING service_id::text AS id`,
    [TENANT, pageActorId, `ap-corte-svc-${Date.now()}`, canonicalId]
  )).rows[0].id;

  // ── FATIA 4: fixtures de conteúdo rico ──────────────────────────────────────────────────
  // (preço do serviço via UPDATE separado — não-adjacente ao INSERT de canonical_services acima;
  // audit-canonical-catalog-closure.mjs faz varredura textual de proximidade INSERT-canônico↔price
  // e um price_cents colado ao INSERT de services logo abaixo do canonical dispararia falso-positivo)
  await pool.query(`UPDATE services SET price_cents = 5000, currency = 'BRL' WHERE service_id = $1::uuid`, [serviceId]);
  // Produtos: MESMO canônico, DOIS merchants PF DEDICADOS (fora de Ana/Bia/Padaria — merchant de
  // EMPRESA exige gate KYB, fora do escopo desta prova; o filtro merchantActorId é o mesmo código
  // seja PF ou PJ). Merchants dedicados também evitam poluir as asserções B/C (Ana/Bia sem produtos).
  const merchantX = await mkUserActor(TENANT, 'Merchant X E2E');
  const merchantY = await mkUserActor(TENANT, 'Merchant Y E2E');
  const categoryRow = await pool.query<{ category_id: string }>(`SELECT category_id FROM categories LIMIT 1`);
  const categoryId = categoryRow.rows[0]?.category_id;
  if (!categoryId) throw new Error('ABORT: nenhuma categoria seedada na DB efêmera (esperado via migrations FULL)');

  const gc2 = await pool.connect();
  let productConceptId: string;
  try {
    await gc2.query('BEGIN');
    await gc2.query(`SELECT set_config('app.concept_governance','true', true)`);
    productConceptId = (await gc2.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1,'produtos-e-comercio') RETURNING concept_id::text AS id`,
      [`ap-pao-${Date.now()}`]
    )).rows[0].id;
    await gc2.query('COMMIT');
  } catch (e) {
    await gc2.query('ROLLBACK');
    throw e;
  } finally {
    gc2.release();
  }
  const canonicalProductId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_products (tenant_id, name, category_id, type, concept_id, concept_resolution_status, scope)
     VALUES ($1::uuid,'Pão E2E',$2::uuid,'INDUSTRIAL',$3::uuid,'confirmed','scoped') RETURNING id::text AS id`,
    [TENANT, categoryId, productConceptId]
  )).rows[0].id;
  const productId = (await pool.query<{ id: string }>(
    `INSERT INTO products (tenant_id, name, category_id, product_type, canonical_product_id, status, is_active)
     VALUES ($1::uuid,'Pão E2E',$2::uuid,'INDUSTRIAL',$3::uuid,'active',true) RETURNING id::text AS id`,
    [TENANT, categoryId, canonicalProductId]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO product_variants (tenant_id, product_id, sku) VALUES ($1::uuid,$2::uuid,'ap-pao-sku')`,
    [TENANT, productId]
  );
  // oferta do MERCHANT X (a que deve aparecer no bloco DELE)
  await pool.query(
    `INSERT INTO product_offers (tenant_id, product_id, merchant_id, price_cents, available_quantity, is_active, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,890,10,true,'active')`,
    [TENANT, productId, merchantX.actorId]
  );
  // oferta do MERCHANT Y no MESMO canônico (NÃO pode vazar no bloco do Merchant X)
  await pool.query(
    `INSERT INTO product_offers (tenant_id, product_id, merchant_id, price_cents, available_quantity, is_active, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,999,5,true,'active')`,
    [TENANT, productId, merchantY.actorId]
  );

  // Agenda: janela REAL da padaria (owner_type='page') + janela DECOY (owner_type diferente,
  // mesmo owner_id) — sem o fix, a decoy vazaria na contagem/lista.
  await pool.query(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES ($1::uuid,'page',$2::uuid,'fixed','active', now() + interval '1 day', now() + interval '1 day 2 hours', 'America/Sao_Paulo')`,
    [TENANT, pageActorId]
  );
  await pool.query(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES ($1::uuid,'service',$2::uuid,'fixed','active', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/Sao_Paulo')`,
    [TENANT, pageActorId]
  );

  // Localização: endereço operacional REAL da padaria (Location Core, DECISION-0020).
  const cityRow = await pool.query<{ city_id: string; state_id: string; country_id: string }>(
    `SELECT c.city_id, c.state_id, s.country_id FROM cities c JOIN states s ON s.state_id = c.state_id LIMIT 1`
  );
  let hasLocationSeed = false;
  if (cityRow.rows[0]) {
    hasLocationSeed = true;
    const { city_id, state_id, country_id } = cityRow.rows[0];
    const addressId = (await pool.query<{ id: string }>(
      `INSERT INTO addresses (country_id, state_id, city_id, street, number, lat, lng, postal_code, source)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'Rua Sigilosa E2E','123',-25.4284,-49.2733,'80000-000','MANUAL_OVERRIDE')
       RETURNING address_id::text AS id`,
      [country_id, state_id, city_id]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary, valid_from_at)
       VALUES ('service_provider',$1::uuid,$2::uuid,'OPERATIONAL',true, now())`,
      [pageActorId, addressId]
    );
  }

  const actorPageRoutes = (await import('../modules/actor-page/actor-page.routes')).default;
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
  await app.register(actorPageRoutes);
  await app.ready();

  const call = (url: string, opts: { userId?: string; actorId?: string } = {}) =>
    app.inject({
      method: 'GET',
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
      },
    });

  try {
    console.log('\n— actor page contract END-TO-END (a aba existe se o bloco está aceso) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · sem req.user → 401
    const rA = await call(`/actor-page/${ana.actorId}`);
    record('A GET sem autenticação → 401', rA.statusCode === 401, `status=${rA.statusCode}`);

    // B · página da Ana (PF, 1 post) vista pela Bia
    const rB = await call(`/actor-page/${ana.actorId}`, { userId: bia.userId, actorId: bia.actorId });
    const cB = (rB.json() as any)?.data;
    const tabsB = (cB?.tabs ?? []).map((t: any) => t.key);
    const postsBlock = (cB?.blocks ?? []).find((b: any) => b.type === 'posts');
    const connectB = (cB?.actions ?? []).find((a: any) => a.key === 'connect');
    record('B Ana: Posts ACENDE (count=1); Products/Services NÃO; Tudo+Sobre sempre',
      rB.statusCode === 200 &&
      tabsB.includes('all') && tabsB.includes('about') && tabsB.includes('posts') &&
      !tabsB.includes('products') && !tabsB.includes('services') &&
      postsBlock?.data?.count === 1,
      `status=${rB.statusCode} tabs=${JSON.stringify(tabsB)} posts=${JSON.stringify(postsBlock)}`);
    record("B2 Conectar com allowedLabels do par PF↔PF (amigo/conhecido/familiar)",
      !!connectB && connectB.enabled === true &&
      JSON.stringify(connectB.data?.allowedLabels) === JSON.stringify(['amigo', 'conhecido', 'familiar']),
      `connect=${JSON.stringify(connectB)}`);

    // C · página da Bia (vazia): só Tudo+Sobre
    const rC = await call(`/actor-page/${bia.actorId}`, { userId: ana.userId, actorId: ana.actorId });
    const cC = (rC.json() as any)?.data;
    const tabsC = (cC?.tabs ?? []).map((t: any) => t.key);
    record('C Bia (nada publicado): só Tudo+Sobre — nenhuma aba fantasma',
      rC.statusCode === 200 && tabsC.length === 2 && tabsC.includes('all') && tabsC.includes('about'),
      `tabs=${JSON.stringify(tabsC)}`);

    // D · página da Padaria (1 serviço ativo) vista pela Ana
    const rD = await call(`/actor-page/${pageActorId}`, { userId: ana.userId, actorId: ana.actorId });
    const cD = (rD.json() as any)?.data;
    const tabsD = (cD?.tabs ?? []).map((t: any) => t.key);
    const contractAction = (cD?.actions ?? []).find((a: any) => a.key === 'contract');
    const connectD = (cD?.actions ?? []).find((a: any) => a.key === 'connect');
    record('D Padaria: Serviços ACENDE; Contratar renderiza DESABILITADA gatedBy=PORTA-1',
      rD.statusCode === 200 && tabsD.includes('services') &&
      !!contractAction && contractAction.enabled === false && contractAction.gatedBy === 'PORTA-1',
      `tabs=${JSON.stringify(tabsD)} contract=${JSON.stringify(contractAction)}`);
    record("D2 Conectar PF↔PJ com labels do seed (cliente/colaborador/fornecedor)",
      !!connectD && JSON.stringify(connectD.data?.allowedLabels) === JSON.stringify(['cliente', 'colaborador', 'fornecedor']),
      `connect=${JSON.stringify(connectD)}`);

    // H · bloco Serviços carrega o item real
    const servicesBlock = (cD?.blocks ?? []).find((b: any) => b.type === 'services');
    const svcItem = servicesBlock?.data?.items?.[0];
    record('H bloco Serviços carrega item real (nome/preço do serviço ativo)',
      !!svcItem && svcItem.name === 'Corte E2E' && svcItem.priceCents === 5000,
      `item=${JSON.stringify(svcItem)}`);

    // I · bloco Produtos ESCOPA por merchant — a página do Merchant X só lista a oferta DELE
    // (890), nunca a do Merchant Y (999) no MESMO canônico — prova o filtro merchantActorId novo.
    const rI = await call(`/actor-page/${merchantX.actorId}`, { userId: carlos.userId, actorId: carlos.actorId });
    const cI = (rI.json() as any)?.data;
    const productsBlock = (cI?.blocks ?? []).find((b: any) => b.type === 'products');
    const prodItems = productsBlock?.data?.items ?? [];
    record('I bloco Produtos: 1 item (890, oferta do Merchant X); oferta do Merchant Y (999) NÃO vaza',
      rI.statusCode === 200 && prodItems.length === 1 && prodItems[0]?.priceCents === 890 &&
      !prodItems.some((p: any) => p.priceCents === 999),
      `items=${JSON.stringify(prodItems)}`);

    // J · bloco Agenda ISOLA por owner_type — decoy (owner_type='service', mesmo owner_id) não aparece
    const agendaBlock = (cD?.blocks ?? []).find((b: any) => b.type === 'agenda');
    const agendaItems = agendaBlock?.data?.items ?? [];
    record('J bloco Agenda: só a janela owner_type=page (1 item); decoy owner_type=service NÃO vaza',
      agendaBlock?.data?.count === 1 && agendaItems.length === 1,
      `count=${agendaBlock?.data?.count} items=${JSON.stringify(agendaItems)}`);

    // K · bloco Localização + header.location projetam cidade/estado reais; anti-PII de endereço exato
    if (hasLocationSeed) {
      const locationBlock = (cD?.blocks ?? []).find((b: any) => b.type === 'location');
      record('K bloco Localização projeta cityName/stateCode; header.location espelha o mesmo resumo',
        !!locationBlock?.data?.cityName && !!cD?.header?.location?.cityName &&
        cD.header.location.cityName === locationBlock.data.cityName,
        `block=${JSON.stringify(locationBlock?.data)} header=${JSON.stringify(cD?.header?.location)}`);
      const fullRaw = JSON.stringify(cD);
      record('K2 anti-PII: contrato NUNCA expõe rua/lat/lng/CEP do endereço operacional',
        !/Rua Sigilosa|80000-000|-25\.4284|-49\.2733/.test(fullRaw),
        fullRaw.includes('Rua Sigilosa') ? 'VAZOU rua' : 'ok');
    }

    // E · operating: estranha → 403; dono → 200 com gestão
    const rE1 = await call(`/actor-page/${pageActorId}?mode=operating`, { userId: bia.userId, actorId: bia.actorId });
    const rE2 = await call(`/actor-page/${pageActorId}?mode=operating`, { userId: carlos.userId, actorId: carlos.actorId });
    const cE2 = (rE2.json() as any)?.data;
    const opKeys = (cE2?.actions ?? []).map((a: any) => a.key);
    record('E operating: estranha → 403 fail-closed; dono → 200 com ações de gestão',
      rE1.statusCode === 403 && rE2.statusCode === 200 &&
      cE2?.mode === 'operating' && opKeys.includes('edit_profile') && opKeys.includes('create_service'),
      `estranha=${rE1.statusCode} dono=${rE2.statusCode} actions=${JSON.stringify(opKeys)}`);

    // F · anti-PII no contrato
    const raw = JSON.stringify(cB) + JSON.stringify(cD) + JSON.stringify(cE2);
    const leak = /cpf|tax_id|kyc|global_user_id|user_id|birthdate/i.test(raw);
    record('F contrato sem PII (cpf/tax_id/kyc/global_user_id/user_id)', !leak, raw.slice(0, 200));

    // ── DECISION-0113 · PROVAS ADVERSARIAIS DE VIEWER (P0 actor-page) ────────────────────────
    // Baseline honesto: Ana, com o PRÓPRIO actor, vê Carlos e enxerga a conexão real 'accepted'.
    const rL = await call(`/actor-page/${carlos.actorId}`, { userId: ana.userId, actorId: ana.actorId });
    const connectL = ((rL.json() as any)?.data?.actions ?? []).find((a: any) => a.key === 'connect');
    record('L baseline: Ana (actor próprio) vê a conexão real com Carlos (connectionStatus=accepted)',
      rL.statusCode === 200 && connectL?.data?.connectionStatus === 'accepted',
      `status=${rL.statusCode} connect=${JSON.stringify(connectL)}`);

    // Ataque 1 — Mallory autentica como si mesma mas DECLARA o actorId de Ana (spoof) para ler o
    // status privado do par (Ana, Carlos). O viewer efetivo DEVE cair no actor canônico de Mallory
    // (canRepresentActor(mallory, ana)=false), jamais revelar 'accepted'. status 200 (não vaza erro).
    const rM = await call(`/actor-page/${carlos.actorId}`, { userId: mallory.userId, actorId: ana.actorId });
    const connectM = ((rM.json() as any)?.data?.actions ?? []).find((a: any) => a.key === 'connect');
    record('M spoof: Mallory declarando actor de Ana NÃO revela a conexão privada (não vem accepted)',
      rM.statusCode === 200 && connectM?.data?.connectionStatus !== 'accepted' &&
      connectM?.data?.connectionStatus !== 'pending_sent' && connectM?.data?.connectionStatus !== 'pending_received',
      `status=${rM.statusCode} connect=${JSON.stringify(connectM)}`);

    // Ataque 2 — Mallory declara actor de Carlos enquanto olha a página de Ana: mesma regra, sem vazar.
    const rN = await call(`/actor-page/${ana.actorId}`, { userId: mallory.userId, actorId: carlos.actorId });
    const connectN = ((rN.json() as any)?.data?.actions ?? []).find((a: any) => a.key === 'connect');
    record('N spoof reverso: Mallory declarando actor de Carlos contra a página de Ana não vaza status',
      rN.statusCode === 200 && connectN?.data?.connectionStatus !== 'accepted' &&
      connectN?.data?.connectionStatus !== 'pending_sent' && connectN?.data?.connectionStatus !== 'pending_received',
      `status=${rN.statusCode} connect=${JSON.stringify(connectN)}`);

    // P · FALLBACK CANÔNICO: Ana autentica SEM actionContext (sem x-test-actor-id) → o viewer é
    // resolvido server-side pelo actor canônico do principal (findByUserId → actor_id) e Ana vê a
    // conexão real com Carlos. Prova que o fallback resolve o actor_id correto (não undefined).
    const rP = await call(`/actor-page/${carlos.actorId}`, { userId: ana.userId });
    const connectP = ((rP.json() as any)?.data?.actions ?? []).find((a: any) => a.key === 'connect');
    record('P fallback canônico (sem actionContext): Ana vê a conexão real via findByUserId (accepted)',
      rP.statusCode === 200 && connectP?.data?.connectionStatus === 'accepted',
      `status=${rP.statusCode} connect=${JSON.stringify(connectP)}`);

    // Ataque 3 — atacante SEM actor canônico não deve nem enumerar: usuário fantasma declara actor de
    // Ana. Sem req.user→actor, viewer=null → o bloco Conectar (par) simplesmente não computa relação.
    const ghostUserId = randomUUID();
    const rO = await call(`/actor-page/${carlos.actorId}`, { userId: ghostUserId, actorId: ana.actorId });
    const connectO = ((rO.json() as any)?.data?.actions ?? []).find((a: any) => a.key === 'connect');
    record('O spoof sem actor próprio: viewer=null, nenhuma relação de Ana é enumerada',
      rO.statusCode === 200 && (!connectO || connectO?.data?.connectionStatus === undefined ||
        (connectO?.data?.connectionStatus !== 'accepted' && connectO?.data?.connectionStatus !== 'pending_sent' && connectO?.data?.connectionStatus !== 'pending_received')),
      `status=${rO.statusCode} connect=${JSON.stringify(connectO)}`);

    // G · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('G Δbank=0 (contrato é leitura pura)', bankBefore.rows[0].n === bankAfter.rows[0].n,
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
