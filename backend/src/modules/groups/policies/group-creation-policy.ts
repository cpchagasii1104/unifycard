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
   * @param actorId ID do actor (actors.id) do utilizador que deseja criar o grupo
   * @throws ForbiddenError se o limite de criação for atingido
   */
  async canCreateGroup(tenantId: string, actorId: string): Promise<void> {
    const groupsCreated = await groupsRepository.countGroupsCreatedByUser(tenantId, actorId);

    if (groupsCreated >= this.INITIAL_LIMIT) {
      throw new ForbiddenError(
        'Você já criou um grupo. No momento, cada usuário pode criar apenas um grupo.'
      );
    }
  }

  /**
   * Retorna o limite atual de criação de grupos para um usuário.
   * Futuramente, este método pode considerar impacto econômico.
   * 
   * @param tenantId ID do tenant
   * @param actorId ID do actor (actors.id); reservado para evolução da policy
   * @returns Limite atual de criação de grupos
   */
  async getCreationLimit(tenantId: string, _actorId: string): Promise<number> {
    void tenantId;
    void _actorId;
    // v1: Limite fixo de 1 grupo
    // Futuro: Pode considerar impacto econômico dos grupos existentes
    return this.INITIAL_LIMIT;
  }

  /**
   * Retorna quantos grupos o usuário ainda pode criar.
   * 
   * @param tenantId ID do tenant
   * @param actorId ID do actor (actors.id)
   * @returns Número de grupos que ainda podem ser criados
   */
  async getRemainingSlots(tenantId: string, actorId: string): Promise<number> {
    const limit = await this.getCreationLimit(tenantId, actorId);
    const created = await groupsRepository.countGroupsCreatedByUser(tenantId, actorId);
    return Math.max(0, limit - created);
  }
}

export const groupCreationPolicy = new GroupCreationPolicy();