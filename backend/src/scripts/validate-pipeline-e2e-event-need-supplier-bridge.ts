/**
 * E2E — F-EVENT-SUPPLIER-BRIDGE (2026-08-04). 🔒 SÓ DB efêmera.
 *
 * Prova a ponte que faltava: necessidade declarada do evento → FORNECEDOR REAL, resolvida no
 * BACKEND ("a verdade vive no backend", Clayton). Antes desta fatia, `need_concept_id` e
 * `service_offerings`/`rentable_resources` eram duas pontas vivas sem nada no meio.
 *
 *  A · SERVIÇO: need 'seguranca-eventos' encontra a empresa que oferta aquele canonical_service.
 *  B · LOCAÇÃO: need 'banheiro-quimico' (fulfillment_kind='rentable') encontra o rentable_resource.
 *      Prova que os DOIS substratos são varridos — a régua serviço×locação atravessa a ponte.
 *  C · ZERO HONESTO: need sem oferta devolve supplierCount=0 e suppliers=[] — afirmação medida,
 *      não erro nem omissão da linha ("zero é afirmação; desconhecido é a verdade").
 *  D · 🔴 VERMELHA — CONCEPT ERRADO NÃO VAZA: uma oferta ativa de OUTRO concept não pode aparecer
 *      sob a necessidade. É o teste que pega junção por nome/rótulo em vez de por identidade.
 *  E · 🔴 VERMELHA — CROSS-TENANT NÃO VAZA: oferta idêntica, mesmo concept, em OUTRO tenant não
 *      aparece. Vazamento de fornecedor é silencioso; só falha se for atacado de propósito.
 *  F · onlyDeclared: com o filtro, só volta o que o organizador declarou (a lista dele), sem o
 *      resto do template.
 *  G · Δbank=0 — a descoberta de fornecedor não move dinheiro.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';
// Δbank=0 se pergunta AO BANK — a sonda mora em src/modules/bank porque só o domínio Bank lê bank_*
// (SSOT_EXCLUSIVE_BANK_RULE; C4-BANK-READ-BOUNDARY do audit-schema-coherence-ratchet).
import { countBankMovements } from '../modules/bank/bank-movement-probe';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string): void => {
  results.push({ label: l, ok, reason: r });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`);
};

/** Cria tenant + usuário + actor humano pelo caminho real (ensureUserActor), como os E2E irmãos. */
async function makeTenantWithActor(label: string): Promise<{ tenantId: string; actorId: string; userId: string }> {
  const { ensureUserActor } = await import('../modules/identity/actor-writer.service');
  const tenantId = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [`T ${label}`, `t-${label.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`]
    )
  ).rows[0].id;
  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e9)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at)
     VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`,
    [uid, tenantId, `${label.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@e2e.test`, gu]
  );
  const actor = await ensureUserActor(tenantId, uid);
  return { tenantId, actorId: actor.actor_id, userId: uid };
}

/**
 * Actor humano NOVO dentro de um tenant que já existe. Necessário porque o fornecedor tem de
 * viver no mesmo tenant do organizador para ser descoberto.
 */
async function makeHumanActorInTenant(tenantId: string, label: string): Promise<string> {
  const { ensureUserActor } = await import('../modules/identity/actor-writer.service');
  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e9)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at)
     VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`,
    [uid, tenantId, `${label}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@e2e.test`, gu]
  );
  const a = await ensureUserActor(tenantId, uid);
  return a.actor_id;
}

/**
 * Actor FORNECEDOR no tenant do organizador.
 *
 * 🔴 2026-08-04 — ERA UM `INSERT INTO actors` DIRETO, e estava errado por DOIS motivos que se
 * reforçam. O primeiro é de fronteira: `audit-schema-coherence-ratchet` mordeu
 * (C5-ACTORS-INSERT-BOUNDARY) porque só `modules/identity/actor-writer.service.ts` escreve em
 * `actors`. O segundo é de VERDADE: o actor `page` que eu inseria não tinha `company_id`, e page
 * sem empresa é MEIA-EMPRESA — não-representável (403), como descobri no seed no mesmo dia. O
 * teste passava com um fornecedor que não existiria em produção.
 *
 * `ensurePageActor` exige `companyId` justamente por isso. Como a ponte casa por CONCEPT e
 * `provider_actor_id` aceita PF, empresa e grupo INDISTINTAMENTE, o fornecedor desta prova é um
 * actor HUMANO nascido pelo writer soberano (`ensureUserActor`) — mais fiel, não menos: exercita
 * o caminho pessoa-física-fornecedora sem inventar uma empresa pela metade.
 */
