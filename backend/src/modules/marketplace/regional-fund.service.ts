// backend/src/modules/marketplace/regional-fund.service.ts
// FASE X — Bloco 2: Regional Fund (operacional, sem regras de incentivo)

import type { RegionalFund } from '@contracts/marketplace/RegionalFund.contract';
import { isUseBankRegionalFundEnabled } from '@core/features/use-bank-regional-fund';
import { bankAccountRepository } from '../bank/bank-account.repository';
import { bankAccountService } from '../bank/bank-account.service';
import { bankTransactionService } from '../bank/bank-transaction.service';
import type { BankTransferResult } from '../bank/bank-transaction.types';
import { buildSystemAuthorship } from '../bank/financial-authorship.helper';
import { v5 as uuidv5 } from 'uuid';
import { REGIONAL_FUND_BANK_TOPUP_REF_NAMESPACE } from './marketplace-regional-fund-bank.helpers';
import { regionalFundRepository, type RegionalFundRow, type CreateFundInput, type AllocateInput } from './regional-fund.repository';

export interface RegionInput {
  country: string;
  state: string;
  city: string;
}

function rowToRegionalFund(row: RegionalFundRow): RegionalFund {
  return {
    regionalFundId: row.id,
    region: { country: row.country, state: row.state, city: row.city },
    balance: Number(row.total_balance_cents),
    currency: 'BRL',
    rules: {
      minReserve: 0,
      maxMonthlyOutflow: 0,
      allowedUses: ['infrastructure', 'incentives', 'subsidies', 'community_services'],
    },
    governance: { decisionModel: 'automatic' },
    status: 'active',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export interface CreateRegionalFundInput {
  region: { country: string; state: string; city: string };
  rules?: unknown;
  governance?: unknown;
}

export interface AllocateRegionalFundInput {
  regional_fund_id: string;
  type: string;
  target_actorId: string;
  target_actorType: string;
  amountCents: number;
  reason: string;
  reference?: { orderId?: string; delivery_id?: string; subscription_id?: string };
}

export interface RecordRegionalFundCreditInput {
  regional_fund_id: string;
  amountCents: number;
  currency?: string;
  source?: string;
  reference_id?: string;
}

export interface AllocateResult {
  status: 'approved' | 'rejected';
  allocation_id: string;
}

class RegionalFundService {
  async getRegionalFundByRegion(tenantId: string, region: RegionInput): Promise<RegionalFund | null> {
    const row = await regionalFundRepository.getByRegion(tenantId, region.country, region.state, region.city);
    if (!row) return null;
    const fund = rowToRegionalFund(row);
    if (!isUseBankRegionalFundEnabled()) {
      return fund;
    }
    const bankAcc = await bankAccountService.ensureRegionalFundBankAccountForRegion(tenantId, region, 'BRL');
    const bal = await bankAccountService.getBalance(tenantId, bankAcc.accountId);
    return { ...fund, balance: bal.balanceCents };
  }

  async createRegionalFund(tenantId: string, input: CreateRegionalFundInput): Promise<RegionalFund> {
    const row = await regionalFundRepository.createFund(tenantId, {
      country: input.region.country,
      state: input.region.state,
      city: input.region.city,
    });
    return rowToRegionalFund(row);
  }

  async allocateRegionalFund(tenantId: string, input: AllocateRegionalFundInput): Promise<AllocateResult> {
    const row = await regionalFundRepository.allocate(tenantId, {
      regionalFundId: input.regional_fund_id,
      actorId: input.target_actorId,
      amountCents: input.amountCents,
      allocationType: input.type || 'incentive',
    });
    return { status: 'approved', allocation_id: row.id };
  }

  async recordRegionalFundCredit(tenantId: string, input: RecordRegionalFundCreditInput): Promise<void> {
    await regionalFundRepository.credit(tenantId, input.regional_fund_id, input.amountCents);
  }

  async executeAllocation(tenantId: string, allocationId: string): Promise<void> {
    await regionalFundRepository.executeAllocation(tenantId, allocationId);
  }

  /**
   * Credita a conta Bank do fundo regional (ledger SSOT) a partir da conta system `reserve`.
   * Não altera `regional_funds.total_balance_cents` nem insere linhas no ledger manualmente.
   *
   * @param idempotencyReferenceId — estável por operação lógica (ex.: `regional-fund-topup-BR-SP-SaoPaulo-001`);
   *   reutilizar o mesmo valor evita funding duplicado (uniq em bank_transactions).
   */
  async topUpRegionalFundBankFromReserve(
    tenantId: string,
    region: RegionInput,
    amountCents: number,
    idempotencyReferenceId: string
  ): Promise<BankTransferResult> {
    if (amountCents <= 0) {
      throw new Error('topUpRegionalFundBankFromReserve: amountCents must be positive');
    }
    const logicalRef = idempotencyReferenceId.trim();
    if (!logicalRef) {
      throw new Error('topUpRegionalFundBankFromReserve: idempotencyReferenceId is required');
    }
    /** bank_transactions.reference_id é UUID no schema Genesis — derivar de chave lógica estável. */
    const referenceId = uuidv5(logicalRef, REGIONAL_FUND_BANK_TOPUP_REF_NAMESPACE);
    const reserve = await bankAccountRepository.getSystemAccount(tenantId, 'reserve', 'BRL');
    if (!reserve) {
      throw new Error(
        'topUpRegionalFundBankFromReserve: conta system:reserve do tenant não encontrada; não é possível debitar tesouraria.'
      );
    }
    const toAccount = await bankAccountService.ensureRegionalFundBankAccountForRegion(tenantId, region, 'BRL');
    const eventId = referenceId;
    return bankTransactionService.transfer(tenantId, {
      eventId,
      fromAccountId: reserve.accountId,
      toAccountId: toAccount.accountId,
      amountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `Regional fund bank top-up (${region.country}-${region.state}-${region.city})`,
      metadata: {
        regional_fund_bank_topup: true,
        idempotency_reference: logicalRef,
        region_country: region.country,
        region_state: region.state,
        region_city: region.city,
      },
      referenceType: 'regional_fund_bank_topup',
      referenceId,
      authorship: buildSystemAuthorship({ actingForAccountId: reserve.accountId }),
      treasurySource: 'treasury:governance',
    });
  }
}

export const regionalFundService = new RegionalFundService();