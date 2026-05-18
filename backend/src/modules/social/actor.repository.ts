// src/modules/social/actor.repository.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ActorTypeDb } from '@core/social/actor-type';

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
    // Primeiro tenta encontrar actor existente
    const existing = await runQueryWithTenant<ActorRow>(
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

    if (existing) {
      return existing;
    }

    // Busca nome do usuário
    const user = await runQueryWithTenant<{
      email: string;
      full_name: string | null;
    }>(
      tenantId,
      `
      SELECT u.email, p.full_name
      FROM users u
      LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
      WHERE u.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const displayName = user.full_name || user.email.split('@')[0];

    // Cria novo actor
    const newActor = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      INSERT INTO actors (
        tenant_id, actor_type, user_id, display_name, slug
      )
      VALUES ($1, 'user', $2, $3, $4)
      RETURNING *
      `,
      [tenantId, userId, displayName, `user-${userId.substring(0, 8)}`]
    );

    if (!newActor) {
      throw new Error('Erro ao criar actor');
    }

    return newActor;
  }

  /**
   * Busca actor por user_id
   */
  async findByUserId(tenantId: string, userId: string): Promise<ActorRow | null> {
    const row = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, userId]
    );

    return row || null;
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

    // 1. Actor pessoal (user)
    // 🔴 REGRA: PF sempre tem can_post = true (permissão básica)
    const userActor = await this.findOrCreateUserActor(tenantId, user.user_id);
    actors.push({
      ...userActor,
      user_role: 'owner',
      can_post: true, // PF sempre pode postar
    });

    // 2. Actors de empresas onde o usuário tem permissão
    // Busca empresas via JOIN direto entre company_users e users usando global_user_id
    // LEFT JOIN company_types para expor slug (bootstrap contextual — Fase 1 capabilities)
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
      INNER JOIN companies c ON a.company_id = c.company_id
      INNER JOIN company_users cu ON c.company_id = cu.company_id
      INNER JOIN users u ON cu.global_user_id = u.global_user_id
      INNER JOIN tenants t ON a.tenant_id = t.id
      LEFT JOIN company_types ct ON ct.id = t.company_type_id
      WHERE a.tenant_id = $1
        AND a.actor_type = 'page'
        AND u.user_id = $2
        AND u.tenant_id = $1
        AND cu.is_active = true
        AND c.status != 'suspended'
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
        company_status: companyActor.company_status as 'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED',
      } as ActorRow & { user_role?: string; can_post?: boolean; company_status?: string });
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

