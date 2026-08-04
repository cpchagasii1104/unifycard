// backend/src/modules/events/events-rsvp.routes.ts
// Rotas para RSVP (confirmação de presença) em eventos
// ⚠️ REGRAS CANÔNICAS:
// - RSVP só acontece após clique explícito
// - RSVP NÃO altera visibilidade
// - RSVP NÃO dispara ações automáticas
// - RSVP é reversível
//
// ═══ 🔴 CORRIGIDO 2026-08-04 — ESTAS ROTAS NUNCA FUNCIONARAM ═══
// As 4 liam `(request as any).tenant_id` e `(request as any).user_id`. Os plugins do sistema
// põem no request **`req.tenant.id`** e **`req.user.userId`** (é o que TODO o resto do backend
// usa — `event.routes.ts` inteiro, por exemplo). Como `tenant_id` não existe no request, o
// guard `if (!tenantId) return 401` disparava SEMPRE:
//     POST /api/events/:id/rsvp  →  {"error":"Unauthorized"}   [reproduzido com curl]
// Por isso `event_rsvp` e `event_attendees` estavam com **0 linhas**: ninguém nunca conseguiu se
// inscrever em evento nenhum, e o `as any` escondeu o defeito do typecheck.
//
// É a MESMA assinatura dos outros três defeitos desta sessão (`startAt` × `datetimeStart`,
// `/api/feed` aposentado, preço nunca projetado): código lendo campo que não existe, falhando
// calado. O `as any` é o denominador comum — ele desliga exatamente a checagem que pegaria isto.
//
// 🔴 E o POST/DELETE não tinham `canViewEvent`, que os GET irmãos já tinham. Dava para se
// inscrever (ESCRITA) num evento que você nem pode ver (LEITURA) — gate mais frouxo no caminho
// que muta que no que lê. Corrigido: deny-first com 404 não-leak, igual aos irmãos.

import { FastifyPluginAsync } from 'fastify';
import { eventRSVPService } from '@core/events/event-rsvp.service';
import { eventActionsService } from '@core/events/event-actions.service';
import type { CreateRSVPInput, RSVPStatus } from '@core/events/event-rsvp.service';

const eventsRSVPRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /events/:id/rsvp
   * Cria ou atualiza RSVP
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      status: RSVPStatus;
      notes?: string | null;
      guest_email?: string | null;
      guest_name?: string | null;
    };
  }>('/:id/rsvp', async (request, reply) => {
    const { id: eventId } = request.params;
    const { status, notes, guest_email, guest_name } = request.body;
    const tenantId = request.tenant?.id;
    const userId = request.user?.userId;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Validar status
    if (!['yes', 'no', 'maybe'].includes(status)) {
      return reply.code(400).send({ error: 'Status inválido. Deve ser: yes, no ou maybe' });
    }

    // 🔴 2026-08-04 — gate que FALTAVA no caminho de ESCRITA. Os GET irmãos já herdavam
    // `canViewEvent` do evento-pai; o POST não, então dava para se inscrever num evento privado
    // que o caller nem consegue LER. Deny-first, 404 não-leak (mesma forma dos irmãos: não
    // revelar existência para quem não pode ver).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const input: CreateRSVPInput = {
        event_id: eventId,
        user_id: userId || null,
        guest_email: guest_email || null,
        guest_name: guest_name || null,
        status,
        notes: notes || null,
      };

      const rsvp = await eventRSVPService.upsertRSVP(tenantId, userId || null, input);

      // 🔴 2026-08-04 — este log NÃO pode derrubar a inscrição, e derrubava.
      // `logAction` grava em `event_actions_log`, tabela que **não existe** no schema vivo (foi
      // desenhada no pré-gênesis, `migrations_archive/0818_event_actions_log.sql`, e nunca
      // re-materializada). Como o `await` estava no caminho principal, a rota devolvia 500:
      //     {"error":"relação \"event_actions_log\" não existe"}   [reproduzido com curl]
      // …DEPOIS de a inscrição já ter sido COMMITADA. O usuário ficava inscrito e via erro — a
      // pior combinação possível, pior que falhar limpo: ele tenta de novo achando que não deu.
      //
      // Observabilidade é ACESSÓRIA ao ato. Falhar aqui não desfaz o que já aconteceu, então não
      // pode fingir que desfez. O erro vai ALTO para o log do servidor (não é engolido em
      // silêncio — isso seria a doença oposta) e a resposta diz a verdade: a inscrição existe.
      try {
        await eventActionsService.logAction(tenantId, {
          event_id: eventId,
          user_id: userId || null,
          action_type: `rsvp_${status}` as any,
          metadata: {
            rsvp_id: rsvp.id,
            guest_email: guest_email || null,
          },
        });
      } catch (logError) {
        fastify.log.error(
          { err: logError, eventId, rsvpId: rsvp.id, route: 'POST /events/:id/rsvp' },
          '[RSVP] trilha de observabilidade falhou (event_actions_log ausente) — a INSCRIÇÃO foi gravada e vale'
        );
      }

      return { rsvp };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao criar/atualizar RSVP' });
    }
  });

  /**
   * GET /events/:id/rsvp/status
   * Busca status de RSVP do usuário para o evento
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { guest_email?: string };
  }>('/:id/rsvp/status', async (request, reply) => {
    const { id: eventId } = request.params;
    const { guest_email } = request.query;
    const tenantId = request.tenant?.id;
    const userId = request.user?.userId;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const rsvp = await eventRSVPService.getRSVPStatus(
        tenantId,
        eventId,
        userId || null,
        guest_email || null
      );

      if (!rsvp) {
        return reply.code(404).send({ error: 'RSVP não encontrado' });
      }

      return { rsvp };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar RSVP' });
    }
  });

  /**
   * GET /events/:id/rsvp/counts
   * Busca contagens de RSVP para o evento
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id/rsvp/counts', async (request, reply) => {
    const { id: eventId } = request.params;
    const tenantId = request.tenant?.id;
    const userId = request.user?.userId;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const counts = await eventRSVPService.getRSVPCounts(tenantId, eventId);
      return { counts };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar contagens de RSVP' });
    }
  });

  /**
   * DELETE /events/:id/rsvp
   * Remove RSVP
   */
  fastify.delete<{
    Params: { id: string };
    Querystring: { guest_email?: string };
  }>('/:id/rsvp', async (request, reply) => {
    const { id: eventId } = request.params;
    const { guest_email } = request.query;
    const tenantId = request.tenant?.id;
    const userId = request.user?.userId;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Mesmo gate do POST — cancelar inscrição também é escrita sobre o evento.
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, eventId, userId))) {
      return reply.code(404).send({ error: 'Evento não encontrado' });
    }

    try {
      await eventRSVPService.removeRSVP(
        tenantId,
        eventId,
        userId || null,
        guest_email || null
      );

      return { success: true };
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao remover RSVP' });
    }
  });
};

export { eventsRSVPRoutes };


