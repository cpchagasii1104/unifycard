// backend/src/modules/ledger/ledger.service.ts
// Ledger Service - Registro de movimentações financeiras
// 🔴 BLINDAGEM: Append-only, imutável após criação
// 🔴 BLINDAGEM: Tudo amarrado a EvidencePack

import { ledgerRepository } from './ledger.repository';
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  LedgerEntryFilters,
  AccountBalance,
  ContextStatement,
} from './ledger.types';
import { BadRequestError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

/**
 * IDs de contas canônicas do sistema
 */
export const SYSTEM_ACCOUNTS = {
  ESCROW: 'system:escrow',
  PLATFORM_COMMISSION: 'system:platform_commission',
  PROVIDER_REVENUE: 'system:provider_revenue',
  REQUESTER_PAYMENT: 'system:requester_payment',
} as const;

class LedgerService {
  /**
   * Registra entrada no ledger
   * 🔴 BLINDAGEM: Sempre requer evidencePackId
   */
  async recordEntry(tenantId: string, input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    // Validar que evidence pack existe
    const { evidenceService } = await import('../evidence/evidence.service');
    try {
      await evidenceService.getPack(tenantId, input.evidencePackId);
    } catch (err) {
      throw new BadRequestError('Evidence pack não encontrado. Toda entrada no ledger requer evidência.');
    }

    // Criar entrada
    const entry = await ledgerRepository.createEntry(tenantId, input);

    // Adicionar evento ao Evidence Pack
    await evidenceService.addEvent(tenantId, input.evidencePackId, {
      eventId: entry.entryId,
      eventType: 'ledger_entry_created' as any,
      timestamp: entry.timestamp,
      actorId: input.metadata?.actorId || 'system',
      userId: null,
      data: {
        entryType: input.entryType,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
        amountCents: input.amountCents,
        currency: input.currency,
        contextType: input.contextType,
        contextId: input.contextId,
      },
      source: 'ledger',
      sourceId: entry.entryId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'ledger_entry_created',
      actorId: input.metadata?.actorId || 'system',
      userId: null,
      contextType: input.contextType as any,
      contextId: input.contextId,
      metadata: {
        entryId: entry.entryId,
        entryType: input.entryType,
        amountCents: input.amountCents,
        currency: input.currency,
      },
    });

    return entry;
  }

  /**
   * Registra hold de escrow
   */
  async recordEscrowHold(
    tenantId: string,
    escrowId: string,
    amountCents: number,
    currency: string,
    evidencePackId: string,
    metadata?: Record<string, any>
  ): Promise<LedgerEntry> {
    return this.recordEntry(tenantId, {
      debitAccountId: SYSTEM_ACCOUNTS.ESCROW,
      creditAccountId: SYSTEM_ACCOUNTS.REQUESTER_PAYMENT,
      amountCents,
      currency,
      entryType: 'ESCROW_HOLD',
      contextType: 'escrow',
      contextId: escrowId,
      evidencePackId,
      metadata: {
        ...metadata,
        escrowId,
      },
    });
  }

  /**
   * Registra release de escrow
   */
  async recordEscrowRelease(
    tenantId: string,
    escrowId: string,
    amountCents: number,
    currency: string,
    providerAccountId: string,
    evidencePackId: string,
    metadata?: Record<string, any>
  ): Promise<LedgerEntry> {
    return this.recordEntry(tenantId, {
      debitAccountId: providerAccountId,
      creditAccountId: SYSTEM_ACCOUNTS.ESCROW,
      amountCents,
      currency,
      entryType: 'ESCROW_RELEASE',
      contextType: 'escrow',
      contextId: escrowId,
      evidencePackId,
      metadata: {
        ...metadata,
        escrowId,
        providerAccountId,
      },
    });
  }

  /**
   * Registra refund de escrow
   */
  async recordEscrowRefund(
    tenantId: string,
    escrowId: string,
    amountCents: number,
    currency: string,
    requesterAccountId: string,
    evidencePackId: string,
    metadata?: Record<string, any>
  ): Promise<LedgerEntry> {
    return this.recordEntry(tenantId, {
      debitAccountId: SYSTEM_ACCOUNTS.ESCROW,
      creditAccountId: requesterAccountId,
      amountCents,
      currency,
      entryType: 'ESCROW_REFUND',
      contextType: 'escrow',
      contextId: escrowId,
      evidencePackId,
      metadata: {
        ...metadata,
        escrowId,
        requesterAccountId,
      },
    });
  }

  /**
   * Registra criação de splits
   */
  async recordSplitsCreated(
    tenantId: string,
    splitIds: string[],
    totalAmountCents: number,
    commissionCents: number,
    providerAmountCents: number,
    currency: string,
    contextType: 'service_order' | 'agreement',
    contextId: string,
    evidencePackId: string,
    metadata?: Record<string, any>
  ): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];

    // 1. Registrar split total (débito do requester, crédito do sistema)
    const splitEntry = await this.recordEntry(tenantId, {
      debitAccountId: SYSTEM_ACCOUNTS.REQUESTER_PAYMENT,
      creditAccountId: SYSTEM_ACCOUNTS.ESCROW,
      amountCents: totalAmountCents,
      currency,
      entryType: 'SPLIT_CREATED',
      contextType,
      contextId,
      evidencePackId,
      metadata: {
        ...metadata,
        splitIds,
        totalAmountCents,
      },
    });
    entries.push(splitEntry);

    // 2. Registrar comissão (débito do escrow, crédito da plataforma)
    if (commissionCents > 0) {
      const commissionEntry = await this.recordEntry(tenantId, {
        debitAccountId: SYSTEM_ACCOUNTS.ESCROW,
        creditAccountId: SYSTEM_ACCOUNTS.PLATFORM_COMMISSION,
        amountCents: commissionCents,
        currency,
        entryType: 'COMMISSION_FEE',
        contextType,
        contextId,
        evidencePackId,
        metadata: {
          ...metadata,
          splitIds,
          commissionCents,
        },
      });
      entries.push(commissionEntry);
    }

    return entries;
  }

  /**
   * Busca entrada do ledger por ID
   */
  async getEntryById(tenantId: string, entryId: string): Promise<LedgerEntry | null> {
    return ledgerRepository.findById(tenantId, entryId);
  }

  /**
   * Lista entradas do ledger
   */
  async listEntries(tenantId: string, filters: LedgerEntryFilters = {}): Promise<LedgerEntry[]> {
    return ledgerRepository.listEntries(tenantId, filters);
  }

  /**
   * Calcula saldo de uma conta
   */
  async getAccountBalance(tenantId: string, accountId: string, currency: string = 'BRL'): Promise<AccountBalance> {
    return ledgerRepository.getAccountBalance(tenantId, accountId, currency);
  }

  /**
   * Busca extrato por contexto
   */
  async getContextStatement(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<ContextStatement> {
    const result = await ledgerRepository.getContextStatement(tenantId, contextType, contextId);
    return {
      contextType: contextType as any,
      contextId,
      entries: result.entries,
      totalDebitsCents: result.totalDebitsCents,
      totalCreditsCents: result.totalCreditsCents,
      netAmountCents: result.totalCreditsCents - result.totalDebitsCents,
      currency: result.currency,
    };
  }
}

export const ledgerService = new LedgerService();

