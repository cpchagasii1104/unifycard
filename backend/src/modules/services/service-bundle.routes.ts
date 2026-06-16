// backend/src/modules/services/service-bundle.routes.ts
// Rotas para SERVIÇOS COMBINADOS (Bundles) com co-agendamento

import type { FastifyInstance } from 'fastify';
import { serviceBundleService } from './service-bundle.service';
import type {
  CreateBundleBookingInput,
  ConfirmBundleInput,
} from './service-bundle.types';

const serviceBundleRoutes = async (fastify: FastifyInstance) => {
  // 🔴 DECISION-0113 (WRITE-AUTHORSHIP) — DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF: gravar autoria/autoridade
  // de um write de bundle (book/confirm) exige BINDING server-side. O actor declarado pelo cliente
  // (`requesterActorId` no body do `book`; `actionContext.actorId` no `confirm`) é só um HINT — NÃO
  // autoridade. Antes, `book` passava `actionContext.actorId` como userId e `requesterActorId` cru do body,
  // e `confirm` gravava `confirmedBy* = actionContext.actorId` (mesma conflação corrigida no service-order):
  // um caller declarava o actor de outro e criava/confirmava bundle em nome da vítima, além de alimentar o
  // gate de serviço (`canActAs`) com um actor-UUID no lugar do userId. Binding (espelha bindOrderWriteActor):
  // (1) `req.user.userId` REAL obrigatório (401); (2) actor declarado presente (400); (3)
  // `canRepresentActor(userId, actorDeclarado)` — senão 403. Retorna {userId, actorId} BINDADO: o handler
  // grava o actor validado e o userId REAL. 403 honesto ANTES de qualquer write (sem write parcial).
  // A autoridade fina por-booking (dono soberano da availability) permanece reforçada downstream por
  // `confirmBookingFromDecision` (F-BOOKING-ORDER-BINDING-CANONICAL).
  const bindWriteActor = async (
    req: any,
    reply: any,
    tenantId: string,
    declaredActorId: string | undefined
  ): Promise<{ userId: string; actorId: string } | null> => {
    const userId = req.user?.userId as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: 'Não autenticado' });
      return null;
    }
    if (!declaredActorId) {
      reply.status(400).send({ error: 'actorId é obrigatório' });
      return null;
    }
    let canRepresent = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canRepresent = await authorizationService.canRepresentActor(tenantId, userId, declaredActorId);
    } catch {
      canRepresent = false;
    }
    if (!canRepresent) {
      reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      return null;
    }
    return { userId, actorId: declaredActorId };
  };

  /**
   * POST /service-bundles/book
   * Cria bundle bookings de forma atômica
   * 
   * REGRAS:
   * - Cria múltiplos bookings vinculados
   * - Todos compartilham mesmo horário/localização se especificado
   * - NÃO cria pagamento automático
   */
  fastify.post<{ Body: CreateBundleBookingInput }>(
    '/service-bundles/book',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const body = req.body;

      // 🔴 DECISION-0113 write-binding: `requesterActorId` (quem solicita) é a PARTE do write e vem do
      // cliente (HINT). Binda com canRepresentActor + passa o userId REAL ao service.
      const bound = await bindWriteActor(req, reply, tenantId, body?.requesterActorId);
      if (!bound) return reply;

      // Converter strings para Date se necessário
      const scheduledStart = body.scheduledStart instanceof Date
        ? body.scheduledStart
        : new Date(body.scheduledStart);
      const scheduledEnd = body.scheduledEnd instanceof Date
        ? body.scheduledEnd
        : new Date(body.scheduledEnd);

      try {
        const result = await serviceBundleService.createBundleBookings(
          tenantId,
          bound.userId,
          {
            ...body,
            requesterActorId: bound.actorId,
            scheduledStart,
            scheduledEnd,
          }
        );

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao criar bundle bookings',
        });
      }
    }
  );

  /**
   * GET /service-bundles/:bundleId/bookings
   * Busca bookings de um bundle
   */
  fastify.get<{ Params: { bundleId: string } }>(
    '/service-bundles/:bundleId/bookings',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { bundleId } = req.params;

      try {
        const bookings = await serviceBundleService.getBundleBookings(tenantId, bundleId);
        return reply.send({ bookings });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar bookings do bundle',
        });
      }
    }
  );

  /**
   * GET /service-bundles/:bundleId/can-confirm
   * Verifica se bundle pode ser confirmado
   */
  fastify.get<{ Params: { bundleId: string } }>(
    '/service-bundles/:bundleId/can-confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { bundleId } = req.params;

      try {
        const result = await serviceBundleService.canConfirmBundle(tenantId, bundleId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao verificar se bundle pode ser confirmado',
        });
      }
    }
  );

  /**
   * POST /service-bundles/confirm
   * Confirma bundle de forma atômica
   * 
   * REGRAS:
   * - Todos os bookings devem ter decisão ACCEPTED
   * - Todos os service orders são criados ou nenhum
   * - Agenda é bloqueada como conjunto
   * - NÃO cria pagamento automático
   */
  fastify.post<{ Body: ConfirmBundleInput }>(
    '/service-bundles/confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const body = req.body;
      const actionContext = (req as any).actionContext;

      // 🔴 DECISION-0113 write-binding: `confirmedByActorId` (organizador) declarado é HINT. Binda com
      // canRepresentActor; grava o actor validado + o userId REAL. A autoridade fina por-booking (dono
      // soberano da availability) segue reforçada por confirmBookingFromDecision (defesa em profundidade).
      const bound = await bindWriteActor(req, reply, tenantId, actionContext?.actorId);
      if (!bound) return reply;

      try {
        const result = await serviceBundleService.confirmBundle(tenantId, {
          ...body,
          confirmedByActorId: bound.actorId,
          confirmedByUserId: bound.userId,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao confirmar bundle',
        });
      }
    }
  );
};

export default serviceBundleRoutes;




