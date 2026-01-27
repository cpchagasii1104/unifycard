// backend/src/core/ai/tasks/tasks.service.ts
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStep, StartTaskRequest } from './tasks.types';
import { approvalService } from '../approval/approval.service';

// Armazenamento em memória (simples para MVP)
const tasks: Map<string, Task> = new Map();

class TasksService {
  // Criar nova task
  createTask(userId: string, tenantId: string, request: StartTaskRequest): Task {
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task: Task = {
      taskId,
      userId,
      tenantId,
      goal: request.goal,
      maxSteps: request.maxSteps || 5,
      currentStep: 0,
      status: 'pending',
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    tasks.set(taskId, task);
    return task;
  }

  // Buscar task por ID
  getTask(taskId: string, userId: string, tenantId: string): Task | null {
    const task = tasks.get(taskId);
    
    if (!task) {
      return null;
    }

    if (task.userId !== userId || task.tenantId !== tenantId) {
      return null;
    }

    return task;
  }

  // Executar um passo da task
  async executeStep(taskId: string, userId: string, tenantId: string): Promise<{
    stepResult: string;
    status: string;
    waitingApproval?: { token: string; action: string };
  }> {
    const task = this.getTask(taskId, userId, tenantId);
    
    if (!task) {
      throw new Error('Task não encontrada');
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      throw new Error(`Task está ${task.status}`);
    }

    if (task.currentStep >= task.maxSteps) {
      task.status = 'completed';
      task.updatedAt = new Date().toISOString();
      tasks.set(taskId, task);
      return {
        stepResult: 'Task completada: limite de passos atingido',
        status: task.status,
      };
    }

    // Marcar como running
    task.status = 'running';
    task.currentStep += 1;
    task.updatedAt = new Date().toISOString();

    try {
      // Gerar estratégia baseada no goal
      const strategy = this.generateStrategyForGoal(task.goal, task.currentStep, task.history);

      // Determinar se precisa de aprovação
      const requiresApproval = this.requiresApproval(strategy.action);

      let approvalToken: string | undefined;
      if (requiresApproval) {
        // Criar solicitação de aprovação
        const approval = approvalService.createApproval(userId, tenantId, {
          action: strategy.action,
          payload: strategy.payload || {},
          description: strategy.description,
        });
        approvalToken = approval.token;
        task.status = 'waiting_approval';
      }

      // Registrar passo no histórico
      const step: TaskStep = {
        stepNumber: task.currentStep,
        action: strategy.action,
        result: strategy.result,
        requiresApproval,
        approvalToken,
        timestamp: new Date().toISOString(),
      };

      task.history.push(step);

      // Atualizar status se não está esperando aprovação
      if (!requiresApproval) {
        if (task.currentStep >= task.maxSteps) {
          task.status = 'completed';
        } else {
          task.status = 'pending';
        }
      }

      task.updatedAt = new Date().toISOString();
      tasks.set(taskId, task);

      return {
        stepResult: strategy.result,
        status: task.status,
        waitingApproval: approvalToken ? { token: approvalToken, action: strategy.action } : undefined,
      };
    } catch (error: any) {
      task.status = 'failed';
      task.updatedAt = new Date().toISOString();
      tasks.set(taskId, task);
      throw error;
    }
  }

  // Gerar estratégia para o goal (mock - em produção usar LLM)
  private generateStrategyForGoal(goal: string, stepNumber: number, history: TaskStep[]): {
    action: string;
    result: string;
    description?: string;
    payload?: Record<string, any>;
  } {
    // Mock simples baseado no step
    if (stepNumber === 1) {
      return {
        action: 'analyze',
        result: `Passo ${stepNumber}: Analisando objetivo "${goal}"`,
        description: 'Análise inicial do objetivo',
      };
    } else if (stepNumber === 2) {
      return {
        action: 'read_files',
        result: `Passo ${stepNumber}: Identificando arquivos relevantes`,
        description: 'Leitura de arquivos do projeto',
        payload: { filePath: 'backend/src/server.ts' },
      };
    } else {
      return {
        action: 'suggest',
        result: `Passo ${stepNumber}: Sugerindo implementação`,
        description: 'Geração de sugestão',
      };
    }
  }

  // Verificar se ação requer aprovação
  private requiresApproval(action: string): boolean {
    const actionsRequiringApproval = [
      'apply_patch',
      'patch',
      'install_package',
      'install',
      'write_file',
      'delete_file',
    ];

    return actionsRequiringApproval.includes(action);
  }

  // Cancelar task
  cancelTask(taskId: string, userId: string, tenantId: string): Task | null {
    const task = this.getTask(taskId, userId, tenantId);
    
    if (!task) {
      return null;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task;
    }

    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();
    tasks.set(taskId, task);

    return task;
  }
}

export const tasksService = new TasksService();

