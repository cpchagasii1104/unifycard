// backend/src/modules/events/event-rfq-opportunity.service.ts
// Service para integração Event RFQ → Opportunity Dispatch
// ⚠️ REGRAS CANÔNICAS:
// - Disparo é EXPLÍCITO (organizador escolhe empresas manualmente)
// - NÃO dispara automaticamente
// - NÃO cria ranking
// - Apenas notifica empresas selecionadas

import { opportunityDispatchService } from '@modules/dispatch/opportunity-dispatch.service';
import { OpportunityType } from '@modules/dispatch/opportunity-dispatch.types';
import type { EventRFQ } from './event-rfq.types';

/**
 * Service para disparo de oportunidades a partir de RFQ
 * ⚠️ REGRAS: Disparo é EXPLÍCITO, não automático
 */
class EventRFQOpportunityService {
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



