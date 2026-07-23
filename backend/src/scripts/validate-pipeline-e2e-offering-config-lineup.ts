/**
 * E2E — ARCO FUNDAÇÃO EVENTOS · FATIA 3 · CARDÁPIO DE CONFIGS com LINE-UP opcional. Prova, POR API
 * DIRETA (camada de service REAL — "a verdade vive no backend"), que a banda monta o cardápio de
 * formações na PRÓPRIA service_offering (service_offering_configs) e opcionalmente declara o LINE-UP
 * por PESSOA (service_offering_config_members.member_actor_id — doutrina DECISION-0188: membership é
 * episódio imutável; sair+voltar NÃO quebra configs). Bank-free (Δbank=0). DB efêmera. NUNCA unificard_dev.
 *
 * PROVAS:
 *  (1) banda REAL via createGroup; 2 membros entram por intent BILATERAL real (invite+accept);
 *      oferta pendura no grupo-actor (cadeia selada declareConcept→createService→createOffering).
 *  (2) cardápio de 3 configs: "voz-e-violão" (team 1, line-up [vocalista]); "banda completa"
 *      (team 5, line-up [ambos]); "produção completa" (team 12, requires_setup_crew, sob_consulta,
 *      SEM line-up). listConfigs devolve TODAS (sob_consulta inclusa).
 *  (3) dualidade solo: user-actor provider usa as MESMAS tabelas — 2 configs sem line-up.
 *  (4) negativos fail-closed: não-dono CRUD → 403; line-up em solo → 409; não-membro → 422;
 *      team_size < line-up → 400 (dois lados: update E add).
 *  (5) LIFECYCLE (prova estrutural da fatia): membro SAI pelo leave governado real → lineupComplete=false,
 *      linha do line-up INTACTA, membership terminal; membro REENTRA por intent real → lineupComplete=true
 *      com ZERO edição de config (prova da escolha member_actor_id).
 *  (6) Δbank=0.
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
  if (!/band|group|actor|provider|config|lineup|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `cfg-${seq}@e2e.test`, gu]);
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

/** Publica um provider (user OU grupo-actor): declara concept → service(active) → offering. */
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
    canonicalServiceId: canonical.canonicalId, priceCents: 250000, durationMinutes: 90,
  });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

