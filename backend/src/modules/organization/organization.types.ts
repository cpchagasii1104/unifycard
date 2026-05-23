// backend/src/modules/organization/organization.types.ts
// SPRINT 78: CONVITES, PAPÉIS E GOVERNANÇA ORGANIZACIONAL

/**
 * Chave do papel organizacional
 */
export type OrganizationRoleKey = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'FINANCE';

/**
 * Papel organizacional
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Papéis controlam permissões (integra com permission system existente)
 * - Tudo explícito e auditável
 * - Sem criar permissões mágicas
 */
export interface OrganizationRole {
  id: string;
  tenantId: string;
  roleKey: OrganizationRoleKey;
  description: string | null;
  createdAt: string;
}

/**
 * Status do membro organizacional
 */
export type OrganizationMemberStatus = 'ACTIVE' | 'SUSPENDED';

/**
 * Membro organizacional
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Aceite exige aceite explícito
 * - Sem aceite = sem acesso
 * - Um usuário pode pertencer a várias organizações
 */
export interface OrganizationMember {
  id: string;
  tenantId: string;
  actorId: string;
  userId: string;
  roleId: string;
  status: OrganizationMemberStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Status do convite organizacional
 */
export type OrganizationInviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/**
 * Convite organizacional
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Convite ≠ Usuário
 * - Aceite é obrigatório
 * - Sem automação silenciosa
 * - Tudo auditável
 */
export interface OrganizationInvite {
  id: string;
  tenantId: string;
  email: string;
  roleId: string;
  invitedByUserId: string;
  status: OrganizationInviteStatus;
  token: string;
  expiresAt: Date;
  createdAt: string;
  acceptedAt: Date | null;
}

/**
 * Input para convidar usuário
 */
export interface InviteUserInput {
  email: string;
  roleKey: OrganizationRoleKey;
}

/**
 * Input para aceitar convite
 */
export interface AcceptInviteInput {
  token: string;
  userId: string;
  actorId: string;
}

/**
 * Filtros para listar convites
 */
export interface OrganizationInviteFilters {
  status?: OrganizationInviteStatus;
  limit?: number;
  offset?: number;
}

/**
 * Filtros para listar membros
 */
export interface OrganizationMemberFilters {
  status?: OrganizationMemberStatus;
  roleKey?: OrganizationRoleKey;
  limit?: number;
  offset?: number;
}

/** Escopo de consolidação para relatórios multi-empresa (objeto resolvido pelo helper) */
export interface ConsolidationScope {
  unitId?: string;
  includeChildren: boolean;
  consolidated: boolean;
}

/** Unidade organizacional (árvore de departamentos) */
export interface OrganizationUnit {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  parentId: string | null;
  slug: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationUnitInput {
  name: string;
  type?: string;
  parentId?: string | null;
  slug: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationUnitInput {
  name?: string;
  type?: string;
  parentId?: string | null;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface OrganizationUnitTree extends OrganizationUnit {
  children: OrganizationUnitTree[];
}

