// backend/src/modules/marketplace/regional-fund.service.ts
//
// 🔴 TRILHO RETIRADO — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 2d (DECISION-0166 D3 +
// doutrina DECISION-0165: sistema virgem = EXCISÃO, não convivência).
//
// Este serviço operava o trilho PARALELO de fundo regional do marketplace legado:
// tabela regional_funds com geografia por STRING (country/state/city TEXT) e SALDO EM COLUNA
// (total_balance_cents) fora do bank_ledger — dupla verdade paralela. As tabelas
// regional_funds/regional_fund_allocations foram DROPADAS (migration 20260710110000) com
// 0 rows e zero writer alcançável de rota montada (provas no cartório).
//
// SUBSTITUTO CANÔNICO: regional_fund_accounts (FK Location Core) +
// bankAccountService.ensureRegionalFundAccount + bank_ledger como única verdade de saldo.
//
// A classe permanece como TOMBSTONE fail-closed para os importadores legados não-alcançáveis
// (marketplace facade/terminal/company-application): leituras devolvem vazio (nenhum fundo
// paralelo existe), escritas lançam 501 REGIONAL_FUNDS_RETIRED. Reabrir = pipeline canônico,
// frente própria com GO.

import type { RegionalFund } from '@contracts/marketplace/RegionalFund.contract';
import type { BankTransferResult } from '../bank/bank-transaction.types';

export interface RegionInput {
  country: string;
  state: string;
  city: string;
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

function retired(operation: string): never {
  throw Object.assign(
    new Error(
      `REGIONAL_FUNDS_RETIRED: ${operation} — trilho paralelo de fundo regional (geografia ` +
        `string + saldo em coluna fora do bank_ledger) EXCISADO na Fase 2d (DECISION-0166 D3). ` +
        `Use regional_fund_accounts (FK) + lookupRegionalFundAccount + bank_ledger (DECISION-0177).`
    ),
    { statusCode: 501 }
  );
}

class RegionalFundService {
  /** Trilho excisado: nenhum fundo paralelo existe. Leitura devolve null (vazio honesto). */
  async getRegionalFundByRegion(_tenantId: string, _region: RegionInput): Promise<RegionalFund | null> {
    return null;
  }

  async createRegionalFund(_tenantId: string, _input: CreateRegionalFundInput): Promise<RegionalFund> {
    retired('createRegionalFund');
  }

  async allocateRegionalFund(_tenantId: string, _input: AllocateRegionalFundInput): Promise<AllocateResult> {
    retired('allocateRegionalFund');
  }

  async recordRegionalFundCredit(_tenantId: string, _input: RecordRegionalFundCreditInput): Promise<void> {
    retired('recordRegionalFundCredit');
  }

  async executeAllocation(_tenantId: string, _allocationId: string): Promise<void> {
    retired('executeAllocation');
  }

  async topUpRegionalFundBankFromReserve(
    _tenantId: string,
    _region: RegionInput,
    _amountCents: number,
    _idempotencyReferenceId: string
  ): Promise<BankTransferResult> {
    retired('topUpRegionalFundBankFromReserve');
  }
}

export const regionalFundService = new RegionalFundService();
