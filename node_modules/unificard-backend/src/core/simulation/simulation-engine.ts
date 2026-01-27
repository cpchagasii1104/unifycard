// src/core/simulation/simulation-engine.ts
// Engine de simulação - função pura e determinística

import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
import type { SimulationRules, SimulationResult } from './simulation.types';
import { v4 as uuidv4 } from 'uuid';
import { policyRegistry } from '../policy/policy-registry';
import { policyResolutionEngine } from '../policy-resolution/policy-resolution-engine';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';
import { decisionLogService } from '../decision-log/decision-log.service';

/**
 * Engine de simulação - função pura e determinística
 * Recebe eventos e regras, retorna resultado
 */
export class SimulationEngine {
  /**
   * Simula split regional alternativo
   * Calcula quanto o fundo teria acumulado com percentual diferente
   */
  async simulateRegionalSplit(
    events: CanonicalEvent[],
    rules: SimulationRules,
    period: { start: string; end: string },
    context?: PolicyContext
  ): Promise<SimulationResult> {
    // Resolver política com contexto (se fornecido)
    let actualPercentage: number;
    
    if (context) {
      const resolution = await policyResolutionEngine.resolvePolicy(
        'economy',
        'regional_split_percentage',
        context
      );
      actualPercentage = resolution?.resolvedValue || 0.10;
    } else {
      // Fallback para política estática
      actualPercentage = policyRegistry.getPolicyValue<number>(
        'economy',
        'regional_split_percentage',
        0.10
      ) || 0.10;
    }

    // Filtrar apenas eventos de pagamento processado
    const paymentEvents = events.filter(
      (e) => e.eventType === 'payment.processed' && e.amount !== undefined
    );

    // Calcular valor atual (lê da policy)
    const actualValue = paymentEvents.reduce((sum, event) => {
      const amount = event.amount || 0;
      const regionalSplit = amount * actualPercentage;
      return sum + regionalSplit;
    }, 0);

    // Calcular valor simulado (percentual alternativo)
    // Se não fornecido nas regras, usar policy de simulação ou fallback explícito
    const simulatedPercentage = rules.regionalSplitPercentage || 
      policyRegistry.getPolicyValue<number>(
        'simulation',
        'alternative_regional_split_percentage',
        0.15 // Fallback explícito: 15% como valor padrão de simulação
      ) || 0.15;
    const simulatedValue = paymentEvents.reduce((sum, event) => {
      const amount = event.amount || 0;
      const regionalSplit = amount * simulatedPercentage;
      return sum + regionalSplit;
    }, 0);

    // Calcular delta e percentual de mudança
    const delta = simulatedValue - actualValue;
    const percentageChange = actualValue > 0 ? (delta / actualValue) * 100 : 0;

    const result: SimulationResult = {
      simulationId: uuidv4(),
      simulationType: 'regional_split_alternative',
      rules,
      actualValue,
      simulatedValue,
      delta,
      percentageChange,
      eventCount: paymentEvents.length,
      period,
      metadata: {
        originalPercentage: actualPercentage,
        simulatedPercentage,
        currency: paymentEvents[0]?.currency || 'BRL',
      },
    };

    // Registrar observação no decision log
    try {
      await decisionLogService.createObservation(
        'economy',
        'regional_split_percentage',
        (context || {}) as { [key: string]: unknown },
        actualPercentage,
        {
          suggestedValue: simulatedPercentage,
          metadata: {
            simulationId: result.simulationId,
            simulationType: result.simulationType,
            actualValue: result.actualValue,
            simulatedValue: result.simulatedValue,
            delta: result.delta,
            percentageChange: result.percentageChange,
            eventCount: result.eventCount,
            period: result.period,
          },
        }
      );
    } catch (error) {
      // Continuar mesmo se falhar (modo read-only)
      console.warn('[SimulationEngine] Erro ao registrar observação:', error);
    }

    return result;
  }
}

export const simulationEngine = new SimulationEngine();

