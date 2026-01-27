// src/modules/economy/economic-overview.service.ts
// Service do Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
// 🔴 BLINDAGEM: Ele apenas EXIBE o que já aconteceu
// 🔴 BLINDAGEM: isto NÃO é banco
// 🔴 BLINDAGEM: isto NÃO é carteira
// 🔴 BLINDAGEM: isto NÃO é saldo
// 🔴 BLINDAGEM: isto é apenas visualização histórica

import { economicOverviewProjector } from './economic-overview.projector';
import { actorRepository } from '@modules/social/actor.repository';
import { BadRequestError } from '@core/errors';
import type {
  ActorEconomicOverview,
  GroupEconomicOverview,
} from './economic-overview.types';

class EconomicOverviewService {
  /**
   * Busca overview econômico de um Actor
   * 🔴 BLINDAGEM: Apenas visualização histórica, não cria nada
   * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
   */
  async getActorEconomicOverview(
    tenantId: string,
    actorId: string
  ): Promise<ActorEconomicOverview> {
    // 🔴 BLINDAGEM: Validar que actor existe
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new BadRequestError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Calcular overview a partir de dados históricos
    // Não cria nada, apenas agrega dados existentes
    return await economicOverviewProjector.projectActorEconomicOverview(tenantId, actorId);
  }

  /**
   * Busca overview econômico de um Grupo
   * 🔴 BLINDAGEM: Apenas visualização histórica, não cria nada
   * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
   */
  async getGroupEconomicOverview(
    tenantId: string,
    groupId: string
  ): Promise<GroupEconomicOverview> {
    // 🔴 BLINDAGEM: Validar que grupo existe
    const actor = await actorRepository.findById(tenantId, groupId);
    if (!actor) {
      throw new BadRequestError('Grupo não encontrado');
    }
    if (actor.actor_type !== 'group') {
      throw new BadRequestError('Actor não é um grupo');
    }

    // 🔴 BLINDAGEM: Calcular overview a partir de dados históricos
    // Não cria nada, apenas agrega dados existentes
    return await economicOverviewProjector.projectGroupEconomicOverview(tenantId, groupId);
  }
}

export const economicOverviewService = new EconomicOverviewService();

