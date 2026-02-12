// frontend/src/utils/action-nature.ts
// SPRINT 18: Descompressão Sistêmica - Marcação de Natureza das Ações
// Reduz sensação de obrigação, linearidade implícita e expectativa moral
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Natureza da Ação
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Natureza da ação (sugestão, estado, registro, opcional, irreversível)
// - Quebra de linearidade
// - Irreversibilidade
// 
// Arquivos relacionados que USAM este conceito:
// - Componentes de UI que marcam ações
// 
// Para qualquer necessidade de natureza de ação, use este arquivo.
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

/**
 * TIPOS DE NATUREZA DE AÇÃO
 */
export type ActionNature = 
  | 'suggestion'      // Sugestão
  | 'state'           // Estado
  | 'record'          // Registro
  | 'optional'        // Ação opcional
  | 'irreversible';   // Ação irreversível

/**
 * MARCAÇÕES DE NATUREZA
 * Textos curtos e discretos para identificar a natureza de cada ação
 */
export const ACTION_NATURE_LABELS: Record<ActionNature, string> = {
  suggestion: 'Sugestão',
  state: 'Estado',
  record: 'Registro do sistema',
  optional: 'Ação opcional',
  irreversible: 'Registro permanente',
};

/**
 * TEXTO DE QUEBRA DE LINEARIDADE
 * Microtextos para indicar que não há caminho obrigatório
 */
export const LINEARITY_BREAK_TEXTS = {
  workflows: 'Outras ações continuam disponíveis',
  pending: 'Este não é o único caminho',
  suggestions: 'Você pode escolher outras opções',
} as const;

/**
 * TEXTO DE IRREVERSIBILIDADE
 */
export const IRREVERSIBILITY_TEXT = 'Esta ação será registrada permanentemente.';

/**
 * Função auxiliar para obter label de natureza
 */
export function getActionNatureLabel(nature: ActionNature): string {
  return ACTION_NATURE_LABELS[nature];
}

/**
 * Função auxiliar para obter texto de quebra de linearidade
 */
export function getLinearityBreakText(context: keyof typeof LINEARITY_BREAK_TEXTS): string {
  return LINEARITY_BREAK_TEXTS[context];
}

/**
 * Componente de marcação sutil (para uso inline)
 */
export function ActionNatureMarker({ nature }: { nature: ActionNature }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        color: '#999',
        fontStyle: 'italic',
        marginLeft: '0.5rem',
      }}
    >
      {getActionNatureLabel(nature)}
    </span>
  );
}

/**
 * Componente de texto de quebra de linearidade
 */
export function LinearityBreakText({ context }: { context: keyof typeof LINEARITY_BREAK_TEXTS }) {
  return (
    <p
      style={{
        fontSize: '0.85rem',
        color: '#666',
        fontStyle: 'italic',
        marginTop: '0.5rem',
        padding: '0.5rem',
        background: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
      }}
    >
      {getLinearityBreakText(context)}
    </p>
  );
}

/**
 * Componente de marcação de irreversibilidade
 */
export function IrreversibilityMarker() {
  return (
    <p
      style={{
        fontSize: '0.85rem',
        color: '#666',
        marginTop: '0.5rem',
        padding: '0.5rem',
        background: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
      }}
    >
      {IRREVERSIBILITY_TEXT}
    </p>
  );
}

