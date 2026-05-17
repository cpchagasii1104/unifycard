// src/api/groups.ts
// API de Grupos Sociais

import { apiFetch, extractErrorMessage } from './client';

export interface GroupSuggestion {
  group_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count?: number;
  category?: string;
}

export interface GroupSuggestionsResponse {
  groups: GroupSuggestion[];
}

export interface Group {
  groupId: string;
  name: string;
  description?: string;
  audienceDescription?: string;
  ownerUserId: string;
  isActive: boolean;
  profitPercentage?: number;
  financialPurpose?: string; // Finalidade dos recursos financeiros
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  avatarUrl?: string;
  coverUrl?: string;
  categoryId?: string;
  memberCount?: number;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: 'member' | 'admin' | 'moderator' | 'owner' | 'collaborator';
  joinedAt: string;
}

export interface GroupInvite {
  inviteId: string;
  groupId: string;
  invitedUserId: string;
  invitedByUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  name: string;
  description: string; // Obrigatória
  audience_description?: string;
  category_id: string; // Obrigatória
  visibility?: 'public' | 'private' | 'secret';
  scope?: 'national' | 'state' | 'city' | 'neighborhood';
  country_id: string; // Obrigatório
  state_id?: string; // Obrigatório se scope >= 'state'
  city_id?: string; // Obrigatório se scope >= 'city'
  neighborhood?: string; // Obrigatório se scope == 'neighborhood'
  avatar_url?: string;
  cover_url?: string;
  rules_text?: string;
  financial_purpose?: string; // Finalidade dos recursos financeiros
  metadata?: Record<string, any>;
  owner_actor_id?: string; // 🔴 OBRIGATÓRIO: Actor ativo do usuário
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  audience_description?: string;
  category_id?: string;
  visibility?: 'public' | 'private' | 'secret';
  scope?: 'national' | 'state' | 'city' | 'neighborhood';
  country_id?: string;
  state_id?: string;
  city_id?: string;
  neighborhood?: string;
  avatar_url?: string;
  cover_url?: string;
  rules_text?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface GroupCategory {
  categoryId: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  allowedScopes?: string[]; // Scopes permitidos para esta categoria (ex: ['national', 'state', 'city'])
}

/**
 * Busca sugestões de grupos para o usuário
 * Trata 401/404 como feature indisponível (não erro crítico)
 */
export async function getGroupSuggestions(limit: number = 3): Promise<GroupSuggestionsResponse> {
  try {
    // Tentar endpoint específico de grupos primeiro
    const response = await apiFetch(`/social/groups/suggestions?limit=${limit}`, {}, { silent401: true, silent404: true });
    return await response.json();
  } catch (error: any) {
    // Se 401/404, tratar como feature indisponível (não erro)
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 401 || error?.status === 404) {
      return { groups: [] };
    }
    // Outros erros devem ser propagados
    throw error;
  }
}

/**
 * Criar novo grupo
 * POST /groups
 */
export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const response = await apiFetch('/groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Atualizar grupo existente
 * PUT /groups/:groupId
 */
export async function updateGroup(groupId: string, input: UpdateGroupInput): Promise<Group> {
  const response = await apiFetch(`/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Upload de imagem de grupo (avatar ou capa)
 * POST /groups/:groupId/media
 */
export async function uploadGroupImage(
  groupId: string,
  imageFile: File,
  type: 'avatar' | 'cover'
): Promise<{ url: string; versions: Record<string, { url: string; width: number; height: number; size: number; format: string }> }> {
  const formData = new FormData();
  formData.append('file', imageFile);

  // Passar type como query param para facilitar parsing no backend
  const response = await apiFetch(`/groups/${groupId}/media?type=${type}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Buscar categorias de grupos
 * Usa busca canônica /categories/search com context='group'
 */
export async function getGroupCategories(): Promise<GroupCategory[]> {
  try {
    const { searchCategories } = await import('./categories');
    const categories = await searchCategories('', 1000, 'group' as import('@unificard/contracts').CategoryContext);
    
    return categories.map(cat => ({
      categoryId: cat.categoryId,
      name: cat.name,
      slug: cat.slug,
      icon: undefined,
      description: cat.description || undefined,
      allowedScopes: (cat as any).metadata?.allowed_scopes || ['national', 'state', 'city', 'neighborhood'],
    }));
  } catch (error) {
    console.warn('[Groups] Erro ao buscar categorias:', error);
    return [];
  }
}

/**
 * Listar grupos do usuário (onde é owner/admin/member)
 * GET /groups/mine
 */
export async function getMyGroups(): Promise<{ groups: Group[] }> {
  const response = await apiFetch('/groups/mine', {}, { silent404: true });
  
  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar meus grupos:', response.status, response.statusText);
    }
    return { groups: [] };
  }
  
  return await response.json();
}

/**
 * Listar grupos públicos (para busca/descoberta)
 * GET /groups
 */
export async function getPublicGroups(): Promise<{ groups: Group[] }> {
  const response = await apiFetch('/groups', {}, { silent404: true });
  
  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar grupos públicos:', response.status, response.statusText);
    }
    return { groups: [] };
  }
  
  return await response.json();
}

