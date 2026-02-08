// src/core/catalog/catalog-payment.service.ts
// ⚠️ DEPRECATED: Este serviço não está em uso ativo e usa @core/economy (legacy)
// 
// STATUS: P2 - Não alcançável via rotas HTTP ativas
// 
// NOTA: Este serviço será migrado para Unify Bank quando o fluxo de catálogo/marketplace
// for implementado. Por enquanto, mantido para compatibilidade mas não deve ser usado
// por módulos ativos.
//
// Para novos pagamentos de catálogo, use:
// - bankIntegrationService.processServiceBookingPayment() para serviços
// - bankTransactionService.createTransactionWithSplit() com contexto apropriado

import { accountService } from '../economy/accounts/account.service';
import { splitEngineService } from '../economy/split.service';
import { regionAccountService } from '../economy/region-account.service';
import { groupAccountService } from '../economy/group-account.service';
import { referralSplitService } from '../economy/referral-split.service';
import { devLog } from '@utils/devLog';

interface ProcessCatalogOrderPaymentInput {
  tenantId: string;
  orderId: string;
  buyerUserId: string; // Usuário que está comprando
  sellerUserId?: string; // Vendedor/merchant (se houver)
  amountCents: number;
  currency?: string;
}

interface ProcessCatalogOrderPaymentResult {
  transactionIds: string[];
  splits: Array<{
    targetType: string;
    amountCents: number;
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

    // 6. Processar split de referral (se aplicável)
    // Buscar transactionId do primeiro split (ou usar base transaction)
    const baseTransactionId = splitResult.splits[0]?.transactionId || '';
    
    if (baseTransactionId && sellerUserId) {
      try {
        await referralSplitService.processReferralSplit({
          tenantId,
          transactionId: baseTransactionId,
          sourceUserId: sellerUserId, // Vendedor que recebeu o pagamento
          amountCents: Math.floor(amount * 100), // Converter para centavos
          percentageBps: 500, // 5% de comissão para indicador
          metadata: {
            type: 'service_payment',
            orderId,
            buyerUserId,
            sellerUserId,
          },
        });
      } catch (err) {
        // Não falha o pagamento se split falhar
        devLog.warn('referral.split.service_payment_error', { 
          error: err instanceof Error ? err.message : String(err),
          orderId,
          sellerUserId,
        });
      }
    }

    return {
      transactionIds: splitResult.splits
        .map(s => s.transactionId)
        .filter((id): id is string => !!id),
      splits: splitResult.splits.map(s => ({
        targetType: s.rule.targetType,
        amountCents: s.amount,
        transactionId: s.transactionId,
      })),
    };
  }
}

export const catalogPaymentService = new CatalogPaymentService();



















