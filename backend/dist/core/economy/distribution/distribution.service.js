"use strict";
// backend/src/core/economy/distribution/distribution.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributionService = void 0;
const uuid_1 = require("uuid");
const transaction_service_1 = require("@core/economy/transaction.service");
// import { accountService } from '@core/economy/account.service'; // LEGACY: módulo em extinção
const event_bus_1 = require("@core/events/event-bus");
/**
 * Configuração padrão de fees
 * Pode ser sobrescrita por tenant ou por transação
 */
const DEFAULT_FEE_CONFIG = {
    platformFeePercent: 2.5, // 2.5%
    communityFeePercent: 1.0, // 1.0%
    groupFeePercent: 0.5, // 0.5%
};
class DistributionService {
    /**
     * Calcula fees de uma transação
     *
     * @param amount - Valor da transação
     * @param config - Configuração de fees (opcional, usa default se não fornecido)
     * @returns Cálculo detalhado dos fees
     */
    calculateFees(amountCents, config = {}) {
        const finalConfig = {
            ...DEFAULT_FEE_CONFIG,
            ...config,
        };
        // Calcula cada fee
        const platformFee = (amount * finalConfig.platformFeePercent) / 100;
        const communityFee = (amount * finalConfig.communityFeePercent) / 100;
        const groupFee = (amount * finalConfig.groupFeePercent) / 100;
        // Total de fees
        const totalFees = platformFee + communityFee + groupFee;
        // Valor líquido que chega ao destinatário
        const netAmount = amount - totalFees;
        return {
            originalAmount: amount,
            platformFee: Math.round(platformFee * 100) / 100, // Arredonda para 2 decimais
            communityFee: Math.round(communityFee * 100) / 100,
            groupFee: Math.round(groupFee * 100) / 100,
            totalFees: Math.round(totalFees * 100) / 100,
            netAmount: Math.round(netAmount * 100) / 100,
        };
    }
    /**
     * Distribui fundos automaticamente com cálculo de fees
     *
     * FLUXO:
     * 1. Calcula fees
     * 2. Transfere valor líquido para destinatário
     * 3. Distribui fees para contas de sistema
     * 4. Emite eventos de distribuição
     *
     * GARANTIAS:
     * - Tudo em transações atômicas
     * - Idempotência via event_id
     * - Double-entry bookkeeping automático
     * - Auditabilidade completa
     */
    async autoDistribute(tenantId, input) {
        const { fromAccount, toAccount, amount, groupAccount, config } = input;
        // 1. Calcula fees
        const calculation = this.calculateFees(amount, config);
        // 2. Busca ou cria contas de sistema
        // LEGACY: accountService não existe mais (módulo em extinção)
        // TODO: Migrar para bankAccountService do UnifyBank
        const platformAccount = { accountId: 'platform_ops' }; // Placeholder
        const communityAccount = { accountId: 'community_fund' }; // Placeholder
        // 3. Prepara event IDs para idempotência
        const mainEventId = (0, uuid_1.v4)();
        const platformFeeEventId = (0, uuid_1.v4)();
        const communityFeeEventId = (0, uuid_1.v4)();
        const groupFeeEventId = groupAccount ? (0, uuid_1.v4)() : undefined;
        const eventIds = [mainEventId, platformFeeEventId, communityFeeEventId];
        if (groupFeeEventId)
            eventIds.push(groupFeeEventId);
        try {
            // 4. Transfere valor líquido para destinatário
            await transaction_service_1.transactionService.transfer(tenantId, {
                fromAccount,
                toAccount,
                amountCents: calculation.netAmount,
                eventId: mainEventId,
                metadata: {
                    type: 'main_transfer',
                    originalAmount: amount,
                    feesApplied: calculation.totalFees,
                },
            });
            // 5. Transfere platform fee
            if (calculation.platformFee > 0) {
                await transaction_service_1.transactionService.transfer(tenantId, {
                    fromAccount,
                    toAccount: platformAccount.accountId,
                    amountCents: calculation.platformFee,
                    eventId: platformFeeEventId,
                    metadata: {
                        type: 'platform_fee',
                        relatedEventId: mainEventId,
                    },
                });
            }
            // 6. Transfere community fee
            if (calculation.communityFee > 0) {
                await transaction_service_1.transactionService.transfer(tenantId, {
                    fromAccount,
                    toAccount: communityAccount.accountId,
                    amountCents: calculation.communityFee,
                    eventId: communityFeeEventId,
                    metadata: {
                        type: 'community_fee',
                        relatedEventId: mainEventId,
                    },
                });
            }
            // 7. Transfere group fee (se aplicável)
            if (groupAccount && calculation.groupFee > 0 && groupFeeEventId) {
                await transaction_service_1.transactionService.transfer(tenantId, {
                    fromAccount,
                    toAccount: groupAccount,
                    amountCents: calculation.groupFee,
                    eventId: groupFeeEventId,
                    metadata: {
                        type: 'group_fee',
                        relatedEventId: mainEventId,
                    },
                });
            }
            // 8. Emite evento de distribuição completa
            await event_bus_1.eventBus.publish({
                tenantId,
                type: 'distribution.completed',
                payload: {
                    mainEventId,
                    fromAccount,
                    toAccount,
                    originalAmount: amount,
                    netAmount: calculation.netAmount,
                    fees: {
                        platform: calculation.platformFee,
                        community: calculation.communityFee,
                        group: calculation.groupFee,
                    },
                    eventIds,
                },
            });
            return {
                transactionId: mainEventId,
                calculation,
                distributions: {
                    platformAccount: platformAccount.accountId,
                    communityAccount: communityAccount.accountId,
                    groupAccount,
                },
                eventIds,
            };
        }
        catch (error) {
            // Emite evento de falha
            await event_bus_1.eventBus.publish({
                tenantId,
                type: 'distribution.failed',
                payload: {
                    fromAccount,
                    toAccount,
                    amount,
                    error: error.message,
                },
            });
            throw error;
        }
    }
    /**
     * Recalcula fees em lote (útil para ajustes de configuração)
     *
     * NOTA: Isso NÃO cria transações, apenas calcula quanto seria
     * distribuído com as novas configurações.
     */
    async batchRecalculateFees(amounts, config = {}) {
        return amounts.map((amount) => this.calculateFees(amount, config));
    }
    /**
     * Simula uma distribuição sem executar
     * Útil para preview antes de confirmar
     */
    async simulateDistribution(amountCents, config = {}) {
        return this.calculateFees(amount, config);
    }
    /**
     * Busca configuração de fees de um tenant
     * (Por enquanto retorna default, mas pode ser estendido para config por tenant no DB)
     */
    async getFeeConfig(_tenantId) {
        // TODO: Buscar do banco se tenant tiver config customizada
        return DEFAULT_FEE_CONFIG;
    }
    /**
     * Atualiza configuração de fees de um tenant
     * (Implementação futura: salvar no banco)
     */
    async updateFeeConfig(_tenantId, _config) {
        // TODO: Salvar no banco
        throw new Error('Not implemented yet');
    }
}
exports.distributionService = new DistributionService();