/**
 * Buscar grupo por ID
 * GET /groups/:id
 */
export async function getGroup(groupId: string): Promise<Group> {
  const response = await apiFetch(`/groups/${groupId}`, {}, { silent404: true });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Grupo não encontrado');
    }
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar grupo:', response.status, response.statusText);
    }
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  
  const group: any = await response.json();
  // 🔴 CORREÇÃO: Mapear avatar_url/cover_url do backend para avatarUrl/coverUrl
  return {
    ...group,
    avatarUrl: group.avatar_url || group.avatarUrl,
    coverUrl: group.cover_url || group.coverUrl,
  };
}

/**
 * A5 (2026-05-15): saldo do grupo via backend bank service (LEI §4.6 — SSOT financeiro soberano).
 * GET /groups/:id/balance
 * Retorna saldo soberano do grupo (canônico §4.7 — em BRL, não cents).
 *
 * NOTA arquitetural: frontend NÃO acessa tabelas bank diretamente (LEI §4.6).
 * Saldo é resolvido server-side via bank service; frontend consome apenas a API HTTP.
 */
export interface GroupBalance {
  balance: number;
  currency: string;
  accountId?: string;
  hasAccount: boolean;
}

export async function getGroupBalance(groupId: string): Promise<GroupBalance | null> {
  const response = await apiFetch(`/groups/${groupId}/balance`, {}, { silent401: true, silent404: true });
  if (!response.ok) return null;
  const json = await response.json();
  // Backend retorna { ok, data: { balance, currency, hasAccount, accountId? } }
  const data = json?.data ?? json;
  return {
    balance: data.balance ?? 0,
    currency: data.currency ?? 'BRL',
    accountId: data.accountId,
    hasAccount: !!data.hasAccount,
  };
}

/**
 * Listar membros do grupo
 * GET /groups/:id/members
 */
export async function getGroupMembers(groupId: string): Promise<{ members: GroupMember[] }> {
  const response = await apiFetch(`/groups/${groupId}/members`, {}, { silent404: true });
  
  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar membros:', response.status, response.statusText);
    }
    return { members: [] };
  }
  
  return await response.json();
}

/**
 * Atualizar role de um membro
 * PATCH /groups/:id/members/:userId
 */
