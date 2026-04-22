// backend/src/modules/escrow/escrow.service.ts
// Serviço de Escrow - orquestra repository e regras de negócio
// 🔴 BLINDAGEM: Nenhum pagamento sem Agreement FINALIZED

import { escrowRepository } from './escrow.repository';
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
import { NotFoundError, BadRequestError } from '@core/errors';

class EscrowService {
  async createEscrowFromAgreement(
    tenantId: string,
    input: CreateEscrowInput,
    evidencePackId: string | null
  ): Promise<EscrowAccount> {
    const { agreementService } = await import('../agreements/agreement.service');
    const agreement = await agreementService.getAgreement(tenantId, input.agreementId);
    if (agreement.status !== 'finalized') {
      throw new BadRequestError('Só é possível criar escrow a partir de acordo finalizado');
    }

    const escrow = await escrowRepository.createEscrowAccount(tenantId, input, evidencePackId);
    await escrowRepository.updateTotalAmount(
      tenantId,
      escrow.escrowId,
      agreement.priceCents,
      agreement.currency
    );

    const totalCents = agreement.priceCents;
    for (const m of input.milestones) {
      const amountCents = Math.round((m.percentage / 100) * totalCents);
      await escrowRepository.createMilestone(
        tenantId,
        escrow.escrowId,
        m.milestone,
        amountCents,
        m.percentage
      );
    }

    const updated = await escrowRepository.findById(tenantId, escrow.escrowId);
    if (!updated) throw new Error('createEscrowFromAgreement: escrow not found after create');
    return updated;
  }

  async getEscrowAccount(tenantId: string, escrowId: string): Promise<EscrowAccount | null> {
    return escrowRepository.findById(tenantId, escrowId);
  }

  async getEscrowByAgreement(
    tenantId: string,
    agreementId: string
  ): Promise<EscrowAccount | null> {
    return escrowRepository.findByAgreement(tenantId, agreementId);
  }

  async listEscrowAccounts(
    tenantId: string,
    filters: EscrowFilters = {}
  ): Promise<EscrowAccount[]> {
    return escrowRepository.list(tenantId, filters);
  }

  async listMilestones(
    tenantId: string,
    escrowId: string
  ): Promise<PaymentMilestoneRecord[]> {
    return escrowRepository.listMilestones(tenantId, escrowId);
  }

  async listTransactions(
    tenantId: string,
    escrowId: string
  ): Promise<EscrowTransaction[]> {
    return escrowRepository.listTransactions(tenantId, escrowId);
  }

  async authorizeMilestone(
    tenantId: string,
    escrowId: string,
    input: AuthorizeMilestoneInput
  ): Promise<PaymentMilestoneRecord> {
    const milestones = await escrowRepository.listMilestones(tenantId, escrowId);
    const milestone = milestones.find((m) => m.milestone === input.milestone);
    if (!milestone) throw new NotFoundError('Milestone não encontrado');
    return escrowRepository.updateMilestoneStatus(
      tenantId,
      milestone.milestoneId,
      'authorized',
      input.authorizedByActorId,
      null
    );
  }

  async releasePayment(
    tenantId: string,
    escrowId: string,
    input: ReleasePaymentInput
  ): Promise<{ escrow: EscrowAccount; milestone: PaymentMilestoneRecord }> {
    const milestones = await escrowRepository.listMilestones(tenantId, escrowId);
    const milestone = milestones.find((m) => m.milestone === input.milestone);
    if (!milestone) throw new NotFoundError('Milestone não encontrado');

    // Idempotência: se já foi released com bank_transaction_id, retornar estado
    if (milestone.status === 'released') {
      const account = await escrowRepository.findById(tenantId, escrowId);
      if (!account) throw new NotFoundError('Escrow não encontrado');
      return { escrow: account, milestone };
    }

    const amountCents = input.amountCents ?? milestone.amountCents;
    const account = await escrowRepository.findById(tenantId, escrowId);
    if (!account) throw new NotFoundError('Escrow não encontrado');

    // BRIDGE: bank PRIMEIRO
    const escrowBankBridge = process.env.ESCROW_BANK_BRIDGE === '1' ||
                              process.env.ESCROW_BANK_BRIDGE === 'true';

    let bankTransactionId: string | null = null;

    if (escrowBankBridge) {
      if (!input.toBankAccountId) {
        throw new BadRequestError('toBankAccountId obrigatório com ESCROW_BANK_BRIDGE ativo');
      }
      const { bankTransactionService } = await import('../bank/bank-transaction.service');
      const { bankAccountService } = await import('../bank/bank-account.service');
      const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');

      // C54: Gate financeiro obrigatório antes de transfer (AUTHORITY_PRECEDENCE §4.1)
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: input.releasedByActorId,
        action: 'financial_transfer',
        amountCents,
      });

      // Conta custódia escrow (owner_type='escrow', owner_id=escrowId)
      const escrowBankAccount = await bankAccountService.getOrCreateAccount(tenantId, {
        ownerType: 'escrow',
        ownerId: escrowId,
        accountType: 'escrow_payments',
      });

      // Gerar reference_id estável (idempotente)
      const referenceId = `${tenantId}|${escrowId}|${milestone.milestoneId}|release`;

      const bankTx = await bankTransactionService.transfer(tenantId, {
        eventId: referenceId,
        fromAccountId: escrowBankAccount.accountId,
        toAccountId: input.toBankAccountId,
        amountCents,
        referenceType: 'escrow_operation',
        referenceId,
        description: `Release milestone ${input.milestone} escrow ${escrowId}`,
        transactionType: 'transfer',
        authorship: buildSystemAuthorship({ actingForAccountId: escrowBankAccount.accountId }),
      });

