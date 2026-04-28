/**
 * Validação E2E real: fluxo completo via serviços do domínio financeiro (UnifyBank).
 *
 * Uso: pnpm exec tsx src/scripts/validate-financial-flow-real.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';
import { identityService } from '../core/identity/identity.service';
import { bankAccountRepository } from '../modules/bank/bank-account.repository';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { bankTransactionReadRepository } from '../modules/bank/bank-transaction-read.repository';
import { bankSplitRepository } from '../modules/bank/bank-split.repository';
import {
  buildFinancialAuthorshipFromRequest,
  buildSystemAuthorship,
} from '../modules/bank/financial-authorship.helper';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

function ownershipAuth(userId: string, accountId: string) {
  return buildFinancialAuthorshipFromRequest({
    performedByUserId: userId,
    actingForActorId: userId,
    actingForAccountId: accountId,
    authoritySource: 'ownership',
    permissionSnapshot: {
      permissionKey: 'ownership',
      allowed: true,
      actorId: userId,
      userId,
      decidedAt: new Date().toISOString(),
    },
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }

  console.log('═══ Validação financeira E2E (serviços reais) ═══\n');

  const users = await pool.query<{
    user_id: string;
    email: string;
    global_user_id: string;
  }>(
    `SELECT user_id, email, global_user_id FROM users
     WHERE tenant_id = $1 AND global_user_id IS NOT NULL
     ORDER BY email
     LIMIT 2`,
    [TENANT_ID]
  );

  if (users.rows.length < 2) {
    console.error('Precisa de 2 usuários com global_user_id no tenant. Rode seed-dev-complete e backfill se necessário.');
    process.exit(1);
  }

  const [u1, u2] = users.rows;
  await identityService.ensureCanonicalActorChain(u1.user_id, TENANT_ID);
  await identityService.ensureCanonicalActorChain(u2.user_id, TENANT_ID);

  const acc1 = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: u1.user_id,
    ownerType: 'user',
    currency: 'BRL',
  });
  const acc2 = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: u2.user_id,
    ownerType: 'user',
    currency: 'BRL',
  });

  console.log('Contas:', { a: acc1.accountId, b: acc2.accountId });

  // Genesis: créditos a contas não-system exigem execution_capacity na conta system (view system_coverage).
  let sys = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve');
  if (!sys) {
    await bankAccountRepository.createAccount(TENANT_ID, {
      ownerId: `system:reserve:${TENANT_ID}`,
      ownerType: 'system',
      accountType: 'credit',
      currency: 'BRL',
    });
    sys = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve');
  }
  if (!sys) {
    throw new Error('Não foi possível criar/obter conta system:reserve');
  }

  await bankTransactionService.createSimpleTransaction(TENANT_ID, {
    eventId: uuidv4(),
    referenceType: 'e2e_system_liquidity_mint',
    toAccountId: sys.accountId,
    amountCents: 50_000_000,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'E2E mint system coverage capacity — ten chars',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({
      actingForAccountId: sys.accountId,
      actingForActorId: u1.user_id,
    }),
  });

  await bankTransactionService.transfer(TENANT_ID, {
    eventId: uuidv4(),
    fromAccountId: sys.accountId,
    toAccountId: acc1.accountId,
    amountCents: 500_000,
    currency: 'BRL',
    transactionType: 'transfer',
    referenceType: 'e2e_treasury_sim_seed',
    referenceId: uuidv4(),
    description: 'E2E treasury simulation seed to user — ten chars',
    treasurySource: 'treasury:simulation',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({
      actingForAccountId: sys.accountId,
      actingForActorId: u1.user_id,
    }),
  });

  const paymentRefId = uuidv4();
  const splitResult = await bankTransactionService.createTransactionWithExplicitSplitLines(TENANT_ID, {
    referenceType: 'service_execution',
    referenceId: paymentRefId,
    fromAccountId: acc1.accountId,
    payerActorId: u1.user_id,
    amountCents: 40_000,
    currency: 'BRL',
    splitLines: [
      {
        targetAccountId: acc2.accountId,
        amountCents: 40_000,
        percentage: 100,
        receiverActorId: u2.user_id,
        splitType: 'revenue_share',
      },
    ],
    description: 'E2E service_execution split validation — at least ten chars',
    metadata: { e2e: true, flow: 'validate-financial-flow-real' },
    concept_id: 'system-reserve-credit',
    authorship: ownershipAuth(u1.user_id, acc1.accountId),
  });

  console.log('\n✅ Transação com split concluída:', {
    transactionId: splitResult.transaction.transactionId,
    splitsCount: splitResult.splits.length,
    ledgerEntries: splitResult.ledgerEntries.length,
  });

  const txRows = await bankTransactionReadRepository.listRecentTransactionRows(TENANT_ID, 5);
  const splitRows = await bankSplitRepository.listRecentSplitsDebug(TENANT_ID, 5);
  const accounts = await bankAccountRepository.listAccountsDebugRows(TENANT_ID, 500);

  console.log('\n--- Transações SSOT (últimas 5) ---');
  console.log(JSON.stringify(txRows, null, 2));
  console.log('\n--- Splits SSOT (últimos 5) ---');
  console.log(JSON.stringify(splitRows, null, 2));
  console.log('\n--- Contas SSOT (amostra) ---');
  console.log(JSON.stringify(accounts, null, 2));

  const bal1 = await bankAccountService.getBalance(TENANT_ID, acc1.accountId);
  const bal2 = await bankAccountService.getBalance(TENANT_ID, acc2.accountId);
  console.log('\nSaldos (ledger):', { user1_cents: bal1.balanceCents, user2_cents: bal2.balanceCents });
}

main()
  .catch((e) => {
    console.error('\n❌ Falha na validação:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });