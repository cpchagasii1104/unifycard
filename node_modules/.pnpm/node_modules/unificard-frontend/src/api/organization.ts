// frontend/src/api/organization.ts
// SPRINT 51: API client para unidades organizacionais

import { apiFetch } from './client';

export type OrganizationUnitType = 'MATRIX' | 'BRANCH' | 'DC';

export interface OrganizationUnit {
  id: string;
  tenantId: string;
  name: string;
  type: OrganizationUnitType;
  parentId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationUnitTree extends OrganizationUnit {
  children?: OrganizationUnitTree[];
}

/**
 * Lista unidades organizacionais
 */
export async function listOrganizationUnits(params?: {
  parentId?: string | null;
  type?: OrganizationUnitType;
}): Promise<{ units: OrganizationUnit[] }> {
  const queryParams = new URLSearchParams();
  if (params?.parentId !== undefined) {
    queryParams.append('parentId', params.parentId || 'null');
  }
  if (params?.type) {
    queryParams.append('type', params.type);
  }

  const query = queryParams.toString();
  const response = await apiFetch(`/organization/units${query ? `?${query}` : ''}`);
  return response.json();
}

/**
 * Obtém árvore de unidades
 */
export async function getOrganizationUnitTree(rootId?: string): Promise<{ tree: OrganizationUnitTree[] }> {
  const queryParams = new URLSearchParams();
  if (rootId) {
    queryParams.append('rootId', rootId);
  }

  const query = queryParams.toString();
  const response = await apiFetch(`/organization/units/tree${query ? `?${query}` : ''}`);
  return response.json();
}

/**
 * Busca unidade por ID
 */
export async function getOrganizationUnitById(unitId: string): Promise<OrganizationUnit> {
  const response = await apiFetch(`/organization/units/${unitId}`);
  return response.json();
}

/**
 * Busca unidade por actor
 */
export async function getOrganizationUnitByActor(actorId: string): Promise<OrganizationUnit> {
  const response = await apiFetch(`/organization/units/actor/${actorId}`);
  return response.json();
}

// ============================================================
// ORGANIZATION MEMBERS
// ============================================================

export type OrganizationMemberStatus = 'ACTIVE' | 'SUSPENDED';
export type OrganizationRoleKey = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'FINANCE';

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

export interface OrganizationMemberFilters {
  status?: OrganizationMemberStatus;
  roleKey?: OrganizationRoleKey;
  limit?: number;
  offset?: number;
}

/**
 * Lista membros da organização
 */
export async function listOrganizationMembers(filters?: OrganizationMemberFilters): Promise<{ members: OrganizationMember[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.roleKey) queryParams.append('roleKey', filters.roleKey);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  if (filters?.offset) queryParams.append('offset', filters.offset.toString());

  const query = queryParams.toString();
  const response = await apiFetch(`/organization/members${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar membros' }));
    throw new Error(error.error || 'Erro ao listar membros');
  }
  return response.json();
}

/**
 * Muda papel do membro
 */
export async function changeMemberRole(memberId: string, roleKey: OrganizationRoleKey): Promise<OrganizationMember> {
  const response = await apiFetch(`/organization/members/${memberId}/role`, {
    method: 'POST',
    body: JSON.stringify({ roleKey }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao alterar papel' }));
    throw new Error(error.error || 'Erro ao alterar papel');
  }
  return response.json();
}

/**
 * Remove membro da organização
 */
export async function removeOrganizationMember(memberId: string): Promise<void> {
  const response = await apiFetch(`/organization/members/${memberId}/remove`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao remover membro' }));
    throw new Error(error.error || 'Erro ao remover membro');
  }
}

// ============================================================
// ORGANIZATION INVITES
// ============================================================

export type OrganizationInviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface OrganizationInvite {
  id: string;
  tenantId: string;
  email: string;
  roleId: string;
  invitedByUserId: string;
  status: OrganizationInviteStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface InviteUserInput {
  email: string;
  roleKey: OrganizationRoleKey;
}

export interface OrganizationInviteFilters {
  status?: OrganizationInviteStatus;
  limit?: number;
  offset?: number;
}

/**
 * Convidar usuário para organização
 */
export async function inviteUserToOrganization(input: InviteUserInput): Promise<OrganizationInvite> {
  const response = await apiFetch('/organization/invites', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao enviar convite' }));
    throw new Error(error.error || 'Erro ao enviar convite');
  }
  return response.json();
}

/**
 * Lista convites da organização
 */
export async function listOrganizationInvites(filters?: OrganizationInviteFilters): Promise<{ invites: OrganizationInvite[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  if (filters?.offset) queryParams.append('offset', filters.offset.toString());

  const query = queryParams.toString();
  const response = await apiFetch(`/organization/invites${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar convites' }));
    throw new Error(error.error || 'Erro ao listar convites');
  }
  return response.json();
}

/**
 * Revogar convite
 */
export async function revokeOrganizationInvite(inviteId: string): Promise<OrganizationInvite> {
  const response = await apiFetch(`/organization/invites/${inviteId}/revoke`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao revogar convite' }));
    throw new Error(error.error || 'Erro ao revogar convite');
  }
  return response.json();
}

// ============================================================
// ORGANIZATION ROLES
// ============================================================

export interface OrganizationRole {
  id: string;
  tenantId: string;
  roleKey: OrganizationRoleKey;
  description: string | null;
  createdAt: string;
}

/**
 * Lista papéis da organização
 */
export async function listOrganizationRoles(): Promise<{ roles: OrganizationRole[] }> {
  const response = await apiFetch('/organization/roles');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar papéis' }));
    throw new Error(error.error || 'Erro ao listar papéis');
  }
  return response.json();
}

// ============================================================
// ORGANIZATION UNITS (apenas leitura - endpoints POST/PATCH não existem)
// ============================================================