export async function updateMemberRole(
  groupId: string,
  memberUserId: string,
  role: 'member' | 'admin' | 'moderator' | 'collaborator'
): Promise<{ member: GroupMember }> {
  const response = await apiFetch(`/groups/${groupId}/members/${memberUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Remover membro do grupo
 * DELETE /groups/:id/members/:userId
 */
export async function removeGroupMember(groupId: string, memberUserId: string): Promise<void> {
  const response = await apiFetch(`/groups/${groupId}/members/${memberUserId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
}

/**
 * Criar convite para o grupo
 * POST /groups/:id/invites
 */
export async function createGroupInvite(groupId: string, invitedUserId: string): Promise<{ invite: GroupInvite }> {
  const response = await apiFetch(`/groups/${groupId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ invited_user_id: invitedUserId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Listar convites do grupo
 * GET /groups/:id/invites
 */
export async function getGroupInvites(groupId: string, status?: 'pending' | 'accepted' | 'declined'): Promise<{ invites: GroupInvite[] }> {
  const params = status ? `?status=${status}` : '';
  const response = await apiFetch(`/groups/${groupId}/invites${params}`, {}, { silent404: true });

  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar convites:', response.status, response.statusText);
    }
    return { invites: [] };
  }

  return await response.json();
}

/**
 * Aceitar convite
 * POST /groups/:id/invites/:inviteId/accept
 */
export async function acceptGroupInvite(groupId: string, inviteId: string): Promise<{ member: GroupMember }> {
  const response = await apiFetch(`/groups/${groupId}/invites/${inviteId}/accept`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Recusar convite
 * POST /groups/:id/invites/:inviteId/decline
 */
export async function declineGroupInvite(groupId: string, inviteId: string): Promise<void> {
  const response = await apiFetch(`/groups/${groupId}/invites/${inviteId}/decline`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
}

/**
 * Buscar dashboard do grupo (métricas simples, read-only)
 */
export async function getGroupDashboard(groupId: string): Promise<{
  membersCount: number;
  eventsCount: number;
  postsCount: number | null;
  updatedAt: string;
}> {
  const response = await apiFetch(`/groups/${groupId}/dashboard`, {}, { silent404: true });
  
  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar dashboard:', response.status, response.statusText);
    }
    // Retornar valores padrão em caso de erro
    return {
      membersCount: 0,
      eventsCount: 0,
      postsCount: null,
      updatedAt: new Date().toISOString(),
    };
  }

  return await response.json();
}

/**
 * Busca economia do grupo (read-only)
 * GET /groups/:groupId/economy
 */
export async function getGroupEconomy(groupId: string): Promise<{
  totalIn: number;
  totalOut: number;
  balance: number;
  currency: string;
  lastUpdate: string;
}> {
  const response = await apiFetch(`/groups/${groupId}/economy`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  return await response.json();
}

/**
 * Busca resumo de fechamento do grupo (read-only)
 * GET /groups/:groupId/closure-summary
 */
export async function getGroupClosureSummary(groupId: string): Promise<{
  lifetimeEvents: number;
  lifetimeEconomicVolume: number;
  createdAt: string;
}> {
  const response = await apiFetch(`/groups/${groupId}/closure-summary`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  return await response.json();
}

/**
 * Busca histórico de transições de estado do grupo (read-only)
 * GET /groups/:groupId/state-history
 */
export async function getGroupStateHistory(groupId: string): Promise<Array<{
  state: string;
  changedAt: string;
}>> {
  const response = await apiFetch(`/groups/${groupId}/state-history`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  return await response.json();
}

/**
 * Listar convites do usuário
 * GET /groups/invites/mine
 */
export async function getMyInvites(status?: 'pending' | 'accepted' | 'declined'): Promise<{ invites: GroupInvite[] }> {
  const params = status ? `?status=${status}` : '';
  const response = await apiFetch(`/groups/invites/mine${params}`, {}, { silent404: true });

  if (!response.ok) {
    if (response.status >= 500) {
      console.error('[Groups] Erro do servidor ao buscar meus convites:', response.status, response.statusText);
    }
    return { invites: [] };
  }

  return await response.json();
}

/**
 * Solicitar entrada em grupo privado
 * POST /groups/:id/request
 */
export async function requestJoinGroup(groupId: string, expiresInDays?: number): Promise<{ invite: GroupInvite }> {
  const response = await apiFetch(`/groups/${groupId}/request`, {
    method: 'POST',
    body: JSON.stringify({ expires_in_days: expiresInDays }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Aprovar solicitação de entrada
 * POST /groups/:id/requests/:inviteId/approve
 */
export async function approveJoinRequest(groupId: string, inviteId: string): Promise<{ member: GroupMember }> {
  const response = await apiFetch(`/groups/${groupId}/requests/${inviteId}/approve`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }

  return await response.json();
}

/**
 * Rejeitar solicitação de entrada
 * POST /groups/:id/requests/:inviteId/reject
 */
export async function rejectJoinRequest(groupId: string, inviteId: string): Promise<void> {
  const response = await apiFetch(`/groups/${groupId}/requests/${inviteId}/reject`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
}


