// backend/src/core/features/feature-flags.ts
// Feature Flags - Infra apenas, sem mudar domínio
// 🔴 BLINDAGEM: Fail-closed para permissões; fail-open apenas onde documentado

/**
 * Feature Flags disponíveis
 */
export type FeatureFlag = 
  | 'FEATURE_RFQ_ENABLED'
  | 'FEATURE_BUNDLES_ENABLED'
  | 'FEATURE_FINANCIAL_ENABLED'
  | 'FEATURE_MESSAGING_ENABLED';

/**
 * Verifica se uma feature está habilitada
 * 
 * @param flag - Nome da feature flag
 * @returns true se habilitada, false caso contrário
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const value = process.env[flag];
  
  // Se não definido, usar padrão (habilitado)
  if (value === undefined) {
    return true;
  }
  
  // Converter para boolean
  return value.toLowerCase() === 'true';
}

/**
 * Verifica se RFQ está habilitado
 */
export function isRFQEnabled(): boolean {
  return isFeatureEnabled('FEATURE_RFQ_ENABLED');
}

/**
 * Verifica se Bundles estão habilitados
 */
export function isBundlesEnabled(): boolean {
  return isFeatureEnabled('FEATURE_BUNDLES_ENABLED');
}

/**
 * Verifica se Financeiro está habilitado
 */
export function isFinancialEnabled(): boolean {
  return isFeatureEnabled('FEATURE_FINANCIAL_ENABLED');
}

/**
 * Verifica se Mensageria está habilitada
 */
export function isMessagingEnabled(): boolean {
  return isFeatureEnabled('FEATURE_MESSAGING_ENABLED');
}

