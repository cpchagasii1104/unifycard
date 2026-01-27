// frontend/src/utils/functioning-evidence.ts
// SPRINT 21: Evidência de Funcionamento
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Evidência de Funcionamento
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Evidência de funcionamento (confirmações passivas)
// - Sinais de coerência
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-pulse.ts (usa conceito de evidência)
// 
// Para qualquer necessidade de evidência, use este arquivo.
// 
// ═══════════════════════════════════════════════════════════════
// EVOLUÇÃO CONCEITUAL (SPRINT 31)
// ═══════════════════════════════════════════════════════════════
// Este conceito pode evoluir ao longo do tempo.
// Mudanças de significado devem ser registradas em:
// INSTITUTIONAL_CONCEPT_EVOLUTIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: UI (Interface de Usuário)
// PÚBLICO PERMITIDO: Usuários finais, admin, piloto
// 
// ✅ PODE SER USADO em:
//    - Componentes de ação
//    - Handlers de execução
//    - Fluxos de usuário final
//    - Qualquer componente de UI
// 
// ✅ ESTRUTURA OPERACIONAL - Não é apenas leitura
// ═══════════════════════════════════════════════════════════════
// SPRINT 21: Evidência de Funcionamento
// Torna visível que o sistema está operando corretamente, sem induzir ação ou criar pressão

/**
 * TEXTOS DE CONFIRMAÇÃO PASSIVA
 * Textos informativos discretos após ações executadas
 */
export const PASSIVE_CONFIRMATION_TEXTS = {
  transaction: 'Esta ação foi registrada pelo sistema.',
  delegation: 'Esta delegação foi processada corretamente.',
  dispute: 'Esta resolução foi registrada pelo sistema.',
  workflow: 'Este evento foi processado corretamente.',
  general: 'Esta ação foi registrada pelo sistema.',
} as const;

/**
 * TEXTOS DE SINAIS DE COERÊNCIA
 * Indicações discretas de consistência e funcionamento correto
 */
export const COHERENCE_SIGNALS = {
  consistent: 'Estado consistente.',
  noConflicts: 'Sem conflitos registrados.',
  processed: 'Processado conforme regras vigentes.',
  verified: 'Verificado pelo sistema.',
  general: 'Estado consistente.',
} as const;

/**
 * Função auxiliar para obter texto de confirmação passiva
 */
export function getPassiveConfirmation(
  type: keyof typeof PASSIVE_CONFIRMATION_TEXTS = 'general'
): string {
  return PASSIVE_CONFIRMATION_TEXTS[type];
}

/**
 * Função auxiliar para obter sinal de coerência
 */
export function getCoherenceSignal(
  type: keyof typeof COHERENCE_SIGNALS = 'general'
): string {
  return COHERENCE_SIGNALS[type];
}

/**
 * Componente de confirmação passiva
 * Exibe texto discreto após ação executada
 */
export function PassiveConfirmation({ 
  type = 'general',
  show = true 
}: { 
  type?: keyof typeof PASSIVE_CONFIRMATION_TEXTS;
  show?: boolean;
}) {
  if (!show) return null;

  return (
    <p style={{
      fontSize: '0.8rem',
      color: '#999',
      fontStyle: 'italic',
      marginTop: '0.5rem',
      padding: '0.5rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
    }}>
      {getPassiveConfirmation(type)}
    </p>
  );
}

/**
 * Componente de sinal de coerência
 * Exibe indicação discreta de consistência
 */
export function CoherenceSignal({ 
  type = 'general',
  show = true 
}: { 
  type?: keyof typeof COHERENCE_SIGNALS;
  show?: boolean;
}) {
  if (!show) return null;

  return (
    <p style={{
      fontSize: '0.75rem',
      color: '#999',
      fontStyle: 'italic',
      marginTop: '0.25rem',
    }}>
      {getCoherenceSignal(type)}
    </p>
  );
}

/**
 * Componente combinado para rodapé informativo
 * Usado em detalhes, modais e após ações
 */
export function FunctioningEvidenceFooter({
  confirmationType,
  coherenceType,
  showConfirmation = true,
  showCoherence = true,
}: {
  confirmationType?: keyof typeof PASSIVE_CONFIRMATION_TEXTS;
  coherenceType?: keyof typeof COHERENCE_SIGNALS;
  showConfirmation?: boolean;
  showCoherence?: boolean;
}) {
  return (
    <div style={{
      marginTop: '1rem',
      paddingTop: '1rem',
      borderTop: '1px solid #e0e0e0',
    }}>
      {showConfirmation && (
        <PassiveConfirmation type={confirmationType || 'general'} />
      )}
      {showCoherence && (
        <CoherenceSignal type={coherenceType || 'general'} />
      )}
    </div>
  );
}

