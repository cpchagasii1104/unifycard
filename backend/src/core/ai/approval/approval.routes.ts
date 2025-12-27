// backend/src/core/ai/approval/approval.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { approvalService } from './approval.service';
import type { ApprovalRequest } from './approval.types';

const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /ai/approval/request - Criar solicitação de aprovação
  fastify.post<{ Body: ApprovalRequest }>('/request', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { action, payload, description } = req.body;

    if (!action) {
      return reply.status(400).send({ error: 'action é obrigatório' });
    }

    const approval = approvalService.createApproval(req.user.id, req.tenant.id, {
      action,
      payload: payload || {},
      description,
    });

    return reply.send({ approval });
  });

  // GET /ai/approval/pending - Listar aprovações pendentes
  fastify.get('/pending', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const pending = approvalService.listPending(req.user.id, req.tenant.id);
    return reply.send({ approvals: pending });
  });

  // POST /ai/approval/approve - Aprovar ação
  fastify.post<{ Body: { token: string } }>('/approve', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { token } = req.body;

    if (!token) {
      return reply.status(400).send({ error: 'token é obrigatório' });
    }

    const approval = approvalService.approve(token, req.user.id, req.tenant.id);

    if (!approval) {
      return reply.status(404).send({ error: 'Aprovação não encontrada, expirada ou inválida' });
    }

    return reply.send({ approval, message: 'Ação aprovada com sucesso' });
  });

  // POST /ai/approval/reject - Rejeitar ação
  fastify.post<{ Body: { token: string } }>('/reject', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { token } = req.body;

    if (!token) {
      return reply.status(400).send({ error: 'token é obrigatório' });
    }

    const approval = approvalService.reject(token, req.user.id, req.tenant.id);

    if (!approval) {
      return reply.status(404).send({ error: 'Aprovação não encontrada, expirada ou inválida' });
    }

    return reply.send({ approval, message: 'Ação rejeitada' });
  });
};

export default approvalRoutes;


