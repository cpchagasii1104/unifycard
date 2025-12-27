// src/modules/social/actor.repository.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface ActorRow {
  actor_id: string;
  tenant_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export class ActorRepository {
  /**
   * Busca actor por ID
   */
  async findById(tenantId: string, actorId: string): Promise<ActorRow | null> {
    const row = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, tenant_id, actor_type, user_id, company_id, group_id,
             display_name, slug, avatar_url, cover_url, bio, metadata,
             created_at, updated_at
      FROM actors
      WHERE actor_id = $1
      LIMIT 1
      `,
      [actorId]
    );

    return row || null;
  }

  /**
   * Busca ou cria actor para um usuário
   */
  async findOrCreateUserActor(
    tenantId: string,
    userId: string,
    globalUserId: string
  ): Promise<ActorRow> {
    // Primeiro tenta encontrar
    // FASE 3.6: Corrigir JOIN - buscar user_id através de user_identity_links ou global_user_id em users
    const existing = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT a.*
      FROM actors a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.tenant_id = $1 
        AND (u.global_user_id = $2 OR EXISTS (
          SELECT 1 FROM user_identity_links uil 
          WHERE uil.user_id = u.user_id AND uil.global_user_id = $2
        ))
        AND a.actor_type = 'user'
      LIMIT 1
      `,
      [tenantId, globalUserId]
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
      [tenantId, userId, displayName, `user-${globalUserId.substring(0, 8)}`]
    );

    if (!newActor) {
      throw new Error('Erro ao criar actor');
    }

    return newActor;
  }

  /**
   * Busca ou cria actor para uma empresa (page)
   */
  async findOrCreatePageActor(
    tenantId: string,
    companyId: string
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
        tenant_id, actor_type, company_id, display_name, slug
      )
      VALUES ($1, 'page', $2, $3, $4)
      RETURNING *
      `,
      [tenantId, companyId, displayName, `page-${companyId.substring(0, 8)}`]
    );

    if (!newActor) {
      throw new Error('Erro ao criar actor');
    }

    return newActor;
  }

  /**
   * Busca actors disponíveis para um usuário (pessoal + empresas com permissão)
   */
  async findAvailableActors(
    tenantId: string,
    globalUserId: string
  ): Promise<Array<ActorRow & { user_role?: string; can_post?: boolean; company_status?: string }>> {
    // Busca user_id
    const user = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
      SELECT user_id FROM users
      WHERE user_id IN (
        SELECT user_id FROM global_users WHERE global_user_id = $1
      )
      LIMIT 1
      `,
      [globalUserId]
    );

    if (!user) {
      return [];
    }

    const actors: Array<ActorRow & { user_role?: string; can_post?: boolean; company_status?: string }> = [];

    // 1. Actor pessoal (user)
    const userActor = await this.findOrCreateUserActor(tenantId, user.user_id, globalUserId);
    actors.push({
      ...userActor,
      user_role: 'owner',
      can_post: true,
    });

    // 2. Actors de empresas onde o usuário tem permissão
    // 🔴 REGRA: TODAS as empresas aparecem no seletor (independente de validation_status)
    // 🔴 REGRA: validation_status afeta apenas capacidades financeiras, NUNCA visibilidade ou posting
    const companyActors = await runQueriesWithTenant<ActorRow & { role: string; can_manage_company: boolean; company_status: string }>(
      tenantId,
      `
      SELECT 
        a.*,
        cu.role,
        cu.can_manage_company,
        c.company_status
      FROM actors a
      INNER JOIN companies c ON a.company_id = c.company_id
      INNER JOIN company_users cu ON c.company_id = cu.company_id
      WHERE a.tenant_id = $1
        AND a.actor_type = 'page'
        AND cu.global_user_id = $2
        AND cu.is_active = true
        AND c.status != 'suspended'
        -- 🔴 REMOVIDO: Filtro por company_status - todas as empresas aparecem
      ORDER BY cu.is_primary DESC, c.created_at DESC
      `,
      [tenantId, globalUserId]
    );

    for (const companyActor of companyActors) {
      // 🔴 REGRA: can_post é SEMPRE true para empresas (independente de validation_status)
      // validation_status afeta apenas capacidades financeiras, não posting na rede social
      actors.push({
        ...companyActor,
        user_role: companyActor.role,
        can_post: true, // Sempre true - validation_status não afeta posting
        // Adicionar status para frontend mostrar badge
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
