// backend/src/core/pilot/pilot-invites.routes.ts
// SPRINT 14: Rotas para convites do modo piloto

import { FastifyPluginAsync } from 'fastify';
import { pilotInvitesService } from './pilot-invites.service';
import type { CreatePilotInviteInput } from './pilot-invites.repository';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar materializando tabela na mão. 3 endpoints, montado em /admin/pilot (app.builder.ts:677);
// ║          substrato medido AUSENTE em unificard_dev: pilot_invites.
// ║          NÃO é dívida técnica quebrada — é ESCOPO NÃO INICIADO. NÃO apagar arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém o módulo na borda, ANTES de qualquer
// ║          service/SQL. Religar = apagar a linha + materializar do archive com GATE.
// ╚════════════════════════════════════════════════════════════════
const pilotInvitesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'pilot-invites',
    reason: 'out_of_product_minimum',
    missingSubstrate: ['pilot_invites'],
  }));

  /**
   * POST /admin/pilot/invites
   * Cria um novo convite
   * Requer permissão invite_pilot_user
   */
  fastify.post<{
    Body: CreatePilotInviteInput;
  }>('/invites', {
    preHandler: [requirePermission('invite_pilot_user')],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const invite = await pilotInvitesService.createInvite(tenantId, {
        ...req.body,
        invitedByUserId: req.user.id || req.user.userId,
      });

      return reply.status(201).send({
        ok: true,
        data: invite,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar convite');
      return reply.status(500).send({
        error: error.message || 'Erro ao criar convite',
      });
    }
  });

  /**
   * GET /admin/pilot/invites
   * Lista convites
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      status?: string;
    };
  }>('/invites', async (req, reply) => {
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
      const status = req.query.status as any;

      const invites = await pilotInvitesService.listInvites(tenantId, {
        limit,
        offset,
        status,
      });

      return reply.status(200).send({
        ok: true,
        data: invites,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar convites');
      return reply.status(500).send({
        error: error.message || 'Erro ao listar convites',
      });
    }
  });

  /**
   * POST /admin/pilot/invites/:inviteId/revoke
   * Revoga convite
   */
  fastify.post<{
    Params: { inviteId: string };
  }>('/invites/:inviteId/revoke', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID não encontrado' });
    }

    try {
      const invite = await pilotInvitesService.revokeInvite(tenantId, req.params.inviteId);

      if (!invite) {
        return reply.status(404).send({
          error: 'Convite não encontrado ou já processado',
        });
      }

      return reply.status(200).send({
        ok: true,
        data: invite,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao revogar convite');
      return reply.status(500).send({
        error: error.message || 'Erro ao revogar convite',
      });
    }
  });
};

export default pilotInvitesRoutes;

