// src/modules/groups/groups.repository.ts
// D9.2-B (DECISION-0188): membership Actor-first — a VERDADE de pertencimento vive em
// group_actor_memberships (escrita SOMENTE pelas fns governadas via service canonico).
// Este repository NAO escreve nem le group_members (casa legada CONGELADA no cutover).
// Leitores aqui PROJETAM a casa nova no shape legado (userId resolvido do user-actor).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { tenantService } from '@core/tenants/tenant.service';
import { worldService } from '@core/world/services/world.service';
import { groupActorMembershipRepository } from './group-actor-membership.repository';
import type { Group, GroupMember, GroupAccount, CreateGroupInput, UpdateGroupInput, GroupVisibility, GroupInvite, GroupInviteStatus } from './groups.types';

interface GroupRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  owner_actor_id: string;
  status: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface GroupMemberRow {
  membership_id: string;
  group_id: string;
  member_actor_id: string;
  user_id: string | null;
  role: string;
  joinedAt: Date;
}

// 🔴 ESTE TIPO MENTIU POR TODA A VIDA DO MÓDULO (corrigido 2026-08-05).
// Declarava `account_id` e `createdAt` — duas colunas que NUNCA existiram em `group_accounts`
// (reais: `bank_account_id`, `created_at`). O TypeScript compilou feliz porque um tipo de linha é
// uma AFIRMAÇÃO sobre o que o banco devolve, nunca uma checagem: `runQueryWithTenant<T>` não valida
// nada em runtime. Efeito: as 3 queries da seção ACCOUNTS estouravam `42703` e a rota de consulta
// da conta do grupo devolvia 500 para todo grupo — por isso `group_accounts` tem ZERO linhas:
// nunca foi
// possível criar uma. `createdAt` sem aspas ainda dobrava para `createdat`, um segundo erro no
// mesmo identificador.
interface GroupAccountRow {
  group_id: string;
  bank_account_id: string;
  created_at: Date;
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
    const metadata = row.metadata || {};
    const location = metadata.location || {};

