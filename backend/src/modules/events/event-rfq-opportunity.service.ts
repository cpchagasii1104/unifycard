// backend/src/modules/events/event-rfq-opportunity.service.ts
// Service para integração Event RFQ → Opportunity Dispatch
// ⚠️ REGRAS CANÔNICAS:
// - Disparo é EXPLÍCITO (organizador escolhe empresas manualmente)
// - NÃO dispara automaticamente
// - NÃO cria ranking
// - Apenas notifica empresas selecionadas

import { opportunityDispatchService } from '@modules/dispatch/opportunity-dispatch.service';
import { OpportunityType } from '@modules/dispatch/opportunity-dispatch.types';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import { HttpError } from '@core/errors/http-error';
import type { EventRFQ } from './event-rfq.types';

/**
 * Service para disparo de oportunidades a partir de RFQ
 * ⚠️ REGRAS: Disparo é EXPLÍCITO, não automático
 */
class EventRFQOpportunityService {
  /**
   * 🔴 F-EVENT-RFQ-DISPATCH-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. A rota DECIDE permissão (assertCanReadEventMoney
   * resolve o organizer server-side + canRepresentActor); quarentena DECIDE se o organizer está ATIVO. Disparo é
   * opportunity/notification (money-free): NÃO cria booking/payment_request/payment_intent/Bank. O scope é o ORGANIZER
   * do RFQ (rfq.organizerActorId — actor JÁ bound em createRFQ), NUNCA actionContext/userId cru. companyActorIds são
   * TARGETS passivos (recebem oportunidade), não executores — não se gateia o alvo. 403 ACTOR_EFFECTIVELY_BLOCKED.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw HttpError.forbidden(
        'ACTOR_EFFECTIVELY_BLOCKED: organizer em quarentena (ou âncora humana bloqueada) — disparo de RFQ bloqueado (§4.8.4).'
      );
    }
  }

  /**
   * Dispara oportunidades para empresas selecionadas manualmente
   * ⚠️ REGRAS: Organizador escolhe empresas, sistema apenas notifica
   */
  async dispatchRFQToCompanies(
    tenantId: string,
    userId: string,
    rfq: EventRFQ,
    companyActorIds: string[]
  ): Promise<{ dispatched: number; errors: Array<{ actorId: string; error: string }> }> {
    // 🔴 F-EVENT-RFQ-DISPATCH-QUARANTINE-GATE: organizer (scope) bloqueado não dispara. ANTES de qualquer createDispatch.
    await this.assertActorNotQuarantined(tenantId, rfq.organizerActorId);

    const errors: Array<{ actorId: string; error: string }> = [];
    let dispatched = 0;

    // Disparar para cada empresa selecionada
    for (const companyActorId of companyActorIds) {
      try {
        await opportunityDispatchService.createDispatch(tenantId, userId, {
          opportunityId: rfq.rfqId,
          opportunityType: OpportunityType.SERVICE,
          targetActorId: companyActorId,
          metadata: {
            rfqId: rfq.rfqId,
            eventId: rfq.eventId,
            contextType: 'rfq',
          },
        });
        dispatched++;
      } catch (error: any) {
        errors.push({
          actorId: companyActorId,
          error: error.message || 'Erro ao criar dispatch',
        });
      }
    }

    return { dispatched, errors };
  }
}

export const eventRFQOpportunityService = new EventRFQOpportunityService();



