// frontend/src/api/companies.ts
// API para gerenciar empresas (PJ)

import { CompanyStatus, CompanyUserRole, CompanyOperationalStatus } from '@unificard/contracts';
import { apiFetch } from './client';

// Re-export para compatibilidade reversa
export type { CompanyUserRole, CompanyStatus, CompanyOperationalStatus };

/**
 * Status de verificação KYB (DECISION-0089) — derivado de `fiscal_identities.kyb_status`.
 * FONTE ÚNICA de "empresa verificada". `companyStatus`/`isVerified` NÃO são fonte.
 */
export type KybVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'closed';

export interface CompanyAddress {
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface CompanyContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface CompanyActivity {
  mainActivityCode?: string; // CNAE principal
  mainActivityDescription?: string;
  secondaryActivities?: Array<{
    code: string;
    description: string;
  }>;
}

export interface CompanyPermissions {
  canManageCompany: boolean;
  canManageFinancial: boolean;
  canManageEmployees: boolean;
  canViewReports: boolean;
  canManageServices: boolean;
}

export interface Company {
  companyId: string;
  globalUserId: string;
  cnpj: string;
  companyName: string;
  tradeName?: string;
  registrationDate?: string;
  address: CompanyAddress;
  contact: CompanyContact;
  activity: CompanyActivity;
  revenueData?: Record<string, any>;
  status: CompanyOperationalStatus;
  /** lifecycle/onboarding — NÃO é fonte de verificação; VERIFIED/APPROVED legados/mortos (DECISION-0092/0093). */
  companyStatus?: CompanyStatus;
  /** @deprecated legado/compat — NÃO é fonte; use `kybStatus`/`isKybApproved` (DECISION-0089/0093). Será aposentado na Fase 3.3. */
  isVerified: boolean;
  /** DECISION-0089 Fase 1 — FONTE ÚNICA de verificação PJ (derivada de fiscal_identities.kyb_status). */
  kybStatus?: KybVerificationStatus | null;
  /** Derivado: `kybStatus === 'approved'`. Único critério visual de "empresa verificada". */
  isKybApproved?: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userRole: {
    companyUserId: string;
    companyId: string;
    globalUserId: string;
    role: CompanyUserRole;
    roleDescription?: string;
    permissions: CompanyPermissions;
    isActive: boolean;
    isPrimary: boolean;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  };
}

export type MarketplaceDomain = 'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs';

export interface CompanyDomain {
  companyDomainId: string;
  companyId: string;
  domain: MarketplaceDomain;
  enabled: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  cnpj: string;
  companyName?: string;
  tradeName?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  role: CompanyUserRole;
  roleDescription?: string;
  permissions?: Partial<CompanyPermissions>;
  isPrimary?: boolean;
  fetchFromRevenue?: boolean;
  domains?: MarketplaceDomain[]; // Domínios de atuação (obrigatório: pelo menos 1)
}

export interface UpdateCompanyInput {
  companyName?: string;
  tradeName?: string;
  registrationDate?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  status?: CompanyOperationalStatus;
  metadata?: Record<string, any>;
}

export interface RevenueFederalData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  data_abertura?: string;
  situacao_cadastral?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  capital_social?: string;
  porte?: string;
  natureza_juridica?: string;
  atividade_principal?: Array<{
    code: string;
    text: string;
  }>;
  atividades_secundarias?: Array<{
    code: string;
    text: string;
  }>;
  qsa?: Array<{
    nome: string;
    qual: string;
    pais_origem?: string;
    nome_rep_legal?: string;
    qual_rep_legal?: string;
  }>;
}

/**
 * Lista todas as empresas do usuário
 */
export async function listCompanies(): Promise<Company[]> {
  const response = await apiFetch('/companies');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data.companies || [];
  }
  return result.companies || [];
}

/**
 * Busca empresa por ID
 */
export async function getCompany(companyId: string): Promise<Company> {
  const response = await apiFetch(`/companies/${companyId}`);
  return response.json();
}

/**
 * Cria nova empresa
 */
export async function createCompany(input: CreateCompanyInput): Promise<{ company: Company; companyUser: any }> {
  const response = await apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Lista domínios ativos de uma empresa
 */
export async function getCompanyDomains(companyId: string): Promise<{ domains: CompanyDomain[] }> {
  const response = await apiFetch(`/companies/${companyId}/domains`, {
    method: 'GET',
  });
  return response.json();
}

/**
 * Atualiza domínios de uma empresa
 */
export async function updateCompanyDomains(
  companyId: string,
  domains: MarketplaceDomain[]
): Promise<{ domains: CompanyDomain[] }> {
  const response = await apiFetch(`/companies/${companyId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domains }),
  });
  return response.json();
}

/**
 * Atualiza empresa
 */
export async function updateCompany(companyId: string, input: UpdateCompanyInput): Promise<Company> {
  const response = await apiFetch(`/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Remove empresa (soft delete)
 * apiFetch já lança erro automaticamente com a mensagem do backend
 */
export async function deleteCompany(companyId: string): Promise<void> {
  await apiFetch(`/companies/${companyId}`, {
    method: 'DELETE',
  });
  // Se chegou aqui, foi sucesso (204 No Content)
}

/**
 * Busca dados do CNPJ na Receita Federal
 * 🔴 Retorna { ok: true, data } ou { ok: false, message } - nunca lança erro
 */
export async function fetchCNPJFromRevenue(cnpj: string): Promise<{ ok: boolean; data?: RevenueFederalData; message?: string }> {
  const response = await apiFetch('/companies/fetch-cnpj', {
    method: 'POST',
    body: JSON.stringify({ cnpj }),
  });
  return response.json();
}

/**
 * Upload documento da empresa (PDF)
 */
export async function uploadCompanyDocument(
  companyId: string,
  file: File
): Promise<{ ok: boolean; message?: string; data?: { documentId: string; companyStatus: string } }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(`/companies/${companyId}/documents`, {
    method: 'POST',
    body: formData,
    // Não definir Content-Type - o browser define automaticamente com boundary
    headers: {},
  });

  return response.json();
}

/**
 * Lista documentos da empresa
 */
export async function listCompanyDocuments(companyId: string): Promise<Array<{
  documentId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}>> {
  const response = await apiFetch(`/companies/${companyId}/documents`);
  const result = await response.json();
  return result.data || [];
}

/**
 * Lista documentos pendentes (ADMIN)
 */
export async function listPendingDocuments(): Promise<Array<{
  documentId: string;
  companyId: string;
  globalUserId: string;
  companyName: string;
  companyCnpj: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}>> {
  const response = await apiFetch('/companies/admin/documents/pending');
  const result = await response.json();
  return result.data || [];
}

/**
 * Aprova ou rejeita documento (ADMIN)
 */
export async function updateDocumentStatus(
  documentId: string,
  status: 'approved' | 'rejected',
  rejectedReason?: string
): Promise<{ ok: boolean; message?: string; data?: { documentId: string; companyStatus: string } }> {
  const response = await apiFetch(`/companies/admin/documents/${documentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejectedReason }),
  });
  return response.json();
}

// DECISION-0096 / Presential UX 2 (higiene): os exports de validação presencial FASE 12 foram
// REMOVIDOS (requestCompanyValidation, getCompanyValidationHistory + tipos ValidationRequest/
// CompanyValidation). O fluxo presencial PJ está reservado/desabilitado (backend 501, UI removida).
// A verificação PJ ocorre pelo fluxo KYB/documental.










