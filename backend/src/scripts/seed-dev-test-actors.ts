/**
 * seed-dev-test-actors.ts — cria actors de teste (empresa/página, grupo) para dev@unificard.local
 * em unificard_dev, USANDO OS SERVIÇOS REAIS (companiesService.createCompany, groupsService.createGroup)
 * — não INSERT cru — para que os actors nasçam exatamente como nasceriam via UI real (mesmas
 * validações, mesmos invariantes, mesma cadeia F-ATOMIC-COMPANY-BIRTH / ensureGroupActor).
 *
 * Pedido direto do Clayton (2026-07-02): sistema local virgem, só o actor 'user' de teste existe;
 * precisa de actors de teste para testar o switcher/pílula/UX multi-actor.
 *
 * NÃO cria: canal (actor_type='channel' — ZERO writer real no backend hoje, confirmado por grep;
 * inserir via SQL cru seria simular uma feature que não existe, não gerar dado de teste honesto) nem
 * artista/banda (NÃO existe valor de actor_type para isso — actors_actor_type_check não lista
 * 'artist'/'band'; inventar um violaria a mesma decisão D-C2 pendente documentada em
 * actorContextConfig.ts). Ambos ficam para quando a decisão ontológica D-C2 acontecer.
 *
 * Roda direto em unificard_dev (é o alvo pedido, não DB efêmera). Sem migration, sem schema novo.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`🎯 Banco-alvo: ${db}`);

  const userRow = (await pool.query<{ user_id: string; global_user_id: string; tenant_id: string }>(
    `SELECT user_id, global_user_id, tenant_id FROM users WHERE email = 'dev@unificard.local'`
  )).rows[0];
  if (!userRow) throw new Error('dev@unificard.local não encontrado.');
  const { user_id: userId, global_user_id: globalUserId, tenant_id: tenantId } = userRow;
  console.log(`👤 dev@unificard.local: userId=${userId} globalUserId=${globalUserId} tenantId=${tenantId}`);

  function validCnpj(): string {
    const n: number[] = [];
    for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
    const dv = (base: number[]): number => {
      const weights = base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = dv(n);
    const d2 = dv([...n, d1]);
    return [...n, d1, d2].join('');
  }

  // Bootstrap dos ports (mesmo padrão dos E2Es desta sessão) — sem isso, services que
  // dependem de socialPortsRegistry (companiesService via actorRepository) falham.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // ── Empresa/página (actor_type='page') via serviço real ────────────────────────
  // Idempotência manual: se já existe (reexecução), não duplica.
  const existingPageActor = (await pool.query<{ id: string; display_name: string; company_id: string }>(
    `SELECT id, display_name, company_id FROM actors WHERE actor_type = 'page' AND display_name = 'Empresa Teste Dev' ORDER BY created_at DESC LIMIT 1`
  )).rows[0];
  let companyId: string;
  if (existingPageActor) {
    console.log(`\n— Empresa de teste já existe (pulando criação) —`);
    companyId = existingPageActor.company_id;
    console.log(`✅ Page-actor já existente: ${existingPageActor.id} "${existingPageActor.display_name}"`);
  } else {
    console.log('\n— Criando empresa de teste (companiesService.createCompany) —');
    const { companiesService } = await import('../core/companies/companies.service');
    const company = await companiesService.createCompany(
      globalUserId,
      {
        cnpj: validCnpj(),
        companyName: 'Empresa Teste Dev',
        tradeName: 'Empresa Teste Dev',
        role: 'owner',
        fetchFromRevenue: false, // sem chamada externa à Receita — dado 100% local
        isPrimary: false,
      },
      tenantId
    );
    companyId = company.company.companyId;
    console.log(`✅ Empresa criada: companyId=${companyId} status=${company.company.companyStatus}`);

    const pageActor = (await pool.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM actors WHERE company_id = $1 AND actor_type = 'page' LIMIT 1`,
      [companyId]
    )).rows[0];
    console.log(`✅ Page-actor nascido atomicamente: ${pageActor?.id} "${pageActor?.display_name}"`);
  }

  // ── Grupo (actor_type='group') via serviço real ─────────────────────────────────
  const existingGroupActor = (await pool.query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM actors WHERE actor_type = 'group' AND display_name = 'Grupo Teste Dev' ORDER BY created_at DESC LIMIT 1`
  )).rows[0];
  let groupActorReal: { id: string; display_name: string } | undefined = existingGroupActor;
  if (existingGroupActor) {
    console.log(`\n— Grupo de teste já existe (pulando criação) —`);
    console.log(`✅ Group-actor já existente: ${existingGroupActor.id} "${existingGroupActor.display_name}"`);
  } else {
    console.log('\n— Criando grupo de teste (groupsService.createGroup) —');
    const { groupsService } = await import('../modules/groups/groups.service');
    const brazil = (await pool.query<{ country_id: string }>(
      `SELECT country_id FROM countries WHERE iso_alpha2 = 'BR' OR name ILIKE '%brasil%' LIMIT 1`
    )).rows[0];
    const group = await groupsService.createGroup(tenantId, userId, {
      name: 'Grupo Teste Dev',
      description: 'Grupo de teste criado para validar o switcher multi-actor (ambiente dev local).',
      visibility: 'public',
      scope: 'national',
      country_id: brazil?.country_id,
    });
    console.log(`✅ Grupo criado: groupId=${group.groupId}`);

    groupActorReal = (await pool.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM actors WHERE actor_type = 'group' AND display_name = 'Grupo Teste Dev' ORDER BY created_at DESC LIMIT 1`
    )).rows[0];
    console.log(`✅ Group-actor nascido atomicamente: ${groupActorReal?.id} "${groupActorReal?.display_name}"`);
  }

  // ── Resumo final ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  const allActors = (await pool.query<{ id: string; actor_type: string; display_name: string }>(
    `SELECT id, actor_type, display_name FROM actors WHERE global_user_id = $1 OR company_id = $2 OR id = $3 ORDER BY actor_type`,
    [globalUserId, companyId, groupActorReal?.id ?? '00000000-0000-0000-0000-000000000000']
  )).rows;
  console.log('Actors de dev@unificard.local agora:');
  for (const a of allActors) console.log(`  - ${a.actor_type}: ${a.display_name} (${a.id})`);
  console.log('\n⚠️  NÃO criados (sem caminho real de criação hoje):');
  console.log('  - channel (canal): actor_type existe no CHECK, mas ZERO writer no backend. "Cadastrar um canal" no switcher já mostra "em breve" — honesto.');
  console.log('  - artista/banda: NÃO existe valor de actor_type para isso. Precisa de decisão D-C2 (ontologia) antes de existir, mesmo como teste.');
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
