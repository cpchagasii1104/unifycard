// src/core/companies/company-members.types.ts
// Tipos para COMPANY MEMBERS (Base Estrutural)
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Funcionários são actors CPF independentes
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário

import type { DelegationRelationshipType } from '@core/actor-delegation/actor-delegation.repository';

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
  INVITED = 'invited',    // Convidado (aguardando aceite)
  SUSPENDED = 'suspended', // Suspenso
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

/**
 * Input para criar membro
 * 🔴 BLINDAGEM: companyId e actorId são OBRIGATÓRIOS
 */
export interface CreateCompanyMemberInput {
  companyId: string; // OBRIGATÓRIO
  actorId: string; // OBRIGATÓRIO: Actor CPF
  role?: CompanyMemberRole; // Default: 'staff'
  status?: CompanyMemberStatus; // Default: 'invited'
  metadata?: Record<string, any>;
  // R2 FIX (RN2/R2.2, auditoria normativa Yala): VÍNCULO JURÍDICO explícito (eixo D2 separado do `role`
  // operacional). Quando o gestor declara o vínculo real (sócio/diretor/procurador/representante legal),
  // ele vem GOVERNADO por aqui e é escrito na delegação — em vez de ser ADIVINHADO 1:1 do role (que só
  // alcançava administrator/employee/contractor e deixava owner→null + 4 valores mortos). É DADO (o gestor
  // declara o fato), não autoridade — a autoridade segue canManageCompany + canRepresentActor. Opcional:
  // se ausente, cai no fallback derivado do role (compat). Valor validado pelo CHECK do banco.
  relationshipType?: DelegationRelationshipType | null;
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
 * Filtros para busca de membros
 */
export interface CompanyMemberFilters {
  companyId?: string;
  actorId?: string;
  role?: CompanyMemberRole;
  status?: CompanyMemberStatus;
}



