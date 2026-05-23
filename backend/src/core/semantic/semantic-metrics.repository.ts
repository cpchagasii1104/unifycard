import { pool } from '@core/database/pool';

/** Contadores por execução de inferência (DECISION_STATS). */
export type TenantSemanticStatsInput = {
  graphSuccess: number;
  slugFallback: number;
  graphMissing: number;
};

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Soma métricas do dia (UTC) para o tenant.
 * `total_requests` incrementa com a soma dos eventos desta execução (base para taxas).
 */
export async function upsertTenantMetrics(
  tenantId: string,
  stats: TenantSemanticStatsInput
): Promise<void> {
  const g = stats.graphSuccess;
  const s = stats.slugFallback;
  const m = stats.graphMissing;
  const totalDelta = g + s + m;

  await pool.query(
    `
    INSERT INTO tenant_semantic_metrics (
      tenant_id,
      date,
      graph_success_count,
      slug_fallback_count,
      graph_missing_count,
      total_requests
    )
    VALUES ($1, $2::date, $3, $4, $5, $6)
    ON CONFLICT (tenant_id, date) DO UPDATE SET
      graph_success_count = tenant_semantic_metrics.graph_success_count + EXCLUDED.graph_success_count,
      slug_fallback_count = tenant_semantic_metrics.slug_fallback_count + EXCLUDED.slug_fallback_count,
      graph_missing_count = tenant_semantic_metrics.graph_missing_count + EXCLUDED.graph_missing_count,
      total_requests = tenant_semantic_metrics.total_requests + EXCLUDED.total_requests
    `,
    [tenantId, utcDateString(new Date()), g, s, m, totalDelta]
  );
}