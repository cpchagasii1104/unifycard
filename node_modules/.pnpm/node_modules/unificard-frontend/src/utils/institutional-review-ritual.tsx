// frontend/src/utils/institutional-review-ritual.ts
// SPRINT 24: Ritual de Revisão Institucional
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: Leitura Institucional
// PÚBLICO PERMITIDO: Apenas admin em modo piloto
// 
// ❌ NÃO USAR FORA DO CONTEXTO DE LEITURA
// ❌ NÃO importar em componentes de ação
// ❌ NÃO importar em handlers de execução
// ❌ NÃO importar em fluxos de usuário final
// 
// ✅ USAR APENAS em:
//    - Painel admin de leitura institucional
//    - Componentes de visualização de ritual
//    - Ferramentas de interpretação humana
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Ritual de Revisão Institucional
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Ritual de revisão institucional
// - Marco simbólico de momento de leitura e reflexão
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-reading-principles.ts (usa conceito de ritual)
// 
// Para qualquer necessidade de ritual de revisão, use este arquivo.
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
// ESCOPO DE DECISÃO (SPRINT 32)
// ═══════════════════════════════════════════════════════════════
// Decisões relacionadas a este contexto (ritual de revisão)
// devem declarar seu escopo em:
// INSTITUTIONAL_DECISION_SCOPE.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// TENSÃO INSTITUCIONAL (SPRINT 33)
// ═══════════════════════════════════════════════════════════════
// Decisões neste contexto podem coexistir em tensão declarada.
// Ver: INSTITUTIONAL_DECISION_TENSIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// NÃO-DECISÃO DECLARADA (SPRINT 34)
// ═══════════════════════════════════════════════════════════════
// A ausência de decisão neste ponto pode ser registrada explicitamente.
// Ver: INSTITUTIONAL_NON_DECISIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CONTINUIDADE SEM CONSENSO (SPRINT 35)
// ═══════════════════════════════════════════════════════════════
// A permanência deste elemento não implica acordo ou aceitação institucional.
// Ver: INSTITUTIONAL_CONTINUITY_WITHOUT_CONSENSUS.md
// ═══════════════════════════════════════════════════════════════
// Torna explícito quando o sistema está em um momento de leitura e reflexão

/**
 * TEXTOS DO RITUAL DE REVISÃO
 * Textos neutros, não diretivos, não avaliativos
 */
export const REVIEW_RITUAL_TEXTS = {
  moment: 'Este é um momento de leitura institucional.',
  noAction: 'Nenhuma ação é esperada neste estágio.',
  precedes: 'Leitura antecede qualquer decisão futura.',
  general: 'Este é um momento de leitura institucional.',
} as const;

/**
 * Função auxiliar para obter texto do ritual
 */
export function getReviewRitualText(
  type: keyof typeof REVIEW_RITUAL_TEXTS = 'general'
): string {
  return REVIEW_RITUAL_TEXTS[type];
}

/**
 * Componente de Ritual de Revisão Institucional
 * Marca simbólica explícita de momento de leitura
 * APENAS para operadores humanos no painel admin
 */
export function InstitutionalReviewRitual() {
  return (
    <div style={{
      padding: '1rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      marginTop: '1rem',
      borderLeft: '4px solid #999',
    }}>
      <p style={{
        fontSize: '0.9rem',
        color: '#666',
        fontStyle: 'italic',
        margin: '0.5rem 0',
        lineHeight: '1.6',
      }}>
        {getReviewRitualText('moment')}
      </p>
      <p style={{
        fontSize: '0.85rem',
        color: '#999',
        fontStyle: 'italic',
        margin: '0.5rem 0',
        lineHeight: '1.5',
      }}>
        {getReviewRitualText('noAction')}
      </p>
      <p style={{
        fontSize: '0.85rem',
        color: '#999',
        fontStyle: 'italic',
        margin: '0.5rem 0 0 0',
        lineHeight: '1.5',
      }}>
        {getReviewRitualText('precedes')}
      </p>
    </div>
  );
}

