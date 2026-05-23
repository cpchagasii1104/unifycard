// src/modules/economy/economic-overview.projector.ts
// Projector para Dashboard Econômico (READ-ONLY)
// FASE 5.2–5.3: agregações bank_transactions + bank_splits (SSOT); receptor via bank_accounts.actor_id (sem metadata).

import { runQueriesWithTenant } from '@core/database/pool';
import { ReadModelType } from '@core/read-models/read-model.types';
import type { UnificardEvent } from '@core/events/event-bus';
import type {
  ActorEconomicOverview,
  GroupEconomicOverview,
  EconomicTransaction,
} from './economic-overview.types';

/** Valor do split em centavos (SSOT bank_splits.amount). */
const BS_AMOUNT = 'bs.amount::numeric';

/** Splits onde o actor/grupo é receptor: bank_accounts.target_account_id → actor_id (sem metadata). */
const BS_RECEIVER_JOIN = `
  INNER JOIN bank_accounts ba ON ba.id = bs.target_account_id AND ba.tenant_id = bs.tenant_id AND ba.actor_id = $2::uuid
`;

class EconomicOverviewProjector {
  async projectActorEconomicOverview(
    tenantId: string,
    actorId: string
  ): Promise<ActorEconomicOverview> {
    const paidRow = await runQueriesWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(bt.amount_cents), 0)::text AS total
      FROM bank_transactions bt
      WHERE bt.tenant_id = $1 AND bt.actor_id = $2
      `,
      [tenantId, actorId]
    );
    const totalPaid = parseFloat(paidRow[0]?.total || '0');

    const recvRow = await runQueriesWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(${BS_AMOUNT}), 0)::text AS total
      FROM bank_splits bs
      ${BS_RECEIVER_JOIN}
      WHERE bs.tenant_id = $1
      `,
      [tenantId, actorId]
    );
    const totalReceivedFromSplits = parseFloat(recvRow[0]?.total || '0');
    const totalReceived = totalReceivedFromSplits;
    const totalDistributedViaSplit = totalReceivedFromSplits;

    const cntRow = await runQueriesWithTenant<{ n: string }>(
      tenantId,
      `
      SELECT COUNT(DISTINCT x.tid)::text AS n FROM (
        SELECT bt.id AS tid FROM bank_transactions bt
        WHERE bt.tenant_id = $1 AND bt.actor_id = $2
        UNION
        SELECT bs.transaction_id AS tid FROM bank_splits bs
        ${BS_RECEIVER_JOIN}
        WHERE bs.tenant_id = $1
      ) x
      `,
      [tenantId, actorId]
    );
    const executionsCount = parseInt(cntRow[0]?.n || '0', 10);

    const payerRows = await runQueriesWithTenant<{
      id: string;
      amount_cents: string;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT bt.id::text, bt.amount_cents::text, bt.created_at
      FROM bank_transactions bt
      WHERE bt.tenant_id = $1 AND bt.actor_id = $2
      ORDER BY bt.created_at DESC
      LIMIT 30
      `,
      [tenantId, actorId]
    );

    const splitRows = await runQueriesWithTenant<{
      split_id: string;
      amt: string;
      executed_at: Date;
      tx_id: string;
    }>(
      tenantId,
      `
      SELECT bs.split_id::text,
             ${BS_AMOUNT}::text AS amt,
             bt.created_at AS executed_at,
             bs.transaction_id::text AS tx_id
      FROM bank_splits bs
      JOIN bank_transactions bt ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
      ${BS_RECEIVER_JOIN}
      WHERE bs.tenant_id = $1
      ORDER BY bt.created_at DESC
      LIMIT 30
      `,
      [tenantId, actorId]
    );

    const lastTransactions: EconomicTransaction[] = [];

    payerRows.forEach((r) => {
      lastTransactions.push({
        transactionId: r.id,
        type: 'payment_execution',
        amountCents: parseFloat(r.amount_cents),
        currency: 'BRL',
        payerActorId: actorId,
        executedAt: r.created_at,
        metadata: { source: 'bank_transactions' },
      });
    });

    splitRows.forEach((r) => {
      lastTransactions.push({
        transactionId: r.split_id,
        type: 'payment_split',
        amountCents: parseFloat(r.amt),
        currency: 'BRL',
        receiverActorId: actorId,
        executedAt: r.executed_at,
        metadata: { bankTransactionId: r.tx_id, source: 'bank_splits' },
      });
    });

    lastTransactions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());

    return {
      actorId,
      tenantId,
      totalReceived,
      totalPaid,
      totalDistributedViaSplit,
      executionsCount,
      lastTransactions: lastTransactions.slice(0, 20),
      currency: 'BRL',
      lastUpdated: new Date(),
    };
  }

  async projectGroupEconomicOverview(
    tenantId: string,
    groupId: string
  ): Promise<GroupEconomicOverview> {
    const recvRow = await runQueriesWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(${BS_AMOUNT}), 0)::text AS total
      FROM bank_splits bs
      ${BS_RECEIVER_JOIN}
      WHERE bs.tenant_id = $1
      `,
      [tenantId, groupId]
    );
    const totalDistributedViaSplit = parseFloat(recvRow[0]?.total || '0');
    const totalReceived = totalDistributedViaSplit;

    const cntRow = await runQueriesWithTenant<{ n: string }>(
      tenantId,
      `
      SELECT COUNT(DISTINCT bs.transaction_id)::text AS n
      FROM bank_splits bs
      ${BS_RECEIVER_JOIN}
      WHERE bs.tenant_id = $1
      `,
      [tenantId, groupId]
    );
    const executionsCount = parseInt(cntRow[0]?.n || '0', 10);

    const splitList = await runQueriesWithTenant<{
      split_id: string;
      amt: string;
      executed_at: Date;
      tx_id: string;
    }>(
      tenantId,
      `
      SELECT bs.split_id::text,
             ${BS_AMOUNT}::text AS amt,
             bt.created_at AS executed_at,
             bs.transaction_id::text AS tx_id
      FROM bank_splits bs
      JOIN bank_transactions bt ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
      ${BS_RECEIVER_JOIN}
      WHERE bs.tenant_id = $1
      ORDER BY bt.created_at DESC
      LIMIT 30
      `,
      [tenantId, groupId]
    );

    const lastTransactions: EconomicTransaction[] = splitList.map((r) => ({
      transactionId: r.split_id,
      type: 'payment_split',
      amountCents: parseFloat(r.amt),
      currency: 'BRL',
      receiverActorId: groupId,
      executedAt: r.executed_at,
      metadata: { bankTransactionId: r.tx_id, source: 'bank_splits' },
    }));

    return {
      groupId,
      tenantId,
      totalReceived,
      totalDistributedViaSplit,
      executionsCount,
      lastTransactions: lastTransactions.slice(0, 20),
      currency: 'BRL',
      lastUpdated: new Date(),
    };
  }

  async projectReadModel(
    readModelType: ReadModelType,
    event: UnificardEvent
  ): Promise<void> {
    void readModelType;
    void event;
  }
}

export const economicOverviewProjector = new EconomicOverviewProjector();
