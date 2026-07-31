// backend/src/modules/marketplace/unifycard-method.service.ts
// SPRINT 82: Service para UnifyCard Methods

import { unifyCardMethodRepository } from './unifycard-method.repository';
import type { UnifyCardMethod, CreateUnifyCardMethodInput } from './unifycard-method.types';

/**
 * Service para UnifyCard Methods
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Nenhuma integração real
 * - Nenhum dinheiro externo
 * - Apenas modelagem
 * - Tudo auditável
 */
class UnifyCardMethodService {
  /**
   * Cria método de pagamento UnifyCard
   */
  async createMethod(
    tenantId: string,
    input: CreateUnifyCardMethodInput,
    createdByUserId: string
  ): Promise<UnifyCardMethod> {
    const method = await unifyCardMethodRepository.createMethod(tenantId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'UNIFYCARD_METHOD_CREATED',
      methodId: method.id,
      methodType: method.methodType,
      createdByUserId,
    });

    return method;
  }

  /**
   * Lista métodos UnifyCard
   */
  async listMethods(tenantId: string): Promise<UnifyCardMethod[]> {
    return await unifyCardMethodRepository.listMethods(tenantId);
  }

  /**
   * Busca método por tipo
   */
  async getMethodByType(
    tenantId: string,
    methodType: string
  ): Promise<UnifyCardMethod | null> {
    return await unifyCardMethodRepository.getMethodByType(tenantId, methodType);
  }

  /**
   * Resolve taxa para um método
   * 
   * SPRINT 82: Retorna taxa do método ou 0 se não encontrado
   */
  async resolveFee(
    tenantId: string,
    methodType: string
  ): Promise<{ feePercentage: number; settlementDelayDays: number }> {
    const method = await this.getMethodByType(tenantId, methodType);
    
    if (!method) {
      // Se método não encontrado, retornar valores padrão (compatibilidade)
      return {
        feePercentage: 0,
        settlementDelayDays: 0,
      };
    }

    return {
      feePercentage: method.feePercentage,
      settlementDelayDays: method.settlementDelayDays,
    };
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      methodId: string;
      methodType: string;
      createdByUserId: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'INFO',
        actor_id: data.createdByUserId,
        actor_type: 'user',
        source: 'unifycard_method',
        context: {
          method_id: data.methodId,
          method_type: data.methodType,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      console.warn('[UnifyCardMethod] Erro ao registrar auditoria:', error);
    }
  }
}

export const unifyCardMethodService = new UnifyCardMethodService();





