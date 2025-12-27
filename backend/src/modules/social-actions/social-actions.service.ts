// src/modules/social-actions/social-actions.service.ts
import type { FastifyInstance } from 'fastify';
import { SocialActionsRepository } from './social-actions.repository';
import { SocialActionsModel } from './social-actions.model';
import { orchestratorService } from '@core/orchestrator/orchestrator.service';
import { scheduleService } from '../schedule/schedule.service';
import type {
  SocialAction,
  CreateActionInput,
  ExecuteActionResult,
} from './social-actions.types';

class SocialActionsService {
  private repository = new SocialActionsRepository();

  /**
   * Cria uma ação a partir de um post
   */
  async createAction(
    tenantId: string,
    globalUserId: string,
    input: CreateActionInput
  ): Promise<SocialAction> {
    const row = await this.repository.create({
      postId: input.postId,
      tenantId,
      globalUserId,
      intent: input.intent,
      confidence: input.confidence ?? null,
      parameters: input.parameters,
    });

    return SocialActionsModel.fromRow(row);
  }

  /**
   * Busca ação por ID
   */
  async getAction(tenantId: string, actionId: string): Promise<SocialAction | null> {
    const row = await this.repository.findById(tenantId, actionId);
    return row ? SocialActionsModel.fromRow(row) : null;
  }

  /**
   * Busca ações por post
   */
  async getActionsByPost(tenantId: string, postId: string): Promise<SocialAction[]> {
    const rows = await this.repository.findByPost(tenantId, postId);
    return SocialActionsModel.fromRows(rows);
  }

  /**
   * Executa uma ação usando o orchestrator
   */
  async executeAction(
    fastify: FastifyInstance,
    tenantId: string,
    actionId: string,
    userId: string
  ): Promise<ExecuteActionResult> {
    // 1. Buscar ação
    const action = await this.getAction(tenantId, actionId);
    if (!action) {
      throw new Error('Ação não encontrada');
    }

    // 2. Verificar se já foi executada
    if (action.status === 'executed') {
      return {
        success: true,
        actionId: action.actionId,
        intent: action.intent,
        result: action.executionResult,
        executedAt: action.executedAt || new Date(),
      };
    }

    if (action.status === 'cancelled') {
      throw new Error('Ação foi cancelada e não pode ser executada');
    }

    // 3. Verificar se usuário é o dono da ação
    if (action.globalUserId !== userId) {
      throw new Error('Usuário não tem permissão para executar esta ação');
    }

    // 4. Executar usando orchestrator
    let executionResult: any = null;
    let error: string | undefined;
    let success = false;

    try {
      // Se intent é schedule_service, integrar com módulo schedule
      if (action.intent === 'schedule_service') {
        const { workerId, serviceId, date, time } = action.parameters;
        
        if (workerId && date && time) {
          // Buscar ou criar agenda do profissional
          const schedule = await scheduleService.getOrCreateUserSchedule(tenantId, workerId);
          
          // Criar slot se necessário ou reservar existente
          const startTime = new Date(`${date}T${time}`);
          const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hora padrão
          
          try {
            // Tentar adicionar e reservar slot
            const slot = await scheduleService.addSlot(tenantId, schedule.scheduleId, {
              startTime,
              endTime,
              status: 'reserved',
            });
            
            // Reservar o slot criado
            await scheduleService.reserveSlot(
              tenantId,
              schedule.scheduleId,
              { slotId: slot.slotId, actionId: actionId },
              action.globalUserId
            );
            
            executionResult = {
              scheduleId: schedule.scheduleId,
              slotId: slot.slotId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              message: 'Agendamento criado com sucesso',
            };
            success = true;
          } catch (slotError) {
            // Se falhar, tentar executar via orchestrator normal
            const result = await orchestratorService.execute(fastify, {
              intent: action.intent as any,
              parameters: action.parameters,
              userId: action.globalUserId,
              tenantId,
            });
            success = result.success;
            executionResult = result.result;
            error = result.error;
          }
        } else {
          // Executar via orchestrator normal
          const result = await orchestratorService.execute(fastify, {
            intent: action.intent as any,
            parameters: action.parameters,
            userId: action.globalUserId,
            tenantId,
          });
          success = result.success;
          executionResult = result.result;
          error = result.error;
        }
      } else {
        // Executar via orchestrator normal
        const result = await orchestratorService.execute(fastify, {
          intent: action.intent as any,
          parameters: action.parameters,
          userId: action.globalUserId,
          tenantId,
        });
        success = result.success;
        executionResult = result.result;
        error = result.error;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Erro desconhecido ao executar';
    }

    // 5. Atualizar ação com resultado
    const status = success ? 'executed' : 'failed';
    await this.repository.updateExecution(
      tenantId,
      actionId,
      status,
      success ? executionResult : { error }
    );

    // 6. Buscar ação atualizada
    const updatedAction = await this.getAction(tenantId, actionId);

    return {
      success,
      actionId: action.actionId,
      intent: action.intent,
      result: executionResult,
      error,
      executedAt: updatedAction?.executedAt || new Date(),
    };
  }

  /**
   * Cancela uma ação
   */
  async cancelAction(tenantId: string, actionId: string, userId: string): Promise<void> {
    const action = await this.getAction(tenantId, actionId);
    if (!action) {
      throw new Error('Ação não encontrada');
    }

    if (action.globalUserId !== userId) {
      throw new Error('Usuário não tem permissão para cancelar esta ação');
    }

    if (action.status === 'executed') {
      throw new Error('Ação já foi executada e não pode ser cancelada');
    }

    await this.repository.updateExecution(tenantId, actionId, 'cancelled', null);
  }
}

export const socialActionsService = new SocialActionsService();

