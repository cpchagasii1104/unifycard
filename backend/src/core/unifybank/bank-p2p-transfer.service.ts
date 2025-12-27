// backend/src/core/unifybank/bank-p2p-transfer.service.ts
// Serviço de transferência P2P entre usuários

import { v4 as uuidv4 } from 'uuid';
import { accountService } from '@core/economy/accounts/account.service';
import { transactionService } from '@core/economy/transactions/transaction.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import type { TransferResult } from '@core/economy/transactions/transaction.types';

export interface P2PTransferParams {
  fromUserId: string;
  toUserId: string;
  amount: number;
  eventId: string;
}

export interface P2PTransferResult extends TransferResult {
  fromUserId: string;
  toUserId: string;
}

class BankP2PTransferService {
  /**
   * Executa transferência P2P entre dois usuários
   * 
   * GARANTIAS:
   * - Transação SQL atômica (via transactionService)
   * - Validação de saldo (>= amount)
   * - Idempotência via eventId
   * - Ledger imutável (double-entry)
   * - fromUserId !== toUserId
   * - toUserId deve existir
   * 
   * @param tenantId - ID do tenant
   * @param params - Parâmetros da transferência
   * @returns Resultado da transferência
   */
  async transferP2P(
    tenantId: string,
    params: P2PTransferParams
  ): Promise<P2PTransferResult> {
    const { fromUserId, toUserId, amount, eventId } = params;

    // 1. Validações básicas
    if (amount <= 0) {
      const error = new Error('Amount must be greater than zero');
      (error as any).statusCode = 400;
      throw error;
    }

    if (fromUserId === toUserId) {
      const error = new Error('Cannot transfer to yourself');
      (error as any).statusCode = 400;
      throw error;
    }

    // 2. Verificar se toUserId existe (buscar global_user_id)
    const toGlobalUserId = await resolveGlobalUserId(toUserId, tenantId);
    if (!toGlobalUserId) {
      const error = new Error('Destination user not found');
      (error as any).statusCode = 404;
      throw error;
    }

    // 3. Buscar ou criar contas dos usuários
    const fromAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      fromUserId,
      'BRL'
    );

    const toAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      toUserId,
      'BRL'
    );

    // 4. Validar saldo do remetente (deve ser >= amount)
    if (fromAccount.balance < amount) {
      const error = new Error('Insufficient balance');
      (error as any).statusCode = 400;
      throw error;
    }

    // 5. Executar transferência usando o transactionService existente
    // Isso garante transação atômica, locks, idempotência e ledger
    const result = await transactionService.transfer(tenantId, {
      fromAccount: fromAccount.accountId,
      toAccount: toAccount.accountId,
      amount,
      eventId,
      metadata: {
        type: 'p2p_transfer',
        fromUserId,
        toUserId,
      },
    });

    return {
      ...result,
      fromUserId,
      toUserId,
    };
  }
}

export const bankP2PTransferService = new BankP2PTransferService();















