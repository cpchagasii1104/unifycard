// backend/src/modules/support-tickets/support-ticket.service.ts
// F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — regra de negócio do Chamado.
//
// A CATRACA CENTRAL (DESENHO §5/§5B SELADO): o chamado só nasce se `fromActorId`/`toActorId`
// forem EXATAMENTE as duas partes reais do fato de negócio referenciado (nunca "qualquer conexão",
// nunca "confia no que o cliente falou") — a autoridade de REPRESENTAR o actor (canRepresentActor,
// DECISION-0113) é resolvida na ROTA; este service prova que o par declarado bate com a verdade
// causal (segmentos.md #5). Δbank=0 — Chamado é comunicação, NUNCA reverte dinheiro (isso é o
// domínio `disputes`, module diferente, não tocado aqui).

import { supportTicketRepository } from './support-ticket.repository';
import {
  SUPPORT_TICKET_REFERENCE_TYPES,
  SUPPORT_TICKET_STATUSES,
  type OpenSupportTicketInput,
  type RespondSupportTicketInput,
  type SupportTicket,
  type SupportTicketFilters,
} from './support-ticket.types';

class SupportTicketError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

class SupportTicketService {
  /**
   * Abre o chamado. `fromActorId` já foi PROVADO representável pela rota (canRepresentActor).
   * Aqui a prova é OUTRA: o par (from, to) precisa ser EXATAMENTE as duas partes do fato de
   * negócio referenciado — nunca aceita o toActorId do cliente sem checar contra a fonte viva.
   */
  async openTicket(tenantId: string, fromActorId: string, userId: string, input: OpenSupportTicketInput): Promise<SupportTicket> {
    if (!SUPPORT_TICKET_REFERENCE_TYPES.includes(input.referenceType)) {
      throw new SupportTicketError(400, `reference_type inválido: fora do vocabulário governado (${SUPPORT_TICKET_REFERENCE_TYPES.join('/')})`);
    }
    if (!input.toActorId || input.toActorId === fromActorId) {
      throw new SupportTicketError(400, 'toActorId é obrigatório e não pode ser o próprio autor do chamado');
    }
    if (!input.subject?.trim() || !input.message?.trim()) {
      throw new SupportTicketError(400, 'subject e message são obrigatórios');
    }

    const parties = await supportTicketRepository.resolveParties(tenantId, input.referenceType, input.referenceId);
    if (!parties) {
      throw new SupportTicketError(404, `Fato de negócio não encontrado (${input.referenceType}=${input.referenceId}) — ou tipo de recurso não suportado nesta fatia`);
    }

    // 🔴 A CATRACA CAUSAL: {from, to} declarados precisam ser EXATAMENTE {partyA, partyB} do fato
    // real, em qualquer ordem (assimetria de quem abre o chamado é livre; a IDENTIDADE das duas
    // partes não é). Fail-closed — nunca "confia" no toActorId do cliente.
    const declared = [fromActorId, input.toActorId].sort();
    const real = [parties.partyA, parties.partyB].sort();
    if (declared[0] !== real[0] || declared[1] !== real[1]) {
      throw new SupportTicketError(422, 'Os actors declarados não correspondem às partes reais do fato de negócio referenciado');
    }

    return supportTicketRepository.create(tenantId, {
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      fromActorId,
      toActorId: input.toActorId,
      subject: input.subject.trim(),
      message: input.message.trim(),
      createdByUserId: userId,
    });
  }

  /** Responder/mudar status. `respondingActorId` já provado representável pela rota — precisa
   *  ser UMA DAS DUAS partes do próprio chamado (from OU to); estranho nunca passa. */
  async respond(tenantId: string, respondingActorId: string, userId: string, ticketId: string, input: RespondSupportTicketInput): Promise<SupportTicket> {
    const ticket = await supportTicketRepository.findById(tenantId, ticketId);
    if (!ticket) throw new SupportTicketError(404, 'Chamado não encontrado');
    if (ticket.fromActorId !== respondingActorId && ticket.toActorId !== respondingActorId) {
      throw new SupportTicketError(403, 'Só as partes do próprio chamado podem responder');
    }
    if (!SUPPORT_TICKET_STATUSES.includes(input.status)) {
      throw new SupportTicketError(400, `status inválido: fora do vocabulário governado (${SUPPORT_TICKET_STATUSES.join('/')})`);
    }
    const updated = await supportTicketRepository.respond(tenantId, ticketId, input.status, userId);
    if (!updated) throw new SupportTicketError(404, 'Chamado não encontrado');
    return updated;
  }

  async listMine(tenantId: string, actorId: string, filters: SupportTicketFilters = {}): Promise<SupportTicket[]> {
    return supportTicketRepository.listForActor(tenantId, actorId, filters);
  }

  async listEligibleReferences(tenantId: string, actorId: string, counterpartActorId: string) {
    if (counterpartActorId === actorId) return [];
    return supportTicketRepository.listEligibleReferences(tenantId, actorId, counterpartActorId);
  }
}

export const supportTicketService = new SupportTicketService();
