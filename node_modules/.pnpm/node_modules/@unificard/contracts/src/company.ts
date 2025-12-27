/**
 * @unificard/contracts - Company
 * 
 * Tipos de domínio para empresas (Pessoa Jurídica).
 * Fonte única de verdade para frontend e backend.
 */

/**
 * Status do cadastro de uma empresa.
 * Define o estado do processo de validação.
 * 
 * DRAFT: Criada, invisível (não aparece no sistema)
 * PROVISIONAL: Ativa socialmente, com limites (pode postar, não pode votar/fundos)
 * VERIFIED: Validada presencialmente (acesso completo)
 * APPROVED: Plena (futuro - para casos especiais)
 * SUSPENDED: Bloqueada (fraude detectada, etc)
 */
export type CompanyStatus =
  | 'DRAFT'         // Criada, invisível
  | 'PROVISIONAL'   // Ativa socialmente, com limites
  | 'VERIFIED'      // Validada presencialmente
  | 'APPROVED'      // Plena (futuro)
  | 'SUSPENDED';    // Bloqueada

/**
 * Status operacional de uma empresa.
 */
export type CompanyOperationalStatus =
  | 'active'       // Ativa
  | 'inactive'     // Inativa
  | 'suspended'    // Suspensa
  | 'closed';      // Fechada

/**
 * Papel do usuário na empresa.
 */
export type CompanyUserRole =
  | 'owner'        // Proprietário
  | 'partner'      // Sócio
  | 'director'     // Diretor
  | 'manager'      // Gerente
  | 'employee'     // Funcionário
  | 'other';       // Outro