async function makeSupplierActor(tenantId: string, label: string): Promise<string> {
  return makeHumanActorInTenant(tenantId, label);
}

/**
 * Oferta de SERVIÇO completa, na forma REAL do domínio: `services` (o serviço do prestador) e
 * `service_offerings` pendurada nele.
 * 🔴 Descoberto ao rodar: `service_offerings.service_id` é NOT NULL — oferta não flutua, ela
 * pende de um serviço. Inserir só a oferta (como eu tinha feito) produzia dado que o domínio
 * nunca geraria. A trava evitou uma prova que passaria contra uma forma inexistente.
 */
async function makeServiceOffering(input: {
  tenantId: string; providerActorId: string; canonicalServiceId: string;
  serviceName: string; priceCents: number; durationMinutes: number;
}): Promise<string> {
  const svc = await pool.query<{ service_id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'active',NOW(),NOW()) RETURNING service_id`,
    [input.tenantId, input.providerActorId, input.serviceName,
     `${input.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
     input.canonicalServiceId]
  );
  const r = await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, service_id, canonical_service_id, provider_actor_id, price_cents, duration_minutes, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'active',NOW(),NOW()) RETURNING id`,
    [input.tenantId, svc.rows[0].service_id, input.canonicalServiceId, input.providerActorId, input.priceCents, input.durationMinutes]
  );
  return r.rows[0].id;
}

/** concept_id de um slug governado. Falha ALTO se ausente — o seed do catálogo é pré-condição. */
async function conceptIdBySlug(slug: string): Promise<string> {
  const r = await pool.query<{ concept_id: string }>(`SELECT concept_id::text FROM concepts WHERE slug = $1 LIMIT 1`, [slug]);
  const id = r.rows[0]?.concept_id;
  if (!id) throw new Error(`concept ausente no catálogo governado: ${slug}`);
  return id;
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}"`);
  console.log(`🔒 DB efêmera: ${db}\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const { eventNeedSupplierDiscoveryService } = await import('../core/events/event-need-supplier-discovery.service');
  const { eventOperationalNeedsService } = await import('../core/events/event-operational-needs.service');

  const bank0 = String(await countBankMovements());

  const org = await makeTenantWithActor('SUPBRIDGE');
  const outro = await makeTenantWithActor('SUPBRIDGEOUT');

  // Formato SHOW e as necessidades do template — identidade por CONCEPT, nunca por nome.
  const showConceptId = await conceptIdBySlug('show');
  const needSeguranca = await conceptIdBySlug('seguranca-eventos');
  const needBanheiro = await conceptIdBySlug('banheiro-quimico');
  const needBrigadista = await conceptIdBySlug('brigadista-equipe-de-saude');
  // Concept FORA do template do SHOW — a isca da prova vermelha D.
  const conceptForaDoTemplate = await conceptIdBySlug('apresentacao-musical');

  const eventId = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, title, status, visibility,
         timezone, currency, metadata, event_format_concept_id, created_at, updated_at)
       VALUES ($1,$2,'user','Show da Ponte','declared','public','America/Sao_Paulo','BRL','{}'::jsonb,$3,NOW(),NOW())
       RETURNING id`,
      [org.tenantId, org.actorId, showConceptId]
    )
  ).rows[0].id;

  // ── FORNECEDORES REAIS ──────────────────────────────────────────────────────
  // Serviço: empresa de segurança oferta o canonical_service do concept 'seguranca-eventos'.
  const csSeguranca = (
    await pool.query<{ id: string }>(
      `SELECT id::text FROM canonical_services WHERE concept_id = $1::uuid AND tenant_id IS NULL AND status='active' LIMIT 1`,
      [needSeguranca]
    )
  ).rows[0]?.id;
  if (!csSeguranca) throw new Error('canonical_service de seguranca-eventos ausente (pré-condição do catálogo)');

  // O fornecedor vive no MESMO tenant do organizador (é o que o isolamento exige para ser
  // descoberto) e nasce com dono humano próprio — a âncora civil que o domínio cobra.
  const fornecedorActorId = await makeSupplierActor(org.tenantId, 'seguranca-muralha');
  await makeServiceOffering({
    tenantId: org.tenantId, providerActorId: fornecedorActorId, canonicalServiceId: csSeguranca,
    serviceName: 'Segurança para eventos', priceCents: 250000, durationMinutes: 480,
  });

  // Locação: dono oferta um banheiro químico (rentable_resources, concept DIRETO).
  const locadorActorId = await makeSupplierActor(org.tenantId, 'sanitarios-rio-verde');
  // 🔴 `pricing_unit='por_dia'`, LIDO do CHECK, não deduzido. Eu tinha escrito 'diaria' de cabeça
  // e o banco recusou — o vocabulário real é `por_hora|por_dia|por_semana|por_mes|por_semestre|
  // por_ano`. Terceira trava do domínio a me pegar inventando valor nesta fatia; as três estavam
  // certas. Comando que resolveu:
  //   SELECT pg_get_constraintdef(oid) FROM pg_constraint
  //    WHERE conrelid='rentable_resources'::regclass AND contype='c';
  await pool.query(
    `INSERT INTO rentable_resources (tenant_id, owner_actor_id, concept_id, resource_type, label, status, is_active, pricing_unit, price_cents, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,'equipment','Banheiro químico standard','active',true,'por_dia',18000,'{}'::jsonb,NOW(),NOW())`,
    [org.tenantId, locadorActorId, needBanheiro]
  );

  // ISCA D: oferta ATIVA de um concept que NÃO é necessidade do SHOW (apresentacao-musical).
  const csMusical = (
    await pool.query<{ id: string }>(
      `SELECT id::text FROM canonical_services WHERE concept_id = $1::uuid AND tenant_id IS NULL AND status='active' LIMIT 1`,
      [conceptForaDoTemplate]
    )
  ).rows[0]?.id;
  if (csMusical) {
    await makeServiceOffering({
      tenantId: org.tenantId, providerActorId: fornecedorActorId, canonicalServiceId: csMusical,
      serviceName: 'Apresentacao musical isca', priceCents: 350000, durationMinutes: 120,
    });
  }

  // ISCA E: oferta IDÊNTICA (mesmo concept de segurança) em OUTRO tenant.
  const outroFornecedorId = await makeSupplierActor(outro.tenantId, 'seguranca-outra');
  await makeServiceOffering({
    tenantId: outro.tenantId, providerActorId: outroFornecedorId, canonicalServiceId: csSeguranca,
    serviceName: 'Seguranca de outro tenant', priceCents: 1, durationMinutes: 60,
  });

  // ── LEITURA PELA PONTE ──────────────────────────────────────────────────────
  const todas = await eventNeedSupplierDiscoveryService.listNeedsWithSuppliers(org.tenantId, eventId);

  const seg = todas.find((n) => n.needConceptId === needSeguranca);
  rec(
    'A · need SERVIÇO (segurança) encontra a empresa que oferta aquele concept',
    !!seg && seg.supplierCount === 1 && seg.suppliers[0]?.providerActorId === fornecedorActorId && seg.suppliers[0]?.sourceKind === 'service',
    `count=${seg?.supplierCount} provider=${seg?.suppliers[0]?.providerActorId}`
  );
  rec(
    'A2 · o preço vem do fornecedor, em CENTAVOS inteiros (nunca string/float)',
    typeof seg?.suppliers[0]?.priceCents === 'number' && seg?.suppliers[0]?.priceCents === 250000,
    `priceCents=${seg?.suppliers[0]?.priceCents} (${typeof seg?.suppliers[0]?.priceCents})`
  );

  const ban = todas.find((n) => n.needConceptId === needBanheiro);
  rec(
    'B · need LOCAÇÃO (banheiro químico) encontra o rentable_resource — os DOIS substratos são varridos',
    !!ban && ban.supplierCount === 1 && ban.suppliers[0]?.sourceKind === 'rentable' && ban.suppliers[0]?.providerActorId === locadorActorId,
    `kind=${ban?.fulfillmentKind} count=${ban?.supplierCount} source=${ban?.suppliers[0]?.sourceKind}`
  );

  const brig = todas.find((n) => n.needConceptId === needBrigadista);
  rec(
    'C · ZERO HONESTO: need sem oferta volta na lista com supplierCount=0 (não some, não erra)',
    !!brig && brig.supplierCount === 0 && Array.isArray(brig.suppliers) && brig.suppliers.length === 0,
    `presente=${!!brig} count=${brig?.supplierCount}`
  );

  // 🔴 D — junção tem de ser por CONCEPT. Se alguém trocar por nome/rótulo, isto acende.
  const vazouConceptErrado = todas.some((n) => n.suppliers.some((s) => s.offerLabel?.toLowerCase().includes('musical')));
  const musicalComoNecessidade = todas.some((n) => n.needConceptId === conceptForaDoTemplate);
  rec(
    '🔴 D · VERMELHA: oferta ativa de OUTRO concept NÃO aparece sob necessidade nenhuma',
    !vazouConceptErrado && !musicalComoNecessidade,
    `vazouOferta=${vazouConceptErrado} virouNecessidade=${musicalComoNecessidade}`
  );

  // 🔴 E — o vazamento cross-tenant seria mudo: a oferta do outro tenant tem preço 1 centavo,
  // então se vazasse viria PRIMEIRO (ORDER BY price_cents ASC) e seria impossível não notar.
  const vazouCrossTenant = todas.some((n) => n.suppliers.some((s) => s.providerActorId === outroFornecedorId || s.priceCents === 1));
  rec(
    '🔴 E · VERMELHA: oferta do MESMO concept em OUTRO tenant não vaza (isca de 1 centavo ordenaria primeiro)',
    !vazouCrossTenant,
    `vazou=${vazouCrossTenant}`
  );

  // ── F — onlyDeclared ────────────────────────────────────────────────────────
  await eventOperationalNeedsService.add(org.tenantId, eventId, needSeguranca);
  const declaradas = await eventNeedSupplierDiscoveryService.listNeedsWithSuppliers(org.tenantId, eventId, { onlyDeclared: true });
  rec(
    'F · onlyDeclared devolve SÓ a necessidade declarada, já com o fornecedor resolvido',
    declaradas.length === 1 && declaradas[0].needConceptId === needSeguranca && declaradas[0].supplierCount === 1 && declaradas[0].declaredStatus === 'open',
    `n=${declaradas.length} status=${declaradas[0]?.declaredStatus} count=${declaradas[0]?.supplierCount}`
  );
  const semFiltro = await eventNeedSupplierDiscoveryService.listNeedsWithSuppliers(org.tenantId, eventId);
  rec(
    'F2 · sem o filtro, o template INTEIRO volta e marca o que já foi declarado',
    semFiltro.length > 1 && semFiltro.find((n) => n.needConceptId === needSeguranca)?.declaredStatus === 'open'
      && semFiltro.find((n) => n.needConceptId === needBrigadista)?.declaredStatus === null,
    `total=${semFiltro.length}`
  );

  // ── G — Δbank=0 ─────────────────────────────────────────────────────────────
  const bank1 = String(await countBankMovements());
  rec('G · Δbank=0 — descobrir fornecedor não move dinheiro', bank0 === bank1, `${bank0} → ${bank1}`);

  // Panorama legível — é o que a tela vai mostrar.
  console.log('\n  📋 Panorama do SHOW (o que "Meus Eventos · Consumir" renderiza):');
  for (const n of semFiltro) {
    const marca = n.supplierCount > 0 ? '✅' : '⚪';
    const dec = n.declaredStatus ? ' [declarada]' : '';
    console.log(`     ${marca} ${n.label.padEnd(32)} ${String(n.fulfillmentKind).padEnd(9)} → ${n.supplierCount} fornecedor(es)${dec}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Ponte necessidade → fornecedor: verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
