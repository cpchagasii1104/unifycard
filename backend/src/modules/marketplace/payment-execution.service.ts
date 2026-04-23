// backend/src/modules/marketplace/payment-execution.service.ts
// SPRINT 39.2: MARKETPLACE EXECUÇÃO - Payment Execution (Bank)
// Service para execução de pagamentos reais

import { v4 as uuidv4 } from 'uuid';
import { paymentIntentService } from './payment-intent.service';
import { orderRepository } from './order.repository';
import { bankAccountService } from '../bank/bank-account.service';
import { bankTransactionService } from '../bank/bank-transaction.service';
import { getClientWithTenant } from '@core/database/pool';
import { logger } from '@core/observability/logger';
import { registerFundsReceived, validatePayoutCooldown } from '@core/financial/payout-safety';
import { validateWithdrawalVelocity } from '@core/financial/withdrawal-velocity';
import { logFinancialEvent } from '@core/observability/financial-logger';
import type { PaymentTransaction, ExecutePaymentInput } from './payment-intent.types';
import type { BankCurrency } from '../bank/bank-account.types';
import { paymentTransactionRepository } from '../payments/payment-transaction.repository';

/**
 * Service para execução de pagamentos
 *
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Pagamento só ocorre a partir de intent AUTHORIZED
 * - Falha não executa side-effects
 * - Nenhuma lógica de split ainda
 * - NÃO recalcular valor (usa amount do intent)
 * - NÃO criar split ou payout
 *
 * Réplica padrão bank/escrow — **amount SSOT**:
 * - `payment_intents.amount_cents` é a única fonte de verdade do valor a liquidar.
 * - PIX / link / provider só **referenciam**; qualquer divergência → `PAYMENT_AMOUNT_MISMATCH` (fail-closed).
 * - `bankTransactionService.transfer` recebe sempre `intent.amountCents` neste fluxo (nunca montante vindo só do PIX).
 */
class PaymentExecutionService {
  private roundMoneyCents(value: number): number {
    return Math.round(Number(value));
  }

  /**
   * Garante que um montante observado (ex.: linha `pix_charges`) coincide com o intent.
   * Webhook e provider são *trigger*, não fonte de valor.
   */
  private assertAmountMatchesIntent(
    tenantId: string,
    paymentIntentId: string,
    intentAmountCents: number,
    observedAmountCents: number,
    observedSource: string,
    traceId?: string | null
  ): void {
    const expected = this.roundMoneyCents(intentAmountCents);
    const actual = this.roundMoneyCents(observedAmountCents);
    if (expected !== actual) {
      logFinancialEvent({
        financial_event: 'payment_amount_mismatch',
        tenant_id: tenantId,
        trace_id: traceId ?? undefined,
        metadata: {
          payment_intent_id: paymentIntentId,
          intent_amount_cents: expected,
          observed_amount_cents: actual,
          observed_source: observedSource,
        },
      });
      throw new Error('PAYMENT_AMOUNT_MISMATCH');
    }
  }

  /** Correlação única intent → transaction → pix → bank (sem OpenTelemetry). */
  private logPaymentFlowStep(
    tenantId: string,
    traceId: string,
    step: string,
    fields: Record<string, unknown>
  ): void {
    logFinancialEvent({
      financial_event: 'payment_flow_step',
      tenant_id: tenantId,
      trace_id: traceId,
      metadata: { step, ...fields },
    });
  }

