// backend/scripts/validate-financial-authorship-backfill.ts
// Script para validar percentual de backfill de autoria financeira

import { getClientWithTenant } from '@core/database/pool';

/**
 * Valida percentual de backfill de autoria financeira
 * Executa após migration 287 (backfill)
 */
async function validateBackfill() {
  const tenantId = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000000';
  const client = await getClientWithTenant(tenantId);

  try {
    // Contar registros totais e com NULL
    const transactionsResult = await client.query<{ total: string; null_count: string; actor_null: string }>(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE acting_for_account_id IS NULL) as null_count,
        COUNT(*) FILTER (WHERE acting_for_actor_id IS NULL) as actor_null
      FROM bank_transactions
      `
    );

    const ledgerResult = await client.query<{ total: string; null_count: string; actor_null: string }>(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE acting_for_account_id IS NULL) as null_count,
        COUNT(*) FILTER (WHERE acting_for_actor_id IS NULL) as actor_null
      FROM bank_ledger
      `
    );

    const splitsResult = await client.query<{ total: string; null_count: string; actor_null: string }>(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE acting_for_account_id IS NULL) as null_count,
        COUNT(*) FILTER (WHERE acting_for_actor_id IS NULL) as actor_null
      FROM bank_splits
      `
    );

    const transactions = transactionsResult.rows[0];
    const ledger = ledgerResult.rows[0];
    const splits = splitsResult.rows[0];

    const transactionsTotal = parseInt(transactions.total, 10);
    const transactionsNull = parseInt(transactions.null_count, 10);
    const transactionsActorNull = parseInt(transactions.actor_null, 10);
    const transactionsPercent = transactionsTotal > 0 
      ? ((transactionsTotal - transactionsNull) / transactionsTotal * 100).toFixed(2)
      : '100.00';
    const transactionsActorPercent = transactionsTotal > 0
      ? ((transactionsTotal - transactionsActorNull) / transactionsTotal * 100).toFixed(2)
      : '100.00';

    const ledgerTotal = parseInt(ledger.total, 10);
    const ledgerNull = parseInt(ledger.null_count, 10);
    const ledgerActorNull = parseInt(ledger.actor_null, 10);
    const ledgerPercent = ledgerTotal > 0
      ? ((ledgerTotal - ledgerNull) / ledgerTotal * 100).toFixed(2)
      : '100.00';
    const ledgerActorPercent = ledgerTotal > 0
      ? ((ledgerTotal - ledgerActorNull) / ledgerTotal * 100).toFixed(2)
      : '100.00';

    const splitsTotal = parseInt(splits.total, 10);
    const splitsNull = parseInt(splits.null_count, 10);
    const splitsActorNull = parseInt(splits.actor_null, 10);
    const splitsPercent = splitsTotal > 0
      ? ((splitsTotal - splitsNull) / splitsTotal * 100).toFixed(2)
      : '100.00';
    const splitsActorPercent = splitsTotal > 0
      ? ((splitsTotal - splitsActorNull) / splitsTotal * 100).toFixed(2)
      : '100.00';

    console.log('\n=== VALIDAÇÃO DE BACKFILL DE AUTORIA FINANCEIRA ===\n');
    console.log('bank_transactions:');
    console.log(`  Total: ${transactionsTotal}`);
    console.log(`  acting_for_account_id preenchido: ${transactionsTotal - transactionsNull} (${transactionsPercent}%)`);
    console.log(`  acting_for_actor_id preenchido: ${transactionsTotal - transactionsActorNull} (${transactionsActorPercent}%)`);
    console.log(`  acting_for_account_id NULL: ${transactionsNull}`);
    console.log(`  acting_for_actor_id NULL: ${transactionsActorNull}`);

    console.log('\nbank_ledger:');
    console.log(`  Total: ${ledgerTotal}`);
    console.log(`  acting_for_account_id preenchido: ${ledgerTotal - ledgerNull} (${ledgerPercent}%)`);
    console.log(`  acting_for_actor_id preenchido: ${ledgerTotal - ledgerActorNull} (${ledgerActorPercent}%)`);
    console.log(`  acting_for_account_id NULL: ${ledgerNull}`);
    console.log(`  acting_for_actor_id NULL: ${ledgerActorNull}`);

    console.log('\nbank_splits:');
    console.log(`  Total: ${splitsTotal}`);
    console.log(`  acting_for_account_id preenchido: ${splitsTotal - splitsNull} (${splitsPercent}%)`);
    console.log(`  acting_for_actor_id preenchido: ${splitsTotal - splitsActorNull} (${splitsActorPercent}%)`);
    console.log(`  acting_for_account_id NULL: ${splitsNull}`);
    console.log(`  acting_for_actor_id NULL: ${splitsActorNull}`);

    // Verificar casos não resolvidos
    if (transactionsNull > 0 || ledgerNull > 0 || splitsNull > 0) {
      console.log('\n⚠️  ATENÇÃO: Existem registros com acting_for_account_id NULL após backfill.');
      console.log('   Estes registros podem ser:');
      console.log('   - Contas de sistema (owner_type=system)');
      console.log('   - Registros órfãos (account_id não existe)');
      console.log('   - Registros muito antigos sem dados suficientes');
    }

    if (transactionsActorNull > 0 || ledgerActorNull > 0 || splitsActorNull > 0) {
      console.log('\n⚠️  ATENÇÃO: Existem registros com acting_for_actor_id NULL após backfill.');
      console.log('   Estes registros podem ser:');
      console.log('   - Contas de sistema (owner_type=system) sem actor correspondente');
      console.log('   - Contas sem actor correspondente no sistema');
    }

    console.log('\n=== FIM DA VALIDAÇÃO ===\n');
  } finally {
    client.release();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  validateBackfill()
    .then(() => {
      console.log('Validação concluída.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na validação:', error);
      process.exit(1);
    });
}

export { validateBackfill };


