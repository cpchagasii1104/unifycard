// src/modules/groups/groups.repository.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { tenantService } from '@core/tenants/tenant.service';
import { worldService } from '@core/world/services/world.service';
import type { Group, GroupMember, GroupAccount, CreateGroupInput, UpdateGroupInput, GroupVisibility, GroupInvite, GroupInviteStatus } from './groups.types';

interface GroupRow {
  group_id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  audience_description: string | null;
  category_id: string | null;
  visibility: string;
  // 🔴 REMOVIDO: scope, country_id, state_id, city_id, neighborhood, rules_text não existem no schema atual
  // Esses dados são armazenados em metadata
  avatar_url: string | null;
  cover_url: string | null;
  financial_purpose: string | null;
  owner_actor_id: string;
  is_active: boolean;
  profit_percentage: number | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: string;
  joinedAt: Date;
}

interface GroupAccountRow {
  group_id: string;
  account_id: string;
  createdAt: Date;
}

interface GroupInviteRow {
  invite_id: string;
  tenant_id: string;
  group_id: string;
  invited_user_id: string;
  invited_by_user_id: string;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class GroupsRepository {
  private toGroup(row: GroupRow): Group {
    // 🔴 CORREÇÃO: Extrair scope e location de metadata se não existirem como colunas
    const metadata = row.metadata || {};
    const location = metadata.location || {};

    return {
      groupId: row.group_id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      audienceDescription: row.audience_description || undefined,
      categoryId: row.category_id || undefined,
      visibility: (row.visibility || 'public') as Group['visibility'],
      scope: (metadata.scope || 'national') as Group['scope'],
      countryId: location.country_id || undefined,
      stateId: location.state_id || undefined,
      cityId: location.city_id || undefined,
      neighborhood: location.neighborhood || undefined,
      avatarUrl: row.avatar_url || undefined,
      coverUrl: row.cover_url || undefined,
      rulesText: metadata.rules_text || undefined,
      financialPurpose: row.financial_purpose || undefined,
      ownerActorId: row.owner_actor_id,
      isActive: row.is_active,
      profitBps: row.profit_percentage ? parseFloat(row.profit_percentage.toString()) : 0,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toGroupMember(row: GroupMemberRow): GroupMember {
    return {
      groupId: row.group_id,
      userId: row.user_id,
      role: row.role as GroupMember['role'],
      joinedAt: row.joinedAt,
    };
  }

  async create(tenantId: string, ownerActorId: string, input: CreateGroupInput): Promise<Group> {
    // Validar campos obrigatórios baseado no scope
    const scope = input.scope || 'national';
    if (scope !== 'national' && !input.state_id) {
      throw new Error('state_id é obrigatório para scope state, city ou neighborhood');
    }
    if ((scope === 'city' || scope === 'neighborhood') && !input.city_id) {
      throw new Error('city_id é obrigatório para scope city ou neighborhood');
    }
    if (scope === 'neighborhood' && !input.neighborhood) {
      throw new Error('neighborhood é obrigatório para scope neighborhood');
    }

    // 🔴 CONTRATO DE LOCALIZAÇÃO EM METADATA:
    // Por enquanto, scope e localização são armazenados em metadata JSONB.
    // Contrato do JSON:
    // {
    //   scope: 'national' | 'state' | 'city' | 'neighborhood',
    //   location: {
    //     country_id: string | null,  // UUID do país (sempre presente)
    //     state_id: string | null,     // UUID do estado (obrigatório se scope >= 'state')
    //     city_id: string | null,       // UUID da cidade (obrigatório se scope >= 'city')
    //     neighborhood: string | null  // Nome do bairro (obrigatório se scope === 'neighborhood')
    //   },
    //   rules_text: string | null,      // Regras do grupo (texto livre)
    //   hasFinancialIntent: boolean,    // Se grupo pretende movimentar recursos financeiros
    //   ...outros campos de metadata
    // }
    const metadata = {
      ...(input.metadata || {}),
      scope: scope,
      location: {
        country_id: input.country_id || null,
        state_id: input.state_id || null,
        city_id: input.city_id || null,
        neighborhood: input.neighborhood || null,
      },
      rules_text: input.rules_text || null,
    };

    // Gerar slug em TypeScript (generate_group_slug não existe no schema Gênesis)
    let finalSlug = input.slug || null;
    if (!finalSlug) {
      const baseSlug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .substring(0, 60) || 'grupo';

      finalSlug = baseSlug;
    }

    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      INSERT INTO groups (
        tenant_id, name, slug, description, audience_description, category_id, visibility,
        avatar_url, cover_url, financial_purpose,
        owner_actor_id, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, COALESCE($7::group_visibility, 'public'::group_visibility),
        $8, $9, $10,
        $11, $12
      )
      RETURNING group_id, tenant_id, name, slug, description, audience_description, category_id, visibility,
        avatar_url, cover_url, financial_purpose,
        owner_actor_id, is_active, profit_percentage, metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.name,
        finalSlug,
        input.description || '',
        input.audience_description || null,
        input.category_id || null,
        input.visibility || 'public',
        input.avatar_url || null,
        input.cover_url || null,
        input.financial_purpose || null,
        ownerActorId,
        JSON.stringify(metadata)
      ]
    );

    if (!row) {
      throw new Error('Failed to create group');
    }

    // Adicionar owner como membro com role 'owner'
    await this.addMember(tenantId, row.group_id, ownerActorId, 'owner');
    
    // 🔴 CORREÇÃO UX: Adicionar owner também como 'admin' para permitir atualizações
    // Isso garante que o criador pode atualizar mídia sem erro de permissão
    await this.addMember(tenantId, row.group_id, ownerActorId, 'admin');

    return this.toGroup(row);
  }

  async findById(tenantId: string, groupId: string): Promise<Group | null> {
    // 🔴 CORREÇÃO: Remover colunas que não existem (scope, country_id, state_id, city_id, neighborhood, rules_text)
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      SELECT group_id, tenant_id, name, slug, description, audience_description, category_id, visibility,
        avatar_url, cover_url, financial_purpose,
        owner_actor_id, is_active, profit_percentage, metadata, createdAt, updatedAt
      FROM groups
      WHERE group_id = $1 AND tenant_id = $2
      `,
      [groupId, tenantId]
    );

    return row ? this.toGroup(row) : null;
  }

  async findAll(tenantId: string, filters?: { isActive?: boolean; categoryId?: string }): Promise<Group[]> {
    // Buscar dados do tenant para ampliar critério de visibilidade
    const tenant = await tenantService.getTenantById(tenantId);
    let tenantStateId: string | null = null;
    let tenantCountryId: string | null = null;

    if (tenant?.cityId) {
      const cityPath = await worldService.getCityFullPath(tenant.cityId);
      if (cityPath) {
        tenantStateId = cityPath.state.stateId;
        tenantCountryId = cityPath.country.countryId;
      }
    }

    // Construir query para incluir:
    // 1. Grupos do tenant atual
    // 2. Grupos com scope 'state' que correspondam ao estado do tenant
    // 3. Grupos com scope 'national' que correspondam ao país do tenant
    const params: any[] = [tenantId];
    let paramIndex = 2;
    const visibilityConditions: string[] = [`tenant_id = $1`];

    // Ampliar critério: incluir grupos estaduais e nacionais relevantes
    if (tenantStateId || tenantCountryId) {
      // Grupos com scope 'state' que correspondam ao estado do tenant
      if (tenantStateId) {
        visibilityConditions.push(`(
          (metadata->>'scope' = 'state' AND (metadata->'location'->>'state_id')::text = $${paramIndex})
        )`);
        params.push(tenantStateId);
        paramIndex++;
      }

      // Grupos com scope 'national' que correspondam ao país do tenant
      if (tenantCountryId) {
        visibilityConditions.push(`(
          (metadata->>'scope' = 'national' AND (metadata->'location'->>'country_id')::text = $${paramIndex})
        )`);
        params.push(tenantCountryId);
        paramIndex++;
      }
    }

    let query = `
      SELECT group_id, tenant_id, name, slug, description, audience_description, category_id, visibility,
        avatar_url, cover_url, financial_purpose,
        owner_actor_id, is_active, profit_percentage, metadata, createdAt, updatedAt
      FROM groups
      WHERE (${visibilityConditions.join(' OR ')})
    `;

    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    if (filters?.categoryId) {
      query += ` AND category_id = $${paramIndex}`;
      params.push(filters.categoryId);
      paramIndex++;
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<GroupRow>(tenantId, query, params);
    return rows.map((r) => this.toGroup(r));
  }

  async update(tenantId: string, groupId: string, input: UpdateGroupInput): Promise<Group> {
    const updates: string[] = [];
    const params: any[] = [tenantId, groupId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(input.slug);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description || null);
    }
    if (input.audience_description !== undefined) {
      updates.push(`audience_description = $${paramIndex++}`);
      params.push(input.audience_description || null);
    }
    if (input.category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      params.push(input.category_id || null);
    }
    if (input.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      params.push(input.visibility);
    }
    // 🔴 CORREÇÃO: scope, country_id, state_id, city_id, neighborhood, rules_text não existem como colunas
    // Armazenar em metadata
    const needsMetadataUpdate = input.scope !== undefined || input.country_id !== undefined || 
        input.state_id !== undefined || input.city_id !== undefined || 
        input.neighborhood !== undefined || input.rules_text !== undefined;
    
    if (needsMetadataUpdate || input.metadata !== undefined) {
      // Buscar metadata atual para fazer merge
      const current = await this.findById(tenantId, groupId);
      const currentMetadata = current?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        ...(input.metadata || {}),
      };
      
      if (input.scope !== undefined) {
        updatedMetadata.scope = input.scope;
      }
      if (input.country_id !== undefined || input.state_id !== undefined || 
          input.city_id !== undefined || input.neighborhood !== undefined) {
        updatedMetadata.location = {
          ...(currentMetadata.location || {}),
          ...(input.country_id !== undefined ? { country_id: input.country_id } : {}),
          ...(input.state_id !== undefined ? { state_id: input.state_id } : {}),
          ...(input.city_id !== undefined ? { city_id: input.city_id } : {}),
          ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
        };
      }
      if (input.rules_text !== undefined) {
        updatedMetadata.rules_text = input.rules_text;
      }
      
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updatedMetadata));
    }
    if (input.avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      params.push(input.avatar_url || null);
    }
    if (input.cover_url !== undefined) {
      updates.push(`cover_url = $${paramIndex++}`);
      params.push(input.cover_url || null);
    }
    if (input.financial_purpose !== undefined) {
      updates.push(`financial_purpose = $${paramIndex++}`);
      params.push(input.financial_purpose || null);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(input.isActive);
    }
    // 🔴 CORREÇÃO: metadata já foi tratado acima se scope/location/rules_text foram atualizados
    // (removido - lógica unificada acima)
    if (input.profitBps !== undefined) {
      updates.push(`profit_percentage = $${paramIndex++}`);
      params.push(input.profitBps);
    }

    if (updates.length === 0) {
      const existing = await this.findById(tenantId, groupId);
      if (!existing) {
        throw new Error('Group not found');
      }
      return existing;
    }

    updates.push(`updatedAt = now()`);

    // 🔴 CORREÇÃO: Remover colunas que não existem do RETURNING
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      UPDATE groups
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND group_id = $2
      RETURNING group_id, tenant_id, name, slug, description, category_id, visibility,
        avatar_url, cover_url, financial_purpose,
        owner_actor_id, is_active, profit_percentage, metadata, createdAt, updatedAt
      `,
      params
    );

    if (!row) {
      throw new Error('Group not found');
    }

    return this.toGroup(row);
  }

