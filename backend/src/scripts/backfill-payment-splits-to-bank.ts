/**
 * Backfill: payment_splits → execução via serviços UnifyBank (transação + splits + ledger).
 *
 * Uso:
 *   DRY_RUN=true  pnpm exec tsx src/scripts/backfill-payment-splits-to-bank.ts   (default)
 *   DRY_RUN=false pnpm exec tsx src/scripts/backfill-payment-splits-to-bank.ts
 *
 * Regras:
 * - Uma transação por execution_id (reference_type = service_payment_execution).
 * - Idempotência: reexecução não duplica; valida somas.
 * - Não remove payment_splits.
 */

import 'dotenv/config';
import { pool } from '@core/database/pool';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankTransactionReadRepository } from '@modules/bank/bank-transaction-read.repository';
import { bankSplitRepository } from '@modules/bank/bank-split.repository';
import { actorRepository } from '@modules/social/actor.repository';
import type { FinancialAuthorshipContext } from '@modules/bank/financial-authorship.types';
import type { BankCurrency } from '@modules/bank/bank-account.types';

function parseMeta(m: unknown): Record<string, unknown> {
  if (!m) return {};
  if (typeof m === 'string') {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return m as Record<string, unknown>;
}

function moneyToCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

async function resolveAccountForActor(
  tenantId: string,
  actorId: string,
  currency: BankCurrency
): Promise<string> {
  const actor = await actorRepository.findById(tenantId, actorId);
  if (!actor) {
    throw new Error(`Actor ${actorId} not found`);
  }
  if (actor.actor_type === 'user' && actor.user_id) {
    const acc = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: actor.user_id,
      ownerType: 'user',
      currency,
    });
    return acc.accountId;
  }
  if (actor.actor_type === 'page' && actor.company_id) {
    const acc = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: actor.company_id,
      ownerType: 'company',
      currency,
    });
    return acc.accountId;
  }
  if (actor.actor_type === 'group' && actor.group_id) {
    const acc = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: actor.group_id,
      ownerType: 'company',
      currency,
    });
    return acc.accountId;
  }
  throw new Error(`Cannot resolve bank account for actor ${actorId} type ${actor.actor_type}`);
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN !== 'false';
  console.log(`[backfill] DRY_RUN=${dryRun}`);

  const exRows = await pool.query<{ execution_id: string; tenant_id: string }>(
    `SELECT DISTINCT execution_id, tenant_id FROM payment_splits ORDER BY tenant_id, execution_id`
  );

  let migrated = 0;
  let skipped = 0;
  const inconsistencies: Array<{ execution_id: string; reason: string }> = [];
  const examples: string[] = [];

  for (const row of exRows.rows) {
    const { execution_id: executionId, tenant_id: tenantId } = row;
    const client = await pool.connect();
    try {
      const exQ = await client.query<{
        execution_id: string;
        payer_actor_id: string;
        amount: string;
        currency: string;
        metadata: unknown;
      }>(
        `SELECT execution_id, payer_actor_id, amount::text, currency, metadata
         FROM service_payment_executions WHERE execution_id = $1 AND tenant_id = $2`,
        [executionId, tenantId]
      );
      if (exQ.rows.length === 0) {
        inconsistencies.push({ execution_id: executionId, reason: 'execution row missing' });
        continue;
      }
      const execution = exQ.rows[0];
      const meta = parseMeta(execution.metadata);
      if (meta.bankTransactionId) {
        skipped++;
        continue;
      }

      const psQ = await client.query<{
        receiver_actor_id: string;
        amount: string;
        percentage: string | null;
      }>(
        `SELECT receiver_actor_id, amount::text, percentage::text
         FROM payment_splits WHERE execution_id = $1 AND tenant_id = $2 ORDER BY created_at`,
        [executionId, tenantId]
      );

      const splitCents = psQ.rows.map((p) => ({
        receiverActorId: p.receiver_actor_id,
        amountCents: moneyToCents(p.amount),
        percentage: p.percentage ? parseFloat(p.percentage) : null,
      }));
      const sumPs = splitCents.reduce((s, x) => s + x.amountCents, 0);
      const execCents = moneyToCents(execution.amount);
      if (Math.abs(sumPs - execCents) > 1) {
        inconsistencies.push({
          execution_id: executionId,
          reason: `sum(payment_splits)=${sumPs} != execution.amount_cents=${execCents}`,
        });
        continue;
      }

      const existingTxId = await bankTransactionReadRepository.findIdByReferenceTypeAndReferenceId(
        tenantId,
        'service_payment_execution',
        executionId
      );

      if (existingTxId) {
        const txId = existingTxId;
        const sumBs = await bankSplitRepository.sumAmountCentsForTransaction(
          tenantId,
          txId,
          client
        );
        if (Math.abs(sumBs - sumPs) > 1) {
          inconsistencies.push({
            execution_id: executionId,
            reason: `existing tx ${txId}: splits sum ${sumBs} != payment_splits ${sumPs}`,
          });
          continue;
        }
        if (!dryRun) {
          await client.query(
            `UPDATE service_payment_executions
             SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || $3::jsonb
             WHERE execution_id = $1 AND tenant_id = $2`,
            [executionId, tenantId, JSON.stringify({ bankTransactionId: txId })]
          );
        }
        skipped++;
        if (examples.length < 3) {
          examples.push(`execution ${executionId}: reused tx ${txId} (splits already aligned)`);
        }
        continue;
      }

      if (execution.currency !== 'BRL') {
        skipped++;
        if (examples.length < 5) {
          examples.push(`skip ${executionId}: currency ${execution.currency}`);
        }
        continue;
      }

      const payerAct = await actorRepository.findById(tenantId, execution.payer_actor_id);
      if (!payerAct?.user_id) {
        skipped++;
        if (examples.length < 5) {
          examples.push(`skip ${executionId}: payer not user actor`);
        }
        continue;
      }

      const fromAccountId = await resolveAccountForActor(
        tenantId,
        execution.payer_actor_id,
        'BRL'
      );
      const splitLines: Array<{
        targetAccountId: string;
        amountCents: number;
        percentage?: number | null;
        receiverActorId: string;
      }> = [];
      for (const line of splitCents) {
        const targetAccountId = await resolveAccountForActor(
          tenantId,
          line.receiverActorId,
          'BRL'
        );
        splitLines.push({
          targetAccountId,
          amountCents: line.amountCents,
          percentage: line.percentage,
          receiverActorId: line.receiverActorId,
        });
      }

      const authorship: FinancialAuthorshipContext = {
        performedByUserId: payerAct.user_id,
        actingForActorId: execution.payer_actor_id,
        actingForAccountId: fromAccountId,
        authoritySource: 'system',
        permissionSnapshot: {
          permissionKey: 'backfill_payment_splits',
          allowed: true,
          actorId: execution.payer_actor_id,
          userId: payerAct.user_id,
          decidedAt: new Date().toISOString(),
        },
      };

      if (dryRun) {
        migrated++;
        if (examples.length < 5) {
          examples.push(
            `[DRY] would migrate execution ${executionId} total=${sumPs}c ${splitLines.length} splits`
          );
        }
        continue;
      }

      const result = await bankTransactionService.createTransactionWithExplicitSplitLines(tenantId, {
        referenceType: 'service_payment_execution',
        referenceId: executionId,
        fromAccountId,
        payerActorId: execution.payer_actor_id,
        amountCents: sumPs,
        currency: 'BRL',
        splitLines,
        description: `Backfill service execution ${executionId}`,
        metadata: {
          backfill: true,
          payment_splits_execution_id: executionId,
        },
        concept_id: 'service-booking-payment',
        authorship,
      });

      const txId = result.transaction.transactionId;
      await client.query(
        `UPDATE service_payment_executions
         SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || $3::jsonb
         WHERE execution_id = $1 AND tenant_id = $2`,
        [executionId, tenantId, JSON.stringify({ bankTransactionId: txId })]
      );

      migrated++;
      if (examples.length < 5) {
        examples.push(`migrated execution ${executionId} → tx ${txId} (${splitLines.length} splits)`);
      }
    } catch (e) {
      inconsistencies.push({
        execution_id: executionId,
        reason: e instanceof Error ? e.message : String(e),
      });
    } finally {
      client.release();
    }
  }

  console.log(JSON.stringify({ migrated, skipped, inconsistencies, examples }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});