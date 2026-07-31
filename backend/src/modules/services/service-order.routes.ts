// backend/src/modules/services/service-order.routes.ts
// SPRINT 68: Rotas REST para Service Orders

import type { FastifyInstance } from 'fastify';
import { serviceOrderService } from './service-order.service';
import type {
  CreateServiceOrderInput,
  ConfirmServiceOrderInput,
  StartServiceOrderInput,
  CompleteServiceOrderInput,
  CancelServiceOrderInput,
  ServiceOrderFilters,
  ConfirmFinancialTermsInput,
  ServiceOrderStatus,
} from './service-order.types';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   service-order.types.ts (ServiceOrderStatus, fonte do enum vivo service_order_status)
// ║ NÃO:     `query.status as any` sem validar — valor fora do enum bate direto no Postgres e
// ║          vira 500 (achado: FE declarava 5 dos 8 valores, filtro cru quebrava a query).
// ║ EM VEZ:  validar contra este Record — TS falha a compilação se ServiceOrderStatus mudar e
// ║          este objeto não acompanhar (chave faltando/sobrando), então nunca dessincroniza.
// ╚════════════════════════════════════════════════════════════════
const SERVICE_ORDER_STATUS_SET: Record<ServiceOrderStatus, true> = {
  draft: true,
  confirmed: true,
  in_progress: true,
  completed: true,
  seller_pending: true,
  release_approved: true,
  funds_released: true,
  cancelled: true,
};
function isServiceOrderStatus(v: string): v is ServiceOrderStatus {
  return Object.prototype.hasOwnProperty.call(SERVICE_ORDER_STATUS_SET, v);
}