  /**
   * Executa pagamento a partir de um Payment Intent
   * 
   * Fluxo:
   * 1. Validar intent.status === AUTHORIZED
   * 2. Criar payment_transaction com status PENDING
   * 3. Chamar Bank service existente
   * 4. Se sucesso: salvar bank_transaction_id, status = SUCCESS
   * 5. Se falha: status = FAILED, salvar error_code
   * 6. Atualizar PaymentIntent status
   */
  async executePayment(
    tenantId: string,
    input: ExecutePaymentInput & { idempotencyKey?: string }
  ): Promise<PaymentTransaction> {
    const { paymentIntentId, buyerActorId, sellerActorId, actingUserId, idempotencyKey } = input;

    // SPRINT 52: Log estruturado
    logger.info('Payment execution started', {
      tenantId,
      paymentIntentId,
      buyerActorId,
      sellerActorId,
      actingUserId,
      idempotencyKey,
    });

    // SPRINT 41.2: Idempotência - verificar se já existe transação com mesma key
    if (idempotencyKey) {
      const existing = await paymentTransactionRepository.getTransactionByIdempotencyKey(
        tenantId,
        paymentIntentId,
        idempotencyKey
      );
      if (existing) {
        // Retornar transação existente (idempotente)
        logger.info('Payment execution idempotent (existing transaction)', {
          tenantId,
          paymentIntentId,
          transactionId: existing.id,
        });
        return existing;
      }
    }

    // 1. Validar intent.status === AUTHORIZED
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    if (intent.status !== 'AUTHORIZED') {
      throw new Error(
        `Payment intent não está autorizado. Status atual: ${intent.status}. Apenas AUTHORIZED pode ser executado.`
      );
    }

    const traceId = intent.traceId;
    this.logPaymentFlowStep(tenantId, traceId, 'intent_authorized', {
      payment_intent_id: paymentIntentId,
      order_id: intent.orderId,
      amount_cents: intent.amountCents,
      currency: intent.currency,
    });

    const priorTx = await paymentTransactionRepository.findByIntentId(tenantId, paymentIntentId);
    if (priorTx?.status === 'SUCCESS') {
      logger.info('Payment execution idempotent (intent already SUCCESS)', {
        tenantId,
        paymentIntentId,
        transactionId: priorTx.id,
      });
      return priorTx;
    }
    if (priorTx?.status === 'FAILED') {
      throw new Error('PAYMENT_TRANSACTION_PREVIOUSLY_FAILED');
    }

    // Buscar order para validar buyer/seller
    const order = await orderRepository.getOrderById(tenantId, intent.orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${intent.orderId}`);
    }

    if (order.buyerActorId !== buyerActorId) {
      throw new Error(`Buyer actor não corresponde ao pedido`);
    }

    if (order.sellerActorId !== sellerActorId) {
      throw new Error(`Seller actor não corresponde ao pedido`);
    }

    try {
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: buyerActorId,
        action: 'financial_payment',
        amountCents: intent.amountCents,
      });
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      if (err.statusCode === 403) {
        throw new Error(err.message === 'ACTOR_RISK_LIMIT_EXCEEDED' ? 'PAYMENT_RISK_LIMIT' : 'PAYMENT_RISK_BLOCKED');
      }
      throw e;
    }

    const isPix = intent.metadata?.payment_method_snapshot?.type === 'PIX';

    // 2. Estado interno primeiro (1 intent → 1 payment_transaction); depois provider (PIX).
    const paymentTransaction = await paymentTransactionRepository.createTransaction(
      tenantId,
      paymentIntentId,
      intent.amountCents,
      intent.currency,
      traceId,
      idempotencyKey
    );
    this.logPaymentFlowStep(tenantId, traceId, 'payment_transaction_pending', {
      payment_intent_id: paymentIntentId,
      payment_transaction_id: paymentTransaction.id,
      amount_cents: intent.amountCents,
    });

    let pixCharge: any = null;
    if (isPix) {
      try {
        const { pixService } = await import('../payments/pix.service');
        const { contactService } = await import('./contact.service');

        let payerTaxId: string | undefined;
        let payerName: string | undefined;
        const payerContactId = intent.metadata?.payerContactId;
        if (payerContactId) {
          const contact = await contactService.getContactById(tenantId, payerContactId);
          if (contact) {
            payerTaxId = contact.taxId || undefined;
            payerName = contact.name;
          }
        }

        pixCharge = await pixService.createPixCharge(tenantId, {
          paymentIntentId,
          amountCents: intent.amountCents,
          currency: intent.currency,
          expiresInMinutes: 30,
          payerTaxId,
          payerName,
          metadata: {
            trace_id: traceId,
            order_id: intent.orderId,
            buyer_actor_id: buyerActorId,
            seller_actor_id: sellerActorId,
          },
        });
      } catch (pixError) {
        console.warn('[PaymentExecution] Erro ao criar PixCharge:', pixError);
      }
      if (pixCharge) {
        this.assertAmountMatchesIntent(
          tenantId,
          paymentIntentId,
          intent.amountCents,
          pixCharge.amountCents,
          'pix_charge_after_create',
          traceId
        );
        await paymentTransactionRepository.setProviderReference(
          tenantId,
          paymentTransaction.id,
          'pix',
          pixCharge.id
        );
        const currentMetadata = paymentTransaction.metadata || {};
        await paymentTransactionRepository.updateMetadata(tenantId, paymentTransaction.id, {
          ...currentMetadata,
          pix_charge_id: pixCharge.id,
          pix_qr_code: pixCharge.payloadSnapshot.qrCode,
          pix_qr_code_text: pixCharge.payloadSnapshot.qrCodeText,
          pix_expiresAt: pixCharge.expiresAt.toISOString(),
        });
      }
    }

    if (isPix && pixCharge) {
      const refreshed = await paymentTransactionRepository.getTransactionById(
        tenantId,
        paymentTransaction.id
      );
      return refreshed ?? paymentTransaction;
    }

    let compensableBankTransactionId: string | undefined;

    try {
      const { orderSagaService } = await import('@core/sagas/order-saga.service');
      const { getByOrderId } = await import('@modules/orders/order-saga.repository');

      // 3. Resolver contas do buyer e seller
      const buyerAccountId = await this.resolveActorAccount(
        tenantId,
        buyerActorId,
        intent.currency
      );

      const sellerAccountId = await this.resolveActorAccount(
        tenantId,
        sellerActorId,
        intent.currency
      );

      // SPRINT 73: Verificar se payment method é UNIFYCARD
      const paymentMethodSnapshot = intent.metadata?.payment_method_snapshot;
      const isUnifyCard = paymentMethodSnapshot?.provider === 'UNIFYCARD';
      
      // SPRINT 85: Verificar se payment method é PIX
      const isPix = paymentMethodSnapshot?.type === 'PIX';

      // SPRINT 82: Resolver taxa via UnifyCardMethodService se provider = UNIFYCARD
      let resolvedFeePercentage = paymentMethodSnapshot?.fee_percentage || 0;
      let resolvedSettlementDelayDays = paymentMethodSnapshot?.settlement_delay_days || 0;
      
      if (isUnifyCard && paymentMethodSnapshot?.type) {
        try {
          const { unifyCardMethodService } = await import('./unifycard-method.service');
          // Mapear tipo do payment_method para tipo do unifycard_method
          let unifyCardMethodType: string = paymentMethodSnapshot.type;
          if (paymentMethodSnapshot.type === 'CREDIT_CARD') {
            unifyCardMethodType = 'CREDIT';
          } else if (paymentMethodSnapshot.type === 'DEBIT_CARD') {
            unifyCardMethodType = 'DEBIT';
          } else if (paymentMethodSnapshot.type === 'VOUCHER') {
            unifyCardMethodType = 'VALE_REFEICAO'; // Default, pode ser ajustado
          }

          const feeInfo = await unifyCardMethodService.resolveFee(tenantId, unifyCardMethodType);
          
          // Usar taxa resolvida (não modifica o snapshot original)
          resolvedFeePercentage = feeInfo.feePercentage;
          resolvedSettlementDelayDays = feeInfo.settlementDelayDays;
        } catch (error) {
          // Log mas não bloqueia execução (compatibilidade)
          console.warn('[PaymentExecution] Erro ao resolver taxa UnifyCard:', error);
        }
      }

      if (await getByOrderId(tenantId, intent.orderId)) {
        await orderSagaService.advanceSaga(tenantId, intent.orderId, 'payment_pending');
      }

      let bankResult: any;
      if (isUnifyCard) {
        // SPRINT 73: Criar transação UnifyCard
        const { unifyCardService } = await import('./unifycard.service');
        
        // Determinar transaction type baseado no payment method type
        let transactionType: 'CREDIT' | 'DEBIT' | 'PIX' | 'VOUCHER' = 'CREDIT';
        if (paymentMethodSnapshot?.type === 'DEBIT_CARD') {
          transactionType = 'DEBIT';
        } else if (paymentMethodSnapshot?.type === 'PIX') {
          transactionType = 'PIX';
        } else if (paymentMethodSnapshot?.type === 'VOUCHER') {
          transactionType = 'VOUCHER';
        }

        // Autorizar transação UnifyCard
        const unifyCardTransaction = await unifyCardService.authorize(
          tenantId,
          {
            paymentIntentId,
            paymentMethodId: intent.metadata?.payment_method_id,
            transactionType,
            grossAmountCents: intent.amountCents,
            metadata: {
              trace_id: traceId,
              order_id: intent.orderId,
              buyer_actor_id: buyerActorId,
              seller_actor_id: sellerActorId,
            },
          },
          sellerActorId,
          sellerActorId,
          actingUserId
        );

        // Capturar imediatamente (simulação)
        const capturedTransaction = await unifyCardService.capture(
          tenantId,
          {
            transactionId: unifyCardTransaction.id,
          },
          sellerActorId,
          actingUserId
        );

        // Criar bank transaction simulado (futuro: usar ledger real)
        bankResult = {
          transactionId: `unifycard-${capturedTransaction.id}`,
          unifyCardTransactionId: capturedTransaction.id,
        };
      } else {
        // Settlement Step 4: Payment → Escrow (user_wallet → escrow_payments).
        // Seller is NOT touched here; funds stay in escrow until settlement (Step 5).
        await bankAccountService.ensurePlatformAccounts(tenantId, intent.currency as BankCurrency);
        const buyerUserId = await this.getBuyerUserId(tenantId, buyerActorId);
        await bankAccountService.ensureLifecycleAccountsForOwner(
          tenantId,
          buyerUserId,
          'user',
          intent.currency as BankCurrency
        );
        const userWalletAccount = await bankAccountService.getLifecycleAccount(
          tenantId,
          buyerUserId,
          'user',
          'user_wallet',
          intent.currency as BankCurrency
        );
        const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
          tenantId,
          'escrow_payments',
          intent.currency as BankCurrency
        );
        if (!userWalletAccount) {
          throw new Error(`Conta user_wallet não encontrada para o comprador (actor ${buyerActorId})`);
        }
        if (!escrowAccount) {
          throw new Error('Conta escrow_payments da plataforma não encontrada');
        }
        const userWalletAccountId = userWalletAccount.accountId;
        const escrowPaymentsAccountId = escrowAccount.accountId;

        const { buildFinancialAuthorshipFromRequest } = await import('../bank/financial-authorship.helper');
        const authorship = buildFinancialAuthorshipFromRequest({
          performedByUserId: actingUserId ?? null,
          actingForActorId: buyerActorId,
          actingForAccountId: userWalletAccountId,
          authoritySource: 'ownership',
          permissionSnapshot: {
            permissionKey: 'financial.transaction.execute',
            allowed: true,
            actorId: buyerActorId,
            userId: actingUserId ?? '',
            decidedAt: new Date().toISOString(),
          },
        });
        const eventId = uuidv4();
        // C56: order_id OBRIGATÓRIO — transação de receita marketplace (escrow payment)
        bankResult = await bankTransactionService.transfer(tenantId, {
          eventId,
          fromAccountId: userWalletAccountId,
          toAccountId: escrowPaymentsAccountId,
          amountCents: intent.amountCents,
          currency: intent.currency as BankCurrency,
          transactionType: 'transfer',
          description: `Marketplace payment (escrow): Order ${intent.orderId}`,
          metadata: {
            trace_id: traceId,
            payment_intent_id: paymentIntentId,
            order_id: intent.orderId,
            buyer_actor_id: buyerActorId,
            seller_actor_id: sellerActorId,
            acting_user_id: actingUserId,
            context: 'marketplace_payment',
            settlement_step: 'payment_to_escrow',
          },
          referenceType: 'marketplace_payment_escrow',
          referenceId: paymentIntentId,
          orderId: intent.orderId,
          authorship,
        });
        const tid = bankResult?.transactionId;
        if (typeof tid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tid)) {
          compensableBankTransactionId = tid;
        }
      }

      if (await getByOrderId(tenantId, intent.orderId)) {
        await orderSagaService.advanceSaga(tenantId, intent.orderId, 'paid');
      }

      // 5. Se sucesso: salvar bank_transaction_id, status = SUCCESS
      const successTransaction = await paymentTransactionRepository.markAsSuccess(
        tenantId,
        paymentTransaction.id,
        bankResult.transactionId
      );

      // SPRINT 82: Atualizar metadata com snapshot da taxa UnifyCard se aplicável
      const currentMetadata = successTransaction.metadata || {};
      const updatedMetadata: Record<string, any> = {
        ...currentMetadata,
        bank_transaction_id: bankResult.transactionId,
        unifycard_transaction_id: bankResult.unifyCardTransactionId,
      };

      // SPRINT 82: Adicionar snapshot da taxa se UnifyCard
      if (isUnifyCard && paymentMethodSnapshot) {
        updatedMetadata.unifycard_fee_snapshot = {
          fee_percentage: resolvedFeePercentage,
          settlement_delay_days: resolvedSettlementDelayDays,
          method_type: paymentMethodSnapshot.type,
        };
      }

      // Atualizar metadata apenas se houver mudanças
      if (JSON.stringify(currentMetadata) !== JSON.stringify(updatedMetadata)) {
        await paymentTransactionRepository.updateMetadata(
          tenantId,
          successTransaction.id,
          updatedMetadata
        );
      }

      // SPRINT 52: Log estruturado de sucesso
      logger.info('Payment execution succeeded', {
        tenantId,
        traceId,
        paymentIntentId,
        transactionId: successTransaction.id,
        bankTransactionId: bankResult.transactionId,
        amountCents: intent.amountCents,
        currency: intent.currency,
      });
      this.logPaymentFlowStep(tenantId, traceId, 'bank_transfer_success', {
        payment_intent_id: paymentIntentId,
        payment_transaction_id: successTransaction.id,
        bank_transaction_id: bankResult.transactionId,
        provider: successTransaction.paymentMethod ?? undefined,
        amount_cents: intent.amountCents,
      });

      // SPRINT 54: NÃO consumir reservas aqui - isso só acontece quando fulfillment é SHIPPED
      // Reservas permanecem ativas até o fulfillment ser enviado

      // SPRINT 44: Criar documento fiscal automaticamente após pagamento SUCCESS
      const { fiscalDocumentService } = await import('./fiscal-document.service');
      try {
        // Determinar tipo de documento baseado na origem do pedido
        // Se metadata.pdv_session_id existe → NFC-e (PDV)
        // Caso contrário → NF-e (Marketplace)
        const orderMetadata = order.metadata || {};
        let documentType = orderMetadata.pdv_session_id ? ('NFCE' as const) : ('NFE' as const);

        // SPRINT 75: Ajustar tipo baseado no regime tributário se disponível
        try {
          const { companyProfileService } = await import('./company-profile.service');
          const profile = await companyProfileService.getProfile(tenantId);
          if (profile) {
            // MEI geralmente usa NFC-e (simplificado)
            // Lucro Real/Presumido podem usar NF-e
            // Por enquanto, apenas sugerir (não forçar)
            // Futuro: política mais complexa baseada em regime
            if (profile.taxRegime === 'MEI' && !orderMetadata.pdv_session_id) {
              // MEI pode usar NFC-e mesmo no marketplace (simplificado)
              documentType = 'NFCE';
            }
          }
        } catch (profileError) {
          // Não bloquear se busca de perfil falhar
          console.warn(`[PaymentExecution] Erro ao buscar perfil da empresa:`, profileError);
        }

        await fiscalDocumentService.createFromOrder(
          tenantId,
          intent.orderId,
          paymentIntentId,
          documentType,
          intent.amountCents
        );
      } catch (fiscalError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn(`[PaymentExecution] Erro ao criar documento fiscal após pagamento SUCCESS para pedido ${intent.orderId}:`, fiscalError);
      }

      // SPRINT 54: Criar fulfillment automaticamente após pagamento SUCCESS
      const { fulfillmentService } = await import('./fulfillment.service');
      try {
        // Determinar origem baseado na origem do pedido
        const orderMetadata = order.metadata || {};
        const source = orderMetadata.pdv_session_id ? ('PDV' as const) : ('MARKETPLACE' as const);

        await fulfillmentService.createFromOrder(tenantId, intent.orderId, source);
      } catch (fulfillmentError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn(`[PaymentExecution] Erro ao criar fulfillment após pagamento SUCCESS para pedido ${intent.orderId}:`, fulfillmentError);
      }

      // SPRINT 74: Calcular comissão se houver referral code ou group
      let commissionSnapshot: any = null;
      try {
        const { commissionService } = await import('./commission.service');
        const { referralService } = await import('./referral.service');
        
        const orderMetadata = order.metadata || {};
        const referralCode = orderMetadata.referral_code;
        let referralCodeId: string | undefined;
        let groupId: string | undefined;

        // Resolver referral code se fornecido
        if (referralCode) {
          const resolved = await referralService.resolveCode(tenantId, referralCode);
          if (resolved) {
            referralCodeId = resolved.referralCode.id;
            groupId = resolved.groupId || undefined;
          }
        }

        // Calcular comissão
        const commissionCalculation = await commissionService.resolveCommission(tenantId, {
          amountCents: intent.amountCents,
          referralCodeId,
          groupId,
          paymentMethodId: intent.metadata?.payment_method_id,
        });

        commissionSnapshot = commissionCalculation.snapshot;
      } catch (commissionError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn(`[PaymentExecution] Erro ao calcular comissão para pedido ${intent.orderId}:`, commissionError);
      }

      // SPRINT 71: Criar conta a receber automaticamente após pagamento SUCCESS
      const { accountsReceivableService } = await import('./accounts-receivable.service');
      try {
        // Determinar source_type baseado na origem do pedido
        const orderMetadata = order.metadata || {};
        let sourceType: 'MARKETPLACE_ORDER' | 'PDV_ORDER' | 'SERVICE_ORDER' | 'EVENT_TICKET' = 'MARKETPLACE_ORDER';
        
        if (orderMetadata.pdv_session_id) {
          sourceType = 'PDV_ORDER';
        } else if (orderMetadata.is_payment_link) {
          // SPRINT 86: Payment Link
          sourceType = 'MARKETPLACE_ORDER'; // Usar MARKETPLACE_ORDER por enquanto (futuro: PAYMENT_LINK)
        } else if (orderMetadata.is_ticket_order) {
          sourceType = 'EVENT_TICKET';
        } else if (orderMetadata.is_service_order) {
          sourceType = 'SERVICE_ORDER';
        }

        // SPRINT 86: Registrar uso do payment link após pagamento SUCCESS
        if (orderMetadata.is_payment_link && orderMetadata.payment_link_id) {
          try {
            const { paymentLinkService } = await import('../payments/payment-link.service');
            await paymentLinkService.registerUse(tenantId, orderMetadata.payment_link_id);
            
            // Atualizar status do payment_link_payment
            const { paymentLinkRepository } = await import('../payments/payment-link.repository');
            await paymentLinkRepository.updatePaymentStatus(
              tenantId,
              paymentIntentId,
              'SUCCESS',
              successTransaction.id
            );
          } catch (linkError) {
            // Log mas não bloqueia sucesso do pagamento
            console.warn('[PaymentExecution] Erro ao registrar uso do payment link:', linkError);
          }
        }

        // Calcular data esperada de recebimento (D+0 para pagamentos imediatos, ou D+X conforme método)
        // Por padrão, recebimento imediato (hoje)
        const expectedAt = new Date();

        // SPRINT 72: Extrair payment method do intent metadata
        const paymentMethod = intent.metadata?.payment_method_snapshot?.type || null;

        // SPRINT 0: Extrair contact_id do intent metadata se fornecido
        const payerContactId = intent.metadata?.payerContactId;

        await accountsReceivableService.createFromPaymentIntent(
          tenantId,
          {
            paymentIntentId,
            actorId: sellerActorId, // Quem deve receber (vendedor)
            sourceType,
            sourceId: intent.orderId,
            amountCents: intent.amountCents,
            currency: intent.currency,
            expectedAt,
            paymentMethod, // SPRINT 72: Extraído do intent metadata
            metadata: {
              order_id: intent.orderId,
              payment_transaction_id: successTransaction.id,
              bank_transaction_id: bankResult.transactionId,
              // SPRINT 74: Snapshot da comissão calculada
              commission_snapshot: commissionSnapshot,
              // SPRINT 0: Contact ID do pagador (se fornecido)
              contact_id: payerContactId,
            },
          },
          sellerActorId, // createdByActorId
          actingUserId
        );
      } catch (receivableError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn(`[PaymentExecution] Erro ao criar conta a receber após pagamento SUCCESS para pedido ${intent.orderId}:`, receivableError);
      }

      // SPRINT 77: Criar settlement (PENDING) após pagamento SUCCESS
      try {
        const { settlementService } = await import('./settlement.service');
        const { regionAccountService: regionAccountResolver } = await import('@core/economy/region-account.service');
        
        // Resolver regionId (usa stateId do tenant por enquanto)
        let regionId: string | undefined;
        try {
          const { tenantService } = await import('@core/tenants/tenant.service');
          const { worldService } = await import('@core/world/services/world.service');
          const tenant = await tenantService.getTenantById(tenantId);
          if (tenant?.cityId) {
            const cityPath = await worldService.getCityFullPath(tenant.cityId);
            if (cityPath?.state?.stateId) {
              regionId = cityPath.state.stateId;
            }
          }
        } catch (regionError) {
          // Log mas não bloqueia criação de settlement
          console.warn(`[PaymentExecution] Erro ao resolver regionId:`, regionError);
        }

        // Se regionId encontrado e há taxa (fee), criar settlement
        if (regionId) {
          // SPRINT 82: Calcular taxa usando taxa resolvida (já resolvido via UnifyCardMethodService se UNIFYCARD)
          const feePercentage = isUnifyCard ? resolvedFeePercentage : (intent.metadata?.payment_method_snapshot?.fee_percentage || 0);
          const grossAmountCents = intent.amountCents;
          const feeAmountCents = Math.round(grossAmountCents * (feePercentage / 100));

          if (feeAmountCents > 0) {
            // Determinar sourceType baseado na origem
            const orderMetadata = order.metadata || {};
            let sourceType: 'PAYMENT' | 'TICKET' | 'SERVICE' = 'PAYMENT';
            if (orderMetadata.is_ticket_order) {
              sourceType = 'TICKET';
            } else if (orderMetadata.is_service_order) {
              sourceType = 'SERVICE';
            }

            await settlementService.createFromPayment(
              tenantId,
              {
                regionId,
                sourceType,
                sourceId: successTransaction.id, // payment_transaction_id
                grossAmountCents,
                feeAmountCents,
                metadata: {
                  payment_intent_id: paymentIntentId,
                  payment_transaction_id: successTransaction.id,
                  order_id: intent.orderId,
                  bank_transaction_id: bankResult.transactionId,
                },
              },
              sellerActorId, // createdByActorId
              actingUserId
            );
          }
        }
      } catch (settlementError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn(`[PaymentExecution] Erro ao criar settlement após pagamento SUCCESS para pedido ${intent.orderId}:`, settlementError);
      }

      // Atualizar PaymentIntent: permanece AUTHORIZED (ou criar status PAID se já existir padrão)
      // Por enquanto, mantemos AUTHORIZED (não criamos PAID ainda)
      // await paymentIntentService.updateIntent(tenantId, paymentIntentId, { status: 'PAID' });

      // SPRINT 93: Acumular pontos de fidelidade
      try {
        const payerContactId = intent.metadata?.payerContactId || intent.metadata?.contact_id;
        if (payerContactId) {
          const { loyaltyService } = await import('../loyalty/loyalty.service');
          
          // Determinar channel baseado na origem
          const orderMetadata = order.metadata || {};
          let channel: 'PDV' | 'MARKETPLACE' | 'VENUE' | 'EVENT' = 'MARKETPLACE';
          if (orderMetadata.pdv_session_id) {
            channel = 'PDV';
          } else if (orderMetadata.tab_id || orderMetadata.source === 'VENUE') {
            channel = 'VENUE';
          } else if (orderMetadata.is_ticket_order) {
            channel = 'EVENT';
          }

          const earned = await loyaltyService.earnFromPaymentSuccess(tenantId, {
            contactId: payerContactId,
            amountCents: intent.amountCents,
            channel,
            actorId: order.sellerActorId,
            referenceType: 'payment_transaction',
            referenceId: successTransaction.id,
            orderId: order.id,
          });

          // Adicionar earnedPoints ao metadata da transaction para retornar no response
          if (earned.pointsEarned > 0) {
            // Futuro: atualizar metadata da transaction se necessário
          }
        }
      } catch (loyaltyError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn('[PaymentExecution] Erro ao acumular pontos de fidelidade:', loyaltyError);
      }

      // 6. Registrar auditoria
      await this.recordAudit(tenantId, {
        actorId: buyerActorId,
        actingUserId: actingUserId || buyerActorId,
        paymentIntentId,
        transactionId: bankResult.transactionId,
        result: 'SUCCESS',
      });

      return successTransaction;
    } catch (error: any) {
      // 5. Se falha: status = FAILED, salvar error_code
      const errorCode = error.code || error.message?.substring(0, 100) || 'UNKNOWN_ERROR';

      const failedTransaction = await paymentTransactionRepository.markAsFailed(
        tenantId,
        paymentTransaction.id,
        errorCode
      );

      // SPRINT 52: Log estruturado de falha
      logger.error('Payment execution failed', {
        tenantId,
        paymentIntentId,
        transactionId: failedTransaction.id,
        errorCode,
        amountCents: intent.amountCents,
        currency: intent.currency,
      }, error);

      // SPRINT 43: Liberar reservas de estoque quando pagamento for FAILED
      const { inventoryReservationService } = await import('./inventory-reservation.service');
      try {
        await inventoryReservationService.releaseReservation(tenantId, intent.orderId);
      } catch (releaseError) {
        // Log mas não bloqueia tratamento de falha
        console.warn(`[PaymentExecution] Erro ao liberar reservas após pagamento FAILED para pedido ${intent.orderId}:`, releaseError);
      }

      {
        const { orderSagaService } = await import('@core/sagas/order-saga.service');
        const { getByOrderId } = await import('@modules/orders/order-saga.repository');
        const sagaRow = await getByOrderId(tenantId, intent.orderId);
        const terminal = new Set(['failed', 'cancelled', 'fulfilled']);
        if (sagaRow && !terminal.has(String(sagaRow.status))) {
          const failReason = `payment_execution_failed:${errorCode}`;
          if (compensableBankTransactionId) {
            await orderSagaService.failSaga(tenantId, intent.orderId, failReason, {
              compensation: { originalTransactionId: compensableBankTransactionId },
            });
          } else {
            await orderSagaService.failSaga(tenantId, intent.orderId, failReason);
          }
        }
      }

      // Atualizar PaymentIntent: status = FAILED
      await paymentIntentService.failPaymentIntent(tenantId, paymentIntentId);

      const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
      recordActorRiskEventAsync(tenantId, buyerActorId, 'payment_failed', paymentIntentId, {
        orderId: intent.orderId,
        errorCode,
      });

      // Registrar auditoria
      await this.recordAudit(tenantId, {
        actorId: buyerActorId,
        actingUserId: actingUserId || buyerActorId,
        paymentIntentId,
        transactionId: null,
        result: 'FAILED',
        errorCode,
      });

      // SPRINT 50: Gerar alerta automático quando pagamento falha
      try {
        const { automationService } = await import('../automation/automation.service');
        await automationService.processEvent(tenantId, {
          eventType: 'PAYMENT_FAILED',
          tenantId,
          entityType: 'payment',
          entityId: paymentTransaction.id,
          context: {
            orderId: intent.orderId,
            paymentIntentId,
            errorCode,
            amountCents: intent.amountCents,
            eventId: uuidv4(),
          },
        });
      } catch (alertError) {
        // Log mas não bloqueia tratamento de falha
        console.warn(`[PaymentExecution] Erro ao gerar alerta para pagamento falho:`, alertError);
      }

      // Re-throw erro para que chamador saiba que falhou
      throw error;
    }
  }

  /**
   * Settlement (evento separado da autorização).
   * Move fundos de escrow_payments → clearing → seller_pending.
   * Deve ser chamado quando o gateway liquidar (ex.: webhook payment_settled).
   *
   * Não chama este método dentro de executePayment(); autorização e settlement são eventos distintos.
   */
  async settlePaymentToSeller(
    tenantId: string,
    paymentIntentId: string,
    amountCents: number,
    sellerCompanyId: string,
    currency: BankCurrency,
    options?: {
      orderId?: string;
      sellerActorId?: string;
      /** Overrides para testes (Genesis: 1 conta system — usar contas actor para escrow/clearing) */
      escrowAccountId?: string;
      clearingAccountId?: string;
      sellerPendingAccountId?: string;
    }
  ): Promise<{ clearingTransactionId: string; sellerPendingTransactionId: string }> {
    await bankAccountService.ensurePlatformAccounts(tenantId, currency);
    await bankAccountService.ensureLifecycleAccountsForOwner(
      tenantId,
      sellerCompanyId,
      'company',
      currency
    );
    const escrowAccount = options?.escrowAccountId
      ? { accountId: options.escrowAccountId }
      : await bankAccountService.getPlatformLifecycleAccount(tenantId, 'escrow_payments', currency);
    const clearingAccount = options?.clearingAccountId
      ? { accountId: options.clearingAccountId }
      : await bankAccountService.getPlatformLifecycleAccount(tenantId, 'clearing', currency);
    const sellerPendingAccount = options?.sellerPendingAccountId
      ? { accountId: options.sellerPendingAccountId }
      : await bankAccountService.getLifecycleAccount(
          tenantId,
          sellerCompanyId,
          'company',
          'seller_pending',
          currency
        );
    if (!escrowAccount || !clearingAccount || !sellerPendingAccount) {
      throw new Error(
        'Contas escrow_payments, clearing ou seller_pending não encontradas para settlement'
      );
    }
    const settlementMetadataBase = {
      reference_type: 'settlement' as const,
      reference_id: paymentIntentId,
      payment_intent_id: paymentIntentId,
      order_id: options?.orderId,
      seller_actor_id: options?.sellerActorId,
      settlement_step: 'escrow_to_seller_pending' as const,
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const descOrder = options?.orderId ? ` (Order ${options.orderId})` : '';
    // C56: order_id de receita marketplace (settlement)
    const r1 = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: escrowAccount.accountId,
      toAccountId: clearingAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Settlement: escrow → clearing${descOrder}`,
      metadata: { ...settlementMetadataBase, purpose: 'settlement' },
      referenceType: 'settlement',
      referenceId: paymentIntentId,
      orderId: options?.orderId,
      authorship: buildSystemAuthorship({ actingForAccountId: escrowAccount.accountId }),
      treasurySource: 'treasury:settlement',
    });
    // C56: order_id de receita marketplace (settlement)
    const r2 = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: clearingAccount.accountId,
      toAccountId: sellerPendingAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Seller settlement: clearing → seller_pending${descOrder}`,
      metadata: { ...settlementMetadataBase, purpose: 'seller_settlement' },
      referenceType: 'seller_settlement',
      referenceId: paymentIntentId,
      orderId: options?.orderId,
      authorship: buildSystemAuthorship({ actingForAccountId: clearingAccount.accountId }),
      treasurySource: 'treasury:settlement',
    });
    return {
      clearingTransactionId: r1.transactionId,
      sellerPendingTransactionId: r2.transactionId,
    };
  }

  /**
   * Dispute window end: move fundos de seller_pending → seller_available.
   * Deve ser chamado quando a janela de disputa terminar ou evento de confirmação (ex.: job agendado).
   */
  async releaseSellerFunds(
    tenantId: string,
    paymentIntentId: string,
    amountCents: number,
    sellerCompanyId: string,
    currency: BankCurrency,
    options?: {
      orderId?: string;
      sellerActorId?: string;
      sellerPendingAccountId?: string;
      sellerAvailableAccountId?: string;
    }
  ): Promise<{ transactionId: string }> {
    await bankAccountService.ensureLifecycleAccountsForOwner(
      tenantId,
      sellerCompanyId,
      'company',
      currency
    );
    const sellerPendingAccount = options?.sellerPendingAccountId
      ? { accountId: options.sellerPendingAccountId }
      : await bankAccountService.getLifecycleAccount(
          tenantId,
          sellerCompanyId,
          'company',
          'seller_pending',
          currency
        );
    const sellerAvailableAccount = options?.sellerAvailableAccountId
      ? { accountId: options.sellerAvailableAccountId }
      : await bankAccountService.getLifecycleAccount(
          tenantId,
          sellerCompanyId,
          'company',
          'seller_available',
          currency
        );
    if (!sellerPendingAccount || !sellerAvailableAccount) {
      throw new Error(
        'Contas seller_pending ou seller_available não encontradas para release'
      );
    }
    const metadata = {
      reference_type: 'dispute_release' as const,
      reference_id: paymentIntentId,
      payment_intent_id: paymentIntentId,
      order_id: options?.orderId,
      seller_actor_id: options?.sellerActorId,
      settlement_step: 'seller_pending_to_available' as const,
      purpose: 'dispute_release',
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const descOrder = options?.orderId ? ` (Order ${options.orderId})` : '';
    // C56: order_id de receita marketplace (dispute_release)
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerPendingAccount.accountId,
      toAccountId: sellerAvailableAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Dispute release: seller_pending → seller_available${descOrder}`,
      metadata,
      referenceType: 'dispute_release',
      referenceId: paymentIntentId,
      orderId: options?.orderId,
      authorship: buildSystemAuthorship({
        actingForAccountId: sellerPendingAccount.accountId,
      }),
      treasurySource: 'treasury:settlement',
    });
    const sellerActorId =
      options?.sellerActorId ??
      ('actorId' in sellerAvailableAccount ? sellerAvailableAccount.actorId ?? null : null);
    if (sellerActorId) {
      registerFundsReceived(tenantId, sellerActorId);
    }
    return { transactionId: result.transactionId };
  }

  /**
   * Payout solicitado: move fundos de seller_available → seller_payout.
   * Chamado quando o seller solicita saque (antes do envio ao banco).
   */
  async requestSellerPayout(
    tenantId: string,
    sellerCompanyId: string,
    amountCents: number,
    currency: BankCurrency,
    payoutRequestId: string
  ): Promise<{ transactionId: string }> {
    await bankAccountService.ensureLifecycleAccountsForOwner(
      tenantId,
      sellerCompanyId,
      'company',
      currency
    );
    const sellerAvailableAccount = await bankAccountService.getLifecycleAccount(
      tenantId,
      sellerCompanyId,
      'company',
      'seller_available',
      currency
    );
    const sellerPayoutAccount = await bankAccountService.getLifecycleAccount(
      tenantId,
      sellerCompanyId,
      'company',
      'seller_payout',
      currency
    );
    if (!sellerAvailableAccount || !sellerPayoutAccount) {
      throw new Error(
        'Contas seller_available ou seller_payout não encontradas para payout'
      );
    }
    const sellerActorId = sellerAvailableAccount.actorId ?? null;
    if (sellerActorId) {
      try {
        validatePayoutCooldown(tenantId, sellerActorId);
      } catch (e) {
        if (e instanceof Error && e.message === 'PAYOUT_COOLDOWN_ACTIVE') {
          logFinancialEvent({
            financial_event: 'payout_cooldown_blocked',
            tenant_id: tenantId,
            actor_id: sellerActorId,
          });
        }
        throw e;
      }
      try {
        validateWithdrawalVelocity(tenantId, sellerActorId);
      } catch (e) {
        if (e instanceof Error && e.message === 'WITHDRAWAL_VELOCITY_EXCEEDED') {
          logFinancialEvent({
            financial_event: 'withdrawal_velocity_blocked',
            tenant_id: tenantId,
            actor_id: sellerActorId,
          });
        }
        throw e;
      }
    }
    const metadata = {
      reference_type: 'payout_request' as const,
      reference_id: payoutRequestId,
      payout_request_id: payoutRequestId,
      payout_step: 'available_to_payout' as const,
      purpose: 'payout_request',
      seller_company_id: sellerCompanyId,
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerAvailableAccount.accountId,
      toAccountId: sellerPayoutAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Payout request: seller_available → seller_payout (${payoutRequestId})`,
      metadata,
      referenceType: 'payout_request',
      referenceId: payoutRequestId,
      authorship: buildSystemAuthorship({
        actingForAccountId: sellerAvailableAccount.accountId,
      }),
      treasurySource: 'treasury:settlement',
    });
    return { transactionId: result.transactionId };
  }

  /**
   * Confirmação bancária: move fundos de seller_payout → bank_settlement.
   * Chamado quando o banco confirma a transferência para o seller.
   */
  async confirmBankPayout(
    tenantId: string,
    sellerCompanyId: string,
    amountCents: number,
    currency: BankCurrency,
    bankTransferId: string,
    options?: { sellerPayoutAccountId?: string; bankSettlementAccountId?: string }
  ): Promise<{ transactionId: string }> {
    await bankAccountService.ensurePlatformAccounts(tenantId, currency);
    await bankAccountService.ensureLifecycleAccountsForOwner(
      tenantId,
      sellerCompanyId,
      'company',
      currency
    );
    const sellerPayoutAccount = options?.sellerPayoutAccountId
      ? { accountId: options.sellerPayoutAccountId }
      : await bankAccountService.getLifecycleAccount(
          tenantId,
          sellerCompanyId,
          'company',
          'seller_payout',
          currency
        );
    const bankSettlementAccount = options?.bankSettlementAccountId
      ? { accountId: options.bankSettlementAccountId }
      : await bankAccountService.getPlatformLifecycleAccount(
          tenantId,
          'bank_settlement',
          currency
        );
    if (!sellerPayoutAccount || !bankSettlementAccount) {
      throw new Error(
        'Contas seller_payout ou bank_settlement não encontradas para confirmação de payout'
      );
    }
    const metadata = {
      reference_type: 'bank_payout' as const,
      reference_id: bankTransferId,
      bank_transfer_id: bankTransferId,
      payout_step: 'payout_to_bank' as const,
      purpose: 'payout_bank_settlement',
      seller_company_id: sellerCompanyId,
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerPayoutAccount.accountId,
      toAccountId: bankSettlementAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Bank payout confirmation: seller_payout → bank_settlement (${bankTransferId})`,
      metadata,
      referenceType: 'bank_payout',
      referenceId: bankTransferId,
      authorship: buildSystemAuthorship({
        actingForAccountId: sellerPayoutAccount.accountId,
      }),
      treasurySource: 'treasury:settlement',
    });
    return { transactionId: result.transactionId };
  }

  /**
   * Retorna user_id do comprador (actor tipo user). Usado para lifecycle user_wallet.
   */
  private async getBuyerUserId(tenantId: string, buyerActorId: string): Promise<string> {
    const client = await getClientWithTenant(tenantId);
    try {
      const result = await client.query<{ actor_type: string; user_id: string | null }>(
        `SELECT actor_type, user_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
        [tenantId, buyerActorId]
      );
      if (result.rows.length === 0) {
        throw new Error(`Actor não encontrado: ${buyerActorId}`);
      }
      const actor = result.rows[0];
      if (actor.actor_type !== 'user' || !actor.user_id) {
        throw new Error(`Comprador deve ser actor tipo user: ${buyerActorId}`);
      }
      return actor.user_id;
    } finally {
      client.release();
    }
  }

  /**
   * Retorna company_id do seller (actor tipo page). Usado para lifecycle seller_pending/available/payout.
   */
  private async getSellerCompanyId(tenantId: string, sellerActorId: string): Promise<string> {
    const client = await getClientWithTenant(tenantId);
    try {
      const result = await client.query<{ actor_type: string; company_id: string | null }>(
        `SELECT actor_type, company_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
        [tenantId, sellerActorId]
      );
      if (result.rows.length === 0) {
        throw new Error(`Actor não encontrado: ${sellerActorId}`);
      }
      const actor = result.rows[0];
      if (actor.actor_type !== 'page' || !actor.company_id) {
        throw new Error(`Seller deve ser actor tipo page: ${sellerActorId}`);
      }
      return actor.company_id;
    } finally {
      client.release();
    }
  }

  /**
   * Resolve conta bancária de um actor
   */
  private async resolveActorAccount(
    tenantId: string,
    actorId: string,
    currency: BankCurrency
  ): Promise<string> {
    const client = await getClientWithTenant(tenantId);

    try {
      // Buscar actor para determinar tipo
      const actorResult = await client.query<{
        actor_type: string;
        user_id: string | null;
        company_id: string | null;
      }>(
        `
        SELECT actor_type, user_id, company_id
        FROM actors
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1
        `,
        [tenantId, actorId]
      );

      if (actorResult.rows.length === 0) {
        throw new Error(`Actor não encontrado: ${actorId}`);
      }

      const actor = actorResult.rows[0];

      // Resolver conta baseado no tipo
      if (actor.actor_type === 'user' && actor.user_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.user_id,
          ownerType: 'user',
          currency,
        });
        return account.accountId;
      } else if (actor.actor_type === 'page' && actor.company_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.company_id,
          ownerType: 'company',
          currency,
        });
        return account.accountId;
      } else {
        throw new Error(`Tipo de actor não suportado: ${actor.actor_type}`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Registra auditoria do pagamento
   */
  private async recordAudit(
    tenantId: string,
    data: {
      actorId: string;
      actingUserId: string;
      paymentIntentId: string;
      transactionId: string | null;
      result: 'SUCCESS' | 'FAILED';
      errorCode?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: 'MARKETPLACE_PAYMENT_EXECUTED',
        severity: data.result === 'SUCCESS' ? 'low' : 'medium',
        actor_id: data.actorId ?? null,
        actor_type: 'user', // Assumindo user para buyer
        company_id: undefined,
        employee_id: undefined,
        source: 'marketplace_payment',
        context: {
          payment_intent_id: data.paymentIntentId,
          bank_transaction_id: data.transactionId,
          result: data.result,
          error_code: data.errorCode,
          acting_user_id: data.actingUserId,
        },
      });
    } catch (auditErr) {
      // Não falhar execução se auditoria falhar
      console.error('[AuditService] Erro ao registrar evento MARKETPLACE_PAYMENT_EXECUTED:', auditErr);
    }
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<PaymentTransaction | null> {
    return await paymentTransactionRepository.getTransactionById(tenantId, transactionId);
  }

  /**
   * Lista transações de um payment intent
   */
  async getTransactionsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentTransaction[]> {
    return await paymentTransactionRepository.listTransactionsByIntent(tenantId, paymentIntentId);
  }
  /**
   * Marca pagamento PIX como SUCCESS (chamado pelo webhook)
   * 
   * SPRINT 87: Integração com subscriptions
   */
  async markPixPaymentAsSuccess(
    tenantId: string,
    paymentIntentId: string,
    pixChargeId: string
  ): Promise<PaymentTransaction> {
    // 1. Buscar intent
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    const { pixChargeRepository } = await import('../payments/pix.repository');
    const pixRow = await pixChargeRepository.getChargeById(tenantId, pixChargeId);
    if (!pixRow) {
      throw new Error(`PIX charge não encontrado: ${pixChargeId}`);
    }
    if (pixRow.paymentIntentId !== paymentIntentId) {
      logFinancialEvent({
        financial_event: 'payment_pix_charge_intent_mismatch',
        tenant_id: tenantId,
        trace_id: intent.traceId,
        metadata: {
          payment_intent_id: paymentIntentId,
          pix_charge_id: pixChargeId,
          charge_payment_intent_id: pixRow.paymentIntentId,
        },
      });
      throw new Error('PAYMENT_PIX_CHARGE_INTENT_MISMATCH');
    }
    this.assertAmountMatchesIntent(
      tenantId,
      paymentIntentId,
      intent.amountCents,
      pixRow.amountCents,
      'pix_charge_webhook_confirm',
      intent.traceId
    );

    // 2. Buscar transação PENDING
    const transactions = await paymentTransactionRepository.listTransactionsByIntent(
      tenantId,
      paymentIntentId
    );
    const pendingTransaction = transactions.find((t: { status: string }) => t.status === 'PENDING');
    if (!pendingTransaction) {
      throw new Error(`Transação PENDING não encontrada para intent: ${paymentIntentId}`);
    }

    this.assertAmountMatchesIntent(
      tenantId,
      paymentIntentId,
      intent.amountCents,
      pendingTransaction.amountCents,
      'payment_transaction_pending',
      intent.traceId
    );

    // 3. Marcar como SUCCESS (usando pixChargeId como bank_transaction_id temporário)
    const successTransaction = await paymentTransactionRepository.markAsSuccess(
      tenantId,
      pendingTransaction.id,
      pixChargeId // Usar pixChargeId como identificador
    );

    this.logPaymentFlowStep(tenantId, intent.traceId, 'pix_webhook_mark_success', {
      payment_intent_id: paymentIntentId,
      payment_transaction_id: successTransaction.id,
      provider_reference: pixChargeId,
      bank_transaction_id: successTransaction.bankTransactionId ?? undefined,
      amount_cents: intent.amountCents,
    });

    // 4. SPRINT 87: Verificar se é subscription e avançar ciclo
    if (intent.metadata?.subscription_id) {
      try {
        const { subscriptionService } = await import('../subscriptions/subscription.service');
        await subscriptionService.advanceCycleSuccess(tenantId, intent.metadata.subscription_id);
      } catch (subscriptionError) {
        // Log mas não bloqueia sucesso do pagamento
        console.warn('[PaymentExecution] Erro ao avançar ciclo de subscription:', subscriptionError);
      }
    }

    // SPRINT 93: Acumular pontos de fidelidade (PIX)
    try {
      const payerContactId = intent.metadata?.payerContactId || intent.metadata?.contact_id;
      if (payerContactId) {
        const { loyaltyService } = await import('../loyalty/loyalty.service');
        const { orderRepository } = await import('./order.repository');
        
        const order = await orderRepository.getOrderById(tenantId, intent.orderId);
        if (order) {
          const orderMetadata = order.metadata || {};
          let channel: 'PDV' | 'MARKETPLACE' | 'VENUE' | 'EVENT' = 'MARKETPLACE';
          if (orderMetadata.pdv_session_id) {
            channel = 'PDV';
          } else if (orderMetadata.tab_id || orderMetadata.source === 'VENUE') {
            channel = 'VENUE';
          } else if (orderMetadata.is_ticket_order) {
            channel = 'EVENT';
          }

          await loyaltyService.earnFromPaymentSuccess(tenantId, {
            contactId: payerContactId,
            amountCents: intent.amountCents,
            channel,
            actorId: order.sellerActorId,
            referenceType: 'payment_transaction',
            referenceId: successTransaction.id,
            orderId: order.id,
          });
        }
      }
    } catch (loyaltyError) {
      // Log mas não bloqueia sucesso do pagamento
      console.warn('[PaymentExecution] Erro ao acumular pontos de fidelidade (PIX):', loyaltyError);
    }

    // 5. Registrar auditoria
    await this.recordAudit(tenantId, {
      actorId: intent.metadata?.buyerActorId ?? 'system',
      actingUserId: intent.metadata?.actingUserId ?? intent.metadata?.buyerActorId ?? 'system',
      paymentIntentId,
      transactionId: successTransaction.id,
      result: 'SUCCESS',
    });

    return successTransaction;
  }
}

export const paymentExecutionService = new PaymentExecutionService();



