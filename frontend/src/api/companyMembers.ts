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
  INVITED = 'invited',
  SUSPENDED = 'suspended',
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

/**
 * Input para criar membro
 */
export interface CreateCompanyMemberInput {
  actorId: string;
  role?: CompanyMemberRole;
  status?: CompanyMemberStatus;
  metadata?: Record<string, any>;
}

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
 * Cria um novo membro
 */
export async function createCompanyMember(
  companyId: string,
  input: CreateCompanyMemberInput
): Promise<CompanyMember> {
  const result = await apiFetchJson<{ ok: boolean; data: CompanyMember }>(
    `/companies/${companyId}/members`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
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

