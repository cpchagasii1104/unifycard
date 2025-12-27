"use strict";
// src/core/catalog/catalog-payment.service.ts
//
// Serviço de pagamento para catálogo/marketplace (pedidos)
// Integrado com SplitEngine para garantir redistribuição automática
//
// NOTA: Esta função será chamada quando o fluxo de finalização de pedido for implementado
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogPaymentService = void 0;
const account_service_1 = require("../economy/accounts/account.service");
const split_service_1 = require("../economy/split.service");
const region_account_service_1 = require("../economy/region-account.service");
const group_account_service_1 = require("../economy/group-account.service");
class CatalogPaymentService {
    /**
     * Processa pagamento de pedido do catálogo
     * Usa SplitEngine para redistribuir automaticamente
     *
     * Destinos típicos:
     * - Vendedor/Merchant → WORKER
     * - Tenant/Plataforma → TENANT
     * - Região → REGION
     * - Grupos do usuário → GROUP
     */
    async processOrderPayment(input) {
        const { tenantId, orderId, buyerUserId, sellerUserId, amount, currency = 'BRL', } = input;
        // 1. Buscar ou criar contas
        const buyerAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, buyerUserId, currency);
        const tenantAccount = await account_service_1.accountService.getPlatformAccount(tenantId, currency);
        // 2. Resolver conta do vendedor (se houver)
        let sellerAccountId;
        if (sellerUserId) {
            const sellerAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, sellerUserId, currency);
            sellerAccountId = sellerAccount.accountId;
        }
        // 3. Resolver regionAccountId e groupAccountIds
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
            userId: buyerUserId,
        });
        const groupAccountIds = await group_account_service_1.groupAccountService.resolveGroupAccountIds({
            tenantId,
            userId: buyerUserId,
        });
        // 4. Preparar contexto para SplitEngine
        const splitContext = {
            tenantId,
            amount,
            currency,
            source: 'catalog',
            customerAccountId: buyerAccount.accountId,
            workerAccountId: sellerAccountId, // Vendedor recebe como WORKER
            tenantAccountId: tenantAccount.accountId,
            regionAccountId,
            groupAccountIds,
            metadata: {
                module: 'catalog',
                type: 'order_payment',
                orderId,
                buyerUserId,
                sellerUserId,
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
exports.catalogPaymentService = new CatalogPaymentService();
//# sourceMappingURL=catalog-payment.service.js.map