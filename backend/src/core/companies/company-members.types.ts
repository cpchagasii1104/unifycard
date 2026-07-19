// src/core/companies/company-members.types.ts
// Tipos para COMPANY MEMBERS (Base Estrutural)
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Funcionários são actors CPF independentes
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário


/**
 * Role do Membro da Empresa
 * 🔴 BLINDAGEM: Role é contexto, não decisão
 */
export enum CompanyMemberRole {
  ADMIN = 'admin',        // Administrador
  STAFF = 'staff',        // Funcionário
  CONTRACTOR = 'contractor', // Contratado/Prestador
}

/**
 * Status do Membro da Empresa
 * 🔴 BLINDAGEM: Status é estado, não decisão
 */
export enum CompanyMemberStatus {
  ACTIVE = 'active',      // Ativo
  SUSPENDED = 'suspended', // Suspenso (congela grants; status nega autoridade)
  REVOKED = 'revoked',    // Revogado (DECISION-0189: revogação LÓGICA — DELETE físico condenado; grants zerados; histórico preservado em company_member_events)
  // DECISION-0189 (F4/R17): 'invited' MORREU como estado de membership — convite vive
  // exclusivamente em company_access_invitations (F5).
}

/**
 * Membro da Empresa (entidade de domínio)
 * 🔴 BLINDAGEM: Membro é actor CPF independente associado a uma empresa
 * 🔴 BLINDAGEM: Empresa pode atribuir compromissos, mas NÃO edita agenda pessoal
 */
export interface CompanyMember {
  memberId: string;
  tenantId: string;
  companyId: string; // OBRIGATÓRIO: Empresa
  actorId: string; // OBRIGATÓRIO: Actor CPF (actor_type = 'user')
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Linha do banco de dados (CompanyMemberRow)
 */
export interface CompanyMemberRow {
  member_id: string;
  tenant_id: string;
  company_id: string;
  actor_id: string;
  role: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// DECISION-0189 (F4): CreateCompanyMemberInput MORREU junto com a criação direta de membro
// (R17 — só bootstrap e aceite canônico criam 'active'). O vínculo jurídico é declarado via
// comando governado declareRelationship (casa company_member_relationships), não na criação.

/**
 * Input para atualizar membro
 */
export interface UpdateCompanyMemberInput {
  role?: CompanyMemberRole;
  status?: CompanyMemberStatus;
  metadata?: Record<string, any>;
}

/**
 * Filtros para busca de membros
 */
export interface CompanyMemberFilters {
  companyId?: string;
  actorId?: string;
  role?: CompanyMemberRole;
  status?: CompanyMemberStatus;
}



