// src/modules/social/actor.repository.ts
import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type { ActorTypeDb } from '@core/social/actor-type';
import type { TxQueryClient } from '@core/social/ports/actor-repository.port';

// N2-D.2-R1 (ressalva Yala R1): erros estáveis da âncora canônica do Actor de usuário. A unicidade FÍSICA
// (uq_actors_user, migration 20260711180000) é a barreira principal; estas checagens são defesa adicional.
export const ACTOR_USER_ANCHOR_AMBIGUOUS =
  'ACTOR_USER_ANCHOR_AMBIGUOUS: mais de um actor_type=user para (tenant_id, user_id) — estado estruturalmente impossível (uq_actors_user). findByUserId não escolhe arbitrariamente.';
export const ACTOR_USER_CANONICAL_ANCHOR_CONFLICT =
  'ACTOR_USER_CANONICAL_ANCHOR_CONFLICT: âncora (tenant_id, user_id) actor_type=user ligada a global_user_id incompatível — não funde identidades nem altera o Actor vencedor.';

// Predicado da âncora parcial (espelha uq_actors_user) usado no ON CONFLICT dos writers.
const USER_ANCHOR_CONFLICT_TARGET =
  `(tenant_id, user_id) WHERE actor_type = 'user' AND tenant_id IS NOT NULL AND user_id IS NOT NULL`;

// Linha de Actor que carrega os campos da âncora canônica (o SELECT/RETURNING deve trazer global_user_id).
type UserActorAnchorRow = ActorRow & { global_user_id?: string | null; id?: string };

/**
 * N2-D.2-R1-FIX (ressalva Yala): PÓS-CONDIÇÃO ÚNICA de qualquer Actor `user` REUTILIZADO nos dois
 * writers canônicos — vale para os TRÊS caminhos (já existia / criado agora / venceu a corrida). A
 * validação NÃO é proteção específica do ramo de corrida perdida: é contrato compartilhado. Comparações
 * EXPLÍCITAS (===/!==), sem truthiness/fallback/coerção. Qualquer incompatibilidade → fail-closed; NUNCA
 * atualiza/funde/corrige/recria/escolhe outro registro.
 */
function assertCanonicalUserActorAnchor(
  actor: UserActorAnchorRow,
  expectedTenantId: string,
  expectedUserId: string,
  expectedGlobalUserId: string
): void {
  const actorIdMismatch =
    actor.actor_id != null && actor.id != null && actor.actor_id !== actor.id;
  if (
    actor.actor_type !== 'user' ||
    actor.tenant_id !== expectedTenantId ||
    actor.user_id !== expectedUserId ||
    actor.global_user_id !== expectedGlobalUserId ||
    actorIdMismatch
  ) {
    throw new Error(ACTOR_USER_CANONICAL_ANCHOR_CONFLICT);
  }
}

export interface ActorRow {
  actor_id: string;
  tenant_id: string;
  actor_type: ActorTypeDb;
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
  /** Âncora humana (FK actors.id); ver §4.8 LEI / migrations actor_responsibility */
  responsible_actor_id: string | null;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  metadata: any;
  created_at: string | Date;
  updated_at: string | Date;
}

export class ActorRepository {
  /**
   * Busca actor por ID
   */
  /**
   * Busca actor por ID
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   * - Nenhuma query pode usar apenas actor_id isolado
   */
  async findById(tenantId: string, actorId: string): Promise<ActorRow | null> {
    const row = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             responsible_actor_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    return row || null;
  }

  /**
   * Busca ou cria actor para um usuário
   */
  async findOrCreateUserActor(
    tenantId: string,
    userId: string
  ): Promise<ActorRow> {
    // Busca nome do usuário + global_user_id ANTES de qualquer caminho de reuso (F3.1 v2 DECISION-0062:
    // ordem causal identity → actor). N2-D.2-R1-FIX: o global_user_id canônico é necessário para validar a
    // âncora em TODOS os caminhos (já existia / criado / venceu a corrida), não só na corrida perdida.
    const user = await runQueryWithTenant<{
      email: string;
      full_name: string | null;
      global_user_id: string | null;
    }>(
      tenantId,
      `
      SELECT u.email,
             COALESCE(p.full_name, gu.full_name) AS full_name,
             u.global_user_id::text AS global_user_id
      FROM users u
      LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
      LEFT JOIN global_users gu ON gu.global_user_id = u.global_user_id
      WHERE u.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // 🔴 F3.1 v2 (DECISION-0062): fail-closed para actor humano sem âncora global.
    if (!user.global_user_id) {
      throw new Error(
        `findOrCreateUserActor: users.global_user_id ausente para user_id=${userId} — ` +
        `actor humano canônico exige âncora global (DECISION-0062 D4 / §4.8). ` +
        `Não cria órfão.`
      );
    }
    const expectedGlobalUserId = user.global_user_id;

    // CAMINHO 1 — Actor já existe: valida a âncora canônica ANTES de retornar (mesma pós-condição).
    const existing = await runQueryWithTenant<UserActorAnchorRow>(
      tenantId,
      `
      SELECT a.*, a.global_user_id::text AS global_user_id
      FROM actors a
      WHERE a.tenant_id = $1
        AND a.user_id = $2
        AND a.actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, userId]
    );

