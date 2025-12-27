// src/core/companies/companies.types.ts
// Tipos para sistema de empresas (PJ)

import { CompanyStatus, CompanyUserRole } from '@unificard/contracts';

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
  companyStatus: CompanyStatus; // Status do cadastro
  isVerified: boolean;
  metadata?: Record<string, any>; // Raio X, análises, etc.
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyPermissions {
  canManageCompany: boolean; // Gerenciar dados da empresa
  canManageFinancial: boolean; // Gerenciar financeiro
  canManageEmployees: boolean; // Gerenciar funcionários
  canViewReports: boolean; // Ver relatórios
  canManageServices: boolean; // Gerenciar serviços/produtos
}

export interface CreateCompanyInput {
  cnpj: string;
  companyName?: string; // Se não fornecido, busca da Receita Federal
  tradeName?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  role: CompanyUserRole;
  roleDescription?: string;
  permissions?: Partial<CompanyPermissions>;
  isPrimary?: boolean;
  fetchFromRevenue?: boolean; // Se true, busca dados da Receita Federal
}

export interface UpdateCompanyInput {
  cnpj?: string; // 🔴 Só pode ser editado se company_status != 'validated'
  companyName?: string;
  tradeName?: string;
  registrationDate?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  status?: 'active' | 'inactive' | 'suspended' | 'closed';
  companyStatus?: CompanyStatus;
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
