// frontend/src/utils/institutional-pulse.ts
// SPRINT 22: Pulso Institucional
// Torna visível que o sistema continua em operação mesmo quando não há ações recentes
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Silêncio Institucional / Pulso Institucional
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Silêncio institucional (ausência de eventos não indica ausência de funcionamento)
// - Pulso institucional (sinal de vida temporal)
// 
// Arquivos relacionados que USAM este conceito:
// - temporal-state.ts (usa conceito de silêncio em estados vazios)
// - functioning-evidence.ts (usa conceito de pulso)
// 
// Para qualquer necessidade de silêncio/pulso, use este arquivo.
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
// NOTA: Este utilitário é usado em componentes de UI de usuário final
// para indicar que o sistema está operacional, mesmo em estados vazios.
// ═══════════════════════════════════════════════════════════════

/**
 * TEXTOS DE PULSO INSTITUCIONAL
 * Textos discretos que indicam que o sistema está em operação contínua
 */
export const INSTITUTIONAL_PULSE_TEXTS = {
  continuous: 'Sistema em operação contínua.',
  noInconsistencies: 'Nenhuma inconsistência detectada até o momento.',
  verified: 'Sistema verificado e operacional.',
  general: 'Sistema em operação contínua.',
} as const;

/**
 * Função auxiliar para obter texto de pulso institucional
 */
export function getInstitutionalPulse(
  type: keyof typeof INSTITUTIONAL_PULSE_TEXTS = 'general'
): string {
  return INSTITUTIONAL_PULSE_TEXTS[type];
}

/**
 * Formata data simples (DD/MM) sem frequência explícita
 */
export function formatSimpleDate(date?: Date | string): string {
  if (!date) {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  }
  
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Componente de pulso institucional
 * Exibe texto discreto em estados vazios/ausência
 */
export function InstitutionalPulse({ 
  type = 'general',
  showLastCheck = false,
  lastCheckDate,
  show = true 
}: { 
  type?: keyof typeof INSTITUTIONAL_PULSE_TEXTS;
  showLastCheck?: boolean;
  lastCheckDate?: Date | string;
  show?: boolean;
}) {
  if (!show) return null;

  return (
    <div style={{
      marginTop: '1rem',
      padding: '0.75rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
    }}>
      <p style={{
        fontSize: '0.85rem',
        color: '#999',
        fontStyle: 'italic',
        margin: 0,
        lineHeight: '1.4',
      }}>
        {getInstitutionalPulse(type)}
      </p>
      {showLastCheck && lastCheckDate && (
        <p style={{
          fontSize: '0.75rem',
          color: '#bbb',
          fontStyle: 'italic',
          marginTop: '0.5rem',
          margin: '0.5rem 0 0 0',
        }}>
          Última verificação automática: {formatSimpleDate(lastCheckDate)}
        </p>
      )}
    </div>
  );
}

