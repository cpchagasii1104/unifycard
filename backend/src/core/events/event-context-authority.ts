// backend/src/core/events/event-context-authority.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a decisão ÚNICA de "posso amarrar este pedido a este evento?"
// ║ NORMA:   DECISION-0113 (actorId do body é HINT, autoridade é server-side) ·
// ║          "a verdade vive no backend" (Clayton) · MAPA_CANONICO_PERMISSIONS_v1
// ║ NÃO:     NÃO reimplementar a checagem em cada writer; NÃO aceitar eventId do body como prova.
// ║ EM VEZ:  chame assertEventContextAuthority() — serviço e locação usam ESTA função.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ESTA FUNÇÃO NASCEU (2026-08-05) ═══
// O diálogo de orçamento pergunta "PARA QUAL EVENTO". No caminho de SERVIÇO essa resposta viajava
// e era validada; no caminho de LOCAÇÃO ela era **descartada em silêncio** — o writer
// `POST /rentable-resources/:id/book` nunca teve o campo. Defeito meu, de 2026-08-04, ao rotear o
// diálogo por origem: campo coletado, nenhum leitor, com aparência de ter funcionado.
//
// Ao consertar, a tentação era escrever a validação do evento no módulo de locação. Isso criaria
// DUAS regras para a mesma pergunta — e duas regras sobre autoridade divergem em silêncio até
// ninguém saber qual manda. A checagem foi EXTRAÍDA para cá, e os dois caminhos passam por ela.
//
// 🔴 A CHAVE É `manage_attendees`, E ISSO É HERANÇA DELIBERADA, NÃO DESCUIDO.
// Ela vem do precedente selado C3 EDGE C-1 (`service-offering.service.ts`), cuja justificativa é:
// vincular um performer ao elenco é ADMINISTRAR staff do evento, então a decisão é a MESMA do
// `POST /events/:id/v2/commitments`. Para LOCAÇÃO não há vínculo de elenco (o bind de performer é
// gated por `ownerType === 'service_offering'` em `unified-availability.service.ts:455`, verificado
// antes de escrever isto) — ou seja, para locação esta chave é MAIS ESTRITA do que o ato exige.
//
// Escolhi manter a mesma chave em vez de eleger uma mais fraca por conta própria: chave nova ou
// mais frouxa seria vocabulário de permissão inventado por quem chegou hoje, e ser mais estrito
// FALHA FECHADO. Se o dono decidir que amarrar uma locação a um evento merece chave própria, ela
// se troca **aqui**, em um lugar só, e os dois caminhos acompanham.

/** Erro neutro de domínio — cada writer traduz para o envelope da sua superfície. */
export class EventContextAuthorityError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Prova que `userId` pode amarrar um pedido ao evento `eventId`.
 *
 * O evento é carregado SERVER-SIDE — o `eventId` que veio do corpo da requisição é apenas um
 * ponteiro, nunca prova. Inexistente neste tenant → 404 (não confirma existência alheia);
 * sem a chave sobre o DONO do evento → 403.
 */
export async function assertEventContextAuthority(
  tenantId: string,
  userId: string,
  eventId: string
): Promise<void> {
  const { eventService } = await import('@core/events/event.service');
  const { authorizationService } = await import('@core/authorization/authorization.service');

  const event = await eventService.getEvent(tenantId, eventId);
  if (!event) {
    throw new EventContextAuthorityError(404, 'EVENT_CONTEXT_NOT_FOUND', 'Evento inexistente neste tenant.');
  }
  const decision = await authorizationService.canActAs(tenantId, userId, event.actorId, 'manage_attendees');
  if (!decision.allowed) {
    throw new EventContextAuthorityError(
      403,
      'EVENT_CONTEXT_NOT_MANAGEABLE',
      'Sem a permissão exata manage_attendees sobre o dono do evento (mesma chave do POST /events/:id/v2/commitments).'
    );
  }
}
