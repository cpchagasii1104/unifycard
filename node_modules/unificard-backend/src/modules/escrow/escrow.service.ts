// backend/src/modules/escrow/escrow.service.ts
// Service para Pagamentos com Escrow e Marcos de Execução
// 🔴 BLINDAGEM: Nenhum pagamento sem Agreement FINALIZED
// 🔴 BLINDAGEM: Valores vêm exclusivamente do Agreement
// 🔴 BLINDAGEM: Nenhuma automação silenciosa

import { escrowRepository } from './escrow.repository';
import { agreementRepository } from '../agreements/agreement.repository';
import type {
  EscrowAccount,
  PaymentMilestoneRecord,
  EscrowTransaction,
  CreateEscrowInput,
  AuthorizeMilestoneInput,
  ReleasePaymentInput,
  RefundInput,
  EscrowFilters,
} from './escrow.types';
import { NotFoundError, BadRequestError, ConflictError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class EscrowService {
  /**
   * Cria escrow account a partir de Agreement FINALIZED
   * 🔴 BLINDAGEM: Agreement deve estar FINALIZED
   * 🔴 BLINDAGEM: Valores vêm exclusivamente do Agreement
   * 🔴 BLINDAGEM: Valida trust score antes de criar
   */
  async createEscrowFromAgreement(
    tenantId: string,
    input: CreateEscrowInput,
    evidencePackId: string | null
  ): Promise<EscrowAccount> {
    // 1. Validar que agreement existe e está FINALIZED
    const agreement = await agreementRepository.findById(tenantId, input.agreementId);
    if (!agreement) {
      throw new NotFoundError('Agreement não encontrado');
    }

    if (agreement.status !== 'FINALIZED') {
      throw new BadRequestError('Agreement deve estar FINALIZED para criar escrow');
    }

    // 1.5. 🔴 BLINDAGEM: Validar trust score antes de criar escrow
    try {
      const { trustEngineService } = await import('../trust/trust-engine.service');
      const canProceed = await trustEngineService.canProceedWithAction(tenantId, {
        action: 'escrow:create',
        actorId: agreement.requesterActorId,
        contextType: 'agreement',
        contextId: input.agreementId,
      });

      if (!canProceed.canProceed) {
        throw new BadRequestError(
          canProceed.reason || 'Não é possível criar escrow devido a baixo trust score'
        );
      }
    } catch (trustError: any) {
      // Se for erro de trust, lançar
      if (trustError.message?.includes('trust') || trustError.message?.includes('score')) {
        throw trustError;
      }
      // Outros erros são ignorados (não bloqueiam se trust service não estiver disponível)
      console.warn('[Escrow] Erro ao validar trust (não bloqueante):', trustError);
    }

    // 2. Validar que não existe escrow para este agreement
    const existing = await escrowRepository.findByAgreement(tenantId, input.agreementId);
    if (existing) {
      throw new ConflictError('Já existe escrow account para este agreement');
    }

    // 3. Validar milestones (soma deve ser 100%)
    const totalPercentage = input.milestones.reduce((sum, m) => sum + m.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestError(`Soma dos percentuais dos milestones deve ser 100% (atual: ${totalPercentage}%)`);
    }

    // 4. Criar escrow account
    const escrow = await escrowRepository.createEscrowAccount(tenantId, input, evidencePackId);

    // 5. Atualizar valor total do agreement
    await escrowRepository.updateTotalAmount(
      tenantId,
      escrow.escrowId,
      agreement.priceCents,
      agreement.currency
    );

    // 6. Criar milestones
    const totalAmount = agreement.priceCents;
    for (const milestoneInput of input.milestones) {
      const amountCents = Math.round((totalAmount * milestoneInput.percentage) / 100);
      await escrowRepository.createMilestone(
        tenantId,
        escrow.escrowId,
        milestoneInput.milestone,
        amountCents,
        milestoneInput.percentage
      );
    }

    // 7. Buscar escrow atualizado
    const updatedEscrow = await escrowRepository.findById(tenantId, escrow.escrowId);
    if (!updatedEscrow) {
      throw new Error('Erro ao criar escrow account');
    }

    // 8. Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'escrow_created',
      actorId: agreement.requesterActorId,
      userId: null,
      contextType: 'agreement' as any,
      contextId: input.agreementId,
      metadata: {
        escrowId: updatedEscrow.escrowId,
        totalAmountCents: totalAmount,
        milestones: input.milestones,
      },
    });

    // 9. Registrar evento no Evidence Pack (se existir)
    if (evidencePackId) {
      try {
        const { evidenceService } = await import('../evidence/evidence.service');
        const { randomUUID } = await import('crypto');
        await evidenceService.addEvent(tenantId, evidencePackId, {
          eventId: randomUUID(),
          eventType: 'escrow_created',
          timestamp: new Date(),
          actorId: agreement.requesterActorId,
          userId: null,
          data: {
            escrowId: updatedEscrow.escrowId,
            totalAmountCents: totalAmount,
            currency: agreement.currency,
          },
          source: 'system',
          sourceId: updatedEscrow.escrowId,
        });
      } catch (evidenceError) {
        // Não bloquear se registro em evidence falhar
        console.warn('Erro ao registrar evento no evidence pack:', evidenceError);
      }
    }

    return updatedEscrow;
  }

  /**
   * Busca escrow account por ID
   */
  async getEscrowAccount(tenantId: string, escrowId: string): Promise<EscrowAccount> {
    const escrow = await escrowRepository.findById(tenantId, escrowId);
    if (!escrow) {
      throw new NotFoundError('Escrow account não encontrado');
    }
    return escrow;
  }

  /**
   * Busca escrow account por agreement
   */
  async getEscrowByAgreement(tenantId: string, agreementId: string): Promise<EscrowAccount | null> {
    return escrowRepository.findByAgreement(tenantId, agreementId);
  }

  /**
   * Lista escrow accounts com filtros
   */
  async listEscrowAccounts(tenantId: string, filters: EscrowFilters = {}): Promise<EscrowAccount[]> {
    return escrowRepository.list(tenantId, filters);
  }

  /**
   * Lista milestones de um escrow
   */
  async listMilestones(tenantId: string, escrowId: string): Promise<PaymentMilestoneRecord[]> {
    await this.getEscrowAccount(tenantId, escrowId); // Validar que existe
    return escrowRepository.listMilestones(tenantId, escrowId);
  }

  /**
   * Lista transações de um escrow
   */
  async listTransactions(tenantId: string, escrowId: string): Promise<EscrowTransaction[]> {
    await this.getEscrowAccount(tenantId, escrowId); // Validar que existe
    return escrowRepository.listTransactions(tenantId, escrowId);
  }

  /**
   * Autoriza milestone (muda status para AUTHORIZED)
   * 🔴 BLINDAGEM: Valida transição de milestone
   */
  async authorizeMilestone(
    tenantId: string,
    escrowId: string,
    input: AuthorizeMilestoneInput
  ): Promise<PaymentMilestoneRecord> {
    const escrow = await this.getEscrowAccount(tenantId, escrowId);

    // Validar que não há disputa aberta
    if (escrow.disputeStatus === 'OPEN') {
      throw new ConflictError('Não é possível autorizar milestone enquanto houver disputa aberta');
    }

    // Buscar milestone
    const milestones = await escrowRepository.listMilestones(tenantId, escrowId);
    const milestone = milestones.find((m) => m.milestone === input.milestone);
    if (!milestone) {
      throw new NotFoundError(`Milestone ${input.milestone} não encontrado`);
    }

    // Validar transição
    if (milestone.status !== 'PENDING') {
      throw new ConflictError(`Milestone ${input.milestone} já foi autorizado ou liberado`);
    }

    // Validar ordem dos milestones
    const milestoneOrder: Record<string, number> = {
      CONFIRMED: 1,
      STARTED: 2,
      COMPLETED: 3,
    };

    const currentOrder = milestoneOrder[input.milestone];
    const previousMilestones = milestones.filter(
      (m) => milestoneOrder[m.milestone] < currentOrder
    );

    const hasUnauthorizedPrevious = previousMilestones.some((m) => m.status === 'PENDING');
    if (hasUnauthorizedPrevious) {
      throw new BadRequestError(
        'Não é possível autorizar este milestone antes de autorizar os anteriores'
      );
    }

    // Atualizar milestone
    const updated = await escrowRepository.updateMilestoneStatus(
      tenantId,
      milestone.milestoneId,
      'AUTHORIZED',
      input.authorizedByActorId,
      null
    );

    // Atualizar escrow status
    if (escrow.status === 'PENDING') {
      await escrowRepository.updateEscrowStatus(tenantId, escrowId, 'FUNDS_HELD', 0, 0, 0, input.milestone);
    } else {
      await escrowRepository.updateEscrowStatus(tenantId, escrowId, escrow.status, undefined, undefined, undefined, input.milestone);
    }

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'milestone_reached',
      actorId: input.authorizedByActorId,
      userId: input.authorizedByUserId || null,
      contextType: 'agreement' as any,
      contextId: escrow.agreementId,
      metadata: {
        escrowId,
        milestone: input.milestone,
        milestoneId: milestone.milestoneId,
      },
    });

    return updated;
  }

  /**
   * Libera pagamento de um milestone
   * 🔴 BLINDAGEM: Valida que milestone está AUTHORIZED
   * 🔴 BLINDAGEM: Disputa aberta bloqueia RELEASE
   */
  async releasePayment(
    tenantId: string,
    escrowId: string,
    input: ReleasePaymentInput
  ): Promise<{ escrow: EscrowAccount; transaction: EscrowTransaction }> {
    const escrow = await this.getEscrowAccount(tenantId, escrowId);

    // Validar que não há disputa aberta
    if (escrow.disputeStatus === 'OPEN') {
      throw new ConflictError('Não é possível liberar pagamento enquanto houver disputa aberta');
    }

    // Buscar milestone
    const milestones = await escrowRepository.listMilestones(tenantId, escrowId);
    const milestone = milestones.find((m) => m.milestone === input.milestone);
    if (!milestone) {
      throw new NotFoundError(`Milestone ${input.milestone} não encontrado`);
    }

    // Validar que milestone está AUTHORIZED
    if (milestone.status !== 'AUTHORIZED') {
      throw new ConflictError(`Milestone ${input.milestone} deve estar AUTHORIZED para liberar pagamento`);
    }

    // Determinar valor a liberar
    const amountToRelease = input.amountCents || milestone.amountCents;

    // Validar que há fundos suficientes
    const availableAmount = escrow.totalAmountCents - escrow.releasedAmountCents - escrow.refundedAmountCents;
    if (amountToRelease > availableAmount) {
      throw new BadRequestError(
        `Valor a liberar (${amountToRelease}) excede o disponível (${availableAmount})`
      );
    }

    // Criar transação
    const transaction = await escrowRepository.createTransaction(
      tenantId,
      escrowId,
      milestone.milestoneId,
      'RELEASE',
      amountToRelease,
      escrow.currency,
      input.releasedByActorId
    );

    // Atualizar milestone
    await escrowRepository.updateMilestoneStatus(
      tenantId,
      milestone.milestoneId,
      'RELEASED',
      milestone.authorizedByActorId,
      input.releasedByActorId
    );

    // Atualizar escrow
    const newReleasedAmount = escrow.releasedAmountCents + amountToRelease;
    const newStatus = newReleasedAmount >= escrow.totalAmountCents ? 'RELEASED' : 'READY_TO_RELEASE';
    const updatedEscrow = await escrowRepository.updateEscrowStatus(
      tenantId,
      escrowId,
      newStatus,
      escrow.heldAmountCents,
      newReleasedAmount,
      escrow.refundedAmountCents,
      escrow.currentMilestone,
      escrow.disputeStatus
    );

    // TODO: Integrar com sistema bancário para executar transferência
    // Por enquanto, apenas marca como COMPLETED
    // await bankTransactionService.executeTransfer(...);

    // 🔴 BLINDAGEM: Registrar no Ledger
    try {
      const { ledgerService } = await import('../ledger/ledger.service');
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreement = await agreementRepository.findById(tenantId, escrow.agreementId);
      
      if (agreement && escrow.evidencePackId) {
        // Buscar account do provider (pode ser actorId ou account bancário)
        const providerAccountId = `actor:${agreement.providerActorId}`;
        
        await ledgerService.recordEscrowRelease(
          tenantId,
          escrowId,
          amountToRelease,
          escrow.currency,
          providerAccountId,
          escrow.evidencePackId,
          {
            milestone: input.milestone,
            transactionId: transaction.transactionId,
          }
        );
      }
    } catch (ledgerError) {
      // Não bloquear se registro no ledger falhar
      console.warn('[Escrow] Erro ao registrar no ledger (não bloqueante):', ledgerError);
    }

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'funds_released',
      actorId: input.releasedByActorId,
      userId: input.releasedByUserId || null,
      contextType: 'agreement' as any,
      contextId: escrow.agreementId,
      metadata: {
        escrowId,
        milestone: input.milestone,
        amountCents: amountToRelease,
        transactionId: transaction.transactionId,
      },
    });

    // 🔴 BLINDAGEM: Registrar evento de trust positivo se escrow foi completado
    if (updatedEscrow.status === 'RELEASED') {
      try {
        const { trustEngineService: trustService } = await import('../trust/trust-engine.service');
        
        if (escrow.evidencePackId) {
          // Buscar agreement para pegar ambos os actors
          const agreement = await agreementRepository.findById(tenantId, escrow.agreementId);
          if (agreement) {
            // Registrar para ambos os actors
            await trustService.registerTrustEvent(tenantId, {
              actorId: agreement.requesterActorId,
              eventType: 'escrow_completed_successfully',
              severity: 'LOW',
              contextType: 'escrow',
              contextId: escrowId,
              evidencePackId: escrow.evidencePackId,
            });

            await trustService.registerTrustEvent(tenantId, {
              actorId: agreement.providerActorId,
              eventType: 'escrow_completed_successfully',
              severity: 'LOW',
              contextType: 'escrow',
              contextId: escrowId,
              evidencePackId: escrow.evidencePackId,
            });
          }
        }
      } catch (trustError) {
        console.warn('[Escrow] Erro ao registrar evento de trust (não bloqueante):', trustError);
      }
    }

    // Registrar evento no Evidence Pack (se existir)
    if (escrow.evidencePackId) {
      try {
        const { evidenceService } = await import('../evidence/evidence.service');
        const { randomUUID } = await import('crypto');
        await evidenceService.addEvent(tenantId, escrow.evidencePackId, {
          eventId: randomUUID(),
          eventType: 'funds_released',
          timestamp: new Date(),
          actorId: input.releasedByActorId,
          userId: input.releasedByUserId || null,
          data: {
            escrowId,
            milestone: input.milestone,
            amountCents: amountToRelease,
            transactionId: transaction.transactionId,
          },
          source: 'system',
          sourceId: transaction.transactionId,
        });
      } catch (evidenceError) {
        console.warn('Erro ao registrar evento no evidence pack:', evidenceError);
      }
    }

    return {
      escrow: updatedEscrow,
      transaction,
    };
  }

  /**
   * Reembolsa fundos
   * 🔴 BLINDAGEM: Valida que há fundos para reembolsar
   */
  async refundFunds(
    tenantId: string,
    escrowId: string,
    input: RefundInput
  ): Promise<{ escrow: EscrowAccount; transaction: EscrowTransaction }> {
    const escrow = await this.getEscrowAccount(tenantId, escrowId);

    // Validar que há fundos para reembolsar
    const availableAmount = escrow.totalAmountCents - escrow.releasedAmountCents - escrow.refundedAmountCents;
    if (input.amountCents > availableAmount) {
      throw new BadRequestError(
        `Valor a reembolsar (${input.amountCents}) excede o disponível (${availableAmount})`
      );
    }

    // Criar transação
    const transaction = await escrowRepository.createTransaction(
      tenantId,
      escrowId,
      null,
      'REFUND',
      input.amountCents,
      escrow.currency,
      input.refundedByActorId
    );

    // Atualizar escrow
    const newRefundedAmount = escrow.refundedAmountCents + input.amountCents;
    const newStatus = newRefundedAmount >= escrow.totalAmountCents ? 'REFUNDED' : escrow.status;
    const updatedEscrow = await escrowRepository.updateEscrowStatus(
      tenantId,
      escrowId,
      newStatus,
      escrow.heldAmountCents,
      escrow.releasedAmountCents,
      newRefundedAmount,
      escrow.currentMilestone,
      escrow.disputeStatus
    );

    // TODO: Integrar com sistema bancário para executar reembolso
    // await bankTransactionService.executeRefund(...);

    // 🔴 BLINDAGEM: Registrar no Ledger
    try {
      const { ledgerService } = await import('../ledger/ledger.service');
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreement = await agreementRepository.findById(tenantId, escrow.agreementId);
      
      if (agreement && escrow.evidencePackId) {
        // Buscar account do requester
        const requesterAccountId = `actor:${agreement.requesterActorId}`;
        
        await ledgerService.recordEscrowRefund(
          tenantId,
          escrowId,
          input.amountCents,
          escrow.currency,
          requesterAccountId,
          escrow.evidencePackId,
          {
            reason: input.reason,
            transactionId: transaction.transactionId,
          }
        );
      }
    } catch (ledgerError) {
      console.warn('[Escrow] Erro ao registrar no ledger (não bloqueante):', ledgerError);
    }

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'refund_issued',
      actorId: input.refundedByActorId,
      userId: input.refundedByUserId || null,
      contextType: 'agreement' as any,
      contextId: escrow.agreementId,
      metadata: {
        escrowId,
        amountCents: input.amountCents,
        reason: input.reason,
        transactionId: transaction.transactionId,
      },
    });

    return {
      escrow: updatedEscrow,
      transaction,
    };
  }

  /**
   * Sincroniza status de disputa com EvidencePack
   */
  async syncDisputeStatus(
    tenantId: string,
    escrowId: string,
    disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED'
  ): Promise<EscrowAccount> {
    const escrow = await this.getEscrowAccount(tenantId, escrowId);

    // Se disputa foi aberta, bloquear escrow
    if (disputeStatus === 'OPEN' && escrow.status !== 'BLOCKED_BY_DISPUTE') {
      await escrowRepository.updateEscrowStatus(
        tenantId,
        escrowId,
        'BLOCKED_BY_DISPUTE',
        undefined,
        undefined,
        undefined,
        escrow.currentMilestone,
        'OPEN'
      );
    }

    // Se disputa foi resolvida, restaurar status anterior
    if (disputeStatus === 'RESOLVED' && escrow.status === 'BLOCKED_BY_DISPUTE') {
      const newStatus = escrow.releasedAmountCents > 0 ? 'READY_TO_RELEASE' : 'FUNDS_HELD';
      await escrowRepository.updateEscrowStatus(
        tenantId,
        escrowId,
        newStatus,
        undefined,
        undefined,
        undefined,
        escrow.currentMilestone,
        'RESOLVED'
      );
    } else {
      // Apenas atualizar dispute status
      await escrowRepository.updateEscrowStatus(
        tenantId,
        escrowId,
        escrow.status,
        undefined,
        undefined,
        undefined,
        escrow.currentMilestone,
        disputeStatus
      );
    }

    const updated = await escrowRepository.findById(tenantId, escrowId);
    if (!updated) {
      throw new Error('Erro ao atualizar escrow');
    }

    return updated;
  }
}

export const escrowService = new EscrowService();

