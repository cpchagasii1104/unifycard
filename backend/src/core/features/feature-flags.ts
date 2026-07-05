// backend/src/core/features/feature-flags.ts
// Feature Flags - Infra apenas, sem mudar domínio
// 🔴 BLINDAGEM: Fail-closed para permissões; fail-open apenas onde documentado

/**
 * Feature Flags disponíveis
 */
// 🔴 F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX (2ª rodada da auditoria Yala, 2026-07-05):
// 'FEATURE_FINANCIAL_ENABLED' foi REMOVIDA deste union de propósito. `isFeatureEnabled` (abaixo) é
// fail-OPEN por padrão — correto pras 3 flags não-financeiras que restam, ERRADO pra dinheiro.
// Removê-la do union fecha em tempo de COMPILAÇÃO a porta que a 1ª correção só fechou em
// runtime: código futuro não consegue mais chamar `isFeatureEnabled('FEATURE_FINANCIAL_ENABLED')`
// e obter fail-open por engano — só `isFinancialEnabled()` (fail-closed real) resolve essa flag.
export type FeatureFlag =
  | 'FEATURE_RFQ_ENABLED'
  | 'FEATURE_BUNDLES_ENABLED'
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
 * Verifica se Financeiro está habilitado.
 *
 * 🔴 F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX (achado colateral da auditoria Yala do
 * decision pack PORTA-1, 2026-07-05): ao contrário das outras 3 flags deste arquivo (RFQ/
 * Bundles/Messaging, legitimamente fail-OPEN por padrão — não são domínio financeiro), esta
 * NÃO delega a `isFeatureEnabled` (que retorna `true` quando a env var está ausente). O único
 * caller (`POST /service-orders/:id/confirm-financial-terms`) grava `bank_splits` DIRETO — o
 * comentário da rota já declarava "atrás de isFinancialEnabled() → 503, inalcançável por ora",
 * mas essa premissa era FALSA (o flag ligava sozinho sem `FEATURE_FINANCIAL_ENABLED` no
 * ambiente; a superfície só não escrevia porque um `transactionId` fictício não-UUID batia em
 * 22P02 antes do INSERT — contenção por acidente de tipo, não por design). Fail-closed real:
 * exige `FEATURE_FINANCIAL_ENABLED=true` EXATO pra habilitar.
 */
export function isFinancialEnabled(): boolean {
  return process.env.FEATURE_FINANCIAL_ENABLED === 'true';
}

/**
 * Verifica se Mensageria está habilitada
 */
export function isMessagingEnabled(): boolean {
  return isFeatureEnabled('FEATURE_MESSAGING_ENABLED');
}

