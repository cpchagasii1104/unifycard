// src/modules/events/events-payment.service.ts
//
// Serviço de pagamento para eventos (ingressos)
// Integrado com SplitEngine para garantir redistribuição automática
//
// NOTA: Esta função será chamada quando o fluxo de compra de ingressos for implementado

import { accountService } from '@core/economy/accounts/account.service';
import { splitEngineService } from '@core/economy/split.service';
import { regionAccountService } from '@core/economy/region-account.service';
import { groupAccountService } from '@core/economy/group-account.service';
import { runQueryWithTenant } from '@core/database/pool';

interface ProcessEventPaymentInput {
  tenantId: string;
  eventId: string;
  attendeeUserId: string; // Usuário que está comprando ingresso
  organizerId?: string; // Organizador do evento (se houver)
  amount: number;
  currency?: string;
}

interface ProcessEventPaymentResult {
  transactionIds: string[];
  splits: Array<{
    targetType: string;
    amount: number;
    transactionId?: string;
  }>;
}

class EventsPaymentService {
  /**
   * Processa pagamento de ingresso de evento
   * Usa SplitEngine para redistribuir automaticamente
   * 
   * Destinos típicos:
   * - Organizador (se houver) → WORKER
   * - Tenant/Plataforma → TENANT
   * - Região → REGION
   * - Grupos do usuário → GROUP
   */
  async processEventPayment(input: ProcessEventPaymentInput): Promise<ProcessEventPaymentResult> {
    const {
      tenantId,
      eventId,
      attendeeUserId,
      organizerId,
      amount,
      currency = 'BRL',
    } = input;

    // 1. Buscar ou criar contas
    const attendeeAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      attendeeUserId,
      currency as any
    );

    const tenantAccount = await accountService.getPlatformAccount(tenantId, currency as any);

    // 2. Resolver conta do organizador (se houver)
    let organizerAccountId: string | undefined;
    if (organizerId) {
      // Buscar organizador e obter conta associada
      // Por enquanto, usar tenantAccount como placeholder
      // TODO: Criar conta específica do organizador quando sistema de organizadores tiver contas
      organizerAccountId = tenantAccount.accountId; // Placeholder
    }

    // 3. Resolver regionAccountId e groupAccountIds
    const regionAccountId = await regionAccountService.resolveRegionAccountId({
      tenantId,
      userId: attendeeUserId,
    });

    const groupAccountIds = await groupAccountService.resolveGroupAccountIds({
      tenantId,
      userId: attendeeUserId,
    });

    // 4. Preparar contexto para SplitEngine
    const splitContext = {
      tenantId,
      amount,
      currency,
      source: 'events',
      customerAccountId: attendeeAccount.accountId,
      workerAccountId: organizerAccountId, // Organizador recebe como WORKER
      tenantAccountId: tenantAccount.accountId,
      regionAccountId,
      groupAccountIds,
      metadata: {
        module: 'events',
        type: 'event_ticket_purchase',
        eventId,
        attendeeUserId,
        organizerId,
      },
    };

    // 5. Aplicar splits via SplitEngine
    const splitResult = await splitEngineService.applySplits(splitContext);

    return {
      transactionIds: splitResult.splits
        .map(s => s.transactionId)
        .filter((id): id is string => !!id),
      splits: splitResult.splits.map(s => ({
        targetType: s.rule.targetType,
        amount: s.amount,
        transactionId: s.transactionId,
      })),
    };
  }
}

export const eventsPaymentService = new EventsPaymentService();















