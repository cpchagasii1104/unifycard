// frontend/src/utils/institutional-reading-principles.ts
// SPRINT 25: Quadro de Leitura Institucional Compartilhada
// Estabelece limites explícitos sobre COMO o sistema deve ser lido por operadores humanos
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Leitura Institucional
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Princípios de leitura institucional
// - Limites cognitivos sobre como ler o sistema
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-rhythm.ts (usa conceito de leitura)
// - institutional-review-ritual.ts (usa conceito de leitura)
// - institutional-semantic-alignment.tsx (usa conceito de leitura)
// 
// Para qualquer necessidade de leitura institucional, use este arquivo.
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
// Decisões relacionadas a este contexto (leitura institucional)
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
//    - Componentes de visualização de princípios
//    - Ferramentas de interpretação humana
// ═══════════════════════════════════════════════════════════════

/**
 * PRINCÍPIOS DE LEITURA INSTITUCIONAL
 * Textos curtos, declarativos, neutros, não normativos, não avaliativos
 */
export const READING_PRINCIPLES = [
  'Leitura não implica decisão.',
  'Padrões observados não são causas.',
  'Ausência de sinal não indica falha.',
  'Ritmo não define sucesso ou fracasso.',
  'Toda leitura é parcial por definição.',
] as const;

/**
 * Componente de Quadro de Leitura Institucional Compartilhada
 * Estabelece limites cognitivos explícitos sobre como ler o sistema
 * APENAS para operadores humanos no painel admin
 */
export function InstitutionalReadingFrame() {
  return (
    <div style={{
      padding: '1.25rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      marginTop: '1rem',
      borderLeft: '4px solid #666',
    }}>
      <h3 style={{
        fontSize: '1rem',
        margin: '0 0 1rem 0',
        color: '#1a1a1a',
        fontWeight: 600,
      }}>
        Princípios de Leitura Institucional
      </h3>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        {READING_PRINCIPLES.map((principle, index) => (
          <p
            key={index}
            style={{
              fontSize: '0.9rem',
              color: '#666',
              fontStyle: 'italic',
              margin: 0,
              lineHeight: '1.6',
              paddingLeft: '1rem',
              position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute',
              left: 0,
              color: '#999',
            }}>
              •
            </span>
            {principle}
          </p>
        ))}
      </div>
    </div>
  );
}

