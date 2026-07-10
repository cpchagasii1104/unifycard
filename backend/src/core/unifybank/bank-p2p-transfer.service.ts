// backend/src/core/unifybank/bank-p2p-transfer.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de transferência P2P entre usuários
// 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1B (Opção A · DECISION-0165 D5/D8): transferP2P RETIRADO
//    (fail-closed). Movia dinheiro via createTransactionWithSplit (context 'p2p_transfer' →
//    bankSplitEngine legado = split fora do Bank) e criava contas (getOrCreateAccount) + ledger.
//    P2P e DONATION (donation.service usa este MESMO seam) estão FORA do MVP; sistema virgem →
//    EXCISADO, não contido. Corpo do método removido; imports do corpo removidos (órfãos).
//    donation = HOLD para futura migração ao pipeline canônico. As interfaces/tipo P2PTransferResult
//    ficam preservadas (donation.service as importa e segue typechecando); em runtime transferP2P
//    fail-closa 501 ANTES de qualquer mutação persistida — nada de meio-estado (regra da Fase 1A-R).

export interface P2PTransferParams {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  eventId: string;
}

export interface P2PTransferResult {
  transaction: {
    transactionId: string;
    eventId: string;
    amountCents: number;
    currency: string;
    createdAt: Date;
  };
  fromAccountBalanceCents: number;
  toAccountBalanceCents: number;
  fromUserId: string;
  toUserId: string;
}

class BankP2PTransferService {
  /**
   * RETIRADO (Fase 1B, Opção A). Fail-closed ANTES de qualquer validação / criação-de-conta /
   * ledger / split — nada de meio-estado. Reabre só pelo pipeline canônico
   * (economic_policy_engine → bank-transaction.service → bank_splits), em frente própria com GO.
   */
  async transferP2P(
    _tenantId: string,
    _params: P2PTransferParams,
  ): Promise<P2PTransferResult> {
    const e = new Error(
      'P2P_AND_DONATION_PAYMENT_RETIRED: transferência P2P/doação fora do MVP (DECISION-0165). ' +
        'Reabre só pelo pipeline canônico (economic_policy_engine → bank-transaction.service → bank_splits).',
    );
    (e as any).statusCode = 501;
    throw e;
  }
}

export const bankP2PTransferService = new BankP2PTransferService();