    return {
      groupId: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug ?? '',
      description: row.description || '',
      audienceDescription: metadata.audience_description || undefined,
      categoryId: metadata.category_id || undefined,
      visibility: (metadata.visibility || 'public') as Group['visibility'],
      scope: (metadata.scope || 'national') as Group['scope'],
      countryId: location.country_id || undefined,
      stateId: location.state_id || undefined,
      cityId: location.city_id || undefined,
      neighborhood: location.neighborhood || undefined,
      avatarUrl: metadata.avatar_url || undefined,
      coverUrl: metadata.cover_url || undefined,
      rulesText: metadata.rules_text || undefined,
      financialPurpose: metadata.financial_purpose || undefined,
      ownerActorId: row.owner_actor_id,
      isActive: row.status === 'active',
      profitBps: metadata.profit_percentage ? parseFloat(metadata.profit_percentage.toString()) : 0,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toGroupMember(row: GroupMemberRow): GroupMember {
    return {
      groupId: row.group_id,
      userId: row.user_id,
      memberActorId: row.member_actor_id,
      membershipId: row.membership_id,
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
      audience_description: input.audience_description || null,
      category_id: input.category_id || null,
      visibility: input.visibility || 'public',
      avatar_url: input.avatar_url || null,
      cover_url: input.cover_url || null,
      financial_purpose: input.financial_purpose || null,
    };

    // Gerar slug em TypeScript (generate_group_slug não existe no schema Gênesis)
    let finalSlug = input.slug || null;
    if (!finalSlug) {
      const baseSlug = (input.name ?? 'grupo')
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
        tenant_id, name, slug, description,
        owner_actor_id, status, metadata, purpose
      )
      VALUES (
        $1, $2, $3, $4,
        $5, 'active', $6, $7
      )
      RETURNING id, tenant_id, name, slug, description, owner_actor_id, status, metadata, purpose, created_at, updated_at
      `,
      [
        tenantId,
        input.name,
        finalSlug,
        input.description || '',
        ownerActorId,
        JSON.stringify(metadata),
        // DECISION-0163: propósito governado (CHECK físico); default D3
        (input as any).purpose || 'comunidade_e_pertencimento'
      ]
    );

    if (!row) {
      throw new Error('Failed to create group');
    }

    // D9.2-B (DECISION-0188 D8/D16): a membership do owner NAO nasce mais aqui por INSERT
    // legado — nasce no service (createGroup) via writer governado da casa nova, apos o
    // group-actor. Este repository nao escreve pertencimento.
    return this.toGroup(row);
  }

  async findById(tenantId: string, groupId: string): Promise<Group | null> {
    // 🔴 CORREÇÃO: Remover colunas que não existem (scope, country_id, state_id, city_id, neighborhood, rules_text)
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, slug, description, owner_actor_id, status, metadata, created_at, updated_at
      FROM groups
      WHERE id = $1 AND tenant_id = $2
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
      SELECT id, tenant_id, name, slug, description, owner_actor_id, status, metadata, created_at, updated_at
      FROM groups
      WHERE (${visibilityConditions.join(' OR ')})
    `;

    if (filters?.isActive !== undefined) {
      query += ` AND status = $${paramIndex}`;
      // 🔵 fix (achado no caminho de F-GLOBAL-SEARCH-OMNI): o contrato do filtro é boolean mas a
      // coluna é TEXT ('active'/'inactive'). Antes empurrava o boolean cru → status = 'true' nunca
      // casa → listGroups({isActive:true}) retornava SEMPRE vazio para qualquer caller (bug latente).
      params.push(filters.isActive ? 'active' : 'inactive');
      paramIndex++;
    }

    if (filters?.categoryId) {
      query += ` AND metadata->>'category_id' = $${paramIndex}`;
      params.push(filters.categoryId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

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
    // Campos armazenados em metadata (schema Gênesis não tem essas colunas)
    const needsMetadataUpdate = input.scope !== undefined || input.country_id !== undefined ||
        input.state_id !== undefined || input.city_id !== undefined ||
        input.neighborhood !== undefined || input.rules_text !== undefined ||
        input.audience_description !== undefined || input.category_id !== undefined ||
        input.visibility !== undefined || input.avatar_url !== undefined ||
        input.cover_url !== undefined || input.financial_purpose !== undefined ||
        input.profitBps !== undefined;

    if (needsMetadataUpdate || input.metadata !== undefined) {
      const current = await this.findById(tenantId, groupId);
      const currentMetadata = current?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        ...(input.metadata || {}),
      };

      if (input.scope !== undefined) updatedMetadata.scope = input.scope;
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
      if (input.rules_text !== undefined) updatedMetadata.rules_text = input.rules_text;
      if (input.audience_description !== undefined) updatedMetadata.audience_description = input.audience_description;
      if (input.category_id !== undefined) updatedMetadata.category_id = input.category_id;
      if (input.visibility !== undefined) updatedMetadata.visibility = input.visibility;
      if (input.avatar_url !== undefined) updatedMetadata.avatar_url = input.avatar_url;
      if (input.cover_url !== undefined) updatedMetadata.cover_url = input.cover_url;
      if (input.financial_purpose !== undefined) updatedMetadata.financial_purpose = input.financial_purpose;
      if (input.profitBps !== undefined) updatedMetadata.profit_percentage = input.profitBps;

      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updatedMetadata));
    }
    if (input.isActive !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.isActive ? 'active' : 'inactive');
    }

    if (updates.length === 0) {
      const existing = await this.findById(tenantId, groupId);
      if (!existing) {
        throw new Error('Group not found');
      }
      return existing;
    }

    updates.push(`updated_at = now()`);

    // 🔴 CORREÇÃO: Remover colunas que não existem do RETURNING
    const row = await runQueryWithTenant<GroupRow>(
      tenantId,
      `
      UPDATE groups
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, name, slug, description, owner_actor_id, status, metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Group not found');
    }

    return this.toGroup(row);
  }

  async delete(tenantId: string, groupId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      UPDATE groups
      SET status = 'inactive', updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id
      `,
      [tenantId, groupId]
    );