    if (existing) {
      assertCanonicalUserActorAnchor(existing, tenantId, userId, expectedGlobalUserId);
      return existing;
    }

    const identityCheck = await runQueryWithTenant<{ global_user_id: string }>(
      tenantId,
      `SELECT global_user_id::text FROM identities WHERE global_user_id = $1::uuid LIMIT 1`,
      [expectedGlobalUserId]
    );

    if (!identityCheck) {
      throw new Error(
        `findOrCreateUserActor: identity ausente para global_user_id=${expectedGlobalUserId} — ` +
        `ordem causal exige identity ANTES de actor (§7 hierarquia epistemológica + ` +
        `migration 0010 FK fk_actor_identity). Chame identityService.` +
        `ensureIdentityRowForGlobalUserId antes de criar actor.`
      );
    }

    const displayName = user.full_name || user.email.split('@')[0];

    // Cria novo actor — popula global_user_id satisfazendo FK fk_actor_identity.
    // N2-D.2-R1: ON CONFLICT DO NOTHING no alvo EXATO da âncora parcial (uq_actors_user) fecha a corrida
    // dos dois writers concorrentes sem mascarar outras constraints (outras unique violations propagam).
    const newActor = await runQueryWithTenant<UserActorAnchorRow>(
      tenantId,
      `
      INSERT INTO actors (
        tenant_id, actor_type, user_id, global_user_id, display_name, slug
      )
      VALUES ($1, 'user', $2, $3::uuid, $4, $5)
      ON CONFLICT ${USER_ANCHOR_CONFLICT_TARGET} DO NOTHING
      RETURNING *, global_user_id::text AS global_user_id
      `,
      [tenantId, userId, expectedGlobalUserId, displayName, `user-${userId.substring(0, 8)}`]
    );

    // CAMINHO 2 — criação vencedora: valida a âncora da row criada antes de retornar.
    if (newActor) {
      assertCanonicalUserActorAnchor(newActor, tenantId, userId, expectedGlobalUserId);
      return newActor;
    }

