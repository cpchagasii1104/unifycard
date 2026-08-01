// backend/src/core/pilot/pilot-human-observation.routes.ts
// SPRINT 15: Rotas para observação humana (checklist e notas)

import { FastifyPluginAsync } from 'fastify';
import { pilotHumanObservationService, DEFAULT_CHECKLIST_ITEMS } from './pilot-human-observation.service';
import { pilotHypothesesService } from './pilot-hypotheses.service';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from './pilot-checklist.repository';
import type { CreateNoteInput } from './pilot-notes.repository';
import type { CreateHypothesisInput } from './pilot-hypotheses.repository';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar materializando tabela na mão. 10 endpoints, montado em /admin/pilot (app.builder.ts:680);
// ║          substrato medido AUSENTE em unificard_dev: pilot_notes, pilot_hypotheses, pilot_checklist.
// ║          NÃO é dívida técnica quebrada — é ESCOPO NÃO INICIADO. NÃO apagar arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém o módulo na borda, ANTES de qualquer
// ║          service/SQL. Religar = apagar a linha + materializar do archive com GATE.
// ╚════════════════════════════════════════════════════════════════
const pilotHumanObservationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'pilot-human-observation',
    reason: 'out_of_product_minimum',
    missingSubstrate: ['pilot_notes', 'pilot_hypotheses', 'pilot_checklist'],
  }));

  /**
   * GET /admin/pilot/observation/users
   * Lista usuários com checklist
   */
  fastify.get('/observation/users', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const users = await pilotHumanObservationService.listUsers(tenantId);
      return reply.status(200).send({
        ok: true,
        data: users,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar usuários');
      return reply.status(500).send({
        error: error.message || 'Erro ao listar usuários',
      });
    }
  });

  /**
   * GET /admin/pilot/observation/checklist/:userId
   * Lista checklist de um usuário
   */
  fastify.get<{
    Params: { userId: string };
  }>('/observation/checklist/:userId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const checklist = await pilotHumanObservationService.getChecklist(
        tenantId,
        req.params.userId
      );
      return reply.status(200).send({
        ok: true,
        data: checklist,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao buscar checklist');
      return reply.status(500).send({
        error: error.message || 'Erro ao buscar checklist',
      });
    }
  });

  /**
   * POST /admin/pilot/observation/checklist/:userId/initialize
   * Inicializa checklist padrão para um usuário
   */
  fastify.post<{
    Params: { userId: string };
  }>('/observation/checklist/:userId/initialize', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const checklist = await pilotHumanObservationService.initializeChecklist(
        tenantId,
        req.params.userId,
        req.user.id || req.user.userId
      );
      return reply.status(200).send({
        ok: true,
        data: checklist,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao inicializar checklist');
      return reply.status(500).send({
        error: error.message || 'Erro ao inicializar checklist',
      });
    }
  });

  /**
   * PUT /admin/pilot/observation/checklist/:userId/item
   * Atualiza item do checklist
   */
  fastify.put<{
    Params: { userId: string };
    Body: {
      itemKey: string;
      itemLabel: string;
      checked: boolean;
    };
  }>('/observation/checklist/:userId/item', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const item = await pilotHumanObservationService.updateChecklistItem(
        tenantId,
        {
          observedUserId: req.params.userId,
          itemKey: req.body.itemKey,
          itemLabel: req.body.itemLabel,
        },
        {
          checked: req.body.checked,
          checkedByUserId: req.user.id || req.user.userId,
        }
      );
      return reply.status(200).send({
        ok: true,
        data: item,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao atualizar checklist');
      return reply.status(500).send({
        error: error.message || 'Erro ao atualizar checklist',
      });
    }
  });

  /**
   * GET /admin/pilot/observation/notes/:userId
   * Lista notas de um usuário
   */
  fastify.get<{
    Params: { userId: string };
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/observation/notes/:userId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

      const notes = await pilotHumanObservationService.getNotes(
        tenantId,
        req.params.userId,
        { limit, offset }
      );
      return reply.status(200).send({
        ok: true,
        data: notes,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar notas');
      return reply.status(500).send({
        error: error.message || 'Erro ao listar notas',
      });
    }
  });

  /**
   * POST /admin/pilot/observation/notes/:userId
   * Cria uma nota
   */
  fastify.post<{
    Params: { userId: string };
    Body: {
      content: string;
    };
  }>('/observation/notes/:userId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const note = await pilotHumanObservationService.createNote(
        tenantId,
        {
          observedUserId: req.params.userId,
          content: req.body.content,
        },
        req.user.id || req.user.userId
      );
      return reply.status(201).send({
        ok: true,
        data: note,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar nota');
      return reply.status(500).send({
        error: error.message || 'Erro ao criar nota',
      });
    }
  });

  /**
   * DELETE /admin/pilot/observation/notes/:noteId
   * Deleta uma nota
   */
  fastify.delete<{
    Params: { noteId: string };
  }>('/observation/notes/:noteId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const deleted = await pilotHumanObservationService.deleteNote(
        tenantId,
        req.params.noteId
      );
      return reply.status(200).send({
        ok: true,
        data: { deleted },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao deletar nota');
      return reply.status(500).send({
        error: error.message || 'Erro ao deletar nota',
      });
    }
  });

  /**
   * GET /admin/pilot/observation/hypotheses
   * Lista hipóteses
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/observation/hypotheses', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

      const hypotheses = await pilotHypothesesService.listHypotheses(tenantId, {
        limit,
        offset,
      });
      return reply.status(200).send({
        ok: true,
        data: hypotheses,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar hipóteses');
      return reply.status(500).send({
        error: error.message || 'Erro ao listar hipóteses',
      });
    }
  });

  /**
   * POST /admin/pilot/observation/hypotheses
   * Cria uma hipótese
   */
  fastify.post<{
    Body: {
      content: string;
    };
  }>('/observation/hypotheses', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const hypothesis = await pilotHypothesesService.createHypothesis(
        tenantId,
        {
          content: req.body.content,
        },
        req.user.id || req.user.userId
      );
      return reply.status(201).send({
        ok: true,
        data: hypothesis,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar hipótese');
      return reply.status(500).send({
        error: error.message || 'Erro ao criar hipótese',
      });
    }
  });

  /**
   * DELETE /admin/pilot/observation/hypotheses/:hypothesisId
   * Deleta uma hipótese
   */
  fastify.delete<{
    Params: { hypothesisId: string };
  }>('/observation/hypotheses/:hypothesisId', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const deleted = await pilotHypothesesService.deleteHypothesis(
        tenantId,
        req.params.hypothesisId
      );
      return reply.status(200).send({
        ok: true,
        data: { deleted },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao deletar hipótese');
      return reply.status(500).send({
        error: error.message || 'Erro ao deletar hipótese',
      });
    }
  });
};

export default pilotHumanObservationRoutes;

