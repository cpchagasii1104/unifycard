// backend/src/core/pilot/institutional-memory.routes.ts
// SPRINT 26: Memória Institucional Declarativa
// Rotas API para declarações de aprendizado institucional

import { FastifyPluginAsync } from 'fastify';
import { institutionalMemoryService } from './institutional-memory.service';
import { isPilotMode } from './pilot-events.service';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar materializando tabela na mão. 4 endpoints, montado em /admin/pilot (app.builder.ts:683);
// ║          substrato medido AUSENTE em unificard_dev: institutional_memory_declarations.
// ║          NÃO é dívida técnica quebrada — é ESCOPO NÃO INICIADO. NÃO apagar arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém o módulo na borda, ANTES de qualquer
// ║          service/SQL. Religar = apagar a linha + materializar do archive com GATE.
// ╚════════════════════════════════════════════════════════════════
const institutionalMemoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'institutional-memory',
    reason: 'out_of_product_minimum',
    missingSubstrate: ['institutional_memory_declarations'],
  }));

  /**
   * GET /admin/pilot/institutional-memory
   * Lista declarações de aprendizado institucional
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      context?: string;
    };
  }>('/institutional-memory', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      if (!isPilotMode()) {
        return reply.status(403).send({ error: 'Modo piloto não está ativo' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
      const context = req.query.context;

      const declarations = await institutionalMemoryService.listDeclarations(tenantId, {
        limit,
        offset,
        context,
      });

      return reply.status(200).send({
        ok: true,
        data: declarations,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar declarações');
      return reply.status(500).send({ error: 'Erro ao listar declarações' });
    }
  });

  /**
   * POST /admin/pilot/institutional-memory
   * Cria uma nova declaração de aprendizado
   */
  fastify.post<{
    Body: {
      content: string;
      context?: string;
    };
  }>('/institutional-memory', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      if (!isPilotMode()) {
        return reply.status(403).send({ error: 'Modo piloto não está ativo' });
      }

      const userId = req.user.id || req.user.userId;
      if (!userId) {
        return reply.status(400).send({ error: 'User ID não encontrado' });
      }

      const { content, context } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return reply.status(400).send({ error: 'Conteúdo da declaração é obrigatório' });
      }

      const declaration = await institutionalMemoryService.createDeclaration(tenantId, {
        content: content.trim(),
        authorUserId: userId,
        context: context || 'pilot',
      });

      if (!declaration) {
        return reply.status(500).send({ error: 'Erro ao criar declaração' });
      }

      return reply.status(201).send({
        ok: true,
        data: declaration,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar declaração');
      return reply.status(500).send({ error: 'Erro ao criar declaração' });
    }
  });

  /**
   * PATCH /admin/pilot/institutional-memory/:id
   * Atualiza versão de uma declaração
   */
  fastify.patch<{
    Params: { id: string };
    Body: { content: string };
  }>('/institutional-memory/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      if (!isPilotMode()) {
        return reply.status(403).send({ error: 'Modo piloto não está ativo' });
      }

      const declarationId = req.params.id;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return reply.status(400).send({ error: 'Conteúdo da declaração é obrigatório' });
      }

      const declaration = await institutionalMemoryService.updateDeclaration(
        tenantId,
        declarationId,
        content.trim()
      );

      if (!declaration) {
        return reply.status(404).send({ error: 'Declaração não encontrada' });
      }

      return reply.status(200).send({
        ok: true,
        data: declaration,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao atualizar declaração');
      return reply.status(500).send({ error: 'Erro ao atualizar declaração' });
    }
  });

  /**
   * DELETE /admin/pilot/institutional-memory/:id
   * Remove uma declaração (soft delete)
   */
  fastify.delete<{
    Params: { id: string };
  }>('/institutional-memory/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      if (!isPilotMode()) {
        return reply.status(403).send({ error: 'Modo piloto não está ativo' });
      }

      const declarationId = req.params.id;

      const deleted = await institutionalMemoryService.deleteDeclaration(tenantId, declarationId);

      if (!deleted) {
        return reply.status(404).send({ error: 'Declaração não encontrada' });
      }

      return reply.status(204).send();
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao deletar declaração');
      return reply.status(500).send({ error: 'Erro ao deletar declaração' });
    }
  });
};

export default institutionalMemoryRoutes;

