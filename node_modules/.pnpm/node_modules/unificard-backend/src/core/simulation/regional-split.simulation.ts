// src/core/simulation/regional-split.simulation.ts
// Simulação específica: "Se split REGIONAL fosse 15% ao invés de 10%"

import { eventLogSource } from './event-log.source';
import { simulationEngine } from './simulation-engine';
import type { SimulationResult } from './simulation.types';
import { policyRegistry } from '../policy/policy-registry';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';

/**
 * Executa simulação: "Se split REGIONAL fosse 15% ao invés do valor atual,
 * quanto o fundo teria acumulado nos últimos 30 dias?"
 */
export async function simulateRegionalSplit15Percent(
  tenantId: string,
  days: number = 30,
  context?: PolicyContext
): Promise<SimulationResult> {
  // Verificar se simulações são permitidas (policy)
  const simulationAllowed = policyRegistry.getPolicyValue<boolean>(
    'simulation',
    'allowed',
    true
  );

  if (!simulationAllowed) {
    throw new Error('Simulações não são permitidas pela política atual');
  }

  // Calcular período
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Buscar eventos do período
  const events = await eventLogSource.listEvents({
    tenantId,
    sourceModule: 'work',
    eventType: 'work.assignment.paid',
    startDate,
    endDate,
  });

  // Executar simulação (com contexto opcional para resolução dinâmica)
  // Ler percentual alternativo do Policy Registry ou usar fallback explícito
  const alternativePercentage = policyRegistry.getPolicyValue<number>(
    'simulation',
    'alternative_regional_split_percentage',
    0.15 // Fallback explícito: 15% como valor padrão de simulação
  ) || 0.15;
  
  const result = await simulationEngine.simulateRegionalSplit(
    events,
    {
      regionalSplitPercentage: alternativePercentage,
    },
    {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    context // Contexto para resolução dinâmica de políticas
  );

  return result;
}