const serviceOrderRoutes = async (fastify: FastifyInstance) => {
  // 🔴 DECISION-0113 F6.5.6a (ordem comercial privada): ler uma service-order exige ser PARTE legítima —
  // `customerActorId` (comprador) ou `workerActorId` (prestador) — e o `req.user` poder REPRESENTAR esse
  // actor. Espelha a regra que o write já usa (`buyer-confirm`: `order.customerActorId === buyerActorId`).
  // `:id` na URL é ENDEREÇO, não autorização. fail-closed → 403 não-leak (uniforme com ordem inexistente).
  // NÃO toca os writes (handlers separados; write-spoof fica em DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF).
  // 🔴 F-OPERATOR-SERVICE-ORDER-VIEW-GRANT: a LEITURA operacional (GET :id) aceita autoridade ADITIVA —
  // owner/`canRepresentActor` OU grant ATIVO `service_order:view` escopado ao actor-parte. O grant é
  // resolvido no SERVICE layer (`serviceOrderService.canViewOrderForParty`); a rota NUNCA chama
  // `hasCapabilityGrant`/importa o grant service (enforcement vive no service — guard grants-nonfinancial §4).
  // Opt-in via `opts.allowViewGrant`: SÓ o read operacional liga o fallback. `financial-terms` NÃO liga →
  // permanece PARTE-representável estrita (grant NÃO estende visão financeira). Money-free de ponta a ponta.
  const assertOrderParty = async (
    req: any,
    reply: any,
    tenantId: string,
    order: { customerActorId?: string; workerActorId?: string } | null,
    opts?: { allowViewGrant?: boolean }
  ): Promise<boolean> => {
    const userId = req.user?.userId as string | undefined;
    const actorId = req.actionContext?.actorId as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: 'Não autenticado' });
      return false;
    }
    if (!actorId) {
      reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      return false;
    }
    // não-leak: ordem inexistente OU caller não é parte → 403 uniforme (não revela existência).
    if (!order || (order.customerActorId !== actorId && order.workerActorId !== actorId)) {
      reply.status(403).send({ error: 'Ordem não acessível' });
      return false;
    }
    let authorized = false;
    try {
      if (opts?.allowViewGrant) {
        // read operacional: owner/representação OU grant service_order:view escopado ao actor-parte.
        authorized = await serviceOrderService.canViewOrderForParty(tenantId, userId, actorId);
      } else {
        // estrito (financial-terms): SÓ parte representável; grant não participa da visão financeira.
        const { authorizationService } = await import('@core/authorization/authorization.service');
        authorized = await authorizationService.canRepresentActor(tenantId, userId, actorId);
      }
    } catch {
      authorized = false;
    }
    if (!authorized) {
      reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      return false;
    }
    return true;
  };

  // 🔴 DECISION-0113 (WRITE-AUTHORSHIP) — DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF: gravar a AUTORIA de uma
  // transição de estado comercial (confirm/start/complete/cancel/buyer-confirm) exige BINDING server-side.
  // O `actionContext.actorId` é só um HINT cliente-declarado (5 canais 0113) — NÃO autoridade. Antes:
  // `*ByActorId/*ByUserId = actionContext.actorId` permitia forjar quem confirmou/iniciou a ordem em nome
  // da vítima E alimentava o gate de serviço (`canActAs`) com um actor-UUID no lugar do userId real.
  // Binding (espelha `assertOrderParty` do read + precedente PO/suppliers): (1) `req.user.userId` REAL
  // obrigatório (401); (2) `actionContext.actorId` obrigatório (400); (3) o actor declarado deve ser PARTE
  // legítima da ordem (`customerActorId` OU `workerActorId`) — senão 403 não-leak (cobre ordem inexistente
  // e não-parte uniformemente); (4) `canRepresentActor(userId, actorId)` — senão 403. Retorna o par
  // {userId, actorId} BINDADO: o handler grava `*ByUserId = userId REAL` (autoria verdadeira + gate de
  // serviço passa a rodar contra o principal real). 403 honesto ANTES de qualquer write (sem write parcial).
  const bindOrderWriteActor = async (
    req: any,
    reply: any,
    tenantId: string,
    order: { customerActorId?: string; workerActorId?: string } | null
  ): Promise<{ userId: string; actorId: string } | null> => {
    const userId = req.user?.userId as string | undefined;
    const actorId = req.actionContext?.actorId as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: 'Não autenticado' });
      return null;
    }
    if (!actorId) {
      reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      return null;
    }
    // não-leak: ordem inexistente OU actor declarado não é parte → 403 uniforme (não revela existência).
    if (!order || (order.customerActorId !== actorId && order.workerActorId !== actorId)) {
      reply.status(403).send({ error: 'Ordem não acessível' });
      return null;
    }
    let canRepresent = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canRepresent = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      canRepresent = false;
    }
    if (!canRepresent) {
      reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      return null;
    }
    return { userId, actorId };
  };

  /**
   * POST /service-orders/confirm-booking
   * Confirma booking aceito criando Service Order
   * 
   * REGRAS:
   * - NÃO cria pagamento
   * - NÃO cria comissão
   * - NÃO cria split
   * - Bloqueia agenda explicitamente
   */
  fastify.post<{ Body: { bookingId: string; decisionId: string } }>(
    '/service-orders/confirm-booking',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      // 🔴 F-BOOKING-ORDER-BINDING-CANONICAL: userId REAL (autenticado) é necessário para
      // canRepresentActor do dono da availability — actionContext.actorId é HINT (DECISION-0113).
      const userId = req.user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { bookingId, decisionId } = req.body;

      if (!bookingId) {
        return reply.status(400).send({ error: 'bookingId é obrigatório' });
      }

      if (!decisionId) {
        return reply.status(400).send({ error: 'decisionId é obrigatório' });
      }

      try {
        const order = await serviceOrderService.confirmBookingFromDecision(
          tenantId,
          bookingId,
          decisionId,
          actionContext.actorId,
          userId
        );

        return reply.status(201).send(order);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ 
          error: error.message || 'Erro ao confirmar booking' 
        });
      }
    }
  );

  /**
   * POST /service-orders — CONTIDO (fail-closed).
   *
   * 🔴 CONTENÇÃO P1 — F-SERVICE-ORDER-DIRECT-CREATE-AUTHORITY-CONTAINMENT. A criação DIRETA de
   * service_order via HTTP aceitava `workerActorId`/`customerActorId`/`bookingId`/`decisionId`/
   * `serviceId` do BODY cliente-declarado, sem binding ao dono soberano da availability, sem
   * validar representabilidade e sem exigir decisão ACCEPTED — vetor IRMÃO do confused-deputy
   * (DECISION-0113/0121). Com a UNIQUE parcial em `service_orders.booking_id`, permitia ainda
   * ocupar o slot e bloquear o fluxo legítimo (DoS). Reduzida ao 403 fail-closed: NÃO há caminho
   * (alcançável ou morto) que chame `serviceOrderService.createOrder`. O caminho canônico é
   * `POST /service-orders/confirm-booking` (`confirmBookingFromDecision`, binding ao dono).
   * Reabilitação só com authority binding verificada. Ver DT-SERVICE-ORDER-CREATE-DIRECT-AUTHORITY-UNBOUND.
   */
  fastify.post<{ Body: CreateServiceOrderInput }>('/service-orders', async (_req, reply) => {
    return reply.status(403).send({
      ok: false,
      code: 'SERVICE_ORDER_DIRECT_CREATE_DISABLED',
      message: 'Direct service order creation through HTTP is disabled until authority binding is implemented. Use the booking decision flow.',
    });
  });

  /**
   * GET /service-orders
   * Lista ordens de serviço
   */
  fastify.get('/service-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const filters: ServiceOrderFilters = {};
    if (query.serviceId) filters.serviceId = query.serviceId;
    if (query.workerActorId) filters.workerActorId = query.workerActorId;
    if (query.customerActorId) filters.customerActorId = query.customerActorId;
    if (query.status) {
      if (!isServiceOrderStatus(query.status)) {
        return reply.status(400).send({
          error: `status inválido: "${query.status}". Valores aceitos: ${Object.keys(SERVICE_ORDER_STATUS_SET).join(', ')}`,
        });
      }
      filters.status = query.status;
    }
    if (query.scheduledStartFrom) filters.scheduledStartFrom = new Date(query.scheduledStartFrom);
    if (query.scheduledStartTo) filters.scheduledStartTo = new Date(query.scheduledStartTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    // 🔴 DECISION-0113 F6.5.6a: a listagem só retorna ordens de uma PARTE que o caller representa. Exige >= 1
    // filtro de parte (`workerActorId`|`customerActorId`); todo filtro de parte presente deve ser representável
    // (`canRepresentActor`). Sem isso, qualquer caller listava ordens comerciais alheias / do tenant inteiro.
    const partyFilters = [filters.workerActorId, filters.customerActorId].filter(Boolean) as string[];
    if (partyFilters.length === 0) {
      return reply.status(403).send({
        error: 'Listagem exige filtrar por workerActorId ou customerActorId que você representa',
      });
    }
    // 🔴 F-OPERATOR-SERVICE-ORDER-VIEW-GRANT: cada filtro de parte deve ser representável OU coberto por grant
    // ATIVO service_order:view escopado àquela parte (autoridade ADITIVA, resolvida no SERVICE layer).
    for (const partyId of partyFilters) {
      let authorized = false;
      try {
        authorized = await serviceOrderService.canViewOrderForParty(tenantId, userId, partyId);
      } catch {
        authorized = false;
      }
      if (!authorized) {
        return reply.status(403).send({ error: 'Sem autoridade sobre o actor filtrado' });
      }
    }

    const orders = await serviceOrderService.listOrders(tenantId, filters);
    return { orders };
  });

  /**
   * GET /service-orders/:id
   * Busca ordem por ID
   */
  fastify.get<{ Params: { id: string } }>('/service-orders/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const order = await serviceOrderService.getOrderById(tenantId, id);
    // 🔴 F6.5.6a + F-OPERATOR-SERVICE-ORDER-VIEW-GRANT: parte legítima (customer/worker) representável OU
    // operador com grant service_order:view escopado à parte lê a ordem (allowViewGrant). Inexistente → 403 não-leak.
    if (!(await assertOrderParty(req, reply, tenantId, order, { allowViewGrant: true }))) return reply;

    return order;
  });

  /**
   * POST /service-orders/:id/confirm
   * Confirma ordem de serviço (DRAFT → CONFIRMED)
   */
  fastify.post<{ Params: { id: string }; Body: ConfirmServiceOrderInput }>(
    '/service-orders/:id/confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔴 DECISION-0113 write-binding: autoria bindada (parte representável) ANTES do write.
      const existing = await serviceOrderService.getOrderById(tenantId, id);
      const bound = await bindOrderWriteActor(req, reply, tenantId, existing);
      if (!bound) return reply;

      const order = await serviceOrderService.confirmOrder(tenantId, id, {
        confirmedByActorId: bound.actorId,
        confirmedByUserId: bound.userId,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/start
   * Inicia ordem de serviço (CONFIRMED → IN_PROGRESS)
   */
  fastify.post<{ Params: { id: string }; Body: StartServiceOrderInput }>(
    '/service-orders/:id/start',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔴 DECISION-0113 write-binding: autoria bindada (parte representável) ANTES do write.
      const existing = await serviceOrderService.getOrderById(tenantId, id);
      const bound = await bindOrderWriteActor(req, reply, tenantId, existing);
      if (!bound) return reply;

      const order = await serviceOrderService.startOrder(tenantId, id, {
        startedByActorId: bound.actorId,
        startedByUserId: bound.userId,
        workerNotes: req.body.workerNotes,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/complete
   * Completa ordem de serviço (IN_PROGRESS → COMPLETED)
   */
  fastify.post<{ Params: { id: string }; Body: CompleteServiceOrderInput }>(
    '/service-orders/:id/complete',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔴 DECISION-0113 write-binding: autoria bindada (parte representável) ANTES do write.
      const existing = await serviceOrderService.getOrderById(tenantId, id);
      const bound = await bindOrderWriteActor(req, reply, tenantId, existing);
      if (!bound) return reply;

      const order = await serviceOrderService.completeOrder(tenantId, id, {
        completedByActorId: bound.actorId,
        completedByUserId: bound.userId,
        workerNotes: req.body.workerNotes,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/buyer-confirm
   * D2 (Camada 1 saída — 2026-05-26): buyer confirma conclusão →
   *   seller_pending → release_approved (estado-only, sem mover dinheiro).
   *
   * Significado: "serviço APROVADO para futura liberação financeira" —
   * NÃO "fundos liberados". NÃO confundir com bank-account account_type=
   * 'seller_available' (saldo financeiro real, plano Bank).
   *
   * Validações na service layer:
   *   - actionContext.actorId === order.customerActorId.
   *   - status='seller_pending', flow='fixed_price_escrow', disputed_at IS NULL.
   * Dinheiro permanece em escrow_payments — release financeiro real
   * é frente própria (DT-D2-WIRING-MONEY-PENDING).
   */
  fastify.post<{ Params: { id: string } }>(
    '/service-orders/:id/buyer-confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔴 DECISION-0113 write-binding: autoria bindada (parte representável) ANTES do write. O service
      // ainda reforça a regra fina "só o customer confirma" (order.customerActorId === buyerActorId) —
      // este binding garante que o actor declarado é representável e parte (defesa em profundidade).
      const existing = await serviceOrderService.getOrderById(tenantId, id);
      const bound = await bindOrderWriteActor(req, reply, tenantId, existing);
      if (!bound) return reply;

      const order = await serviceOrderService.confirmBuyerCompletion(tenantId, id, {
        buyerActorId: bound.actorId,
        buyerUserId: bound.userId,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/cancel
   * Cancela ordem de serviço
   */
  fastify.post<{ Params: { id: string }; Body: CancelServiceOrderInput }>(
    '/service-orders/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔴 DECISION-0113 write-binding: autoria bindada (parte representável) ANTES do write.
      const existing = await serviceOrderService.getOrderById(tenantId, id);
      const bound = await bindOrderWriteActor(req, reply, tenantId, existing);
      if (!bound) return reply;

      const order = await serviceOrderService.cancelOrder(tenantId, id, {
        cancelledByActorId: bound.actorId,
        cancelledByUserId: bound.userId,
        cancellationReason: req.body.cancellationReason,
      });

      return order;
    }
  );

  /**
   * GET /service-orders/:id/financial-terms
   * Visualiza termos financeiros de uma Service Order
   * 
   * REGRAS:
   * - NÃO cria split
   * - NÃO executa pagamento
   * - Apenas retorna valores calculados para visualização
   */
  fastify.get<{ Params: { id: string } }>(
    '/service-orders/:id/financial-terms',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      try {
        // 🔴 F6.5.6a: só parte legítima (customer/worker) representável vê os termos financeiros da ordem.
        const order = await serviceOrderService.getOrderById(tenantId, id);
        if (!(await assertOrderParty(req, reply, tenantId, order))) return reply;

        const terms = await serviceOrderService.getFinancialTerms(tenantId, id);
        return reply.send(terms);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao calcular termos financeiros',
        });
      }
    }
  );

  /**
   * POST /service-orders/:id/confirm-financial-terms
   * Confirma termos financeiros criando split
   * 
   * REGRAS:
   * - NÃO executa pagamento
   * - NÃO move dinheiro automaticamente
   * - Apenas cria entidade de split para rastreabilidade
   * - Confirmação humana obrigatória
   *
   * 🟠 RESÍDUO CONSCIENTE (DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF): este write ainda usa
   * `confirmedBy* = actionContext.actorId` (mesma conflação corrigida nos demais writes). NÃO foi
   * bindado aqui porque é FINANCEIRO (cria split / `confirmFinancialTerms`) e está fora do escopo
   * não-financeiro desta fatia — além de estar atrás de `isFinancialEnabled()` → 503. **Achado da
   * auditoria Yala do decision pack PORTA-1 (2026-07-05): essa premissa era FALSA até aqui** — o
   * flag antes delegava a um helper genérico fail-OPEN (ligava sozinho sem
   * `FEATURE_FINANCIAL_ENABLED` no ambiente); a superfície só não escrevia por acidente de tipo
   * (transactionId fictício não-UUID). `isFinancialEnabled()` agora é fail-closed de verdade
   * (`F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX`, feature-flags.ts). O binding deste
   * handler entra na frente financeira própria (3 paralelas read-only).
   */
  fastify.post<{ Params: { id: string }; Body: ConfirmFinancialTermsInput }>(
    '/service-orders/:id/confirm-financial-terms',
    async (req, reply) => {
      // Feature flag: Financial
      const { isFinancialEnabled } = await import('@core/features/feature-flags');
      if (!isFinancialEnabled()) {
        return reply.status(503).send({
          code: 'FEATURE_DISABLED',
          message: 'Feature de termos financeiros está desabilitada',
        });
      }

      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      try {
        const result = await serviceOrderService.confirmFinancialTerms(tenantId, id, {
          confirmedByActorId: actionContext.actorId,
          confirmedByUserId: actionContext.actorId,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao confirmar termos financeiros',
        });
      }
    }
  );
};

export default serviceOrderRoutes;




