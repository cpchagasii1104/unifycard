"use strict";
// src/modules/events/events-payment.service.ts
//
// Serviço de pagamento para eventos (ingressos)
// Integrado com SplitEngine para garantir redistribuição automática
//
// NOTA: Esta função será chamada quando o fluxo de compra de ingressos for implementado
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsPaymentService = void 0;
const account_service_1 = require("@core/economy/accounts/account.service");
const split_service_1 = require("@core/economy/split.service");
const region_account_service_1 = require("@core/economy/region-account.service");
const group_account_service_1 = require("@core/economy/group-account.service");
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
    async processEventPayment(input) {
        const { tenantId, eventId, attendeeUserId, organizerId, amount, currency = 'BRL', } = input;
        // 1. Buscar ou criar contas
        const attendeeAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, attendeeUserId, currency);
        const tenantAccount = await account_service_1.accountService.getPlatformAccount(tenantId, currency);
        // 2. Resolver conta do organizador (se houver)
        let organizerAccountId;
        if (organizerId) {
            // Buscar organizador e obter conta associada
            // Por enquanto, usar tenantAccount como placeholder
            // TODO: Criar conta específica do organizador quando sistema de organizadores tiver contas
            organizerAccountId = tenantAccount.accountId; // Placeholder
        }
        // 3. Resolver regionAccountId e groupAccountIds
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
            userId: attendeeUserId,
        });
        const groupAccountIds = await group_account_service_1.groupAccountService.resolveGroupAccountIds({
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
        const splitResult = await split_service_1.splitEngineService.applySplits(splitContext);
        return {
            transactionIds: splitResult.splits
                .map(s => s.transactionId)
                .filter((id) => !!id),
            splits: splitResult.splits.map(s => ({
                targetType: s.rule.targetType,
                amount: s.amount,
                transactionId: s.transactionId,
            })),
        };
    }
}
exports.eventsPaymentService = new EventsPaymentService();
//# sourceMappingURL=events-payment.service.js.map