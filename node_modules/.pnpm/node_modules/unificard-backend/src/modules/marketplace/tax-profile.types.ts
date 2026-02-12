// backend/src/modules/marketplace/tax-profile.types.ts
// SPRINT 80: FISCAL REAL POR REGIME TRIBUTÁRIO

/**
 * Regime tributário
 * 
 * Nota: Reutiliza enum de company_profiles, mas com SIMPLES adicionado
 */
export type TaxRegime = 'MEI' | 'SIMPLES' | 'PRESUMIDO' | 'REAL';

/**
 * Perfil fiscal
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Regime tributário ≠ cálculo automático
 * - Regime tributário ≠ pagamento
 * - Regime tributário influencia:
 *   - Tipo de documento fiscal permitido
 *   - Campos obrigatórios
 *   - Validações futuras
 * - Nenhum imposto é calculado
 * - Nenhuma alíquota aplicada
 */
export interface TaxProfile {
  id: string;
  tenantId: string;
  companyProfileTenantId: string;
  taxRegime: TaxRegime;
  state: string | null; // UF
  city: string | null;
  isIcmsContributor: boolean;
  isServiceProvider: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar/atualizar perfil fiscal
 */
export interface SetTaxProfileInput {
  taxRegime: TaxRegime;
  state?: string; // UF
  city?: string;
  isIcmsContributor?: boolean;
  isServiceProvider?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Tipos de documento fiscal permitidos por regime
 * 
 * Nota: Usa tipos existentes do sistema (NFCE, NFE, SAT, NONE)
 * NFS-e será adicionado em sprint futura
 */
export const ALLOWED_DOCUMENT_TYPES_BY_REGIME: Record<TaxRegime, string[]> = {
  MEI: ['NFCE', 'NONE'], // NFC-e (NFS-e será adicionado futuramente)
  SIMPLES: ['NFCE', 'NFE', 'NONE'], // NFC-e, NF-e (NFS-e será adicionado futuramente)
  PRESUMIDO: ['NFE', 'NONE'], // NF-e (NFS-e será adicionado futuramente)
  REAL: ['NFE', 'NONE'], // NF-e completa (NFS-e será adicionado futuramente)
};


