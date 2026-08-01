/**
 * E2E — F-EVENT-ORGANIZER-CONTINUITY, prova de autoridade (item 3 do mandato 2026-08-01). 🔒 SÓ DB efêmera.
 *
 * NÃO wireia rota nem UI ("meus eventos" segue travada por /eventos intocado). Prova só a CAPACIDADE de
 * backend que a leitura futura vai consumir:
 *  A · event.repository.ts:listEvents aceita `organizerActorIds` (plural) e filtra `actor_id = ANY(...)`,
 *      sem regredir o filtro singular `organizerActorId` já existente (B2/DECISION-0113).
 *  B · a resolução "quais actors este usuário pode representar" compõe do canônico
 *      `authorizationService.canRepresentActor` (§4.9.3) — nenhuma fonte de autoridade nova, só itera
 *      sobre os actor_id DISTINCT que têm evento no tenant (conjunto pequeno, não a tabela actors inteira).
 *  C · o teste que mata a fatia: usuário que PODE representar o actor 'page' do evento recebe o evento na
 *      lista resolvida; usuário estranho (sem vínculo) NÃO recebe, mesmo usando o filtro plural.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string) => {
  results.push({ label: l, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`);
};

// §4.8.1 (LEI_COERENCIA): writer único de `actors` é actor-writer.service — NENHUM INSERT INTO actors
// direto fora dele (guard audit-schema-coherence-ratchet morde isso; mordeu esta versão do script na
// 1ª tentativa, com INSERT direto — corrigido).
async function mkUser(T: string, nome: string, ensureUserActor: (t: string, u: string) => Promise<{ actor_id: string }>) {
  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-11);
  await pool.query(
    `INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`,
    [gu, tax]
  );
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`,
    [gu, tax]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`,
    [uid, T, `${nome}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@e2e.test`, gu]
  );
  const actor = await ensureUserActor(T, uid);
  return { uid, actorId: actor.actor_id, gu };
}

/**
 * Resolve os actor_id que `userId` pode representar, DENTRO do conjunto de actors que já têm evento no
 * tenant (não varre `actors` inteira). Compõe do canônico `canRepresentActor` — não inventa fonte.
 */
