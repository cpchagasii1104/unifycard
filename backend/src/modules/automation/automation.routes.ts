// backend/src/modules/automation/automation.routes.ts
// SPRINT 50: Rotas REST para alertas
// SPRINT 67: Rotas REST para scheduled actions

import type { FastifyInstance } from 'fastify';
import { alertService } from './alert.service';
import { scheduledActionService } from './scheduled-action.service';
import { auditService } from '@core/audit/audit.service';
import type {
  CreateAlertInput,
  UpdateAlertStatusInput,
  AlertFilters,
} from './automation.types';
import type {
  ScheduleActionInput,
  ScheduledActionFilters,
} from './scheduled-action.types';

const automationRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /automation/alerts
   * Lista alertas
   */
  fastify.get('/alerts', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: AlertFilters = {};
    if (query.type) filters.type = query.type as any;
    if (query.severity) filters.severity = query.severity as any;
    if (query.status) filters.status = query.status as any;
    if (query.entityType) filters.entityType = query.entityType;
    if (query.entityId) filters.entityId = query.entityId;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const alerts = await alertService.listAlerts(tenantId, filters);
    return { alerts };
  });

  /**
   * GET /automation/alerts/count
   * Conta alertas abertos
   */
  fastify.get('/alerts/count', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const count = await alertService.countOpenAlerts(
      tenantId,
      query.severity as any
    );
    return { count };
  });

  /**
   * GET /automation/alerts/:id
   * Busca alerta por ID
   */
  fastify.get<{ Params: { id: string } }>('/alerts/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const alert = await alertService.getAlertById(tenantId, id);
    if (!alert) {
      return reply.status(404).send({ error: 'Alerta não encontrado' });
    }

    return alert;
  });

  /**
   * POST /automation/alerts
   * Cria alerta (usado por automações)
   */
  fastify.post('/alerts', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const alert = await alertService.createAlert(tenantId, req.body as CreateAlertInput);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'ALERT_CREATED',
      severity: alert.severity,
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_id: alert.id,
        alert_type: alert.type,
        entity_type: alert.entityType,
        entity_id: alert.entityId,
      },
    });

    return reply.status(201).send(alert);
  });

  /**
   * PATCH /automation/alerts/:id/status
   * Atualiza status do alerta (ACK ou RESOLVED)
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateAlertStatusInput }>(
    '/alerts/:id/status',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const alert = await alertService.updateAlertStatus(tenantId, id, req.body);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'ALERT_STATUS_UPDATED',
        severity: 'low',
        actor_id: actionContext.actorId,
        actor_type: 'user',
        source: 'automation',
        context: {
          alert_id: id,
          new_status: alert.status,
          reason: req.body.reason,
        },
      });

      return alert;
    }
  );

  // ============================================================
  // SPRINT 67: SCHEDULED ACTIONS
  // ============================================================

  /**
   * POST /automation/schedule
   * Agenda uma ação para execução futura
   */
  fastify.post<{ Body: ScheduleActionInput }>('/schedule', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    const action = await scheduledActionService.scheduleAction(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(action);
  });

  /**
   * GET /automation/schedule
   * Lista ações programadas
   */
  fastify.get('/schedule', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: ScheduledActionFilters = {};
    if (query.actionType) filters.actionType = query.actionType as any;
    if (query.status) filters.status = query.status as any;
    if (query.referenceType) filters.referenceType = query.referenceType;
    if (query.referenceId) filters.referenceId = query.referenceId;
    if (query.scheduledForFrom) filters.scheduledForFrom = new Date(query.scheduledForFrom);
    if (query.scheduledForTo) filters.scheduledForTo = new Date(query.scheduledForTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const actions = await scheduledActionService.listActions(tenantId, filters);
    return { actions };
  });

  /**
   * GET /automation/schedule/:id
   * Busca ação programada por ID
   */
  fastify.get<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const action = await scheduledActionService.getActionById(tenantId, id);
    if (!action) {
      return reply.status(404).send({ error: 'Ação programada não encontrada' });
    }

    return action;
  });

  /**
   * POST /automation/schedule/:id/cancel
   * Cancela uma ação programada
   */
  fastify.post<{ Params: { id: string } }>('/schedule/:id/cancel', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const action = await scheduledActionService.cancelAction(
      tenantId,
      id,
      actionContext.actorId,
      actionContext.actorId
    );

    return action;
  });

  /**
   * POST /automation/schedule/run-due
   *
   * 🔴 CONTENÇÃO P1 — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT (fail-closed).
   * Esta rota disparava `scheduledActionService.executeDueActions(tenantId, now)` SEM gate
   * admin/internal forte (estava só sob authPlugin/tenantPlugin do protectedScope, sem papel
   * material) e com `now` vindo de `req.query.now` — qualquer usuário comum autenticado do
   * tenant podia forçar a execução de ações vencidas com tempo arbitrário. Tempo declarado pelo
   * cliente NÃO é autoridade de execução; varredura de vencidos é trabalho sistêmico, não ação
   * humana via HTTP exposto. Reduzida ao 403 fail-closed: NÃO há mais caminho (alcançável) que
   * leia `query.now` nem chame `executeDueActions` por esta rota. O service `executeDueActions`
   * permanece intacto para um futuro worker/internal caller (sem caller humano hoje).
   * Reabilitação só via worker/caller sistêmico ou gate admin/internal materialmente provado.
   * Ver DT-AUTOMATION-RUN-DUE-HTTP-OPEN.
   */
  fastify.post('/schedule/run-due', async (_req, reply) => {
    return reply.status(403).send({
      ok: false,
      code: 'AUTOMATION_RUN_DUE_HTTP_DISABLED',
      message: 'Scheduled due-action execution through this HTTP route is disabled; it must run via an internal/worker caller. Client-supplied time is not execution authority.',
    });
  });
};

export default automationRoutes;

