// src/core/companies/companies.types.ts
// Tipos para sistema de empresas (PJ)

import { CompanyStatus, CompanyUserRole } from '@unificard/contracts';

/**
 * Status de verificação KYB da identidade fiscal (DECISION-0089).
 * Domínio canônico = CHECK de `fiscal_identities.kyb_status`.
 * FONTE ÚNICA de "empresa verificada" = `kyb_status='approved'`.
 * NÃO confundir com `companyStatus`/`isVerified` (lifecycle/legado).
 */
export type KybVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'closed';

export interface Company {
  companyId: string;
  globalUserId: string;
  cnpj: string;
  companyName: string; // Razão Social
  tradeName?: string; // Nome Fantasia
  registrationDate?: string; // Data de abertura
  address: CompanyAddress;
  contact: CompanyContact;
  activity: CompanyActivity;
  revenueData?: Record<string, any>; // Dados da Receita Federal
  status: 'active' | 'inactive' | 'suspended' | 'closed';
  /** Lifecycle/onboarding (DRAFT/PROVISIONAL/ACTIVE/SUSPENDED). NÃO é fonte de verificação; VERIFIED/APPROVED são legados/mortos (DECISION-0092/0093). */
  companyStatus: CompanyStatus;
  /** DECISION-0093 §4.3 / Fase 3.3-B1: `isVerified` REMOVIDO do DTO (vestígio compat, sem consumidor vivo). Use `kybStatus`/`isKybApproved`. Coluna `companies.is_verified` drop = Fase 3.3-B2. */
  /**
   * DECISION-0089 Fase 1 — read-model derivado de `fiscal_identities.kyb_status`.
   * FONTE ÚNICA de verificação PJ. `null` quando a empresa não tem identidade fiscal
   * resolvível (nunca inferir 'approved' a partir de company_status/is_verified).
   */
  kybStatus: KybVerificationStatus | null;
  /** Derivado: `kybStatus === 'approved'`. Único critério de "empresa verificada" no display. */
  isKybApproved: boolean;
  metadata?: Record<string, any>; // Raio X, análises, etc.
  createdAt: string;
  updatedAt: string;
}

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

// CompanyUserRole importado de @unificard/contracts

export interface CompanyUser {
  companyUserId: string;
  companyId: string;
  globalUserId: string;
  role: CompanyUserRole;
  roleDescription?: string;
  permissions: CompanyPermissions;
  isActive: boolean;
  isPrimary: boolean; // Empresa principal
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPermissions {
  canManageCompany: boolean; // Gerenciar dados da empresa
  canManageFinancial: boolean; // Gerenciar financeiro
  canManageEmployees: boolean; // Gerenciar funcionários
  canViewReports: boolean; // Ver relatórios
  canManageServices: boolean; // Gerenciar serviços/produtos
}

export type MarketplaceDomain = 'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs';

export interface CompanyDomain {
  companyDomainId: string;
  companyId: string;
  domain: MarketplaceDomain;
  isEnabled: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  cnpj: string;
  companyName?: string; // Se não fornecido, busca da Receita Federal
  tradeName?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): `activity` removido do input — alimentava só
  // o ghost de colunas inexistentes em companies. Evidência CNAE irá para a casa fiscal (frente própria).
  role: CompanyUserRole;
  roleDescription?: string;
  permissions?: Partial<CompanyPermissions>;
  isPrimary?: boolean;
  fetchFromRevenue?: boolean; // Se true, busca dados da Receita Federal
  // F-PJ-DOMAIN-SELECTOR-NEUTRALIZE (DECISION-0102): `domains` (livre escolha) REMOVIDO do input de create —
  // alimentava só o writer ghost de company_domains (tabela inexistente). Domínio deriva de CONCEPT, governado.
  /** Categoria de negócio (opcional, armazenada em metadata) */
  businessCategory?: string;
  /** Categorias de serviço (opcional, armazenada em metadata) */
  serviceCategories?: string[];
}

export interface UpdateCompanyInput {
  cnpj?: string; // 🔴 Só pode ser editado se company_status != 'validated'
  companyName?: string;
  tradeName?: string;
  registrationDate?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): `activity` removido do input — alimentava só
  // o ghost de colunas inexistentes em companies. Evidência CNAE irá para a casa fiscal (frente própria).
  status?: 'active' | 'inactive' | 'suspended' | 'closed';
  // DECISION-0090 Fase 2.1: `companyStatus` REMOVIDO do input de edição. updateCompany não pode
  // ser caminho para alterar verificação fiscal (fonte única = fiscal_identities.kyb_status).
  // Lifecycle/verificação têm writers próprios (KYB auditado); edição comum não toca company_status.
  metadata?: Record<string, any>;
}

export interface UpdateCompanyUserInput {
  role?: CompanyUserRole;
  roleDescription?: string;
  permissions?: Partial<CompanyPermissions>;
  isActive?: boolean;
  isPrimary?: boolean;
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
  qsa?: Array<{ // Quadro Societário
    nome: string;
    qual: string; // Qualificação (Sócio, Diretor, etc.)
    pais_origem?: string;
    nome_rep_legal?: string;
    qual_rep_legal?: string;
  }>;
}

