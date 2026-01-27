// backend/src/core/ai/patch/patch.routes.ts
import { FastifyPluginAsync } from 'fastify';
import type { PatchProposalRequest, PatchProposalResponse } from './patch.types';
import type { ApplyPatchRequest, ApplyPatchResponse } from './patch-apply.types';
import { patchService } from './patch.service';
import { patchApplyService } from './patch-apply.service';
import { approvalService } from '../approval/approval.service';

const patchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: PatchProposalRequest }>('/propose', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { filePath, instructions } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      return reply.status(400).send({ error: 'filePath é obrigatório e deve ser uma string' });
    }

    if (!instructions || typeof instructions !== 'string') {
      return reply.status(400).send({ error: 'instructions é obrigatório e deve ser uma string' });
    }

    try {
      const response: PatchProposalResponse = await patchService.generatePatch(filePath, instructions);

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao gerar patch');

      if (error.message.includes('bloqueado') || error.message.includes('fora da raiz')) {
        return reply.status(403).send({ error: error.message });
      }

      if (error.message.includes('não encontrado')) {
        return reply.status(404).send({ error: error.message });
      }

      return reply.status(500).send({ error: 'Erro ao gerar patch' });
    }
  });

  fastify.post<{ Body: ApplyPatchRequest }>('/apply', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { approvalToken, filePath, diff } = req.body;

    if (!approvalToken || typeof approvalToken !== 'string') {
      return reply.status(400).send({ error: 'approvalToken é obrigatório' });
    }

    if (!filePath || typeof filePath !== 'string') {
      return reply.status(400).send({ error: 'filePath é obrigatório e deve ser uma string' });
    }

    if (!diff || typeof diff !== 'string') {
      return reply.status(400).send({ error: 'diff é obrigatório e deve ser uma string' });
    }

    try {
      // Validar token de aprovação
      const approval = approvalService.approve(approvalToken, req.user.id, req.tenant.id);

      if (!approval) {
        return reply.status(403).send({ error: 'Token de aprovação inválido, expirado ou já utilizado' });
      }

      // Verificar se a ação é de aplicar patch
      if (approval.action !== 'apply_patch' && approval.action !== 'patch') {
        return reply.status(403).send({ error: 'Token não autorizado para esta ação' });
      }

      // Aplicar patch
      const response: ApplyPatchResponse = await patchApplyService.applyPatch(
        filePath,
        diff,
        req.user.id,
        req.tenant.id
      );

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao aplicar patch');

      if (error.message.includes('bloqueado') || error.message.includes('fora da raiz')) {
        return reply.status(403).send({ error: error.message });
      }

      if (error.message.includes('não encontrado')) {
        return reply.status(404).send({ error: error.message });
      }

      if (error.message.includes('excede tamanho')) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(500).send({ error: 'Erro ao aplicar patch' });
    }
  });
};

export default patchRoutes;

