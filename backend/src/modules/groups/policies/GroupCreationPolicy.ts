// src/modules/groups/policies/GroupCreationPolicy.ts
//
// Policy de criação de grupos conforme GROUP_CREATION_POLICY.md
// Regra canônica: Limite inicial de 1 grupo por usuário
// Não depende de regras econômicas (split, ledger, participação)

import { ForbiddenError } from '@core/errors';
import { groupsRepository } from '../groups.repository';

class GroupCreationPolicy {
  /**
   * Limite inicial de criação de grupos por usuário (v1)
   * Conforme GROUP_CREATION_POLICY.md
   */
  private readonly INITIAL_LIMIT = 1;

  /**
   * Verifica se o usuário pode criar um novo grupo.
   * Lança ForbiddenError se o limite for atingido.
   * 
   * @param tenantId ID do tenant
   * @param userId ID do usuário que deseja criar o grupo
   * @throws ForbiddenError se o limite de criação for atingido
   */
  async canCreateGroup(tenantId: string, userId: string): Promise<void> {
    const groupsCreated = await groupsRepository.countGroupsCreatedByUser(tenantId, userId);

    if (groupsCreated >= this.INITIAL_LIMIT) {
      throw new ForbiddenError(
        'Você já criou um grupo. No momento, cada usuário pode criar apenas um grupo.',
        'GROUP_CREATION_LIMIT_REACHED'
      );
    }
  }

  /**
   * Retorna o limite atual de criação de grupos para um usuário.
   * Futuramente, este método pode considerar impacto econômico.
   * 
   * @param tenantId ID do tenant
   * @param userId ID do usuário
   * @returns Limite atual de criação de grupos
   */
  async getCreationLimit(tenantId: string, userId: string): Promise<number> {
    // v1: Limite fixo de 1 grupo
    // Futuro: Pode considerar impacto econômico dos grupos existentes
    return this.INITIAL_LIMIT;
  }

  /**
   * Retorna quantos grupos o usuário ainda pode criar.
   * 
   * @param tenantId ID do tenant
   * @param userId ID do usuário
   * @returns Número de grupos que ainda podem ser criados
   */
  async getRemainingSlots(tenantId: string, userId: string): Promise<number> {
    const limit = await this.getCreationLimit(tenantId, userId);
    const created = await groupsRepository.countGroupsCreatedByUser(tenantId, userId);
    return Math.max(0, limit - created);
  }
}

export const groupCreationPolicy = new GroupCreationPolicy();

