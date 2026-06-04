/**
 * @unificard/contracts - Company
 * 
 * Tipos de domínio para empresas (Pessoa Jurídica).
 * Fonte única de verdade para frontend e backend.
 */

/**
 * Status de lifecycle/onboarding de uma empresa (PJ).
 *
 * ⚠️ NÃO é fonte de verificação fiscal. A verificação PJ tem FONTE ÚNICA em
 * `fiscal_identities.kyb_status` (exposta no payload como `kybStatus`/`isKybApproved`).
 * Ver DECISION-0089/0092/0093.
 *
 * DRAFT: Criada, invisível (não aparece no sistema).
 * PROVISIONAL: Ativa socialmente com limites. Capability social pública (post/voto) e
 *   operação financeira exigem `kyb_status='approved'` (DECISION-0094 / F2-C), NÃO este status.
 * SUSPENDED: Bloqueada (fraude detectada, etc).
 *
 * @deprecated VERIFIED — valor legado/morto: nenhum writer o produz desde a Fase 2
 *   (DECISION-0090/0091). NÃO usar como verificação fiscal — use `kyb_status='approved'`.
 * @deprecated APPROVED — idem VERIFIED (legado/morto, não-fonte).
 */
export type CompanyStatus =
  | 'DRAFT'         // Criada, invisível
  | 'PROVISIONAL'   // Ativa socialmente, com limites (verificação = kyb_status)
  | 'VERIFIED'      // @deprecated legado/morto — NÃO é verificação (use kyb_status)
  | 'APPROVED'      // @deprecated legado/morto — NÃO é verificação (use kyb_status)
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


























