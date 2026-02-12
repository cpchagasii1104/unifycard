// backend/src/scripts/seed-initial-balance.ts
// CONTINUOUS PRODUCTION: Seed script para crédito inicial de MFI para novos usuários
// Deve ser executado após criação de usuário (dev-only ou via hook)

import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_BALANCE_AMOUNT = 1000; // 1000 MFI para novos usuários

/**
 * Credita saldo inicial (MFI) para um novo usuário
 * Deve ser chamado após criação de usuário
 * 
 * @param tenantId - ID do tenant
 * @param userId - ID do usuário
 * @param amount - Valor inicial (default: 1000 MFI)
 * @returns transactionId da transação de depósito
 */
export async function creditInitialBalance(
  tenantId: string,
  userId: string,
  amountCents: number = INITIAL_BALANCE_AMOUNT
): Promise<string> {
  // 1. Resolver ou criar conta do usuário
  const userAccount = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: userId,
    ownerType: 'user',
    currency: 'BRL',
  });

  // 2. Buscar conta do sistema "reserve" (fonte dos créditos iniciais)
  const reserveAccount = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');
  if (!reserveAccount) {
    throw new Error('Reserve system account not found. Run migrations first.');
  }

  // 3. Criar transação de depósito (reserve → user)
  // Usar eventId determinístico para idempotência
  const eventId = `initial-balance-${userId}-${tenantId}`;
  
  const result = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId,
    fromAccountId: reserveAccount.accountId,
    toAccountId: userAccount.accountId,
    amount,
    currency: 'BRL',
    transactionType: 'deposit',
    description: `Crédito inicial para novo usuário`,
    metadata: {
      type: 'initial_balance',
      userId,
      source: 'system',
      reason: 'new_user_welcome',
    },
  });

  return result.transactionId;
}

// Script standalone (para execução manual)
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: ts-node seed-initial-balance.ts <tenantId> <userId> [amount]');
    process.exit(1);
  }

  const [tenantId, userId, amountStr] = args;
  const amount = amountStr ? parseFloat(amountStr) : INITIAL_BALANCE_AMOUNT;

  creditInitialBalance(tenantId, userId, amount)
    .then((transactionId) => {
      console.log(`✅ Crédito inicial de ${amount} MFI criado para usuário ${userId}`);
      console.log(`   Transaction ID: ${transactionId}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro ao creditar saldo inicial:', error);
      process.exit(1);
    });
}








