// frontend/src/utils/institutional-rhythm.ts
// SPRINT 23: Ritmo Institucional
// Permite leitura qualitativa do movimento do sistema APENAS para operadores humanos
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Ritmo Institucional
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Ritmo institucional (padrões temporais amplos)
// - Leitura qualitativa do movimento do sistema
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-reading-principles.ts (usa conceito de ritmo)
// 
// Para qualquer necessidade de ritmo, use este arquivo.
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
// Decisões relacionadas a este contexto (ritmo institucional)
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
//    - Componentes de visualização de ritmo
//    - Ferramentas de interpretação humana
// ═══════════════════════════════════════════════════════════════

import type { PilotEvent } from '../api/pilot';

/**
 * PADRÕES TEMPORAIS AMPLOS
 * Classificação qualitativa do ritmo de eventos
 */
export type TemporalPattern = 
  | 'distributed'    // Distribuído ao longo do tempo
  | 'concentrated'   // Concentrado em poucos atores
  | 'sporadic'       // Esporádico
  | 'stable';        // Estável

/**
 * TEXTOS DESCRITIVOS DE RITMO
 * Linguagem qualitativa e descritiva, sem números
 */
export const RHYTHM_DESCRIPTIONS: Record<TemporalPattern, string> = {
  distributed: 'Fluxo distribuído ao longo do tempo.',
  concentrated: 'Atividade concentrada em poucos atores.',
  sporadic: 'Movimento esporádico no sistema.',
  stable: 'Movimento institucional estável.',
};

/**
 * Analisa padrão temporal de eventos
 * Retorna classificação qualitativa baseada em distribuição temporal
 */
export function analyzeTemporalPattern(events: PilotEvent[]): TemporalPattern {
  if (events.length === 0) {
    return 'stable';
  }

  // Ordenar eventos por data
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  // Calcular janelas temporais (sem usar números explícitos)
  const firstEvent = new Date(sortedEvents[0].occurredAt);
  const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].occurredAt);
  const totalSpan = lastEvent.getTime() - firstEvent.getTime();

  // Se todos os eventos estão muito próximos no tempo (concentrado)
  if (totalSpan < 24 * 60 * 60 * 1000) { // menos de 1 dia
    // Verificar se são de poucos atores diferentes
    const uniqueActors = new Set(events.map(e => e.actorId));
    if (uniqueActors.size <= 2) {
      return 'concentrated';
    }
    return 'distributed';
  }

  // Se eventos estão muito espaçados (esporádico)
  if (totalSpan > 7 * 24 * 60 * 60 * 1000) { // mais de 7 dias
    const avgInterval = totalSpan / sortedEvents.length;
    if (avgInterval > 2 * 24 * 60 * 60 * 1000) { // média maior que 2 dias
      return 'sporadic';
    }
  }

  // Se há distribuição razoável ao longo do tempo
  const uniqueActors = new Set(events.map(e => e.actorId));
  if (uniqueActors.size > events.length / 2) {
    return 'distributed';
  }

  // Padrão estável (distribuição moderada)
  return 'stable';
}

/**
 * Analisa padrão de concentração de atores
 * Retorna classificação qualitativa baseada em distribuição de atores
 */
export function analyzeActorDistribution(events: PilotEvent[]): TemporalPattern {
  if (events.length === 0) {
    return 'stable';
  }

  const uniqueActors = new Set(events.map(e => e.actorId));
  const actorCount = uniqueActors.size;
  const eventCount = events.length;

  // Se poucos atores geram muitos eventos (concentrado)
  if (actorCount <= 2 && eventCount > 5) {
    return 'concentrated';
  }

  // Se muitos atores geram poucos eventos cada (distribuído)
  if (actorCount > eventCount / 2) {
    return 'distributed';
  }

  // Se poucos eventos no total (esporádico)
  if (eventCount <= 3) {
    return 'sporadic';
  }

  // Padrão estável
  return 'stable';
}

/**
 * Analisa padrão de variação temporal
 * Retorna classificação qualitativa baseada em variação recente
 */
