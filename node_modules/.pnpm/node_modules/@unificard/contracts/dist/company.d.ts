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
export type CompanyStatus = 'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED';
/**
 * Status operacional de uma empresa.
 */
export type CompanyOperationalStatus = 'active' | 'inactive' | 'suspended' | 'closed';
/**
 * Papel do usuário na empresa.
 */
export type CompanyUserRole = 'owner' | 'partner' | 'director' | 'manager' | 'employee' | 'other';
//# sourceMappingURL=company.d.ts.map