      bankTransactionId = bankTx.transactionId;
    }

    // Só após bank confirmar: gravar escrow_transaction e atualizar milestone
    await escrowRepository.createTransaction(
      tenantId,
      escrowId,
      milestone.milestoneId,
      'release',
      amountCents,
      account.currency,
      input.releasedByActorId,
      bankTransactionId
    );

    const updatedMilestone = await escrowRepository.updateMilestoneStatus(
      tenantId,
      milestone.milestoneId,
      'released',
      null,
      input.releasedByActorId
    );

    const releasedCents = account.releasedAmountCents + amountCents;
    const escrow = await escrowRepository.updateEscrowStatus(
      tenantId,
      escrowId,
      account.status,
      undefined,
      releasedCents,
      undefined,
      input.milestone as string,
      undefined
    );

    return { escrow, milestone: updatedMilestone };
  }

  async refundFunds(
    tenantId: string,
    escrowId: string,
    input: RefundInput
  ): Promise<{ escrow: EscrowAccount }> {
    const account = await escrowRepository.findById(tenantId, escrowId);
    if (!account) throw new NotFoundError('Escrow não encontrado');

    const escrowBankBridge = process.env.ESCROW_BANK_BRIDGE === '1' ||
                              process.env.ESCROW_BANK_BRIDGE === 'true';

    let bankTransactionId: string | null = null;

    if (escrowBankBridge) {
      if (!input.toBankAccountId) {
        throw new BadRequestError('toBankAccountId obrigatório com ESCROW_BANK_BRIDGE ativo');
      }
      const { bankTransactionService } = await import('../bank/bank-transaction.service');
      const { bankAccountService } = await import('../bank/bank-account.service');
      const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');

      // C54: Gate financeiro obrigatório antes de transfer (AUTHORITY_PRECEDENCE §4.1)
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: input.refundedByActorId,
        action: 'financial_transfer',
        amountCents: input.amountCents,
      });

      const escrowBankAccount = await bankAccountService.getOrCreateAccount(tenantId, {
        ownerType: 'escrow',
        ownerId: escrowId,
        accountType: 'escrow_payments',
      });

      const idempotencyKey = input.idempotencyKey ??
        `${tenantId}|${escrowId}|${input.amountCents}|refund`;

      const bankTx = await bankTransactionService.transfer(tenantId, {
        eventId: idempotencyKey,
        fromAccountId: escrowBankAccount.accountId,
        toAccountId: input.toBankAccountId,
        amountCents: input.amountCents,
        referenceType: 'escrow_operation',
        referenceId: idempotencyKey,
        description: input.reason,
        transactionType: 'transfer',
        authorship: buildSystemAuthorship({ actingForAccountId: escrowBankAccount.accountId }),
      });

      bankTransactionId = bankTx.transactionId;
    }

    // Só após bank: registrar e atualizar
    await escrowRepository.createTransaction(
      tenantId,
      escrowId,
      null,
      'refund',
      input.amountCents,
      account.currency,
      input.refundedByActorId,
      bankTransactionId
    );

    const refundedCents = account.refundedAmountCents + input.amountCents;
    const escrow = await escrowRepository.updateEscrowStatus(
      tenantId,
      escrowId,
      'refunded',
      undefined,
      undefined,
      refundedCents,
      undefined,
      undefined
    );

    return { escrow };
  }

  async syncDisputeStatus(
    tenantId: string,
    escrowId: string,
    disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED'
  ): Promise<EscrowAccount> {
    const account = await escrowRepository.findById(tenantId, escrowId);
    if (!account) throw new NotFoundError('Escrow não encontrado');

    const normalized: 'none' | 'open' | 'resolved' =
      disputeStatus === 'NONE' ? 'none' : disputeStatus === 'OPEN' ? 'open' : 'resolved';

    return escrowRepository.updateEscrowStatus(
      tenantId,
      escrowId,
      account.status,
      undefined,
      undefined,
      undefined,
      undefined,
      normalized
    );
  }

  /** Stub: bloqueia saque do escrow antes do evento (CONTRATO v1.3). Implementação futura. */
  async lock(_tenantId: string, _eventId: string): Promise<void> {
    // TODO: integrar com event-escrow quando existir
  }

  /** Stub para fluxo de escrow por evento (pós-evento). Implementação futura. */
  async startRelease(_tenantId: string, _eventId: string): Promise<void> {
    // TODO: integrar com event-escrow quando existir
  }

  /** Stub para liberar valor do escrow de evento. Implementação futura. */
  async release(
    _tenantId: string,
    _params: {
      eventId: string;
      destinationAccountId: string;
      amountCents: number;
      participantId?: string;
      reason?: string;
      idempotencyKey?: string;
    }
  ): Promise<void> {
    // TODO: integrar com event-escrow quando existir
  }

  /** Stub para finalizar escrow de evento. Implementação futura. */
  async complete(_tenantId: string, _eventId: string): Promise<void> {
    // TODO: integrar com event-escrow quando existir
  }

  /** Stub para obter escrow por evento. Implementação futura. */
  async getEscrowByEvent(
    _tenantId: string,
    _eventId: string
  ): Promise<{ current_balance_cents: number } | null> {
    return null;
  }
}

export const escrowService = new EscrowService();