    return !!result;
  }

  // =========================================================
  // MEMBERS — D9.2-B: leitura EXCLUSIVA da casa nova group_actor_memberships.
  // Escrita de membership NAO existe aqui (somente fns governadas via service canonico).
  // =========================================================

  /** Resolve o user-actor canonico de um user (lookup PURO; sem escrita; namespace unico). */
  async findUserActorId(tenantId: string, userId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `SELECT a.id::text AS id
         FROM actors a
        WHERE a.tenant_id = $1 AND a.user_id = $2 AND a.actor_type = 'user'
        ORDER BY a.created_at ASC
        LIMIT 1`,
      [tenantId, userId]
    );
    return row ? row.id : null;
  }

  /** group-actor do Group (autoridade de gestao = canRepresentActor(group_actor) — D10). */
  async getGroupActorId(tenantId: string, groupId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ actor_id: string | null }>(
      tenantId,
      `SELECT actor_id::text AS actor_id FROM groups WHERE tenant_id = $1 AND id = $2`,
      [tenantId, groupId]
    );
    return row?.actor_id ?? null;
  }

  /**
   * Membros ATIVOS do grupo — projecao legada da casa nova (listByGroup + resolucao).
   * role e DERIVADA (owner = groups.owner_actor_id; demais = member) — D11: role sem poder.
   */
  async getMembers(tenantId: string, groupId: string): Promise<GroupMember[]> {
    const rows = await runQueriesWithTenant<GroupMemberRow>(
      tenantId,
      `
      SELECT gam.id::text AS membership_id,
             gam.group_id::text AS group_id,
             gam.member_actor_id::text AS member_actor_id,
             a.user_id::text AS user_id,
             CASE WHEN g.owner_actor_id = gam.member_actor_id THEN 'owner' ELSE 'member' END AS role,
             gam.created_at AS "joinedAt"
      FROM group_actor_memberships gam
      INNER JOIN groups g ON g.id = gam.group_id AND g.tenant_id = gam.tenant_id
      LEFT JOIN actors a ON a.id = gam.member_actor_id AND a.tenant_id = gam.tenant_id
      WHERE gam.group_id = $1 AND gam.tenant_id = $2 AND gam.status = 'active'
      ORDER BY gam.created_at ASC
      `,
      [groupId, tenantId]
    );

    return rows.map((r) => this.toGroupMember(r));
  }

  /**
   * Grupos ATIVOS onde o user (resolvido a user-actor) tem membership ATIVA.
   * D9.2-B: user_id apenas RESOLVE o user-actor (D5); a seleção usa listByMember (idx_gam_member).
   */
  async getUserGroups(tenantId: string, userId: string): Promise<Group[]> {
    const memberActorId = await this.findUserActorId(tenantId, userId);
    if (!memberActorId) {
      return [];
    }
    const memberships = (await groupActorMembershipRepository.listByMember(tenantId, memberActorId))
      .filter((m) => m.status === 'active');
    if (memberships.length === 0) {
      return [];
    }
    const rows = await runQueriesWithTenant<GroupRow>(
      tenantId,
      `
      SELECT g.id, g.tenant_id, g.name, g.slug, g.description, g.owner_actor_id, g.status, g.metadata, g.created_at, g.updated_at
      FROM groups g
      WHERE g.tenant_id = $1 AND g.id = ANY($2::uuid[]) AND g.status = 'active'
      `,
      [tenantId, memberships.map((m) => m.groupId)]
    );
    // ordem legada preservada: membership mais recente primeiro
    const order = new Map(memberships.map((m, i) => [m.groupId, i]));
    return rows
      .map((r) => this.toGroup(r))
      .sort((a, b) => (order.get(b.groupId) ?? -1) - (order.get(a.groupId) ?? -1));
  }

  /** Cap civil (D12): conta SOMENTE memberships ativas do user-actor em grupos ativos. */
  async getUserGroupCount(tenantId: string, userId: string): Promise<number> {
    return (await this.getUserGroups(tenantId, userId)).length;
  }

  /**
   * Cap por ACTOR candidato (D12): retorna a contagem ativa se o actor for user-actor;
   * null para actors institucionais (page/group — sem cap pessoal nesta DECISION).
   */
  async countActiveUserActorMemberships(tenantId: string, memberActorId: string): Promise<number | null> {
    const row = await runQueryWithTenant<{ actor_type: string; n: string }>(
      tenantId,
      `
      SELECT a.actor_type,
             count(gam.id) FILTER (WHERE gam.status = 'active' AND g.status = 'active') AS n
      FROM actors a
      LEFT JOIN group_actor_memberships gam
        ON gam.tenant_id = a.tenant_id AND gam.member_actor_id = a.id
      LEFT JOIN groups g ON g.id = gam.group_id AND g.tenant_id = gam.tenant_id
      WHERE a.tenant_id = $1 AND a.id = $2
      GROUP BY a.actor_type
      `,
      [tenantId, memberActorId]
    );
    if (!row) {
      return null;
    }
    return row.actor_type === 'user' ? Number(row.n) : null;
  }

  /**
   * Conta quantos grupos o usuário criou (como owner).
   * Usado pela GroupCreationPolicy para verificar limite de criação.
   * 
   * @param tenantId ID do tenant
   * @param actorId ID do actor (owner_actor_id / actors.id)
   * @returns Número de grupos criados pelo utilizador (âncora actor)
   */
  async countGroupsCreatedByUser(tenantId: string, actorId: string): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM groups
      WHERE tenant_id = $1 AND owner_actor_id = $2
      `,
      [tenantId, actorId]
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
      INSERT INTO group_accounts (tenant_id, group_id, bank_account_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, group_id) DO NOTHING
      RETURNING group_id, bank_account_id, created_at
      `,
      [tenantId, groupId, accountId]
    );

    if (!row) {
      // ⚠️ A ÚNICA é `(tenant_id, group_id)` — UMA conta por grupo, não uma por par.
      // O `ON CONFLICT` antigo citava `(group_id, account_id)`, que não é única de nada: mesmo com
      // os nomes certos ele teria erguido `42P10`. E a busca de fallback tem que ser pelo MESMO
      // critério da única — procurar por `(group_id, account_id)` devolveria vazio justamente no
      // caso que importa (grupo já ligado a OUTRA conta) e cairia no throw como se fosse falha.
      const existing = await runQueryWithTenant<GroupAccountRow>(
        tenantId,
        `
        SELECT group_id, bank_account_id, created_at
        FROM group_accounts
        WHERE tenant_id = $1 AND group_id = $2
        `,
        [tenantId, groupId]
      );
      if (existing) {
        return {
          groupId: existing.group_id,
          accountId: existing.bank_account_id,
          createdAt: existing.created_at.toISOString(),
        };
      }
      throw new Error('Failed to link account');
    }

    return {
      groupId: row.group_id,
      accountId: row.bank_account_id,
      createdAt: row.created_at.toISOString(),
    };
  }

  async getGroupAccount(tenantId: string, groupId: string): Promise<GroupAccount | null> {
    const row = await runQueryWithTenant<GroupAccountRow>(
      tenantId,
      `
      SELECT ga.group_id, ga.bank_account_id, ga.created_at
      FROM group_accounts ga
      INNER JOIN groups g ON g.id = ga.group_id
      WHERE ga.group_id = $1 AND g.tenant_id = $2
      LIMIT 1
      `,
      [groupId, tenantId]
    );

    // ⚠️ `bank_account_id` é PONTEIRO para `bank_accounts(id)` — este mapa NÃO guarda dinheiro.
    // O que o grupo tem vive no Bank, em dois bolsos separados por natureza econômica
    // (`CONTRATO_GRUPOS_V2` §2.1). A coluna `balance_cents` desta mesma tabela é uma SEGUNDA
    // ESCRITURAÇÃO paralela ao Bank e contradiz a lei; ninguém a lê
    // (`grep balance_cents src/modules/groups` = vazio) e a tabela
    // tem zero linhas. Aposentá-la é ato de GATE, não deste conserto — mas nada aqui passa a lê-la.
    return row
      ? {
          groupId: row.group_id,
          accountId: row.bank_account_id,
          createdAt: row.created_at.toISOString(),
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

  // D9.2-B: o INSERT legado de convite (sem intent_kind — convenção implícita) foi APOSENTADO.
  // Toda intenção nasce EXPLÍCITA (invite|request) via fn_create_group_membership_intent,
  // invocada pelo service canônico de membership (DECISION-0188 D9).

  async getInviteById(tenantId: string, inviteId: string): Promise<GroupInvite | null> {
    // Verificar se convite está expirado e atualizar status se necessário
    const now = new Date();
    const row = await runQueryWithTenant<GroupInviteRow>(
      tenantId,
      `
      UPDATE group_invites
      SET status = 'expired', responded_at = now()
      WHERE tenant_id = $1 
        AND id = $2
        AND status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at <= $3
      RETURNING id AS invite_id, tenant_id, group_id,
        invited_actor_id AS invited_user_id,
        invited_by_actor_id AS invited_by_user_id,
        status,
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        COALESCE(responded_at, created_at) AS "updatedAt"
      `,
      [tenantId, inviteId, now]
    );

    // Se não foi atualizado, buscar normalmente
    if (!row) {
      const inviteRow = await runQueryWithTenant<GroupInviteRow>(
        tenantId,
        `
        SELECT id AS invite_id, tenant_id, group_id,
          invited_actor_id AS invited_user_id,
          invited_by_actor_id AS invited_by_user_id,
          status,
          expires_at AS "expiresAt",
          created_at AS "createdAt",
          COALESCE(responded_at, created_at) AS "updatedAt"
        FROM group_invites
        WHERE tenant_id = $1 AND id = $2
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
          SET status = 'expired', responded_at = now()
          WHERE tenant_id = $1 AND id = $2
          RETURNING id AS invite_id, tenant_id, group_id,
            invited_actor_id AS invited_user_id,
            invited_by_actor_id AS invited_by_user_id,
            status,
            expires_at AS "expiresAt",
            created_at AS "createdAt",
            COALESCE(responded_at, created_at) AS "updatedAt"
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
      SET status = 'expired', responded_at = now()
      WHERE tenant_id = $1
        AND group_id = $2
        AND status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at <= $3
      `,
      [tenantId, groupId, now]
    );

    // Buscar convites
    let query = `
      SELECT id AS invite_id, tenant_id, group_id,
        invited_actor_id AS invited_user_id,
        invited_by_actor_id AS invited_by_user_id,
        status,
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        COALESCE(responded_at, created_at) AS "updatedAt"
      FROM group_invites
      WHERE tenant_id = $1 AND group_id = $2
    `;
    const params: any[] = [tenantId, groupId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status === 'declined' ? 'rejected' : status);
    } else {
      // Se não especificou status, excluir expirados por padrão (considerar como inativos)
      query += ` AND status != 'expired'`;
    }

    query += ` ORDER BY created_at DESC`;

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
      SET status = 'expired', responded_at = now()
      WHERE tenant_id = $1
        AND invited_actor_id = $2
        AND status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at <= $3
      `,
      [tenantId, userId, now]
    );

    // Buscar convites
    let query = `
      SELECT id AS invite_id, tenant_id, group_id,
        invited_actor_id AS invited_user_id,
        invited_by_actor_id AS invited_by_user_id,
        status,
        expires_at AS "expiresAt",
        created_at AS "createdAt",
        COALESCE(responded_at, created_at) AS "updatedAt"
      FROM group_invites
      WHERE tenant_id = $1 AND invited_actor_id = $2
    `;
    const params: any[] = [tenantId, userId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status === 'declined' ? 'rejected' : status);
    } else {
      // Se não especificou status, excluir expirados por padrão (considerar como inativos)
      query += ` AND status != 'expired'`;
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await runQueriesWithTenant<GroupInviteRow>(tenantId, query, params);
    return rows.map((r) => this.toGroupInvite(r));
  }

  async updateInviteStatus(
    tenantId: string,
    inviteId: string,
    status: GroupInviteStatus
  ): Promise<boolean> {
    // D9.2-B: 'declined' era alias de aplicacao sem lastro fisico (CHECK vivo usa 'rejected').
    const physicalStatus = status === 'declined' ? 'rejected' : status;
    const result = await runQueryWithTenant<GroupInviteRow>(
      tenantId,
      `
      UPDATE group_invites
      SET status = $1, responded_at = now()
      WHERE tenant_id = $2 AND id = $3
      RETURNING id AS invite_id
      `,
      [physicalStatus, tenantId, inviteId]
    );

    return !!result;
  }
}

export const groupsRepository = new GroupsRepository();

