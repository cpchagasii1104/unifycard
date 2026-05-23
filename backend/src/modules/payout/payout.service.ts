// backend/src/modules/payout/payout.service.ts
// Payout Service - Execução Financeira Controlada
// 🔴 BLINDAGEM: Nenhum payout sem validação completa
// 🔴 BLINDAGEM: Tudo amarrado a EvidencePack e Audit

import { payoutRepository } from './payout.repository';
import type {
  PayoutBatch,
  PayoutOrder,
  CreatePayoutBatchInput,
  ExecutePayoutManualInput,
  FailPayoutInput,
  PayoutEligibilityResult,
  PayoutBatchFilters,
  PayoutOrderFilters,
} from './payout.types';
import { NotFoundError, BadRequestError, ConflictError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

/**
 * Threshold mínimo de trust score para payout
 */
const MIN_TRUST_SCORE_FOR_PAYOUT = 30;

class PayoutService {
  /**
   * Valida elegibilidade para payout
   * 🔴 BLINDAGEM: Regras não negociáveis
   */
  async validatePayoutEligibility(
    tenantId: string,
    actorId: string,
    escrowId: string | null,
    agreementId: string | null,
    ledgerEntryIds: string[]
  ): Promise<PayoutEligibilityResult> {
    const reasons: string[] = [];
    let eligible = true;

    // 1. Validar Trust Score
    const { trustEngineService } = await import('../trust/trust-engine.service');
    const trustProfile = await trustEngineService.getTrustProfile(tenantId, actorId);

    if (trustProfile.riskLevel === 'BLOCKED') {
      eligible = false;
      reasons.push('Actor bloqueado devido a baixo trust score');
    } else if (trustProfile.currentScore < MIN_TRUST_SCORE_FOR_PAYOUT) {
      eligible = false;
      reasons.push(`Trust score abaixo do mínimo (${trustProfile.currentScore} < ${MIN_TRUST_SCORE_FOR_PAYOUT})`);
    }

    // 2. Validar Escrow (se aplicável)
    if (escrowId) {
      const { escrowService } = await import('../escrow/escrow.service');
      const escrow = await escrowService.getEscrowAccount(tenantId, escrowId);

      if (!escrow) {
        eligible = false;
        reasons.push('Escrow não encontrado');
      } else {
        if (escrow.status !== 'released') {
          eligible = false;
          reasons.push(`Escrow não está released (status: ${escrow.status})`);
        }

        if (escrow.disputeStatus === 'open') {
          eligible = false;
          reasons.push('Disputa aberta bloqueia payout');
        }
      }
    }

    // 3. Validar Agreement (se aplicável)
    if (agreementId) {
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreement = await agreementRepository.findById(tenantId, agreementId);

      if (!agreement) {
        eligible = false;
        reasons.push('Agreement não encontrado');
      } else if (agreement.status !== 'finalized') {
        eligible = false;
        reasons.push(`Agreement não está finalized (status: ${agreement.status})`);
      }
    }

    // 4. Validar ids de linhas de ledger (bank_ledger) — unicidade de uso
    for (const entryId of ledgerEntryIds) {
      // Verificar se entry já foi usada em outro payout
      const isUsed = await payoutRepository.isLedgerEntryUsed(tenantId, entryId);
      if (isUsed) {
        eligible = false;
        reasons.push(`Ledger entry ${entryId} já foi usada em outro payout`);
      }
    }

    // 5. Validar Evidence Pack
    // (Será validado ao criar o payout)

    // Buscar escrow e agreement para preencher hasOpenDispute e status
    let hasOpenDispute = false;
    let escrowStatus: string | undefined;
    let agreementStatus: string | undefined;

    if (escrowId) {
      try {
        const { escrowService } = await import('../escrow/escrow.service');
        const escrow = await escrowService.getEscrowAccount(tenantId, escrowId);
        if (escrow) {
          hasOpenDispute = escrow.disputeStatus === 'open';
          escrowStatus = escrow.status;
        }
      } catch (err) {
        // Ignorar erro
      }
    }

    if (agreementId) {
      try {
        const { agreementRepository } = await import('../agreements/agreement.repository');
        const agreement = await agreementRepository.findById(tenantId, agreementId);
        agreementStatus = agreement?.status;
      } catch (err) {
        // Ignorar erro
      }
    }

    return {
      eligible,
      reasons,
      riskLevel: trustProfile.riskLevel,
      trustScore: trustProfile.currentScore,
      hasOpenDispute,
      escrowStatus,
      agreementStatus,
    };
  }

  /**
   * Cria payout batch e gera orders
   */
  async createPayoutBatch(
    tenantId: string,
    input: CreatePayoutBatchInput
  ): Promise<{ batch: PayoutBatch; orders: PayoutOrder[] }> {
    // 1. Criar evidence pack para o batch
    const { evidenceService } = await import('../evidence/evidence.service');
    const evidencePack = await evidenceService.getOrCreatePack(tenantId, {
      contextType: 'event', // Batch não tem contexto específico
      contextId: `payout_batch_${Date.now()}`,
    });

    // 2. Criar batch
    const batch = await payoutRepository.createBatch(tenantId, evidencePack.packId, {
      currency: input.currency || 'BRL',
      payoutMethod: input.payoutMethod || 'MANUAL',
    });

    // 3. Buscar linhas elegíveis no bank_ledger (créditos a contas com actor) — substitui economy ledger stub
    const { bankReportingRepository } = await import('../bank/bank-reporting.repository');
    const windowStart = input.startDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const windowEnd = input.endDate ?? new Date();
    const ledgerEntries = await bankReportingRepository.listBankLedgerCreditLinesForPayoutWindow(
      tenantId,
      windowStart,
      windowEnd,
      1000
    );

    // 4. Agrupar por actor e gerar orders
    const orders: PayoutOrder[] = [];
    const actorAmounts = new Map<string, { amountCents: number; entryIds: string[]; escrowId?: string; agreementId?: string }>();

    for (const entry of ledgerEntries) {
      // Filtrar por actorIds se fornecido
      if (input.actorIds && !input.actorIds.includes(entry.debitAccountId.replace('actor:', ''))) {
        continue;
      }

      // Verificar se entry já foi usada
      const isUsed = await payoutRepository.isLedgerEntryUsed(tenantId, entry.entryId);
      if (isUsed) {
        continue;
      }

      // Filtrar por valor mínimo
      if (input.minAmountCents && entry.amountCents < input.minAmountCents) {
        continue;
      }

      const actorId = entry.debitAccountId.replace('actor:', '');
      const existing = actorAmounts.get(actorId) || { amountCents: 0, entryIds: [], escrowId: undefined, agreementId: undefined };

      existing.amountCents += entry.amountCents;
      existing.entryIds.push(entry.entryId);
      
      // Extrair escrowId e agreementId do metadata (quando presentes)
      const meta = entry.metadata;
      if (meta && typeof meta.escrowId === 'string') {
        existing.escrowId = meta.escrowId;
      }
      if (meta && typeof meta.agreementId === 'string') {
        existing.agreementId = meta.agreementId;
      }

      actorAmounts.set(actorId, existing);
    }

    // 5. Criar orders para cada actor
    for (const [actorId, data] of actorAmounts.entries()) {
      try {
        const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
        await requireFinancialRiskClearance(tenantId, {
          actorId,
          action: 'financial_payout',
          amountCents: data.amountCents,
        });
      } catch (riskErr: unknown) {
        const e = riskErr as Error & { statusCode?: number };
        // Bloqueio EXPLÍCITO de autoridade: decisão tomada pelo sistema.
        // Ref: docs/ssot/AUTHORITY_PRECEDENCE.md — ATL > KYC > GUARDA
        const isAuthorityBlock =
          e.statusCode === 403 ||
          e.message === 'ACTOR_RISK_LIMIT_EXCEEDED' ||
          e.message === 'ACTOR_RISK_BLOCKED' ||
          e.message === 'SSOT_ROOT_INACTIVE' ||
          e.message === 'SSOT_ATL_BLOCKED' ||
          e.message === 'ECONOMIC_GUARDIANSHIP_LIMIT_EXCEEDED';

        if (isAuthorityBlock) {
          console.error('[PayoutBatch] Ator bloqueado por autoridade — payout não executado', {
            actorId,
            reason: e.message,
            tenantId,
          });
          continue;
        }
        // Erro de infraestrutura: fail-closed — abortar ciclo.
        throw riskErr;
      }

      // Validar elegibilidade
      const eligibility = await this.validatePayoutEligibility(
        tenantId,
        actorId,
        data.escrowId || null,
        data.agreementId || null,
        data.entryIds
      );

      // Buscar evidence pack do contexto (escrow ou agreement)
      let orderEvidencePackId = evidencePack.packId;
      if (data.escrowId) {
        try {
          const escrowEvidencePack = await evidenceService.getPackByContext(tenantId, 'escrow', data.escrowId);
          if (escrowEvidencePack) {
            orderEvidencePackId = escrowEvidencePack.packId;
          }
        } catch (err) {
          // Usar batch evidence pack se não encontrar
        }
      }

      const order = await payoutRepository.createOrder(tenantId, {
        batchId: batch.batchId,
        actorId,
        amountCents: data.amountCents,
        currency: input.currency || 'BRL',
        payoutMethod: input.payoutMethod || 'MANUAL',
        ledgerEntryIds: data.entryIds,
        escrowId: data.escrowId || null,
        agreementId: data.agreementId || null,
        evidencePackId: orderEvidencePackId,
        metadata: {
          eligibility,
        },
      });

      // Atualizar status baseado na elegibilidade
      if (!eligibility.eligible) {
        await payoutRepository.updateOrderStatus(
          tenantId,
          order.orderId,
          'BLOCKED',
          eligibility.reasons.join('; ')
        );
      } else {
        await payoutRepository.updateOrderStatus(tenantId, order.orderId, 'READY');
      }

      orders.push(order);
    }

    // 6. Atualizar contadores do batch
    await payoutRepository.updateBatchCounters(tenantId, batch.batchId);

    // 7. Registrar no Evidence Pack
    await evidenceService.addEvent(tenantId, evidencePack.packId, {
      eventId: batch.batchId,
      eventType: 'payout_batch_created' as any,
      timestamp: new Date(),
      actorId: 'system',
      userId: null,
      data: {
        batchId: batch.batchId,
        orderCount: orders.length,
        totalAmountCents: orders.reduce((sum, o) => sum + o.amountCents, 0),
      },
      source: 'system',
      sourceId: batch.batchId,
    });

    // 8. Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_batch_created',
      actorId: 'system',
      userId: null,
      contextType: 'event' as any,
      contextId: batch.batchId,
      metadata: {
        batchId: batch.batchId,
        orderCount: orders.length,
      },
    });

    return { batch, orders };
  }

  /**
   * Executa payout manual (mock, sem integração bancária real)
   */
  async executePayoutManual(
    tenantId: string,
    orderId: string,
    input: ExecutePayoutManualInput
  ): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }

    if (order.status !== 'READY') {
      throw new BadRequestError(`Payout order deve estar READY para executar (status atual: ${order.status})`);
    }

    try {
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: order.actorId,
        action: 'financial_payout',
        amountCents: order.amountCents,
      });
    } catch {
      throw new BadRequestError('Payout bloqueado por política de risco do beneficiário');
    }

    // Revalidar elegibilidade antes de executar
    const eligibility = await this.validatePayoutEligibility(
      tenantId,
      order.actorId,
      order.escrowId,
      order.agreementId,
      order.ledgerEntryIds
    );

    if (!eligibility.eligible) {
      // Bloquear se não elegível
      const blocked = await payoutRepository.updateOrderStatus(
        tenantId,
        orderId,
        'BLOCKED',
        eligibility.reasons.join('; ')
      );

      // Registrar no Evidence Pack
      const { evidenceService } = await import('../evidence/evidence.service');
      await evidenceService.addEvent(tenantId, order.evidencePackId, {
        eventId: orderId,
        eventType: 'payout_blocked' as any,
        timestamp: new Date(),
        actorId: input.executedByActorId,
        userId: input.executedByUserId || null,
        data: {
          orderId,
          reasons: eligibility.reasons,
        },
        source: 'system',
        sourceId: orderId,
      });

      throw new BadRequestError(`Payout bloqueado: ${eligibility.reasons.join('; ')}`);
    }

    // Marcar como executado (mock)
    const executed = await payoutRepository.updateOrderStatus(
      tenantId,
      orderId,
      'EXECUTED',
      null,
      {
        executedBy: input.executedByActorId,
        executedAt: new Date().toISOString(),
        ...input.executionMetadata,
      }
    );

    // Atualizar contadores do batch (se houver)
    if (order.batchId) {
      await payoutRepository.updateBatchCounters(tenantId, order.batchId);
    }

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, order.evidencePackId, {
      eventId: orderId,
      eventType: 'payout_executed' as any,
      timestamp: new Date(),
      actorId: input.executedByActorId,
      userId: input.executedByUserId || null,
      data: {
        orderId,
        amountCents: order.amountCents,
        currency: order.currency,
        executionMetadata: input.executionMetadata,
      },
      source: 'system',
      sourceId: orderId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_executed',
      actorId: input.executedByActorId,
      userId: input.executedByUserId || null,
      contextType: 'event' as any,
      contextId: orderId,
      metadata: {
        orderId,
        amountCents: order.amountCents,
        currency: order.currency,
      },
    });

    return executed;
  }

  /**
   * Marca payout como falho
   */
  async markAsFailed(tenantId: string, orderId: string, input: FailPayoutInput): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }

    if (!['READY', 'EXECUTED'].includes(order.status)) {
      throw new BadRequestError(`Payout order deve estar READY ou EXECUTED para marcar como falho (status atual: ${order.status})`);
    }

    const failed = await payoutRepository.updateOrderStatus(
      tenantId,
      orderId,
      'FAILED',
      null,
      null,
      input.failureReason
    );

    // Atualizar contadores do batch (se houver)
    if (order.batchId) {
      await payoutRepository.updateBatchCounters(tenantId, order.batchId);
    }

    const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
    recordActorRiskEventAsync(tenantId, order.actorId, 'payout_failed', orderId, {
      failureReason: input.failureReason?.slice(0, 500),
    });

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, order.evidencePackId, {
      eventId: orderId,
      eventType: 'payout_failed' as any,
      timestamp: new Date(),
      actorId: input.failedByActorId,
      userId: input.failedByUserId || null,
      data: {
        orderId,
        failureReason: input.failureReason,
      },
      source: 'system',
      sourceId: orderId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_failed',
      actorId: input.failedByActorId,
      userId: input.failedByUserId || null,
      contextType: 'event' as any,
      contextId: orderId,
      metadata: {
        orderId,
        failureReason: input.failureReason,
      },
    });

    return failed;
  }

  /**
   * Lista payout batches
   */
  async listBatches(tenantId: string, filters: PayoutBatchFilters = {}): Promise<PayoutBatch[]> {
    return payoutRepository.listBatches(tenantId, filters);
  }

  /**
   * Lista payout orders
   */
  async listOrders(tenantId: string, filters: PayoutOrderFilters = {}): Promise<PayoutOrder[]> {
    return payoutRepository.listOrders(tenantId, filters);
  }

  /**
   * Busca payout batch por ID
   */
  async getBatchById(tenantId: string, batchId: string): Promise<PayoutBatch> {
    const batch = await payoutRepository.findBatchById(tenantId, batchId);
    if (!batch) {
      throw new NotFoundError('Payout batch não encontrado');
    }
    return batch;
  }

  /**
   * Busca payout order por ID
   */
  async getOrderById(tenantId: string, orderId: string): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }
    return order;
  }
}

export const payoutService = new PayoutService();

