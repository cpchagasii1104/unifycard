/**
 * E2E — ARCO FUNDAÇÃO EVENTOS · FATIA PREÇO · GRADE DE PREÇO por CONFIG (formação) × dia-da-semana × período.
 * Prova, POR API DIRETA (camada de service REAL — "a verdade vive no backend"), que a banda/artista declara,
 * por item do cardápio (service_offering_configs), um PREÇO por célula (dia ISO 1-7 × período pt-BR), com
 * resolução em CASCATA "a partir de" de 3 níveis (§2 — UMA verdade por célula):
 *   1) célula service_offering_config_prices → 2) configs.default_price_cents → 3) offerings.price_cents SELADA.
 * Preço = valor DECLARADO de catálogo, NUNCA cobrança/movimento de dinheiro (Δbank=0; porta-01 FORA). DB efêmera.
 *
 * PROVAS:
 *  (1) config 'banda-completa': grade (6=Sáb, noite)=R$X e (0=Dom, manha)=R$Y, X≠Y → ambas legíveis DISTINTAS.
 *      Dia canônico §4.25 (0=Dom..6=Sáb): a célula Domingo=0 prova a encodação canônica (não ISO 1-7).
 *  (2) cascata de 3 níveis: célula presente → devolve célula; sem célula mas default_price_cents → devolve default;
 *      nem célula nem default → devolve offerings.price_cents (base SELADA). UM valor por nível.
 *  (3) dualidade SOLO (user-actor): oferta solo também recebe grade (grade independe do line-up).
 *  (4) config PRECIFICADA → deleteConfig SOFT-RETIRE (retired_at setado, preços SOBREVIVEM, sai do listConfigs
 *      ATIVO, segue RESOLVÍVEL); config SEM preço → delete físico normal.
 *  (5) autoridade: não-dono edita grade → 403.
 *  (6) validação fail-closed: dia=7/8 → 400 (7 era Domingo em ISO, agora fora do 0-6 canônico); período='madrugada' → 400; price_cents negativo → 400.
 *  (7) Δbank=0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { serviceOfferingConfigService } from '../modules/services/service-offering-config.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${reason ? ` — ${reason}` : ''}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/band|group|actor|provider|config|price|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 53).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `price-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function resolveServiceConcept(slug: string): Promise<{ conceptId: string; canonicalId: string }> {
  const r = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
       JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind='service'
      WHERE c.slug = $1`,
    [slug]
  )).rows[0];
  if (!r) throw new Error(`concept de serviço governado ausente: ${slug}`);
  return { conceptId: r.concept_id, canonicalId: r.canonical_id };
}

const OFFERING_BASE_CENTS = 250000; // base SELADA da oferta (nível 3 da cascata)

/** Publica um provider (user OU grupo-actor): declara concept → service(active) → offering (base 250000). */
async function publishProvider(
  tenantId: string,
  operatorUserId: string,
  providerActorId: string,
  name: string,
  canonical: { conceptId: string; canonicalId: string },
  cityId: string
): Promise<{ serviceId: string; offeringId: string }> {
  await professionalC1Service.declareConcept(tenantId, providerActorId, { conceptId: canonical.conceptId, skillLevel: 3 }, operatorUserId);
  const service = await servicesService.createService(tenantId, operatorUserId, {
    actorId: providerActorId,
    name,
    serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE,
    canonicalServiceId: canonical.canonicalId,
    cityId,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId, userId: operatorUserId, providerActorId,
    canonicalServiceId: canonical.canonicalId, priceCents: OFFERING_BASE_CENTS, durationMinutes: 90,
  });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

const codeOf = (e: any): string => `${e?.statusCode ?? '?'}:${e?.code ?? String(e?.message ?? e).slice(0, 60)}`;

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { groupsPortsRegistry } = await import('../core/groups/ports-registry');
  const ga = await import('../modules/groups/adapters');
  groupsPortsRegistry.setGroupsRepository(ga.groupsRepositoryAdapter);
  const { groupsService } = await import('../modules/groups/groups.service');

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Offering Config Price Grid E2E', slug: `price-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  const musical = await resolveServiceConcept('apresentacao-musical');

  const ana = await mkUserActor(TENANT, 'Ana Dona da Banda');   // dona + provider SOLO (prova 3)
  const vio = await mkUserActor(TENANT, 'Vic Vocalista');       // membro (para banda válida)
  const gui = await mkUserActor(TENANT, 'Gil Guitarrista');     // membro
  const intruso = await mkUserActor(TENANT, 'Carlos Intruso');  // não-dono (prova 5)

  console.log('\n— setup: banda real (grupo-actor) + oferta base 250000 —');
  const group = await groupsService.createGroup(TENANT, ana.userId, {
    name: 'Banda Preço', description: 'Banda do E2E da fatia PREÇO — grade por config × dia × período.',
  });
  const groupActorId = (await pool.query<{ actor_id: string | null }>(
    `SELECT actor_id::text AS actor_id FROM groups WHERE id = $1::uuid`, [group.groupId]
  )).rows[0]?.actor_id;
  if (!groupActorId) throw new Error('groups.actor_id NULL após createGroup');
  const inv1 = await groupsService.createInvite(TENANT, group.groupId, vio.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, inv1.inviteId, vio.userId);
  const inv2 = await groupsService.createInvite(TENANT, group.groupId, gui.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, inv2.inviteId, gui.userId);
  const bandPub = await publishProvider(TENANT, ana.userId, groupActorId, 'Show — Banda Preço', musical, CITY);

  console.log('\n— (1) grade da config banda-completa: (6=Sáb,noite)=X e (0=Dom,manha)=Y, X≠Y — dia canônico §4.25 —');
  const X: number = 400000, Y: number = 180000;
  const cfgFull = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, label: 'banda-completa', teamSize: 5,
  });
  await serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
    dayOfWeek: 6, periodOfDay: 'noite', priceCents: X,
  });
  // Domingo=0 (canônico §4.25) — prova que a encodação é 0=Dom (não ISO Domingo=7).
  await serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
    dayOfWeek: 0, periodOfDay: 'manha', priceCents: Y,
  });
  const grid1 = await serviceOfferingConfigService.listConfigPrices({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
  });
  const satNoite = grid1.cells.find((c) => c.dayOfWeek === 6 && c.periodOfDay === 'noite');
  const sunManha = grid1.cells.find((c) => c.dayOfWeek === 0 && c.periodOfDay === 'manha');
  record('(1) duas células distintas persistidas e legíveis (esparsa; inclui Domingo=0 canônico)',
    grid1.cells.length === 2 && satNoite?.priceCents === X && sunManha?.priceCents === Y && X !== Y,
    `cells=${grid1.cells.length} sat=${satNoite?.priceCents} sun0=${sunManha?.priceCents}`);

  console.log('\n— (2) cascata "a partir de" de 3 níveis —');
  // define base POR CONFIG (nível 2) via config PUT (updateConfig defaultPriceCents)
  const DEFAULT_CENTS = 300000;
  await serviceOfferingConfigService.updateConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
    defaultPriceCents: DEFAULT_CENTS,
  });
  const lvl1 = await serviceOfferingConfigService.resolveConfigPrice(TENANT, bandPub.offeringId, cfgFull.id, 6, 'noite');
  const lvl2 = await serviceOfferingConfigService.resolveConfigPrice(TENANT, bandPub.offeringId, cfgFull.id, 2, 'tarde'); // sem célula
  record('(2a) NÍVEL 1 célula: resolve(Sáb,noite) = X via source=cell',
    lvl1.priceCents === X && lvl1.source === 'cell', `${lvl1.priceCents}/${lvl1.source}`);
  record('(2b) NÍVEL 2 config default: resolve(Ter,tarde) = default via source=config_default',
    lvl2.priceCents === DEFAULT_CENTS && lvl2.source === 'config_default', `${lvl2.priceCents}/${lvl2.source}`);
  // config SEM default e SEM célula → cai no nível 3 (base da oferta)
  const cfgBase = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, label: 'trio-basico', teamSize: 3,
  });
  const lvl3 = await serviceOfferingConfigService.resolveConfigPrice(TENANT, bandPub.offeringId, cfgBase.id, 6, 'noite');
  record('(2c) NÍVEL 3 base da oferta: resolve = offerings.price_cents via source=offering_base',
    lvl3.priceCents === OFFERING_BASE_CENTS && lvl3.source === 'offering_base', `${lvl3.priceCents}/${lvl3.source}`);

  console.log('\n— (3) dualidade SOLO: oferta user-actor também recebe grade —');
  const soloPub = await publishProvider(TENANT, ana.userId, ana.actorId, 'Ana solo', musical, CITY);
  const soloCfg = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: soloPub.offeringId, label: 'voz e violão', teamSize: 1,
  });
  await serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: soloPub.offeringId, configId: soloCfg.id,
    dayOfWeek: 5, periodOfDay: 'noite', priceCents: 90000,
  });
  const soloResolve = await serviceOfferingConfigService.resolveConfigPrice(TENANT, soloPub.offeringId, soloCfg.id, 5, 'noite');
  record('(3) solo: grade independente do line-up, célula resolvível',
    soloResolve.priceCents === 90000 && soloResolve.source === 'cell', `${soloResolve.priceCents}/${soloResolve.source}`);

  console.log('\n— (4) soft-retire de config PRECIFICADA vs delete físico de config sem preço —');
  // cfgFull é precificada (2 células + default). deleteConfig → SOFT-RETIRE.
  await serviceOfferingConfigService.deleteConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
  });
  const retiredAt = (await pool.query<{ retired_at: string | null }>(
    `SELECT retired_at::text AS retired_at FROM service_offering_configs WHERE id = $1::uuid`, [cfgFull.id]
  )).rows[0]?.retired_at;
  const survivingCells = (await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM service_offering_config_prices WHERE config_id = $1::uuid`, [cfgFull.id]
  )).rows[0].n;
  const activeList = await serviceOfferingConfigService.listConfigs(TENANT, bandPub.offeringId);
  const stillResolvable = await serviceOfferingConfigService.resolveConfigPrice(TENANT, bandPub.offeringId, cfgFull.id, 6, 'noite');
  record('(4a) config precificada: retired_at SETADO, células SOBREVIVEM, sai do listConfigs ATIVO, segue RESOLVÍVEL',
    !!retiredAt && survivingCells === '2' && !activeList.some((c) => c.id === cfgFull.id) && stillResolvable.priceCents === X,
    `retired=${!!retiredAt} cells=${survivingCells} active=${activeList.length} resolve=${stillResolvable.priceCents}`);
  // config sem preço → delete físico
  const cfgEmpty = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, label: 'descartavel', teamSize: 2,
  });
  await serviceOfferingConfigService.deleteConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgEmpty.id,
  });
  const emptyGone = (await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM service_offering_configs WHERE id = $1::uuid`, [cfgEmpty.id]
  )).rows[0].n;
  record('(4b) config SEM preço: delete FÍSICO (linha some do banco)', emptyGone === '0', `restantes=${emptyGone}`);

  console.log('\n— (5) autoridade: não-dono edita grade → 403 —');
  let n5 = 'NO_THROW';
  try {
    await serviceOfferingConfigService.setConfigPrice({
      tenantId: TENANT, userId: intruso.userId, offeringId: bandPub.offeringId, configId: cfgBase.id,
      dayOfWeek: 1, periodOfDay: 'manha', priceCents: 1000,
    });
  } catch (e: any) { n5 = codeOf(e); }
  record('(5) não-dono: setConfigPrice → 403 SERVICE_OFFERING_NOT_REPRESENTABLE',
    n5 === '403:SERVICE_OFFERING_NOT_REPRESENTABLE', n5);

  console.log('\n— (6) validação fail-closed —');
  // Dia canônico §4.25 (0-6): 7 (ex-Domingo ISO) e 8 estão fora da faixa → fail-closed.
  const badDay7 = await tryCode(() => serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgBase.id, dayOfWeek: 7, periodOfDay: 'manha', priceCents: 1000,
  }));
  const badDay8 = await tryCode(() => serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgBase.id, dayOfWeek: 8, periodOfDay: 'manha', priceCents: 1000,
  }));
  const badPeriod = await tryCode(() => serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgBase.id, dayOfWeek: 3, periodOfDay: 'madrugada' as any, priceCents: 1000,
  }));
  const badPrice = await tryCode(() => serviceOfferingConfigService.setConfigPrice({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgBase.id, dayOfWeek: 3, periodOfDay: 'noite', priceCents: -1,
  }));
  record('(6) dia 7/8 → 400 CONFIG_PRICE_DAY_INVALID; período inválido → 400 CONFIG_PRICE_PERIOD_INVALID; negativo → 400 CONFIG_PRICE_INVALID',
    badDay7 === '400:CONFIG_PRICE_DAY_INVALID' && badDay8 === '400:CONFIG_PRICE_DAY_INVALID'
      && badPeriod === '400:CONFIG_PRICE_PERIOD_INVALID' && badPrice === '400:CONFIG_PRICE_INVALID',
    `${badDay7} · ${badDay8} · ${badPeriod} · ${badPrice}`);

  console.log('\n— (7) Δbank —');
  const bankAfter = await bankSnap();
  record('(7) Δbank=0 — nenhum lançamento financeiro', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

async function tryCode(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return 'NO_THROW'; } catch (e: any) { return codeOf(e); }
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