    // CAMINHO 3 — perdeu a corrida: reconsulta a âncora EXATA com cardinalidade (LIMIT 2 → >1 é
    // ACTOR_USER_ANCHOR_AMBIGUOUS, impossível sob uq_actors_user) e valida com o mesmo helper.
    const winners = await runQueriesWithTenant<UserActorAnchorRow>(
      tenantId,
      `
      SELECT a.*, a.global_user_id::text AS global_user_id
      FROM actors a
      WHERE a.tenant_id = $1 AND a.user_id = $2 AND a.actor_type = 'user'
      LIMIT 2
      `,
      [tenantId, userId]
    );
    if (winners.length === 0) {
      throw new Error(ACTOR_USER_CANONICAL_ANCHOR_CONFLICT);
    }
    if (winners.length > 1) {
      throw new Error(ACTOR_USER_ANCHOR_AMBIGUOUS);
    }
    assertCanonicalUserActorAnchor(winners[0], tenantId, userId, expectedGlobalUserId);
    return winners[0];
  }

  /**
   * Variante client-aware/transacional de `findOrCreateUserActor`
   * (F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC). Cria o user-actor humano usando o `client`
   * da transação do caller — escrita ATÔMICA junto com global_user/user/identity no
   * nascimento. NÃO abre/commita transação; o tenant context já deve estar ativo no
   * client (RLS). Mesma ordem causal (DECISION-0062: identity ANTES de actor) e
   * fail-closed (sem âncora global / sem identity → erro, nunca órfão). Não duplica
   * a cadeia canônica: é a variante Tx do MESMO writer (espelho de findOrCreatePageActorTx).
   */
  async findOrCreateUserActorTx(
    client: TxQueryClient,
    tenantId: string,
    userId: string
  ): Promise<ActorRow> {
    // N2-D.2-R1-FIX: carrega o global_user_id canônico ANTES de qualquer caminho de reuso — a âncora é
    // validada nos TRÊS caminhos (já existia / criado / venceu a corrida), com o MESMO helper do writer não-Tx.
    const userRes = await client.query(
      `SELECT u.email,
              COALESCE(p.full_name, gu.full_name) AS full_name,
              u.global_user_id::text AS global_user_id
         FROM users u
         LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
         LEFT JOIN global_users gu ON gu.global_user_id = u.global_user_id
        WHERE u.user_id = $1
        LIMIT 1`,
      [userId]
    );
    const user = userRes.rows[0] as { email: string; full_name: string | null; global_user_id: string | null } | undefined;
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    if (!user.global_user_id) {
      throw new Error(
        `findOrCreateUserActorTx: users.global_user_id ausente para user_id=${userId} — ` +
        `actor humano canônico exige âncora global (DECISION-0062 D4 / §4.8). Não cria órfão.`
      );
    }
    const expectedGlobalUserId = user.global_user_id;

    // CAMINHO 1 — Actor já existe: valida a âncora canônica ANTES de retornar.
    const existing = await client.query(
      `SELECT a.*, a.global_user_id::text AS global_user_id FROM actors a
        WHERE a.tenant_id = $1 AND a.user_id = $2 AND a.actor_type = 'user'
        LIMIT 1`,
      [tenantId, userId]
    );
    if (existing.rows[0]) {
      assertCanonicalUserActorAnchor(existing.rows[0] as UserActorAnchorRow, tenantId, userId, expectedGlobalUserId);
      return existing.rows[0] as ActorRow;
    }

    const identityCheck = await client.query(
      `SELECT global_user_id::text FROM identities WHERE global_user_id = $1::uuid LIMIT 1`,
      [expectedGlobalUserId]
    );
    if (!identityCheck.rows[0]) {
      throw new Error(
        `findOrCreateUserActorTx: identity ausente para global_user_id=${expectedGlobalUserId} — ` +
        `ordem causal exige identity ANTES de actor (migration 0010 FK fk_actor_identity).`
      );
    }

    const displayName = user.full_name || user.email.split('@')[0];
    // N2-D.2-R1: ON CONFLICT DO NOTHING no alvo EXATO da âncora parcial (uq_actors_user). DO NOTHING
    // NÃO aborta a transação do caller (ao contrário de uma unique violation não-tratada) — a variante
    // Tx permanece válida após a corrida perdida, e a reconsulta usa o MESMO client.
    const inserted = await client.query(
      `INSERT INTO actors (
         tenant_id, actor_type, user_id, global_user_id, display_name, slug
       )
       VALUES ($1, 'user', $2, $3::uuid, $4, $5)
       ON CONFLICT ${USER_ANCHOR_CONFLICT_TARGET} DO NOTHING
       RETURNING *, global_user_id::text AS global_user_id`,
      [tenantId, userId, expectedGlobalUserId, displayName, `user-${userId.substring(0, 8)}`]
    );
    // CAMINHO 2 — criação vencedora: valida a âncora da row criada antes de retornar.
    if (inserted.rows[0]) {
      assertCanonicalUserActorAnchor(inserted.rows[0] as UserActorAnchorRow, tenantId, userId, expectedGlobalUserId);
      return inserted.rows[0] as ActorRow;
    }

    // CAMINHO 3 — perdeu a corrida: reconsulta a âncora EXATA no mesmo client (fail-closed em
    // cardinalidade) e valida com o mesmo helper antes de retornar o vencedor.
    const reselect = await client.query(
      `SELECT a.*, a.global_user_id::text AS global_user_id
         FROM actors a
        WHERE a.tenant_id = $1 AND a.user_id = $2 AND a.actor_type = 'user'
        LIMIT 2`,
      [tenantId, userId]
    );
    if (reselect.rows.length === 0) {
      throw new Error(ACTOR_USER_CANONICAL_ANCHOR_CONFLICT);
    }
    if (reselect.rows.length > 1) {
      throw new Error(ACTOR_USER_ANCHOR_AMBIGUOUS);
    }
    const winner = reselect.rows[0] as UserActorAnchorRow;
    assertCanonicalUserActorAnchor(winner, tenantId, userId, expectedGlobalUserId);
    return winner;
  }

  /**
   * Busca o Actor humano canônico (actor_type='user') de um usuário no tenant.
   *
   * N2-D.2-R1: fail-closed em cardinalidade. A unicidade física uq_actors_user torna 2+ impossível;
   * ainda assim conferimos (busca até DUAS rows) e lançamos ACTOR_USER_ANCHOR_AMBIGUOUS se aparecer mais
   * de uma — NUNCA escolhemos "a primeira" (sem LIMIT 1 / ORDER BY como resolvedor de ambiguidade). O
   * contrato normal permanece: 0 → null; exatamente 1 → o Actor. Filtros tenant/user/actor_type='user'
   * e o tipo de retorno público preservados.
   */
  async findByUserId(tenantId: string, userId: string): Promise<ActorRow | null> {
    const rows = await runQueriesWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 2
      `,
      [tenantId, userId]
    );

    if (rows.length === 0) return null;
    if (rows.length > 1) throw new Error(ACTOR_USER_ANCHOR_AMBIGUOUS);
    return rows[0];
  }

  /**
   * Busca actor por company_id
   */
  async findByCompanyId(tenantId: string, companyId: string): Promise<ActorRow | null> {
    const row = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             responsible_actor_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page'
      LIMIT 1
      `,
      [tenantId, companyId]
    );

    return row || null;
  }

  /**
   * Atualiza display_name do actor do usuário
   * Idempotente: só atualiza se display_name mudou
   */
  async updateUserActorDisplayName(
    tenantId: string,
    userId: string,
    displayName: string
  ): Promise<ActorRow | null> {
    if (!displayName || displayName.trim() === '') {
      return null; // Não atualizar se displayName vazio
    }

    // Buscar actor do usuário
    const actor = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT a.*
      FROM actors a
      WHERE a.tenant_id = $1 
        AND a.user_id = $2
        AND a.actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, userId]
    );

    if (!actor) {
      // Se não existe, criar (usando findOrCreateUserActor)
      return await this.findOrCreateUserActor(tenantId, userId);
    }

    // Se display_name já é o mesmo, não atualizar (idempotente)
    if (actor.display_name === displayName.trim()) {
      return actor;
    }

    // Atualizar display_name
    const updated = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      UPDATE actors
      SET display_name = $1, updated_at = now()
      WHERE actor_id = $2
      RETURNING *
      `,
      [displayName.trim(), actor.actor_id]
    );

    return updated || null;
  }

  /**
   * Busca ou cria actor para uma empresa (page)
   */
  async findOrCreatePageActor(
    tenantId: string,
    companyId: string,
    responsibleActorId: string
  ): Promise<ActorRow> {
    const existing = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT * FROM actors
      WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page'
      LIMIT 1
      `,
      [tenantId, companyId]
    );

    if (existing) {
      const needsAnchor =
        existing.responsible_actor_id == null &&
        responsibleActorId &&
        String(responsibleActorId).length > 0;
      if (needsAnchor) {
        const patched = await runQueryWithTenant<ActorRow>(
          tenantId,
          `
          UPDATE actors
          SET responsible_actor_id = $3, updated_at = now()
          WHERE tenant_id = $1 AND actor_id = $2 AND responsible_actor_id IS NULL
          RETURNING *
          `,
          [tenantId, existing.actor_id, responsibleActorId]
        );
        return patched || existing;
      }
      return existing;
    }

    // Busca nome da empresa
    const company = await runQueryWithTenant<{
      company_name: string;
      trade_name: string | null;
    }>(
      tenantId,
      `
      SELECT company_name, trade_name
      FROM companies
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    const displayName = company.trade_name || company.company_name;

    const newActor = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      INSERT INTO actors (
        tenant_id, actor_type, company_id, display_name, slug, responsible_actor_id
      )
      VALUES ($1, 'page', $2, $3, $4, $5)
      RETURNING *
      `,
      [
        tenantId,
        companyId,
        displayName,
        `page-${companyId.substring(0, 8)}`,
        responsibleActorId,
      ]
    );

    if (!newActor) {
      throw new Error('Erro ao criar actor');
    }

    return newActor;
  }

  /**
   * Variante client-aware/transacional de findOrCreatePageActor (F-ATOMIC-COMPANY-BIRTH,
   * DECISION-0075 §9.2). Usa o `client` da transação do caller — a escrita do page-actor
   * é ATÔMICA junto com companies + company_users (sem cleanup compensatório). NÃO abre/
   * commita transação e NÃO seta tenant context (responsabilidade do caller, dentro do
   * BEGIN — RLS de actors). Mesma semântica do não-transacional: âncora humana
   * (responsible_actor_id §4.8.2), idempotência por uq_actors_company_page, page-actor
   * nasce sem habilitar operação por si só (estado pending vive em companies/onboarding).
   */
  async findOrCreatePageActorTx(
    client: TxQueryClient,
    tenantId: string,
    companyId: string,
    responsibleActorId: string
  ): Promise<ActorRow> {
    const existing = await client.query(
      `SELECT * FROM actors
        WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page'
        LIMIT 1`,
      [tenantId, companyId]
    );
    if (existing.rows[0]) {
      const cur = existing.rows[0] as ActorRow;
      const needsAnchor =
        cur.responsible_actor_id == null &&
        responsibleActorId &&
        String(responsibleActorId).length > 0;
      if (needsAnchor) {
        const patched = await client.query(
          `UPDATE actors
              SET responsible_actor_id = $3, updated_at = now()
            WHERE tenant_id = $1 AND actor_id = $2 AND responsible_actor_id IS NULL
            RETURNING *`,
          [tenantId, cur.actor_id, responsibleActorId]
        );
        return (patched.rows[0] as ActorRow) || cur;
      }
      return cur;
    }

    const company = await client.query(
      `SELECT company_name, trade_name FROM companies WHERE company_id = $1 LIMIT 1`,
      [companyId]
    );
    if (!company.rows[0]) {
      throw new Error('Empresa não encontrada');
    }
    const displayName = company.rows[0].trade_name || company.rows[0].company_name;

    const inserted = await client.query(
      `INSERT INTO actors (
         tenant_id, actor_type, company_id, display_name, slug, responsible_actor_id
       )
       VALUES ($1, 'page', $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, companyId, displayName, `page-${companyId.substring(0, 8)}`, responsibleActorId]
    );
    if (!inserted.rows[0]) {
      throw new Error('Erro ao criar actor');
    }
    return inserted.rows[0] as ActorRow;
  }

  /**
   * Busca ou cria o group-actor (actor_type='group') de um group (Fase 3C.3, Etapa 2).
   *
   * 🔴 QUEBRA DE PADRÃO CONSCIENTE: diferente dos find* vizinhos
   * (findOrCreateUserActor/findOrCreatePageActor são NÃO-transacionais, single-table, via
   * runQueryWithTenant), este método é TRANSACIONAL porque o group-actor exige escrita
   * ATÔMICA em DUAS tabelas (INSERT actors + UPDATE groups.actor_id) com lock na row de
   * groups. Espelha o molde de companies.service.activateCompanyOperationally (3B.3):
   * getClientWithTenant + BEGIN + SELECT FOR UPDATE + COMMIT/ROLLBACK.
   * Owner (âncora civil §4.8.2) validado FORA da tx (falha cedo) e REVALIDADO sob lock.
   * Fail-closed em qualquer divergência; idempotente por coerência; nunca cria 2º group-actor.
   */
  async findOrCreateGroupActor(tenantId: string, groupId: string): Promise<ActorRow> {
    // 1. Owner FORA da transação — falha cedo se âncora civil inválida.
    const pre = await runQueryWithTenant<{ owner_actor_id: string | null }>(
      tenantId,
      `SELECT owner_actor_id::text AS owner_actor_id FROM groups WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [groupId, tenantId]
    );
    if (!pre) {
      throw new Error(`findOrCreateGroupActor: group ${groupId} não encontrado no tenant`);
    }
    await this.assertGroupOwnerIsHuman(tenantId, pre.owner_actor_id, groupId);

    // 2. Transação — TODAS as queries usam ESTE client (runQueryWithTenant pegaria conexão
    //    nova e o FOR UPDATE não protegeria o INSERT). Nada de ensure* aqui dentro.
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // 3. Lock na row de groups.
      const locked = await client.query<{
        owner_actor_id: string | null;
        actor_id: string | null;
        name: string;
        slug: string | null;
      }>(
        `SELECT owner_actor_id::text AS owner_actor_id, actor_id::text AS actor_id, name, slug
           FROM groups WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [groupId, tenantId]
      );
      if (locked.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new Error(`findOrCreateGroupActor: group ${groupId} desapareceu sob lock`);
      }
      const g = locked.rows[0];
      const ownerActorId = g.owner_actor_id;

      // 4. Revalidar owner SOB LOCK (mesmo client) — fecha janela de corrida.
      if (!ownerActorId) {
        await client.query('ROLLBACK');
        throw new Error(`findOrCreateGroupActor: group ${groupId} sem owner_actor_id (âncora civil ausente) — §4.8.2`);
      }
      const ownerUnderLock = await client.query<{ actor_type: string; global_user_id: string | null }>(
        `SELECT actor_type, global_user_id::text AS global_user_id FROM actors
          WHERE actor_id = $1 AND tenant_id = $2 LIMIT 1`,
        [ownerActorId, tenantId]
      );
      if (
        ownerUnderLock.rowCount === 0 ||
        ownerUnderLock.rows[0].actor_type !== 'user' ||
        ownerUnderLock.rows[0].global_user_id === null
      ) {
        await client.query('ROLLBACK');
        throw new Error(`findOrCreateGroupActor: owner_actor_id ${ownerActorId} não é actor humano válido (actor_type='user' + global_user_id) sob lock — §4.8.2`);
      }

      // 5. Idempotência: se já há actor, conferir coerência (fail-closed se divergir).
      if (g.actor_id !== null) {
        const existing = await client.query<ActorRow>(
          `SELECT * FROM actors WHERE actor_id = $1 AND tenant_id = $2 LIMIT 1`,
          [g.actor_id, tenantId]
        );
        const e = existing.rows[0];
        if (
          existing.rowCount === 1 &&
          e.actor_type === 'group' &&
          e.group_id === groupId &&
          e.responsible_actor_id === ownerActorId
        ) {
          await client.query('COMMIT');
          return e;
        }
        await client.query('ROLLBACK');
        throw new Error(`findOrCreateGroupActor: group ${groupId} com group-actor incoerente (corrupção estrutural) — falha fechada`);
      }

      // 6. Criar actor — display_name de groups.name (NOT NULL); slug de groups.slug com fallback.
      const displayName = g.name;
      const slug = g.slug || `group-${groupId.substring(0, 8)}`;
      const inserted = await client.query<ActorRow>(
        `INSERT INTO actors (tenant_id, actor_type, group_id, display_name, slug, responsible_actor_id)
         VALUES ($1, 'group', $2, $3, $4, $5)
         RETURNING *`,
        [tenantId, groupId, displayName, slug, ownerActorId]
      );
      const newActor = inserted.rows[0];

      // 7. Back-link groups.actor_id na MESMA transação. COMMIT.
      await client.query(
        `UPDATE groups SET actor_id = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`,
        [newActor.actor_id, groupId, tenantId]
      );
      await client.query('COMMIT');
      return newActor;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // rollback best-effort; erro original prevalece
      }
      // 8. Corrida no uq_actors_group (23505): tx abortou; reler em NOVA query e conferir coerência.
      if ((err as { code?: string }).code === '23505') {
        const g2 = await runQueryWithTenant<{ owner_actor_id: string | null }>(
          tenantId,
          `SELECT owner_actor_id::text AS owner_actor_id FROM groups WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
          [groupId, tenantId]
        );
        const relido = await runQueriesWithTenant<ActorRow>(
          tenantId,
          `SELECT * FROM actors WHERE group_id = $1 AND actor_type = 'group' AND tenant_id = $2`,
          [groupId, tenantId]
        );
        if (
          g2 &&
          relido.length === 1 &&
          relido[0].group_id === groupId &&
          relido[0].actor_type === 'group' &&
          relido[0].responsible_actor_id === g2.owner_actor_id
        ) {
          return relido[0];
        }
        throw new Error(`findOrCreateGroupActor: corrida 23505 e estado relido incoerente — falha fechada`);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Valida que o owner do group é um actor humano (âncora civil §4.8.2): actor_type='user'
   * com global_user_id NOT NULL. Usado FORA da transação (pré-checagem). Não-transacional.
   */
  private async assertGroupOwnerIsHuman(
    tenantId: string,
    ownerActorId: string | null,
    groupId: string
  ): Promise<void> {
    if (!ownerActorId) {
      throw new Error(`findOrCreateGroupActor: group ${groupId} sem owner_actor_id (âncora civil ausente) — §4.8.2`);
    }
    const owner = await runQueryWithTenant<{ actor_type: string; global_user_id: string | null }>(
      tenantId,
      `SELECT actor_type, global_user_id::text AS global_user_id FROM actors
        WHERE actor_id = $1 AND tenant_id = $2 LIMIT 1`,
      [ownerActorId, tenantId]
    );
    if (!owner || owner.actor_type !== 'user' || owner.global_user_id === null) {
      throw new Error(`findOrCreateGroupActor: owner_actor_id ${ownerActorId} não é actor humano válido (actor_type='user' + global_user_id NOT NULL) — §4.8.2`);
    }
  }

  /**
   * Busca actors disponíveis para um usuário (pessoal + empresas com permissão)
   * 🔴 BLINDAGEM: can_post é resolvido via verificação real de permissões
   * NÃO pode ser assumido como true automaticamente
   */
  async findAvailableActors(
    tenantId: string,
    userId: string
  ): Promise<Array<ActorRow & { user_role?: string; can_post?: boolean; company_status?: string }>> {
    // Verificar se o usuário existe no tenant
    const user = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
      SELECT user_id
      FROM users
      WHERE user_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!user) {
      return [];
    }

    const actors: Array<ActorRow & { user_role?: string; can_post?: boolean; company_status?: string }> = [];

    // 1. Actor pessoal (user) — LEITURA PURA (F-C1-AUTO-REACHABLE-READ-PURITY).
    // O nascimento atômico (F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC) GARANTE o user-actor; este GET
    // NÃO cria/cura actor. Usuário corretamente nascido → actor existe e entra na lista.
    // Usuário legado sem actor → AUSÊNCIA HONESTA (não entra na lista; NÃO cria). A sessão
    // trata a lista vazia como estado bloqueado observável (sem maternidade clandestina).
    const userActor = await this.findByUserId(tenantId, user.user_id);
    if (userActor) {
      actors.push({
        ...userActor,
        user_role: 'owner',
        can_post: true, // PF sempre pode postar
      });
    }

    // 2. Actors de empresas onde o usuário tem permissão
    // Busca empresas via JOIN direto entre company_users e users usando global_user_id
    // LEFT JOIN company_types via c.primary_company_type_id (classificação POR-EMPRESA, Fase 3B.3 —
    //   NÃO mais tenants.company_type_id, que vira default/template do tenant).
    // FILTRO OPERACIONAL (Fase 3B.3): só lista empresa OPERACIONAL (Momento 2) — page-actor com
    //   responsible_actor_id + companies.primary_company_type_id/primary_concept_id preenchidos e
    //   com par válido em company_type_allowed_concepts. Empresa Momento 1 (inerte) fica INVISÍVEL.
    // 2026-05-18 P1 Frente C — REVERTIDA após smoke FAIL crítico de bootstrap.
    // Causa raiz: coluna `companies.activity` NÃO EXISTE no schema material
    // (auditado em migration 0065 e seguintes). Tipo TS `Company.activity`
    // em frontend/src/api/companies.ts é projeção tipográfica do contrato,
    // não SSOT material. Adicionar `c.activity` ao SELECT quebrou a query
    // em runtime → SessionProvider silenciava → "Não há actor disponível".
    //
    // Princípio operacional Clayton: confiar em tipo TS sem auditar migration
    // é caminho para verdade paralela. Schema é SSOT, tipo é projeção.
    //
    // Propagação de activity.mainActivityDescription fica pendente em
    // DT-PRESSURE-AVAILABLE-ACTOR-ACTIVITY-FIELD até existir migration que
    // adicione a coluna em `companies`. Por enquanto, businessProfile no
    // frontend continua resolvendo apenas via heurística display_name.
    const companyActors = await runQueriesWithTenant<ActorRow & { role: string; can_manage_company: boolean; company_status: string; company_type_slug: string | null }>(
      tenantId,
      `
      SELECT
        a.*,
        cu.role,
        cu.can_manage_company,
        c.company_status,
        ct.slug AS company_type_slug
      FROM actors a
      INNER JOIN companies c ON a.company_id = c.company_id AND c.tenant_id = $1
      INNER JOIN company_users cu ON c.company_id = cu.company_id AND cu.tenant_id = $1
      INNER JOIN users u ON cu.global_user_id = u.global_user_id
      LEFT JOIN company_types ct ON ct.id = c.primary_company_type_id
      WHERE a.tenant_id = $1
        AND a.actor_type = 'page'
        AND a.responsible_actor_id IS NOT NULL
        AND u.user_id = $2
        AND u.tenant_id = $1
        AND cu.member_status = 'active'
        AND c.status != 'suspended'
        AND c.primary_company_type_id IS NOT NULL
        AND c.primary_concept_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM company_type_allowed_concepts ctac
           WHERE ctac.company_type_id = c.primary_company_type_id
             AND ctac.concept_id = c.primary_concept_id
        )
      ORDER BY cu.is_primary DESC, c.created_at DESC
      `,
      [tenantId, userId]
    );

    // 🔴 CORREÇÃO CRÍTICA: Resolver can_post via verificação real de permissões
    const { reputationService } = await import('./reputation.service');
    
    for (const companyActor of companyActors) {
      // Verificar permissões reais do actor
      const permissions = await reputationService.getPermissions(
        tenantId,
        companyActor.actor_id,
        'page',
        companyActor.company_status
      );
      
      actors.push({
        ...companyActor,
        user_role: companyActor.role,
        can_post: permissions.canPost, // 🔴 VERIFICAÇÃO REAL - não assume true
        company_status: companyActor.company_status as 'DRAFT' | 'PROVISIONAL' | 'ACTIVE' | 'SUSPENDED' // conjunto REAL do CHECK (DECISION-0097); o cast antigo listava VERIFIED/APPROVED (inexistentes) e omitia ACTIVE,
      } as ActorRow & { user_role?: string; can_post?: boolean; company_status?: string });
    }

    // 3. Actors de grupos onde o usuário é membro
    // F-ACTOR-AVAILABLE-GROUP-COVERAGE (2026-07-02): a "Fase 3C.3" (2026-05-30) já materializa o
    // group-actor atomicamente em ensureGroupActor (createGroup), mas esta listagem NUNCA foi
    // estendida para incluí-lo — diferente de empresa (que tem um gate operacional DELIBERADO,
    // Momento 1 vs Momento 2), grupo não tinha NENHUM caminho de listagem: lacuna, não decisão.
    // Espelha o padrão de empresa (tenant-scoped, membership real), sem gate de "momento" análogo
    // (não existe Momento 2 documentado para grupo — group_members.role já é a autoridade viva).
    const groupActors = await runQueriesWithTenant<ActorRow & { role: string }>(
      tenantId,
      `
      SELECT
        a.*,
        gm.role
      FROM actors a
      INNER JOIN groups g ON a.group_id = g.id AND g.tenant_id = $1
      INNER JOIN group_members gm ON gm.group_id = g.id AND gm.tenant_id = $1
      WHERE a.tenant_id = $1
        AND a.actor_type = 'group'
        AND gm.user_id = $2
        AND g.status = 'active'
      ORDER BY g.created_at DESC
      `,
      [tenantId, userId]
    );

    for (const groupActor of groupActors) {
      actors.push({
        ...groupActor,
        user_role: groupActor.role,
        can_post: true, // membro de grupo pode postar em nome do grupo (mesma semântica de PF)
      } as ActorRow & { user_role?: string; can_post?: boolean });
    }

    return actors;
  }

  /**
   * Atualiza actor (avatar, cover, bio)
   */
  async update(
    tenantId: string,
    actorId: string,
    updates: {
      display_name?: string;
      avatar_url?: string;
      cover_url?: string;
      bio?: string;
      metadata?: any;
    }
  ): Promise<ActorRow> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(updates.display_name);
    }
    if (updates.avatar_url !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(updates.avatar_url);
    }
    if (updates.cover_url !== undefined) {
      fields.push(`cover_url = $${paramIndex++}`);
      values.push(updates.cover_url);
    }
    if (updates.bio !== undefined) {
      fields.push(`bio = $${paramIndex++}`);
      values.push(updates.bio);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return this.findById(tenantId, actorId) as Promise<ActorRow>;
    }

    values.push(actorId);

    const updated = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      UPDATE actors
      SET ${fields.join(', ')}
      WHERE actor_id = $${paramIndex}
      RETURNING *
      `,
      values
    );

    if (!updated) {
      throw new Error('Actor não encontrado');
    }

    return updated;
  }
}

export const actorRepository = new ActorRepository();

