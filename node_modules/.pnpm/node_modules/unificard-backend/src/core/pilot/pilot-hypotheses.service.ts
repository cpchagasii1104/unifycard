// backend/src/core/pilot/pilot-hypotheses.service.ts
// SPRINT 16: Service para hipóteses de interpretação humana

import { pilotHypothesesRepository, type PilotHypothesis, type CreateHypothesisInput } from './pilot-hypotheses.repository';

/**
 * Verifica se modo piloto está ativo
 */
function isPilotMode(): boolean {
  return process.env.PILOT_MODE === 'true';
}

class PilotHypothesesService {
  /**
   * Cria uma hipótese
   */
  async createHypothesis(
    tenantId: string,
    input: CreateHypothesisInput,
    createdByUserId: string
  ): Promise<PilotHypothesis> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotHypothesesRepository.create(tenantId, input, createdByUserId);
  }

  /**
   * Lista hipóteses
   */
  async listHypotheses(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PilotHypothesis[]> {
    if (!isPilotMode()) {
      return [];
    }

    return await pilotHypothesesRepository.list(tenantId, options);
  }

  /**
   * Deleta uma hipótese
   */
  async deleteHypothesis(
    tenantId: string,
    hypothesisId: string
  ): Promise<boolean> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotHypothesesRepository.delete(tenantId, hypothesisId);
  }
}

export const pilotHypothesesService = new PilotHypothesesService();







