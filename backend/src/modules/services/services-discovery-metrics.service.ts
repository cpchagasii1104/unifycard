import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';
import { bankTransactionReadRepository } from '@modules/bank/bank-transaction-read.repository';

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

export type ServiceDiscoveryCategoryMetrics = {
  categoryId: string | null;
  requestsCreated: number;
  requestsAccepted: number;
  paymentsCompleted: number;
  amountCentsPaid: number;
};

export type ServiceDiscoveryMetricsSnapshot = {
  totalRequestsCreated: number;
  totalRequestsAccepted: number;
  totalRequestsRejected: number;
  totalPaymentsCompleted: number;
  totalAmountCentsPaid: number;
  averageAmountCentsPerPaidRequest: number | null;
  conversionRates: {
    acceptedOverTotal: number | null;
    paidOverAccepted: number | null;
  };
  byCategory: ServiceDiscoveryCategoryMetrics[];
};

/**
 * Agregações read-only para observabilidade do fluxo service discovery + pagamento.
 * Não altera estado nem regras de negócio.
 */
class ServicesDiscoveryMetricsService {
  async getTenantMetrics(tenantId: string): Promise<ServiceDiscoveryMetricsSnapshot> {
    const totals = await runQueryWithTenant<{
      total_created: string;
      total_accepted: string;
      total_rejected: string;
      total_paid: string;
    }>(
      tenantId,
      `
      SELECT
        COUNT(*)::text AS total_created,
        COUNT(*) FILTER (WHERE status = 'accepted')::text AS total_accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::text AS total_rejected,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::text AS total_paid
      FROM service_discovery_requests
      WHERE tenant_id = $1
      `,
      [tenantId]
    );

    const totalRequestsCreated = parseInt(totals?.total_created ?? '0', 10);
    const totalRequestsAccepted = parseInt(totals?.total_accepted ?? '0', 10);
    const totalRequestsRejected = parseInt(totals?.total_rejected ?? '0', 10);
    const totalPaymentsCompleted = parseInt(totals?.total_paid ?? '0', 10);

    const detailRows = await runQueriesWithTenant<{
      category_id: string | null;
      status: string;
      payment_status: string;
      payment_bank_transaction_id: string | null;
    }>(
      tenantId,
      `
      SELECT
        s.category_id,
        r.status,
        r.payment_status,
        r.payment_bank_transaction_id::text AS payment_bank_transaction_id
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
      `,
      [tenantId]
    );

    const paidTxIds = [
      ...new Set(
        detailRows
          .filter((r) => r.payment_status === 'paid' && r.payment_bank_transaction_id)
          .map((r) => r.payment_bank_transaction_id as string)
      ),
    ];

    const amountByTxId =
      await bankTransactionReadRepository.getAmountCentsByTransactionIds(tenantId, paidTxIds);

    let totalAmountCentsPaid = 0;
    for (const r of detailRows) {
      if (r.payment_status === 'paid' && r.payment_bank_transaction_id) {
        totalAmountCentsPaid += amountByTxId.get(r.payment_bank_transaction_id) ?? 0;
      }
    }

    const averageAmountCentsPerPaidRequest =
      totalPaymentsCompleted > 0
        ? Math.round(totalAmountCentsPaid / totalPaymentsCompleted)
        : null;

    type CatAgg = {
      requestsCreated: number;
      requestsAccepted: number;
      paymentsCompleted: number;
      amountCentsPaid: number;
    };
    const catMap = new Map<string | null, CatAgg>();
    for (const r of detailRows) {
      const key = r.category_id;
      if (!catMap.has(key)) {
        catMap.set(key, {
          requestsCreated: 0,
          requestsAccepted: 0,
          paymentsCompleted: 0,
          amountCentsPaid: 0,
        });
      }
      const c = catMap.get(key)!;
      c.requestsCreated += 1;
      if (r.status === 'accepted') c.requestsAccepted += 1;
      if (r.payment_status === 'paid') {
        c.paymentsCompleted += 1;
        if (r.payment_bank_transaction_id) {
          c.amountCentsPaid += amountByTxId.get(r.payment_bank_transaction_id) ?? 0;
        }
      }
    }

    const byCategory: ServiceDiscoveryCategoryMetrics[] = [...catMap.entries()]
      .map(([categoryId, agg]) => ({
        categoryId,
        requestsCreated: agg.requestsCreated,
        requestsAccepted: agg.requestsAccepted,
        paymentsCompleted: agg.paymentsCompleted,
        amountCentsPaid: agg.amountCentsPaid,
      }))
      .sort((a, b) => b.requestsCreated - a.requestsCreated);

    return {
      totalRequestsCreated,
      totalRequestsAccepted,
      totalRequestsRejected,
      totalPaymentsCompleted,
      totalAmountCentsPaid,
      averageAmountCentsPerPaidRequest,
      conversionRates: {
        acceptedOverTotal: safeRatio(totalRequestsAccepted, totalRequestsCreated),
        paidOverAccepted: safeRatio(totalPaymentsCompleted, totalRequestsAccepted),
      },
      byCategory,
    };
  }
}

export const servicesDiscoveryMetricsService = new ServicesDiscoveryMetricsService();