  async delete(tenantId: string, groupId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ group_id: string }>(
      tenantId,
      `
      UPDATE groups
      SET is_active = false, updatedAt = now()
      WHERE tenant_id = $1 AND group_id = $2
      RETURNING group_id
      `,
      [tenantId, groupId]
    );

    return !!result;
  }

  // =========================================================
  // MEMBERS
  // =========================================================

  async addMember(tenantId: string, groupId: string, userId: string, role: GroupMember['role'] = 'member'): Promise<GroupMember> {
    // 🔴 CORREÇÃO: tenant_id é obrigatório em group_members (NOT NULL)
    const row = await runQueryWithTenant<GroupMemberRow>(
      tenantId,
      `
      INSERT INTO group_members (tenant_id, group_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING group_id, user_id, role, joinedAt
      `,
      [tenantId, groupId, userId, role]
    );

    if (!row) {
      throw new Error('Failed to add member');
    }

    return this.toGroupMember(row);
  }

  async removeMember(tenantId: string, groupId: string, userId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ group_id: string }>(
      tenantId,
      `
      DELETE FROM group_members
      WHERE group_id = $1 AND user_id = $2
      RETURNING group_id
      `,
      [groupId, userId]
    );

    return !!result;
  }

  async getMembers(tenantId: string, groupId: string): Promise<GroupMember[]> {
    const rows = await runQueriesWithTenant<GroupMemberRow>(
      tenantId,
      `
      SELECT gm.group_id, gm.user_id, gm.role, gm.joinedAt
      FROM group_members gm
      INNER JOIN groups g ON g.group_id = gm.group_id
      WHERE gm.group_id = $1 AND g.tenant_id = $2
      ORDER BY gm.joinedAt ASC
      `,
      [groupId, tenantId]
    );

    return rows.map((r) => this.toGroupMember(r));
  }

  /**
   * Verifica se o usuário tem role de admin ou owner no grupo
   */
  async isUserAdminOrOwner(tenantId: string, groupId: string, userId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ role: string }>(
      tenantId,
      `
      SELECT gm.role
      FROM group_members gm
      INNER JOIN groups g ON g.group_id = gm.group_id
      WHERE gm.group_id = $1 AND g.tenant_id = $2 AND gm.user_id = $3
      `,
      [groupId, tenantId, userId]
    );

    if (!row) {
      return false;
    }

    return row.role === 'admin' || row.role === 'owner';
  }

  async getUserGroups(tenantId: string, userId: string): Promise<Group[]> {
    // 🔴 CORREÇÃO: Remover colunas que não existem
    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT g.group_id, g.tenant_id, g.name, g.slug, g.description, g.category_id, g.visibility,
        g.avatar_url, g.cover_url, g.financial_purpose,
        g.owner_actor_id, g.is_active, g.profit_percentage, g.metadata, g.createdAt, g.updatedAt
      FROM groups g
      INNER JOIN group_members gm ON g.group_id = gm.group_id
      WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      ORDER BY gm.joinedAt DESC
      `,
      [tenantId, userId]
    );

    return rows.map((r) => this.toGroup(r));
  }

  async getUserGroupCount(tenantId: string, userId: string): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM group_members gm
      INNER JOIN groups g ON g.group_id = gm.group_id
      WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      `,
      [tenantId, userId]
    );

    return row ? Number(row.count) : 0;
  }

  /**
   * Conta quantos grupos o usuário criou (como owner).
   * Usado pela GroupCreationPolicy para verificar limite de criação.
   * 
   * @param tenantId ID do tenant
   * @param userId ID do usuário (owner_actor_id)
   * @returns Número de grupos criados pelo usuário
   */
  async countGroupsCreatedByUser(tenantId: string, userId: string): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM groups
      WHERE tenant_id = $1 AND owner_actor_id = $2
      `,
      [tenantId, userId]
    );

    return row ? Number(row.count) : 0;
  }

  // =========================================================
  // ACCOUNTS
  // =========================================================

  async linkAccount(tenantId: string, groupId: string, accountId: string): Promise<GroupAccount> {
    // 🔴 CORREÇÃO: tenant_id é obrigatório em group_accounts (NOT NULL)
    const row = await runQueryWithTenant<GroupAccountRow>(
      tenantId,
      `
      INSERT INTO group_accounts (tenant_id, group_id, account_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, account_id) DO NOTHING
      RETURNING group_id, account_id, createdAt
      `,
      [tenantId, groupId, accountId]
    );

    if (!row) {
      // Já existe, buscar
      const existing = await runQueryWithTenant<GroupAccountRow>(
        tenantId,
        `
        SELECT group_id, account_id, createdAt
        FROM group_accounts
        WHERE group_id = $1 AND account_id = $2
        `,
        [groupId, accountId]
      );
      if (existing) {
        return {
          groupId: existing.group_id,
          accountId: existing.account_id,
          createdAt: existing.createdAt.toISOString(),
        };
      }
      throw new Error('Failed to link account');
    }

    return {
      groupId: row.group_id,
      accountId: row.account_id,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getGroupAccount(tenantId: string, groupId: string): Promise<GroupAccount | null> {
    const row = await runQueryWithTenant<GroupAccountRow>(
      tenantId,
      `
      SELECT ga.group_id, ga.account_id, ga.createdAt
      FROM group_accounts ga
      INNER JOIN groups g ON g.group_id = ga.group_id
      WHERE ga.group_id = $1 AND g.tenant_id = $2
      LIMIT 1
      `,
      [groupId, tenantId]
    );

    return row
      ? {
          groupId: row.group_id,
          accountId: row.account_id,
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }

  // =========================================================
  // INVITES
  // =========================================================

  private toGroupInvite(row: GroupInviteRow): GroupInvite {
    return {
      inviteId: row.invite_id,
      groupId: row.group_id,
      invitedUserId: row.invited_user_id,
      invitedByUserId: row.invited_by_user_id,
      status: row.status as GroupInvite['status'],
      expiresAt: row.expiresAt,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createInvite(
    tenantId: string,
    groupId: string,
    invitedUserId: string,
    invitedByUserId: string,
    expiresAt?: Date | null
  ): Promise<GroupInvite> {
    const row = await runQueryWithTenant<GroupInviteRow>(
      tenantId,
      `
      INSERT INTO group_invites (
        tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt
      )
      VALUES ($1, $2, $3, $4, 'pending', $5)
      RETURNING invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
      `,
      [tenantId, groupId, invitedUserId, invitedByUserId, expiresAt || null]
    );

    if (!row) {
      throw new Error('Failed to create invite');
    }

    return this.toGroupInvite(row);
  }

  async getInviteById(tenantId: string, inviteId: string): Promise<GroupInvite | null> {
    // Verificar se convite está expirado e atualizar status se necessário
    const now = new Date();
    const row = await runQueryWithTenant<GroupInviteRow>(
      tenantId,
      `
      UPDATE group_invites
      SET status = 'expired', updatedAt = now()
      WHERE tenant_id = $1 
        AND invite_id = $2
        AND status = 'pending'
        AND expiresAt IS NOT NULL
        AND expiresAt <= $3
      RETURNING invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
      `,
      [tenantId, inviteId, now]
    );

    // Se não foi atualizado, buscar normalmente
    if (!row) {
      const inviteRow = await runQueryWithTenant<GroupInviteRow>(
        tenantId,
        `
        SELECT invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
        FROM group_invites
        WHERE tenant_id = $1 AND invite_id = $2
        `,
        [tenantId, inviteId]
      );

      if (!inviteRow) {
        return null;
      }

      // Verificar se está expirado mas não foi atualizado ainda
      if (inviteRow.status === 'pending' && inviteRow.expiresAt && inviteRow.expiresAt <= now) {
        // Atualizar para expired
        const updatedRow = await runQueryWithTenant<GroupInviteRow>(
          tenantId,
          `
          UPDATE group_invites
          SET status = 'expired', updatedAt = now()
          WHERE tenant_id = $1 AND invite_id = $2
          RETURNING invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
          `,
          [tenantId, inviteId]
        );
        return updatedRow ? this.toGroupInvite(updatedRow) : null;
      }

      return this.toGroupInvite(inviteRow);
    }

    return this.toGroupInvite(row);
  }

  async getInvitesByGroup(
    tenantId: string,
    groupId: string,
    status?: GroupInviteStatus
  ): Promise<GroupInvite[]> {
    // Atualizar convites expirados antes de buscar
    const now = new Date();
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE group_invites
      SET status = 'expired', updatedAt = now()
      WHERE tenant_id = $1
        AND group_id = $2
        AND status = 'pending'
        AND expiresAt IS NOT NULL
        AND expiresAt <= $3
      `,
      [tenantId, groupId, now]
    );

    // Buscar convites
    let query = `
      SELECT invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
      FROM group_invites
      WHERE tenant_id = $1 AND group_id = $2
    `;
    const params: any[] = [tenantId, groupId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status);
    } else {
      // Se não especificou status, excluir expirados por padrão (considerar como inativos)
      query += ` AND status != 'expired'`;
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<GroupInviteRow>(tenantId, query, params);
    return rows.map((r) => this.toGroupInvite(r));
  }

  async getInvitesByUser(
    tenantId: string,
    userId: string,
    status?: GroupInviteStatus
  ): Promise<GroupInvite[]> {
    // Atualizar convites expirados antes de buscar
    const now = new Date();
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE group_invites
      SET status = 'expired', updatedAt = now()
      WHERE tenant_id = $1
        AND invited_user_id = $2
        AND status = 'pending'
        AND expiresAt IS NOT NULL
        AND expiresAt <= $3
      `,
      [tenantId, userId, now]
    );

    // Buscar convites
    let query = `
      SELECT invite_id, tenant_id, group_id, invited_user_id, invited_by_user_id, status, expiresAt, createdAt, updatedAt
      FROM group_invites
      WHERE tenant_id = $1 AND invited_user_id = $2
    `;
    const params: any[] = [tenantId, userId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status);
    } else {
      // Se não especificou status, excluir expirados por padrão (considerar como inativos)
      query += ` AND status != 'expired'`;
    }

    query += ` ORDER BY createdAt DESC`;

    const rows = await runQueriesWithTenant<GroupInviteRow>(tenantId, query, params);
    return rows.map((r) => this.toGroupInvite(r));
  }

  async updateInviteStatus(
    tenantId: string,
    inviteId: string,
    status: GroupInviteStatus
  ): Promise<boolean> {
    const result = await runQueryWithTenant<GroupInviteRow>(
      tenantId,
      `
      UPDATE group_invites
      SET status = $1, updatedAt = now()
      WHERE tenant_id = $2 AND invite_id = $3
      RETURNING invite_id
      `,
      [status, tenantId, inviteId]
    );

    return !!result;
  }
}

export const groupsRepository = new GroupsRepository();



