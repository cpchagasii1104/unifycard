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
 *
 * F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH (2026-06-06): este conjunto DEVE ser idêntico ao
 * CHECK vivo `chk_company_users_role_valid` (migration 20260530541000) — `company_users.role IN
 * ('owner','admin','staff','contractor','member')`. O vocabulário anterior
 * (owner/partner/director/manager/employee/other) divergia do banco: só `owner` coincidia, e criar
 * empresa com qualquer outro violava o CHECK (23514). Vocabulário único = o do banco.
 *
 * `role` NÃO é autoridade granular — a autoridade material vive em `company_users.can_manage_*`.
 * Nuance de produto (sócio/diretor/gerente) é texto livre em `roleDescription` (residual: frente de
 * authorized links/delegations). Default do banco = 'member'.
 */
export type CompanyUserRole =
  | 'owner'        // Proprietário / responsável
  | 'admin'        // Administrador (poder de gestão: sócio-administrador / diretor)
  | 'staff'        // Funcionário / equipe
  | 'contractor'   // Prestador / terceiro
  | 'member';      // Membro


























