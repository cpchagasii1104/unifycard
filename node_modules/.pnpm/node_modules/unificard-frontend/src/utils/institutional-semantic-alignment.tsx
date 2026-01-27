// frontend/src/utils/institutional-semantic-alignment.tsx
// SPRINT 27: Alinhamento Semântico Institucional
// Referência semântica interna para termos críticos usados na leitura e memória institucional
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Alinhamento Semântico Institucional
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Alinhamento semântico institucional
// - Referência semântica interna para termos críticos
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-reading-principles.ts (usa conceito de alinhamento)
// 
// Para qualquer necessidade de alinhamento semântico, use este arquivo.
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
// Decisões relacionadas a este contexto (alinhamento semântico)
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
//    - Componentes de visualização de alinhamento semântico
//    - Ferramentas de interpretação humana
// ═══════════════════════════════════════════════════════════════

interface SemanticTerm {
  term: string;
  definition: string;
  usageNote: string;
  nonUsageNote: string;
}

/**
 * TERMOS CRÍTICOS - Referência Semântica Interna
 * Definições curtas, descritivas, neutras, declarativas, não normativas, não avaliativas
 */
const SEMANTIC_TERMS: SemanticTerm[] = [
  {
    term: 'Atividade',
    definition: 'Qualquer evento registrado pelo sistema, sem juízo de valor.',
    usageNote: 'Usamos este termo quando nos referimos a qualquer ação ou evento observado no sistema.',
    nonUsageNote: 'Não usamos este termo para indicar sucesso, falha ou qualidade.',
  },
  {
    term: 'Fricção',
    definition: 'Interrupção ou desvio observado, não necessariamente erro.',
    usageNote: 'Usamos este termo quando observamos que algo não seguiu o fluxo esperado ou houve interrupção.',
    nonUsageNote: 'Não usamos este termo para indicar falha do usuário ou do sistema.',
  },
  {
    term: 'Silêncio',
    definition: 'Ausência de eventos, não ausência de funcionamento.',
    usageNote: 'Usamos este termo quando não há eventos registrados em um período.',
    nonUsageNote: 'Não usamos este termo para indicar que o sistema parou de funcionar.',
  },
  {
    term: 'Ritmo',
    definition: 'Padrão temporal de eventos, sem avaliação de velocidade ou frequência ideal.',
    usageNote: 'Usamos este termo para descrever como eventos se distribuem no tempo.',
    nonUsageNote: 'Não usamos este termo para indicar se o ritmo é adequado ou inadequado.',
  },
  {
    term: 'Leitura',
    definition: 'Processo de interpretação humana de eventos e padrões, sem gerar decisão automática.',
    usageNote: 'Usamos este termo quando operadores humanos interpretam o que observam no sistema.',
    nonUsageNote: 'Não usamos este termo para indicar análise automática ou decisão algorítmica.',
  },
  {
    term: 'Memória Institucional',
    definition: 'Declarações explícitas de aprendizado registradas por operadores humanos.',
    usageNote: 'Usamos este termo para referenciar declarações textuais de aprendizado sobre o piloto.',
    nonUsageNote: 'Não usamos este termo para indicar dados estruturados, métricas ou análises automáticas.',
  },
  {
    term: 'Padrão',
    definition: 'Repetição observada de eventos ou comportamentos, sem inferência de causa.',
    usageNote: 'Usamos este termo quando observamos que algo se repete ao longo do tempo.',
    nonUsageNote: 'Não usamos este termo para indicar que o padrão é causa ou explicação de algo.',
  },
  {
    term: 'Ausência',
    definition: 'Não ocorrência de algo esperado ou possível, sem juízo sobre a razão.',
    usageNote: 'Usamos este termo quando algo não aconteceu, mas poderia ter acontecido.',
    nonUsageNote: 'Não usamos este termo para indicar que a ausência é um problema ou falha.',
  },
  {
    term: 'Estabilidade',
    definition: 'Pouca variação observada, sem avaliação se isso é desejável ou não.',
    usageNote: 'Usamos este termo quando observamos pouca mudança em um período.',
    nonUsageNote: 'Não usamos este termo para indicar se a estabilidade é boa ou ruim.',
  },
  {
    term: 'Observação',
    definition: 'Registro de ocorrência, sem interpretação automática ou inferência.',
    usageNote: 'Usamos este termo quando registramos que algo aconteceu.',
    nonUsageNote: 'Não usamos este termo para indicar que a observação implica ação ou decisão.',
  },
];

/**
 * Componente de Alinhamento Semântico Institucional
 * Exibe referência semântica interna para termos críticos
 * APENAS para operadores humanos no painel admin
 */
export function InstitutionalSemanticAlignment() {
  return (
    <div style={{
      padding: '1.25rem',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      marginTop: '1rem',
    }}>
      <h3 style={{
        fontSize: '1rem',
        margin: '0 0 1rem 0',
        color: '#1a1a1a',
        fontWeight: 600,
      }}>
        Alinhamento Semântico Institucional
      </h3>

      <p style={{
        fontSize: '0.875rem',
        color: '#666',
        margin: '0 0 1.5rem 0',
        fontStyle: 'italic',
        lineHeight: '1.5',
      }}>
        Referência semântica interna para termos críticos usados na leitura e memória institucional.
        Apenas para alinhamento entre operadores, sem gerar validação ou regra.
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        {SEMANTIC_TERMS.map((term, index) => (
          <div
            key={index}
            style={{
              padding: '1rem',
              background: '#fafafa',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
            }}
          >
            <h4 style={{
              fontSize: '0.95rem',
              margin: '0 0 0.5rem 0',
              color: '#1a1a1a',
              fontWeight: 600,
            }}>
              {term.term}
            </h4>

            <p style={{
              fontSize: '0.9rem',
              color: '#333',
              margin: '0 0 0.75rem 0',
              lineHeight: '1.5',
            }}>
              {term.definition}
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: '#666',
            }}>
              <div style={{
                paddingLeft: '1rem',
                borderLeft: '3px solid #007bff',
              }}>
                <strong style={{ color: '#007bff' }}>Uso:</strong>{' '}
                {term.usageNote}
              </div>

              <div style={{
                paddingLeft: '1rem',
                borderLeft: '3px solid #999',
              }}>
                <strong style={{ color: '#999' }}>Não uso:</strong>{' '}
                {term.nonUsageNote}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

