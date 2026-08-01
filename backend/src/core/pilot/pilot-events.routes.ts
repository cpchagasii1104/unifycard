// backend/src/core/pilot/pilot-events.routes.ts
// SPRINT 13: Rotas para eventos de observação do modo piloto

import { FastifyPluginAsync } from 'fastify';
import { pilotEventsService } from './pilot-events.service';
import type { CreatePilotEventInput } from './pilot-events.repository';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar materializando tabela na mão. 3 endpoints, montado em /admin/pilot (app.builder.ts:674);
// ║          substrato medido AUSENTE em unificard_dev: pilot_events, pilot_checklist, pilot_hypotheses.
// ║          NÃO é dívida técnica quebrada — é ESCOPO NÃO INICIADO. NÃO apagar arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém o módulo na borda, ANTES de qualquer
// ║          service/SQL. Religar = apagar a linha + materializar do archive com GATE.
// ╚════════════════════════════════════════════════════════════════
const pilotEventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'pilot-events',
    reason: 'out_of_product_minimum',
    missingSubstrate: ['pilot_events', 'pilot_checklist', 'pilot_hypotheses'],
  }));

  /**
   * POST /admin/pilot/events
   * Registra um evento de observação
   * Apenas funciona se PILOT_MODE=true
   */
  fastify.post<{
    Body: CreatePilotEventInput;
  }>('/events', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const event = await pilotEventsService.recordEvent(tenantId, req.body);
      
      if (!event) {
        // Modo piloto não está ativo ou erro silencioso
        return reply.status(200).send({
          ok: true,
          data: null,
          message: 'Modo piloto não está ativo ou evento já registrado',
        });
      }

      return reply.status(201).send({
        ok: true,
        data: event,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao registrar evento de piloto');
      return reply.status(500).send({
        error: error.message || 'Erro ao registrar evento',
      });
    }
  });

  /**
   * GET /admin/pilot/events
   * Lista eventos de observação
   * Apenas funciona se PILOT_MODE=true
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      eventType?: string;
    };
  }>('/events', async (req, reply) => {
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
      const eventType = req.query.eventType as any;

      const events = await pilotEventsService.listEvents(tenantId, {
        limit,
        offset,
        eventType,
      });

      return reply.status(200).send({
        ok: true,
        data: events,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar eventos de piloto');
      return reply.status(500).send({
        error: error.message || 'Erro ao listar eventos',
      });
    }
  });

  /**
   * GET /admin/pilot/events/count
   * Conta eventos de observação
   */
  fastify.get<{
    Querystring: {
      eventType?: string;
    };
  }>('/events/count', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const eventType = req.query.eventType as any;
      const count = await pilotEventsService.countEvents(tenantId, eventType);

      return reply.status(200).send({
        ok: true,
        data: { count },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao contar eventos de piloto');
      return reply.status(500).send({
        error: error.message || 'Erro ao contar eventos',
      });
    }
  });
};

export default pilotEventsRoutes;