async function resolveRepresentableEventOrganizerActorIds(
  tenantId: string,
  userId: string,
  canRepresentActor: (t: string, u: string, a: string) => Promise<boolean>
): Promise<string[]> {
  const distinct = await pool.query<{ actor_id: string }>(
    `SELECT DISTINCT actor_id FROM events WHERE tenant_id = $1`,
    [tenantId]
  );
  const allowed: string[] = [];
  for (const row of distinct.rows) {
    if (await canRepresentActor(tenantId, userId, row.actor_id)) {
      allowed.push(row.actor_id);
    }
  }
  return allowed;
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera: ${db}`);

  const T = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('T ORG-CONT','t-orgcont-${Date.now()}') RETURNING id`
    )
  ).rows[0].id;

  // Bootstrap mínimo p/ ActorRepository (actor-writer.service precisa disto; mesmo padrão do E2E
  // DECISION-0161) — ANTES de qualquer criação de actor, não depois.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { ensureUserActor, ensurePageActor } = await import('../modules/identity/actor-writer.service');

  const dono = await mkUser(T, 'Dono', ensureUserActor);
  const estranho = await mkUser(T, 'Estranho', ensureUserActor);

  // Company + page actor, dono como owner (mesma condição que canManageCompany checa — role='owner').
  const companyId = (
    await pool.query<{ id: string }>(
      `INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`,
      [T, 'Casa de Shows E2E']
    )
  ).rows[0].id;
  // Writer canônico §4.8.1 (ensurePageActor), não INSERT direto — âncora civil = dono.actorId (§4.8.2).
  const pageActor = await ensurePageActor(T, companyId, dono.actorId);
  const pageActorId = pageActor.actor_id;
  // company_users NÃO tem is_active (removida DECISION-0189) — member_status default já é 'active'.
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true)`,
    [T, companyId, dono.gu]
  );

  // Evento da PAGE (o que o dono deveria ver na lista) + evento do PRÓPRIO estranho (controle negativo:
  // estranho representa a SI mesmo, não a page — não deve vazar pro dono, e o dono não deve enxergá-lo).
  const eventoPage = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, datetime_start, timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'page','SHOW','Show da Page E2E','draft','public',NOW()+interval '10 day','America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW()) RETURNING id`,
      [T, pageActorId]
    )
  ).rows[0].id;
  const eventoEstranho = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, datetime_start, timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW','Evento do Estranho','draft','public',NOW()+interval '11 day','America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW()) RETURNING id`,
      [T, estranho.actorId]
    )
  ).rows[0].id;

  const { authorizationService } = await import('../core/authorization/authorization.service');
  const canRepresentActor = authorizationService.canRepresentActor.bind(authorizationService);
  const { eventRepository } = await import('../modules/events/event.repository');

  // A · resolução do DONO: deve incluir a page (owner) e o próprio actor dele; NÃO deve incluir o do estranho.
  const allowedDono = await resolveRepresentableEventOrganizerActorIds(T, dono.uid, canRepresentActor);
  rec(
    'A resolução do DONO inclui a page (owner) e exclui o actor do estranho',
    allowedDono.includes(pageActorId) && !allowedDono.includes(estranho.actorId),
    `allowedDono=${JSON.stringify(allowedDono)} pageActorId=${pageActorId} estranho=${estranho.actorId}`
  );

  // B · resolução do ESTRANHO: deve incluir só o próprio actor; NÃO deve incluir a page.
  const allowedEstranho = await resolveRepresentableEventOrganizerActorIds(T, estranho.uid, canRepresentActor);
  rec(
    'B resolução do ESTRANHO inclui só o próprio actor, exclui a page',
    allowedEstranho.includes(estranho.actorId) && !allowedEstranho.includes(pageActorId),
    `allowedEstranho=${JSON.stringify(allowedEstranho)}`
  );

  // C · o teste que mata a fatia: listEvents(organizerActorIds=allowedDono) devolve o evento da page pro
  // dono, e listEvents(organizerActorIds=allowedEstranho) NÃO devolve o evento da page pro estranho.
  const listaDono = await eventRepository.listEvents(T, {
    organizerActorIds: allowedDono,
    visibilityMode: 'organizer_dashboard',
  });
  const listaEstranho = await eventRepository.listEvents(T, {
    organizerActorIds: allowedEstranho,
    visibilityMode: 'organizer_dashboard',
  });
  const donoVeAPage = listaDono.some((e) => e.id === eventoPage);
  const estranhoNaoVeAPage = !listaEstranho.some((e) => e.id === eventoPage);
  const estranhoVeOProprio = listaEstranho.some((e) => e.id === eventoEstranho);
  rec(
    'C listEvents plural: DONO vê o evento da page; ESTRANHO não vê o evento da page mas vê o próprio',
    donoVeAPage && estranhoNaoVeAPage && estranhoVeOProprio,
    `donoVeAPage=${donoVeAPage} estranhoNaoVeAPage=${estranhoNaoVeAPage} estranhoVeOProprio=${estranhoVeOProprio}`
  );

  // D · regressão: o filtro SINGULAR (organizerActorId) já existente continua funcionando sem alteração —
  // extensão aditiva, não reescrita.
  const listaSingular = await eventRepository.listEvents(T, {
    organizerActorId: pageActorId,
    visibilityMode: 'organizer_dashboard',
  });
  rec(
    'D regressão: filtro singular organizerActorId (comportamento pré-existente) intacto',
    listaSingular.some((e) => e.id === eventoPage) && listaSingular.length === 1,
    `ids=${JSON.stringify(listaSingular.map((e) => e.id))}`
  );

  // E · fail-closed: organizerActorIds vazio (usuário sem nenhum actor representável) não devolve nada —
  // não é "amplia pra tudo por omissão".
  const listaVazia = await eventRepository.listEvents(T, {
    organizerActorIds: [],
    visibilityMode: 'organizer_dashboard',
  });
  rec('E fail-closed: organizerActorIds=[] devolve lista vazia (1=0), não o universo', listaVazia.length === 0, `len=${listaVazia.length}`);

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? '✅ TODOS OS TESTES PASSARAM' : '❌ FALHOU'} (${results.filter((r) => r.ok).length}/${results.length})`);
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
