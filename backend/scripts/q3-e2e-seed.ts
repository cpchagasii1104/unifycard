// q3-e2e-seed.ts — Seed de saldo inicial para Q3-E2E
// DESCARTÁVEL após teste. Não commitar.
// Uso: npx tsx scripts/q3-e2e-seed.ts <tenantId> <actorId> <toAccountId> [amountCents]

import { bankTransactionService } from '../src/modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../src/modules/bank/financial-authorship.helper';

async function main() {
  const [, , tenantId, actorId, toAccountId, amtStr] = process.argv;

  if (!tenantId || !actorId || !toAccountId) {
    console.error('Uso: npx tsx scripts/q3-e2e-seed.ts <tenantId> <actorId> <toAccountId> [amountCents]');
    process.exit(1);
  }

  const amountCents = parseInt(amtStr ?? '500000', 10);
  const eventId = `q3-e2e-seed-${toAccountId}-${Date.now()}`;

  console.log('SEED_PARAMS:', { tenantId, actorId, toAccountId, amountCents, eventId });

  const authorship = buildSystemAuthorship({
    actingForAccountId: toAccountId,
    actingForActorId: actorId,
  });

  const result = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId,
    referenceType: 'q3_e2e_initial_credit',
    // fromAccountId omitido → service auto-cria system:liquidity_issuance:{tenantId}
    toAccountId,
    amountCents,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'Q3-E2E seed: credito inicial via liquidity_issuance',
    metadata: { type: 'q3_e2e', source: 'test_seed' },
    concept_id: 'system-reserve-credit',
    authorship,
  });

  console.log('SEED_TX_ID:', result.transaction.transactionId);
  console.log('LEDGER_ENTRIES:', result.ledgerEntries.length);
  console.log('LEDGER_DETAIL:', JSON.stringify(result.ledgerEntries, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('SEED_ERROR:', err.message ?? err);
  process.exit(1);
});
