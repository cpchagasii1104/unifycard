// backend/src/core/user-group-allocation/user-group-allocation.service.ts
// CONTINUOUS PRODUCTION: Service para alocação de grupos do usuário

import { userGroupAllocationRepository, type CreateUserGroupAllocationInput } from './user-group-allocation.repository';
import { BadRequestError } from '@core/errors';

export interface UserGroupAllocationView {
  groupId: string;
  percentage: number;
}

export interface SetUserGroupAllocationInput {
  allocations: Array<{
    groupId: string;
    percentage: number;
  }>;
}

class UserGroupAllocationService {
  /**
   * Busca alocações do usuário
   * Retorna array vazio se não houver alocações (não lança erro)
   */
  async getUserAllocations(
    tenantId: string,
    userId: string
  ): Promise<UserGroupAllocationView[]> {
    try {
      const allocations = await userGroupAllocationRepository.findByUserId(tenantId, userId);
      
      // Garantir que sempre retornamos um array válido
      if (!Array.isArray(allocations)) {
        return [];
      }
      
      return allocations.map((a) => ({
        groupId: a.groupId,
        percentage: a.percentage,
      }));
    } catch (error) {
      // Em caso de erro (ex: tabela não existe, query falha), retornar array vazio
      // Isso permite que criação de eventos funcione mesmo sem contexto financeiro
      return [];
    }
  }

  /**
   * Define alocações do usuário
   * Validações:
   * - Máximo 3 grupos
   * - Soma de percentuais <= 100%
   * - Percentuais > 0 e <= 100
   */
  async setUserAllocations(
    tenantId: string,
    userId: string,
    input: SetUserGroupAllocationInput
  ): Promise<UserGroupAllocationView[]> {
    const { allocations } = input;

    // Validação 1: Máximo 3 grupos
    if (allocations.length > 3) {
      throw new BadRequestError('Máximo de 3 grupos permitidos');
    }

    // Validação 2: Percentuais válidos
    let totalPercentage = 0;
    for (const alloc of allocations) {
      if (alloc.percentage <= 0 || alloc.percentage > 100) {
        throw new BadRequestError(`Percentual deve estar entre 0 e 100: ${alloc.percentage}`);
      }
      totalPercentage += alloc.percentage;
    }

    // Validação 3: Soma <= 100% (10000 bps)
    if (totalPercentage > 100) {
      throw new BadRequestError(`Soma de percentuais (${totalPercentage}%) excede 100%`);
    }

    // Converter percentuais para basis points (0-10000)
    const allocationsWithBps = allocations.map((a) => ({
      ...a,
      percentageBps: Math.round(a.percentage * 100),
    }));

    // Validação 4: Grupos únicos
    const groupIds = allocations.map((a) => a.groupId);
    const uniqueGroupIds = new Set(groupIds);
    if (groupIds.length !== uniqueGroupIds.size) {
      throw new BadRequestError('Grupos duplicados não são permitidos');
    }

    // Validar que grupos existem (opcional, mas recomendado)
    // Por enquanto, vamos confiar que o frontend valida isso

    // Remover alocações antigas
    await userGroupAllocationRepository.deleteAllByUserId(tenantId, userId);

    // Criar novas alocações
    const created: UserGroupAllocationView[] = [];
    for (const alloc of allocationsWithBps) {
      await userGroupAllocationRepository.upsert(tenantId, {
        userId,
        groupId: alloc.groupId,
        percentage: alloc.percentage / 100, // Converter de bps para decimal
      });
      created.push({
        groupId: alloc.groupId,
        percentage: alloc.percentage / 100,
      });
    }

    return created;
  }
}

export const userGroupAllocationService = new UserGroupAllocationService();








