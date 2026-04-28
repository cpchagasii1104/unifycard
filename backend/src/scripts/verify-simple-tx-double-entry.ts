/**
 * Smoke: createSimpleTransaction só com toAccountId mantém SUM(debit)=SUM(credit).
 * Uso: pnpm exec tsx src/scripts/verify-simple-tx-double-entry.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankLedgerRepository } from '../modules/bank/bank-ledger.repository';

dotenv.config({ path: join(process.cwd(), '.env') });

async function main() {
  const tenantId = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
  const sys = await bankAccountService.getSystemAccount(tenantId, 'reserve');
  if (!sys) throw new Error('reserve missing');

  const actorRow = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM users WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const actorId = actorRow.rows[0]?.user_id;
  if (!actorId) throw new Error('no user for tenant (need actor_id FK)');

  const before = await bankLedgerRepository.sumGlobalDebitCreditTotals();

  await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: uuidv4(),
    referenceType: 'e2e_double_entry_smoke',
    toAccountId: sys.accountId,
    amountCents: 123,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'Smoke test double-entry mint at least ten',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({
      actingForAccountId: sys.accountId,
      actingForActorId: actorId,
    }),
  });

  const after = await bankLedgerRepository.sumGlobalDebitCreditTotals();

  const bd = BigInt(before.debit || '0');
  const bc = BigInt(before.credit || '0');
  const ad = BigInt(after.debit || '0');
  const ac = BigInt(after.credit || '0');
  console.log('before', before, 'after', after);
  console.log('delta d', (ad - bd).toString(), 'delta c', (ac - bc).toString());
  if (ad !== ac) throw new Error('LEDGER_UNBALANCED_AFTER_SMOKE');
  console.log('OK: global ledger balanced');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});