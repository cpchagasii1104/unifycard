// src/core/catalog/catalog-payment.service.ts
//
// Serviço de pagamento para catálogo/marketplace (pedidos)
// Integrado com SplitEngine para garantir redistribuição automática
//
// NOTA: Esta função será chamada quando o fluxo de finalização de pedido for implementado

import { accountService } from '../economy/accounts/account.service';
import { splitEngineService } from '../economy/split.service';
import { regionAccountService } from '../economy/region-account.service';
import { groupAccountService } from '../economy/group-account.service';

interface ProcessCatalogOrderPaymentInput {
  tenantId: string;
  orderId: string;
  buyerUserId: string; // Usuário que está comprando
  sellerUserId?: string; // Vendedor/merchant (se houver)
  amount: number;
  currency?: string;
}

interface ProcessCatalogOrderPaymentResult {
  transactionIds: string[];
  splits: Array<{
    targetType: string;
    amount: number;
    transactionId?: string;
  }>;
}

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
  async processOrderPayment(input: ProcessCatalogOrderPaymentInput): Promise<ProcessCatalogOrderPaymentResult> {
    const {
      tenantId,
      orderId,
      buyerUserId,
      sellerUserId,
      amount,
      currency = 'BRL',
    } = input;

    // 1. Buscar ou criar contas
    const buyerAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      buyerUserId,
      currency as any
    );

    const tenantAccount = await accountService.getPlatformAccount(tenantId, currency as any);

    // 2. Resolver conta do vendedor (se houver)
    let sellerAccountId: string | undefined;
    if (sellerUserId) {
      const sellerAccount = await accountService.getOrCreateUserPrimaryAccount(
        tenantId,
        sellerUserId,
        currency as any
      );
      sellerAccountId = sellerAccount.accountId;
    }

    // 3. Resolver regionAccountId e groupAccountIds
    const regionAccountId = await regionAccountService.resolveRegionAccountId({
      tenantId,
      userId: buyerUserId,
    });

    const groupAccountIds = await groupAccountService.resolveGroupAccountIds({
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

export const catalogPaymentService = new CatalogPaymentService();















