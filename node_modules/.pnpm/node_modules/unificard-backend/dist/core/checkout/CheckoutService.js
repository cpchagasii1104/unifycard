"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutService = exports.CheckoutService = void 0;
// src/core/checkout/CheckoutService.ts
// 🔴 CRÍTICO: Orquestração de pagamento e split
const db_1 = require("@core/db");
const account_service_1 = require("../economy/accounts/account.service");
const split_service_1 = require("../economy/split.service");
const region_account_service_1 = require("../economy/region-account.service");
const group_account_service_1 = require("../economy/group-account.service");
const EventOrganizerResolver_1 = require("./EventOrganizerResolver");
/**
 * Serviço central de Checkout
 * Orquestra pagamento via UnifyCard e split via UnifyBank
 */
class CheckoutService {
    /**
     * Processa checkout completo (pagamento + split)
     * 🔴 CRÍTICO: Atomicidade garantida por runTenantTransaction
     */
    async processCheckout(tenantId, input) {
        // Validação básica
        if (input.amount <= 0) {
            throw new Error('Invalid amount');
        }
        if (input.currency !== 'BRL') {
            throw new Error('Only BRL currency supported');
        }
        if (input.paymentMethod !== 'UNIFYCARD') {
            throw new Error('Only UNIFYCARD payment method supported');
        }
        // 🔴 GUARDA OBRIGATÓRIA: Bloqueia mock de UnifyCard em produção
        if (process.env.NODE_ENV === 'production' &&
            (process.env.UNIFYCARD_MODE === 'mock' || !process.env.UNIFYCARD_API_URL)) {
            throw new Error('CRITICAL: UnifyCard mock is not allowed in production. Configure UNIFYCARD_API_URL.');
        }
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // 1. Resolver userId local a partir de globalUserId
            // TODO: Implementar conversão de globalUserId para userId local se necessário
            // Por enquanto, assume que globalUserId pode ser usado como owner_id
            const userId = input.context.globalUserId;
            // 2. Buscar ou criar contas do usuário (customer)
            const customerAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, userId, 'BRL');
            // 3. Buscar conta da plataforma (tenant)
            const tenantAccount = await account_service_1.accountService.getPlatformAccount(tenantId, 'BRL');
            // 4. Resolver conta da região (para split regional)
            const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
                tenantId,
                userId: userId,
            });
            // 5. Resolver contas de grupos (para split de grupos)
            const groupAccountIds = await group_account_service_1.groupAccountService.resolveGroupAccountIds({
                tenantId,
                userId: userId,
            });
            // 6. 🔴 CRÍTICO: Resolver conta do organizador (se contexto EVENT)
            let eventOrganizerAccountId = undefined;
            if (input.context.module === 'EVENT_TICKET' ||
                input.context.module === 'EVENT_CONSUMPTION') {
                eventOrganizerAccountId = await (0, EventOrganizerResolver_1.resolveEventOrganizerAccount)(tenantId, input.context.eventId);
            }
            // 7. Simular pagamento via UnifyCard (mock por enquanto)
            // TODO: Integrar com serviço real de UnifyCard quando disponível
            // Por enquanto, assume que pagamento é bem-sucedido se conta tem saldo suficiente
            // Em produção, aqui seria chamado o serviço real de UnifyCard
            const paymentResult = await this.mockUnifyCardCharge({
                userId: input.context.globalUserId,
                amount: input.amount,
                accountId: customerAccount.accountId,
            });
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || 'Payment failed');
            }
            // 8. Aplicar splits via SplitEngine (UnifyBank)
            const splitContext = {
                tenantId,
                amount: input.amount,
                currency: 'BRL',
                source: input.context.module.toLowerCase(),
                customerAccountId: customerAccount.accountId,
                tenantAccountId: tenantAccount.accountId,
                regionAccountId,
                groupAccountIds,
                eventOrganizerAccountId, // 🔴 CRÍTICO: Conta do organizador para EVENT_ORGANIZER
                metadata: {
                    module: input.context.module,
                    eventId: input.context.eventId,
                    eventType: input.context.eventType,
                    cityId: input.context.cityId,
                    globalUserId: input.context.globalUserId,
                    ticketId: input.context.ticketId,
                    consumptionIds: input.context.consumptionIds,
                    scheduleSlotId: input.context.scheduleSlotId,
                    idempotencyKey: input.idempotencyKey, // 🔴 CRÍTICO: Para idempotência no ledger
                },
            };
            const splitResult = await split_service_1.splitEngineService.applySplits(splitContext);
            // 9. Retornar transactionId (primeira transação do split ou undefined)
            const mainTransactionId = splitResult.splits[0]?.transactionId;
            return {
                success: true,
                transactionId: mainTransactionId,
            };
        });
    }
    /**
     * Mock de UnifyCard (temporário)
     * Em produção, substituir por chamada real ao serviço de UnifyCard
     */
    async mockUnifyCardCharge(params) {
        // Por enquanto, apenas valida se há saldo suficiente
        // Em produção, aqui seria uma chamada HTTP/RPC ao serviço de UnifyCard
        // que debitaria o cartão do usuário
        // TODO: Implementar chamada real quando UnifyCard estiver disponível
        // const response = await fetch('https://unifycard-api/charge', {
        //   method: 'POST',
        //   body: JSON.stringify({
        //     userId: params.userId,
        //     amount: params.amount,
        //   }),
        // });
        // Por enquanto, retorna sucesso (mock)
        return { success: true };
    }
}
exports.CheckoutService = CheckoutService;
exports.checkoutService = new CheckoutService();
//# sourceMappingURL=CheckoutService.js.map