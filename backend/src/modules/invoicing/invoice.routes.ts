// backend/src/modules/invoicing/invoice.routes.ts
// Rotas para Invoice Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { invoiceService } from './invoice.service';
import type { CreateInvoiceFromPayoutInput, IssueInvoiceInput, CancelInvoiceInput } from './invoice.types';
import { invoiceActivationGate } from './invoice-activation';

const invoiceRoutes = async (fastify: FastifyInstance) => {
  // 🔒 DECISION-0189B D7: porta de ativação (fechada por default) ANTES de qualquer gate/consulta.
  // Enquanto o substrato de invoices não for ativado por campanha própria, TODA rota → 503.
  const gate = invoiceActivationGate();
  /**
   * Middleware: Verificar permissão para acessar invoices
   */
  const requireInvoicePermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      
      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        return reply.status(403).send({ error: 'Actor não encontrado' });
      }

      // Verificar permissão para invoices
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:view_ledger',
        'invoice'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar invoices' });
    }
  };

  /**
   * POST /invoices/from-payout/:payoutOrderId
   * Cria invoice a partir de payout EXECUTED
   */
  fastify.post<{ Params: { payoutOrderId: string }; Body: CreateInvoiceFromPayoutInput }>(
    '/invoices/from-payout/:payoutOrderId',
    { preHandler: [gate, requireInvoicePermission] },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const invoice = await invoiceService.createInvoiceFromPayout(
        tenantId,
        req.params.payoutOrderId,
        req.body
      );

      return reply.status(201).send({ invoice });
    }
  );

  /**
   * GET /invoices/:invoiceId
   * Busca invoice por ID
   */
  fastify.get<{ Params: { invoiceId: string } }>(
    '/invoices/:invoiceId',
    { preHandler: [gate, requireInvoicePermission] },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;

      // 🔴 DECISION-0113 canal-5 (:id recurso privado financeiro): `requireInvoicePermission` prova só que o
      // CALLER tem financial:view_ledger no PRÓPRIO actor — NÃO prova acesso a ESTA invoice (IDOR). Invoice é
      // documento money-adjacent com partes reais (emissor=actorId, destinatário=recipientActorId). Resolve a
      // invoice e exige representar UMA das partes; admin cross-actor só com financial:view_all_ledger
      // comprovado. fail-closed → 403. (espelha o gate por-parte já aplicado em GET /invoices list.)
      const callerUserId = (req as { user?: { userId?: string } }).user?.userId;
      if (!callerUserId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // read-only: findById = SELECT; 404 se inexistente (comportamento atual, sem leak adicional).
      const invoice = await invoiceService.getInvoiceById(tenantId, req.params.invoiceId);

      // 🔒 DECISION-0189A §5 (D7.B — R19): invoice é documento FINANCEIRO com partes reais.
      // A autoridade por parte é a FACHADA TERMINAL de leitura financeira: PF vê se o SEU
      // actor canônico é parte (self); parte EMPRESARIAL exige membership ativa +
      // can_view_financial sobre AQUELE actor — representação/can_manage_company isolado
      // NÃO autoriza. actorId do cliente nunca prova participação (partes vêm do recurso).
      const { hasActorFinancialReadAuthority } = await import('@core/authorization/financial-read-authority');
      let canAccess = false;
      for (const partyId of [invoice.actorId, invoice.recipientActorId]) {
        if (!partyId) continue;
        try {
          if ((await hasActorFinancialReadAuthority(tenantId, callerUserId, partyId)).allowed) {
            canAccess = true;
            break;
          }
        } catch { /* fail-closed */ }
      }

      // Escape admin cross-actor: financial:view_all_ledger (permissão real comprovada, NÃO o view_ledger do
      // caller). Necessário p/ invoices com parte 'system:platform'/'system' (não representável por actor humano).
      if (!canAccess) {
        try {
          const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
          const { runQueriesWithTenant } = await import('@core/database/pool');
          // resolve o actor 'user' do caller SOMENTE-LEITURA (NÃO cria actor — proibido side-effect em GET).
          // 🔴 03_IDENTITY_CANONICA §8 / DECISION-0069: NÃO resolver por "primeiro resultado" (sem LIMIT 1).
          // 0 user-actor → sem escape; EXATAMENTE 1 → avalia view_all_ledger; >1 (ambíguo) → fail-closed (não
          // concede escape). Espelha o resolver self do unified-calendar (sem LIMIT; >1 = ambíguo fail-closed).
          const rows = await runQueriesWithTenant<{ actor_id: string }>(
            tenantId,
            `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`,
            [tenantId, callerUserId]
          );
          if (rows.length === 1) {
            await businessAuthorizationService.requirePermission(
              tenantId,
              callerUserId,
              rows[0].actor_id,
              'financial:view_all_ledger',
              'invoice_read'
            );
            canAccess = true;
          }
          // rows.length === 0 (sem user-actor) OU > 1 (ambíguo) → NÃO concede escape (fail-closed).
        } catch {
          canAccess = false;
        }
      }

      if (!canAccess) {
        return reply.status(403).send({
          error: 'Sem autoridade sobre esta invoice (representar emissor/destinatário ou financial:view_all_ledger)',
          code: 'INVOICE_NOT_REPRESENTABLE',
        });
      }

      // R18: audit ANTES do disclosure (falha = 500, sem disclosure sem rastro) + no-store.
      const { recordFinancialAudit } = await import('@core/observability/financial-audit');
      await recordFinancialAudit({
        tenant_id: tenantId,
        event_type: 'financial_read_invoice',
        metadata: { readBy: callerUserId, invoiceId: req.params.invoiceId, route: 'GET /invoices/:invoiceId' },
      });
      reply.header('Cache-Control', 'no-store');
      return reply.send({ invoice });
    }
  );

  /**
   * GET /invoices
   * Lista invoices
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      recipientActorId?: string;
      payoutOrderId?: string;
      serviceOrderId?: string;
      status?: string;
      invoiceType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/invoices', { preHandler: [gate, requireInvoicePermission] }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;

    // 🔒 DECISION-0189A §5 (D7.B.7 — R19): listagem ESCOPADA ANTES da query — NUNCA
    // tenant-wide filtrada depois. Sem filtro de parte declarado, a rota NÃO lista (400
    // explícito): a consulta só roda sobre partes AUTORIZADAS pela fachada financeira
    // terminal (PF self · empresa com can_view_financial). Representação/gestão não lê.
    {
      const callerUserId = (req as { user?: { userId?: string } }).user?.userId;
      if (!callerUserId) return reply.status(401).send({ error: 'Não autenticado' });
      const declaredParties = [req.query.actorId, req.query.recipientActorId].filter(Boolean) as string[];
      if (declaredParties.length === 0) {
        return reply.status(400).send({
          error: 'Listagem de invoices exige filtro explícito de parte (actorId/recipientActorId) autorizada — escopo antes da consulta (DECISION-0189A §5)',
          code: 'EXPLICIT_PARTY_FILTER_REQUIRED',
        });
      }
      const { hasActorFinancialReadAuthority } = await import('@core/authorization/financial-read-authority');
      for (const partyId of declaredParties) {
        let ok = false;
        try { ok = (await hasActorFinancialReadAuthority(tenantId, callerUserId, partyId)).allowed; } catch { ok = false; }
        if (!ok) return reply.status(403).send({ error: 'Sem autoridade financeira exata sobre a parte filtrada (view_financial)', code: 'VIEW_FINANCIAL_REQUIRED' });
      }
    }

    const filters = {
      actorId: req.query.actorId,
      recipientActorId: req.query.recipientActorId,
      payoutOrderId: req.query.payoutOrderId,
      serviceOrderId: req.query.serviceOrderId,
      status: req.query.status as any,
      invoiceType: req.query.invoiceType as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const invoices = await invoiceService.listInvoices(tenantId, filters);

    // R18: audit + no-store (listagem já ESCOPADA por partes autorizadas antes da query).
    const { recordFinancialAudit } = await import('@core/observability/financial-audit');
    await recordFinancialAudit({
      tenant_id: tenantId,
      event_type: 'financial_read_invoice_list',
      metadata: {
        readBy: (req as { user?: { userId?: string } }).user?.userId,
        parties: [req.query.actorId, req.query.recipientActorId].filter(Boolean),
        route: 'GET /invoices',
      },
    });
    reply.header('Cache-Control', 'no-store');
    return reply.send({ invoices, totalCents: invoices.length });
  });

  /**
   * POST /invoices/:invoiceId/issue
   * Emite invoice (muda status para ISSUED)
   */
  fastify.post<{ Params: { invoiceId: string }; Body: IssueInvoiceInput }>(
    '/invoices/:invoiceId/issue',
    { preHandler: [gate, requireInvoicePermission] },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const invoice = await invoiceService.issueInvoice(tenantId, req.params.invoiceId, {
        ...req.body,
        issuedByUserId: userId,
      });

      return reply.send({ invoice });
    }
  );

  /**
   * POST /invoices/:invoiceId/cancel
   * Cancela invoice
   */
  fastify.post<{ Params: { invoiceId: string }; Body: CancelInvoiceInput }>(
    '/invoices/:invoiceId/cancel',
    { preHandler: [gate, requireInvoicePermission] },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const invoice = await invoiceService.cancelInvoice(tenantId, req.params.invoiceId, {
        ...req.body,
        cancelledByUserId: userId,
      });

      return reply.send({ invoice });
    }
  );
};

export default invoiceRoutes;





