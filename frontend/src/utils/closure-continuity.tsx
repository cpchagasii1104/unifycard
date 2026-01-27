// frontend/src/utils/closure-continuity.ts
// SPRINT 20: Encerramento & Continuidade
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Encerramento / Continuidade / Não-Ação (em encerramento)
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Encerramento explícito (getClosureText)
// - Continuidade declarada (getContinuityText)
// - Memória institucional (getMemoryText)
// 
// Arquivos relacionados que USAM este conceito:
// - temporal-state.ts (usa conceito de encerramento)
// - canonical-language.ts (usa conceito de não-ação)
// 
// Para qualquer necessidade de encerramento/continuidade, use este arquivo.
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
// SPRINT 20: Encerramento & Continuidade
// Torna explícito o que está encerrado, o que é contínuo e o que não exige mais ação

/**
 * TEXTOS DE ENCERRAMENTO EXPLÍCITO
 * Textos curtos, neutros e não celebratórios para fluxos concluídos
 */
export const CLOSURE_TEXTS = {
  workflow: 'Este fluxo foi concluído.',
  dispute: 'Esta solicitação de revisão foi resolvida.',
  invite: 'Este convite foi processado.',
  action: 'Nenhuma ação adicional é esperada neste momento.',
  general: 'Este item foi encerrado.',
} as const;

/**
 * TEXTOS DE CONTINUIDADE DECLARADA
 * Textos informativos para entidades contínuas
 */
export const CONTINUITY_TEXTS = {
  company: 'Este é um estado contínuo.',
  group: 'Este é um estado contínuo.',
  delegation: 'Esta relação é contínua.',
  economy: 'Esta economia é contínua.',
  general: 'Não há conclusão esperada.',
} as const;

/**
 * TEXTOS DE MEMÓRIA INSTITUCIONAL
 * Para itens que já ocorreram e não são mais esperados
 */
export const MEMORY_TEXTS = {
  completed: 'Este item faz parte da memória do sistema.',
  resolved: 'Esta resolução faz parte da memória do sistema.',
  processed: 'Este processamento faz parte da memória do sistema.',
  general: 'Este registro faz parte da memória do sistema.',
} as const;

/**
 * Função auxiliar para obter texto de encerramento
 */
export function getClosureText(
  type: keyof typeof CLOSURE_TEXTS = 'general'
): string {
  return CLOSURE_TEXTS[type];
}

/**
 * Função auxiliar para obter texto de continuidade
 */
export function getContinuityText(
  type: keyof typeof CONTINUITY_TEXTS = 'general'
): string {
  return CONTINUITY_TEXTS[type];
}

/**
 * Função auxiliar para obter texto de memória institucional
 */
export function getMemoryText(
  type: keyof typeof MEMORY_TEXTS = 'general'
): string {
  return MEMORY_TEXTS[type];
}

/**
 * Componente de texto de encerramento
 */
export function ClosureText({ type = 'general' }: { type?: keyof typeof CLOSURE_TEXTS }) {
  return (
    <p style={{
      fontSize: '0.85rem',
      color: '#666',
      fontStyle: 'italic',
      marginTop: '0.5rem',
      padding: '0.5rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
    }}>
      {getClosureText(type)}
    </p>
  );
}

/**
 * Componente de texto de continuidade
 */
export function ContinuityText({ type = 'general' }: { type?: keyof typeof CONTINUITY_TEXTS }) {
  return (
    <p style={{
      fontSize: '0.85rem',
      color: '#666',
      fontStyle: 'italic',
      marginTop: '0.5rem',
      padding: '0.5rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
    }}>
      {getContinuityText(type)}
    </p>
  );
}

/**
 * Componente de texto de memória institucional
 */
export function MemoryText({ type = 'general' }: { type?: keyof typeof MEMORY_TEXTS }) {
  return (
    <p style={{
      fontSize: '0.85rem',
      color: '#999',
      fontStyle: 'italic',
      marginTop: '0.5rem',
    }}>
      {getMemoryText(type)}
    </p>
  );
}