export function analyzeVariationPattern(events: PilotEvent[]): TemporalPattern {
  if (events.length === 0) {
    return 'stable';
  }

  // Ordenar por data (mais recente primeiro)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  const now = new Date();
  const recentEvents = sortedEvents.filter(
    e => now.getTime() - new Date(e.occurredAt).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  const olderEvents = sortedEvents.filter(
    e => now.getTime() - new Date(e.occurredAt).getTime() >= 7 * 24 * 60 * 60 * 1000
  );

  // Se pouca variação recente (estável)
  if (recentEvents.length === 0 && olderEvents.length > 0) {
    return 'stable';
  }

  // Se muita atividade recente após período quieto (concentrado)
  if (recentEvents.length > olderEvents.length * 2) {
    return 'concentrated';
  }

  // Se atividade esparsa (esporádico)
  if (recentEvents.length <= 2 && olderEvents.length > 0) {
    return 'sporadic';
  }

  // Padrão distribuído
  return 'distributed';
}

/**
 * Obtém descrição qualitativa do ritmo
 */
export function getRhythmDescription(pattern: TemporalPattern): string {
  return RHYTHM_DESCRIPTIONS[pattern];
}

/**
 * Analisa ritmo institucional geral
 * Combina múltiplas análises qualitativas
 */
export function analyzeInstitutionalRhythm(events: PilotEvent[]): {
  temporalPattern: TemporalPattern;
  actorPattern: TemporalPattern;
  variationPattern: TemporalPattern;
  overallDescription: string;
} {
  const temporalPattern = analyzeTemporalPattern(events);
  const actorPattern = analyzeActorDistribution(events);
  const variationPattern = analyzeVariationPattern(events);

  // Descrição geral combinada (qualitativa)
  let overallDescription = 'Movimento institucional observado.';
  
  if (temporalPattern === 'concentrated' || actorPattern === 'concentrated') {
    overallDescription = 'Atividade concentrada em poucos atores.';
  } else if (temporalPattern === 'distributed' && actorPattern === 'distributed') {
    overallDescription = 'Fluxo distribuído ao longo do tempo.';
  } else if (variationPattern === 'sporadic') {
    overallDescription = 'Movimento esporádico no sistema.';
  } else if (variationPattern === 'stable' && temporalPattern === 'stable') {
    overallDescription = 'Pouca variação recente no sistema.';
  }

  return {
    temporalPattern,
    actorPattern,
    variationPattern,
    overallDescription,
  };
}

/**
 * Componente de leitura de ritmo institucional
 * Exibe apenas para operadores humanos no painel admin
 */
export function InstitutionalRhythmReading({ events }: { events: PilotEvent[] }) {
  const rhythm = analyzeInstitutionalRhythm(events);

  return (
    <div style={{
      padding: '1rem',
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      marginTop: '1rem',
    }}>
      <h3 style={{
        fontSize: '1rem',
        margin: '0 0 0.75rem 0',
        color: '#1a1a1a',
        fontWeight: 600,
      }}>
        Ritmo Institucional
      </h3>
      
      <p style={{
        fontSize: '0.9rem',
        color: '#666',
        fontStyle: 'italic',
        margin: '0.5rem 0',
        lineHeight: '1.5',
      }}>
        {rhythm.overallDescription}
      </p>

      <div style={{
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #e0e0e0',
      }}>
        <p style={{
          fontSize: '0.85rem',
          color: '#999',
          margin: '0.25rem 0',
        }}>
          Padrão temporal: {getRhythmDescription(rhythm.temporalPattern)}
        </p>
        <p style={{
          fontSize: '0.85rem',
          color: '#999',
          margin: '0.25rem 0',
        }}>
          Distribuição de atores: {getRhythmDescription(rhythm.actorPattern)}
        </p>
        <p style={{
          fontSize: '0.85rem',
          color: '#999',
          margin: '0.25rem 0',
        }}>
          Variação recente: {getRhythmDescription(rhythm.variationPattern)}
        </p>
      </div>
    </div>
  );
}