const codeOf = (e: any): string => `${e?.statusCode ?? '?'}:${e?.code ?? String(e?.message ?? e).slice(0, 60)}`;

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Autoridade (canRepresentActor pool-path) + ports de groups — wire como as rotas fazem.
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
  await tenantService.createTenant({ id: TENANT, name: 'Offering Config Line-up E2E', slug: `cfg-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  const musical = await resolveServiceConcept('apresentacao-musical');

  // Atores humanos
  const ana = await mkUserActor(TENANT, 'Ana Dona da Banda');     // dona da banda + provider SOLO (prova 3)
  const vio = await mkUserActor(TENANT, 'Vic Vocalista');         // membro 1 (line-up voz-e-violão)
  const gui = await mkUserActor(TENANT, 'Gil Guitarrista');       // membro 2 (sai e volta — prova 5)
  const intruso = await mkUserActor(TENANT, 'Carlos Intruso');    // não-dono / não-membro (prova 4)

  console.log('\n— (1) banda real + 2 membros via intent BILATERAL + oferta no grupo-actor —');
  const group = await groupsService.createGroup(TENANT, ana.userId, {
    name: 'Banda Cardápio', description: 'Banda do E2E da fatia 3 — cardápio de configs com line-up.',
  });
  const groupActorId = (await pool.query<{ actor_id: string | null }>(
    `SELECT actor_id::text AS actor_id FROM groups WHERE id = $1::uuid`, [group.groupId]
  )).rows[0]?.actor_id;
  if (!groupActorId) throw new Error('groups.actor_id NULL após createGroup');
  // entrada BILATERAL real: dona convida → candidato aceita (caminho governado do cutover D9.2-B)
  const inv1 = await groupsService.createInvite(TENANT, group.groupId, vio.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, inv1.inviteId, vio.userId);
  const inv2 = await groupsService.createInvite(TENANT, group.groupId, gui.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, inv2.inviteId, gui.userId);
  const activeMembers = (await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM group_actor_memberships
      WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND status = 'active'`,
    [TENANT, group.groupId]
  )).rows[0].n;
  const bandPub = await publishProvider(TENANT, ana.userId, groupActorId, 'Show — Banda Cardápio', musical, CITY);
  record('(1) banda + 3 memberships ativas (dona-gênese + 2 por invite/accept) + oferta no grupo-actor',
    activeMembers === '3' && !!bandPub.offeringId, `ativas=${activeMembers}`);

  console.log('\n— (2) cardápio de 3 configs com line-up opcional —');
  const cfgVoz = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId,
    label: 'voz-e-violão', teamSize: 1,
  });
  await serviceOfferingConfigService.addConfigMember({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgVoz.id, memberActorId: vio.actorId,
  });
  const cfgFull = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId,
    label: 'banda completa', teamSize: 5,
  });
  await serviceOfferingConfigService.addConfigMember({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id, memberActorId: vio.actorId,
  });
  await serviceOfferingConfigService.addConfigMember({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id, memberActorId: gui.actorId,
  });
  const cfgProd = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId,
    label: 'produção completa', teamSize: 12, requiresSetupCrew: true, status: 'sob_consulta',
  });
  const list1 = await serviceOfferingConfigService.listConfigs(TENANT, bandPub.offeringId);
  const byLabel = new Map(list1.map((c) => [c.label, c]));
  const voz1 = byLabel.get('voz-e-violão');
  const full1 = byLabel.get('banda completa');
  const prod1 = byLabel.get('produção completa');
  record('(2a) listConfigs devolve as 3 (sob_consulta INCLUSA) com shape declarado',
    list1.length === 3
      && voz1?.teamSize === 1 && voz1.members.length === 1
      && full1?.teamSize === 5 && full1.members.length === 2
      && prod1?.teamSize === 12 && prod1.requiresSetupCrew === true && prod1.status === 'sob_consulta' && prod1.members.length === 0,
    `n=${list1.length}`);
  record('(2b) line-up DERIVADO: todos ativos → isActiveMember=true e lineupComplete=true (vazio = completo)',
    voz1?.lineupComplete === true && full1?.lineupComplete === true && prod1?.lineupComplete === true
      && full1.members.every((m) => m.isActiveMember),
    JSON.stringify(full1?.members));
  record('(2c) config sem preço: id=' + cfgProd.id.slice(0, 8) + ' persistida com identidade autoral',
    !!cfgVoz.id && !!cfgFull.id && !!cfgProd.id);

  console.log('\n— (3) dualidade SOLO: user-actor provider, mesmas tabelas, sem line-up —');
  const soloPub = await publishProvider(TENANT, ana.userId, ana.actorId, 'Ana solo', musical, CITY);
  await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: soloPub.offeringId, label: 'voz e violão', teamSize: 1,
  });
  const soloCfg2 = await serviceOfferingConfigService.createConfig({
    tenantId: TENANT, userId: ana.userId, offeringId: soloPub.offeringId, label: 'com técnico de som', teamSize: 2, status: 'sob_consulta',
  });
  const soloList = await serviceOfferingConfigService.listConfigs(TENANT, soloPub.offeringId);
  record('(3) solo: 2 configs nas MESMAS tabelas, zero line-up, lineupComplete=true por vacuidade',
    soloList.length === 2 && soloList.every((c) => c.members.length === 0 && c.lineupComplete === true),
    `n=${soloList.length}`);

  console.log('\n— (4) negativos fail-closed —');
  let n1 = 'NO_THROW';
  try {
    await serviceOfferingConfigService.createConfig({
      tenantId: TENANT, userId: intruso.userId, offeringId: bandPub.offeringId, label: 'invasão', teamSize: 1,
    });
  } catch (e: any) { n1 = codeOf(e); }
  let n1b = 'NO_THROW';
  try {
    await serviceOfferingConfigService.updateConfig({
      tenantId: TENANT, userId: intruso.userId, offeringId: bandPub.offeringId, configId: cfgFull.id, teamSize: 9,
    });
  } catch (e: any) { n1b = codeOf(e); }
  let n1c = 'NO_THROW';
  try {
    await serviceOfferingConfigService.deleteConfig({
      tenantId: TENANT, userId: intruso.userId, offeringId: bandPub.offeringId, configId: cfgFull.id,
    });
  } catch (e: any) { n1c = codeOf(e); }
  record('(4a) não-dono: create/update/delete de config → 403 SERVICE_OFFERING_NOT_REPRESENTABLE',
    n1 === '403:SERVICE_OFFERING_NOT_REPRESENTABLE' && n1b === '403:SERVICE_OFFERING_NOT_REPRESENTABLE' && n1c === '403:SERVICE_OFFERING_NOT_REPRESENTABLE',
    `${n1} · ${n1b} · ${n1c}`);
  let n2 = 'NO_THROW';
  try {
    await serviceOfferingConfigService.addConfigMember({
      tenantId: TENANT, userId: ana.userId, offeringId: soloPub.offeringId, configId: soloCfg2.id, memberActorId: vio.actorId,
    });
  } catch (e: any) { n2 = codeOf(e); }
  record('(4b) line-up em provider SOLO (user-actor) → 409 CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER',
    n2 === '409:CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER', n2);
  let n3 = 'NO_THROW';
  try {
    await serviceOfferingConfigService.addConfigMember({
      tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id, memberActorId: intruso.actorId,
    });
  } catch (e: any) { n3 = codeOf(e); }
  record('(4c) não-membro do grupo no line-up → 422 CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP',
    n3 === '422:CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP', n3);
  let n4 = 'NO_THROW';
  try {
    await serviceOfferingConfigService.updateConfig({
      tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgFull.id, teamSize: 1,
    });
  } catch (e: any) { n4 = codeOf(e); }
  let n5 = 'NO_THROW';
  try {
    // voz-e-violão: team_size 1 já lotado pelo line-up [vocalista] → incluir 2º membro estoura o piso
    await serviceOfferingConfigService.addConfigMember({
      tenantId: TENANT, userId: ana.userId, offeringId: bandPub.offeringId, configId: cfgVoz.id, memberActorId: gui.actorId,
    });
  } catch (e: any) { n5 = codeOf(e); }
  record('(4d) piso do team_size nos DOIS lados → 400 CONFIG_TEAM_SIZE_BELOW_LINEUP (update E add)',
    n4 === '400:CONFIG_TEAM_SIZE_BELOW_LINEUP' && n5 === '400:CONFIG_TEAM_SIZE_BELOW_LINEUP', `${n4} · ${n5}`);

  console.log('\n— (5) LIFECYCLE: leave governado real → DERIVED-INCOMPLETE → reentrada por intent real —');
  const left = await groupsService.leaveGroup(TENANT, group.groupId, gui.userId);
  const afterLeave = await serviceOfferingConfigService.listConfigs(TENANT, bandPub.offeringId);
  const fullAfterLeave = afterLeave.find((c) => c.id === cfgFull.id);
  const guiRow = fullAfterLeave?.members.find((m) => m.memberActorId === gui.actorId);
  const membershipStatuses = (await pool.query<{ status: string }>(
    `SELECT status FROM group_actor_memberships
      WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND member_actor_id = $3::uuid ORDER BY created_at ASC`,
    [TENANT, group.groupId, gui.actorId]
  )).rows.map((r) => r.status);
  record('(5a) leave governado NÃO bloqueado; linha do line-up INTACTA; isActiveMember=false; lineupComplete=false',
    left === true && fullAfterLeave?.members.length === 2 && guiRow?.isActiveMember === false
      && fullAfterLeave.lineupComplete === false && membershipStatuses.join(',') === 'left',
    `members=${fullAfterLeave?.members.length} statuses=${membershipStatuses.join(',')}`);
  const vozAfterLeave = afterLeave.find((c) => c.id === cfgVoz.id);
  record('(5b) config sem o membro que saiu segue completa (voz-e-violão intacta)',
    vozAfterLeave?.lineupComplete === true);
  // reentrada BILATERAL real (invite+accept) → NOVA linha de membership; ZERO edição de config
  const inv3 = await groupsService.createInvite(TENANT, group.groupId, gui.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, inv3.inviteId, gui.userId);
  const afterRejoin = await serviceOfferingConfigService.listConfigs(TENANT, bandPub.offeringId);
  const fullAfterRejoin = afterRejoin.find((c) => c.id === cfgFull.id);
  const rows2 = (await pool.query<{ status: string }>(
    `SELECT status FROM group_actor_memberships
      WHERE tenant_id = $1::uuid AND group_id = $2::uuid AND member_actor_id = $3::uuid ORDER BY created_at ASC`,
    [TENANT, group.groupId, gui.actorId]
  )).rows.map((r) => r.status);
  record('(5c) reentrada = NOVA linha (left,active); lineupComplete=true de volta com ZERO edição de config (member_actor_id provado)',
    rows2.join(',') === 'left,active' && fullAfterRejoin?.lineupComplete === true
      && fullAfterRejoin.members.find((m) => m.memberActorId === gui.actorId)?.isActiveMember === true,
    `statuses=${rows2.join(',')}`);

  console.log('\n— (6) Δbank —');
  const bankAfter = await bankSnap();
  record('(6) Δbank=0 — nenhum lançamento financeiro', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
