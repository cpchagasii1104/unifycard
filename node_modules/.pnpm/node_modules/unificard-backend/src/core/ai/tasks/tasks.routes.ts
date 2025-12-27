// backend/src/core/ai/tasks/tasks.routes.ts
import { FastifyPluginAsync } from 'fastify';
import type {
  StartTaskRequest,
  StartTaskResponse,
  StepTaskResponse,
} from './tasks.types';
import { tasksService } from './tasks.service';

const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /ai/tasks/start - Iniciar nova task
  fastify.post<{ Body: StartTaskRequest }>('/start', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { goal, maxSteps } = req.body;

    if (!goal || typeof goal !== 'string') {
      return reply.status(400).send({ error: 'goal é obrigatório e deve ser uma string' });
    }

    try {
      const task = tasksService.createTask(req.user.id, req.tenant.id, {
        goal,
        maxSteps: maxSteps || 5,
      });

      const response: StartTaskResponse = {
        taskId: task.taskId,
        status: task.status,
      };

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar task');
      return reply.status(500).send({ error: 'Erro ao criar task' });
    }
  });

  // POST /ai/tasks/step - Executar um passo
  fastify.post<{ Body: { taskId: string } }>('/step', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { taskId } = req.body;

    if (!taskId || typeof taskId !== 'string') {
      return reply.status(400).send({ error: 'taskId é obrigatório' });
    }

    try {
      const result = await tasksService.executeStep(taskId, req.user.id, req.tenant.id);
      const task = tasksService.getTask(taskId, req.user.id, req.tenant.id);

      if (!task) {
        return reply.status(404).send({ error: 'Task não encontrada' });
      }

      const response: StepTaskResponse = {
        stepResult: result.stepResult,
        status: result.status,
        currentStep: task.currentStep,
        maxSteps: task.maxSteps,
        waitingApproval: result.waitingApproval,
      };

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao executar passo');

      if (error.message.includes('não encontrada') || error.message.includes('está')) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(500).send({ error: 'Erro ao executar passo' });
    }
  });

  // GET /ai/tasks/:taskId - Obter estado da task
  fastify.get<{ Params: { taskId: string } }>('/:taskId', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { taskId } = req.params;

    const task = tasksService.getTask(taskId, req.user.id, req.tenant.id);

    if (!task) {
      return reply.status(404).send({ error: 'Task não encontrada' });
    }

    return reply.send(task);
  });

  // POST /ai/tasks/:taskId/cancel - Cancelar task
  fastify.post<{ Params: { taskId: string } }>('/:taskId/cancel', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { taskId } = req.params;

    const task = tasksService.cancelTask(taskId, req.user.id, req.tenant.id);

    if (!task) {
      return reply.status(404).send({ error: 'Task não encontrada' });
    }

    return reply.send({ task, message: 'Task cancelada' });
  });
};

export default tasksRoutes;


