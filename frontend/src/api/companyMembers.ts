// src/api/companyMembers.ts
// Client API para Company Members
// Integra frontend com backend Company Members

import { apiFetchJson } from './client';

/**
 * Role do membro da empresa
 */
export enum CompanyMemberRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  CONTRACTOR = 'contractor',
}

/**
 * Status do membro da empresa
 */
export enum CompanyMemberStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  // DECISION-0189 (F4/F5): 'invited' morreu (convite vive em company_access_invitations);
  // 'revoked' = revogação lógica (histórico preservado)
  REVOKED = 'revoked',
}

/**
 * Membro da empresa
 */
export interface CompanyMember {
  memberId: string;
  companyId: string;
  actorId: string;
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  createdAt: string;
  updatedAt: string;
}

// DECISION-0189 (F5): CreateCompanyMemberInput morreu — membership nasce pelo convite
// canônico (companyInvitations.ts). POST /members responde 410 no backend.

/**
 * Input para atualizar membro
 */
export interface UpdateCompanyMemberInput {
  role?: CompanyMemberRole;
  status?: CompanyMemberStatus;
  metadata?: Record<string, any>;
}

/**
 * Lista membros de uma empresa
 */
export async function listCompanyMembers(
  companyId: string,
  filters?: { role?: CompanyMemberRole; status?: CompanyMemberStatus }
): Promise<CompanyMember[]> {
  const queryParams = new URLSearchParams();
  if (filters?.role) queryParams.append('role', filters.role);
  if (filters?.status) queryParams.append('status', filters.status);

  const result = await apiFetchJson<{ ok: boolean; data: CompanyMember[] }>(
    `/companies/${companyId}/members${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  );
  return result.data;
}

/**
 * Busca membro por ID
 */
export async function getCompanyMember(
  companyId: string,
  memberId: string
): Promise<CompanyMember> {
  const result = await apiFetchJson<{ ok: boolean; data: CompanyMember }>(
    `/companies/${companyId}/members/${memberId}`
  );
  return result.data;
}

/**
 * Atualiza membro
 */
export async function updateCompanyMember(
  companyId: string,
  memberId: string,
  input: UpdateCompanyMemberInput
): Promise<CompanyMember> {
  const result = await apiFetchJson<{ ok: boolean; data: CompanyMember }>(
    `/companies/${companyId}/members/${memberId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return result.data;
}

/**
 * Remove membro
 */
export async function deleteCompanyMember(
  companyId: string,
  memberId: string
): Promise<void> {
  await apiFetchJson(
    `/companies/${companyId}/members/${memberId}`,
    {
      method: 'DELETE',
    }
  );
}

