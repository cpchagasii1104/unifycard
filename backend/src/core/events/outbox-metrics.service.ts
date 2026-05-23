// INFRA-6 GLOBAL — leitura só (observabilidade). Não altera domínio, outbox, handlers nem event_bus.

import { pool } from '@core/database/pool';
import { handlerMetricsService } from '@core/observability/handler-metrics.service';

export type OutboxDbSnapshot = {
  pending: number;
  published: number;
  retry_scheduled: number;
  retrying: number;
};

export type OutboxLag = {
  oldest_pending_seconds: number | null;
};

export type OutboxThroughput = {
  published_5m: number;
  published_15m: number;
};

export type OutboxLatency = {
  avg_latency_seconds: number | null;
  max_latency_seconds: number | null;
};

/** Buckets cumulativos (≤ le) na janela SQL; adequado para histogram_quantile no instante do scrape. */
export type OutboxLatencyHistogramSnapshot = {
  window_minutes: number;
  count: number;
  sum_seconds: number;
  buckets: { le: string; cumulative: number }[];
};

export type OutboxConsolidated = {
  outbox: OutboxDbSnapshot &
    OutboxLag &
    OutboxThroughput & {
      dlq_count: number;
      high_retry_pressure: number;
      pending_older_than_15m: number;
    };
  latency: OutboxLatency | null;
  /** null se `event_log` invisível (RLS) ou erro — não falha o resto do snapshot */
  latencyHistogram: OutboxLatencyHistogramSnapshot | null;
  handlers: {
    db: Awaited<ReturnType<typeof handlerMetricsService.fetchDbSnapshot>>;
    logTotals: Record<string, number>;
  };
};

function num(v: string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isMissingRelation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === '42P01'
  );
}

class OutboxMetricsService {
  private static readonly LATENCY_SQL_WINDOW = `INTERVAL '15 minutes'`;

  async fetchOutboxSnapshot(): Promise<OutboxDbSnapshot | null> {
    try {
      const r = await pool.query<{
        pending: string;
        published: string;
        retry_scheduled: string;
        retrying: string;
      }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE published_at IS NULL)::text AS pending,
          COUNT(*) FILTER (WHERE published_at IS NOT NULL)::text AS published,
          COUNT(*) FILTER (WHERE next_retry_at IS NOT NULL AND published_at IS NULL)::text AS retry_scheduled,
          COUNT(*) FILTER (WHERE attempts > 0 AND published_at IS NULL)::text AS retrying
        FROM event_outbox
        `
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        pending: num(row.pending),
        published: num(row.published),
        retry_scheduled: num(row.retry_scheduled),
        retrying: num(row.retrying),
      };
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  async fetchLag(): Promise<OutboxLag | null> {
    try {
      const r = await pool.query<{ oldest_pending_seconds: string | null }>(
        `
        SELECT
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::text AS oldest_pending_seconds
        FROM event_outbox
        WHERE published_at IS NULL
        `
      );
      const v = r.rows[0]?.oldest_pending_seconds;
      return { oldest_pending_seconds: v == null ? null : numOrNull(v) };
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  async fetchThroughput(): Promise<OutboxThroughput | null> {
    try {
      const r = await pool.query<{ published_5m: string; published_15m: string }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '5 minutes')::text AS published_5m,
          COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '15 minutes')::text AS published_15m
        FROM event_outbox
        `
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        published_5m: num(row.published_5m),
        published_15m: num(row.published_15m),
      };
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  async fetchDlqCount(): Promise<number | null> {
    try {
      const r = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM event_outbox_failed`
      );
      return num(r.rows[0]?.c);
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  async fetchRetryPressureLayer1(): Promise<number | null> {
    try {
      const r = await pool.query<{ high_retry_pressure: string }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE attempts >= 3 AND published_at IS NULL)::text AS high_retry_pressure
        FROM event_outbox
        `
      );
      return num(r.rows[0]?.high_retry_pressure);
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  async fetchPendingOlderThan15m(): Promise<number | null> {
    try {
      const r = await pool.query<{ c: string }>(
        `
        SELECT COUNT(*)::text AS c
        FROM event_outbox
        WHERE published_at IS NULL
          AND created_at < NOW() - INTERVAL '15 minutes'
        `
      );
      return num(r.rows[0]?.c);
    } catch (e) {
      if (isMissingRelation(e)) return null;
      throw e;
    }
  }

  /**
   * Latência outbox → event_log (requer visibilidade cross-tenant em `event_log`; com RLS estrita pode falhar ou subestimar).
   */
  async fetchPipelineLatency(): Promise<OutboxLatency | null> {
    try {
      const r = await pool.query<{ avg_latency_seconds: string | null; max_latency_seconds: string | null }>(
        `
        SELECT
          AVG(EXTRACT(EPOCH FROM (el.created_at - eo.created_at)))::text AS avg_latency_seconds,
          MAX(EXTRACT(EPOCH FROM (el.created_at - eo.created_at)))::text AS max_latency_seconds
        FROM event_outbox eo
        JOIN event_log el ON el.event_id = eo.event_id AND el.tenant_id = eo.tenant_id
        WHERE eo.published_at IS NOT NULL
          AND eo.created_at >= NOW() - ${OutboxMetricsService.LATENCY_SQL_WINDOW}
        `
      );
      const row = r.rows[0];
      if (!row) return { avg_latency_seconds: null, max_latency_seconds: null };
      return {
        avg_latency_seconds: numOrNull(row.avg_latency_seconds),
        max_latency_seconds: numOrNull(row.max_latency_seconds),
      };
    } catch (e) {
      if (isMissingRelation(e)) return null;
      return null;
    }
  }

  /**
   * Histograma cumulativo na mesma janela que fetchPipelineLatency (SLO p95/p99 via histogram_quantile no scrape).
   * Buckets expostos como gauge: cada scrape reflecte a janela móvel SQL — não usar increase() nos buckets.
   */
  async fetchPipelineLatencyHistogram(): Promise<OutboxLatencyHistogramSnapshot | null> {
    const windowMinutes = 15;
    try {
      const r = await pool.query<{
        obs_count: string;
        obs_sum: string;
        le_0_1: string;
        le_0_5: string;
        le_1: string;
        le_2: string;
        le_5: string;
        le_10: string;
        le_inf: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS obs_count,
          COALESCE(SUM(GREATEST(0, sec)), 0)::text AS obs_sum,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 0.1)::text AS le_0_1,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 0.5)::text AS le_0_5,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 1)::text AS le_1,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 2)::text AS le_2,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 5)::text AS le_5,
          COUNT(*) FILTER (WHERE GREATEST(0, sec) <= 10)::text AS le_10,
          COUNT(*)::text AS le_inf
        FROM (
          SELECT EXTRACT(EPOCH FROM (el.created_at - eo.created_at)) AS sec
          FROM event_outbox eo
          JOIN event_log el ON el.event_id = eo.event_id AND el.tenant_id = eo.tenant_id
          WHERE eo.published_at IS NOT NULL
            AND eo.created_at >= NOW() - ${OutboxMetricsService.LATENCY_SQL_WINDOW}
        ) t
        `
      );
      const row = r.rows[0];
      if (!row) {
        return {
          window_minutes: windowMinutes,
          count: 0,
          sum_seconds: 0,
          buckets: [
            { le: '0.1', cumulative: 0 },
            { le: '0.5', cumulative: 0 },
            { le: '1', cumulative: 0 },
            { le: '2', cumulative: 0 },
            { le: '5', cumulative: 0 },
            { le: '10', cumulative: 0 },
            { le: '+Inf', cumulative: 0 },
          ],
        };
      }
      const count = num(row.obs_count);
      return {
        window_minutes: windowMinutes,
        count,
        sum_seconds: Number(row.obs_sum) || 0,
        buckets: [
          { le: '0.1', cumulative: num(row.le_0_1) },
          { le: '0.5', cumulative: num(row.le_0_5) },
          { le: '1', cumulative: num(row.le_1) },
          { le: '2', cumulative: num(row.le_2) },
          { le: '5', cumulative: num(row.le_5) },
          { le: '10', cumulative: num(row.le_10) },
          { le: '+Inf', cumulative: num(row.le_inf) },
        ],
      };
    } catch (e) {
      if (isMissingRelation(e)) return null;
      return null;
    }
  }

  async getConsolidated(): Promise<OutboxConsolidated | null> {
    const [
      snapshot,
      lag,
      throughput,
      dlq,
      highRetry,
      stalePending,
      latency,
      latencyHistogram,
      handlerDb,
    ] = await Promise.all([
      this.fetchOutboxSnapshot(),
      this.fetchLag(),
      this.fetchThroughput(),
      this.fetchDlqCount(),
      this.fetchRetryPressureLayer1(),
      this.fetchPendingOlderThan15m(),
      this.fetchPipelineLatency(),
      this.fetchPipelineLatencyHistogram(),
      handlerMetricsService.fetchDbSnapshot(),
    ]);

    if (!snapshot || !lag || !throughput || dlq === null || highRetry === null || stalePending === null) {
      return null;
    }

    return {
      outbox: {
        ...snapshot,
        ...lag,
        ...throughput,
        dlq_count: dlq,
        high_retry_pressure: highRetry,
        pending_older_than_15m: stalePending,
      },
      latency: latency ?? null,
      latencyHistogram: latencyHistogram ?? null,
      handlers: {
        db: handlerDb,
        logTotals: handlerMetricsService.getTotals(),
      },
    };
  }

  getPrometheusText(data: OutboxConsolidated | null): string {
    if (!data) {
      return '# outbox metrics: tables missing or unavailable\n';
    }
    const o = data.outbox;
    const lines: string[] = [
      '# HELP outbox_pending Rows in event_outbox with published_at IS NULL.',
      '# TYPE outbox_pending gauge',
      `outbox_pending ${o.pending}`,
      '# HELP outbox_retry_scheduled Pending rows with next_retry_at set.',
      '# TYPE outbox_retry_scheduled gauge',
      `outbox_retry_scheduled ${o.retry_scheduled}`,
      '# HELP outbox_retrying Pending rows with attempts > 0 (pressão de retry camada 1).',
      '# TYPE outbox_retrying gauge',
      `outbox_retrying ${o.retrying}`,
      '# HELP outbox_dlq_total Rows in event_outbox_failed.',
      '# TYPE outbox_dlq_total gauge',
      `outbox_dlq_total ${o.dlq_count}`,
      '# HELP outbox_oldest_pending_seconds Age in seconds of oldest pending row (null → 0).',
      '# TYPE outbox_oldest_pending_seconds gauge',
      `outbox_oldest_pending_seconds ${o.oldest_pending_seconds ?? 0}`,
      '# HELP outbox_published_5m Published rows in last 5 minutes.',
      '# TYPE outbox_published_5m gauge',
      `outbox_published_5m ${o.published_5m}`,
      '# HELP outbox_published_15m Published rows in last 15 minutes.',
      '# TYPE outbox_published_15m gauge',
      `outbox_published_15m ${o.published_15m}`,
      '# HELP outbox_high_retry_pressure Pending with attempts >= 3.',
      '# TYPE outbox_high_retry_pressure gauge',
      `outbox_high_retry_pressure ${o.high_retry_pressure}`,
      '# HELP outbox_pending_older_than_15m Stale backlog indicator.',
      '# TYPE outbox_pending_older_than_15m gauge',
      `outbox_pending_older_than_15m ${o.pending_older_than_15m}`,
    ];
    const lat = data.latency;
    if (lat && (lat.avg_latency_seconds != null || lat.max_latency_seconds != null)) {
      lines.push(
        '# HELP outbox_latency_avg_seconds Avg publish lag vs event_log (15m window).',
        '# TYPE outbox_latency_avg_seconds gauge',
        `outbox_latency_avg_seconds ${lat.avg_latency_seconds ?? 0}`,
        '# HELP outbox_latency_max_seconds Max publish lag vs event_log (15m window).',
        '# TYPE outbox_latency_max_seconds gauge',
        `outbox_latency_max_seconds ${lat.max_latency_seconds ?? 0}`
      );
    }

    const hist = data.latencyHistogram;
    if (hist) {
      const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
      lines.push(
        '# HELP outbox_pipeline_latency_seconds Outbox created_at → event_log created_at (s); rolling SQL window at scrape. Buckets/sum/count are gauges — use histogram_quantile at instant, not rate() on buckets.',
        '# TYPE outbox_pipeline_latency_seconds_bucket gauge'
      );
      for (const b of hist.buckets) {
        lines.push(
          `outbox_pipeline_latency_seconds_bucket{le="${esc(b.le)}"} ${b.cumulative}`
        );
      }
      lines.push(
        '# TYPE outbox_pipeline_latency_seconds_sum gauge',
        `outbox_pipeline_latency_seconds_sum ${hist.sum_seconds}`,
        '# TYPE outbox_pipeline_latency_seconds_count gauge',
        `outbox_pipeline_latency_seconds_count ${hist.count}`
      );
    }
    if (data.handlers.db) {
      lines.push(
        '# HELP handler_failures_pending_total event_handler_failures pending+retrying.',
        '# TYPE handler_failures_pending_total gauge',
        `handler_failures_pending_total ${data.handlers.db.pendingTotal}`,
        '# HELP handler_failures_dead_total event_handler_failures dead.',
        '# TYPE handler_failures_dead_total gauge',
        `handler_failures_dead_total ${data.handlers.db.deadTotal}`
      );
    }
    return lines.join('\n') + '\n';
  }

  /**
   * Heurísticas outbox (+ referência camada 2 no JSON). Thresholds = ponto de partida operacional.
   */
  async evaluateOutboxAlertHints(): Promise<{
    level: 'ok' | 'degraded' | 'critical';
    reasons: string[];
    consolidated: OutboxConsolidated | null;
  }> {
    const consolidated = await this.getConsolidated();
    const reasons: string[] = [];
    let level: 'ok' | 'degraded' | 'critical' = 'ok';

    if (!consolidated) {
      return {
        level: 'degraded',
        reasons: ['outbox_metrics_unavailable (missing tables or DB error)'],
        consolidated: null,
      };
    }

    const o = consolidated.outbox;
    if (o.dlq_count > 0) {
      level = 'critical';
      reasons.push(`outbox_dlq_count=${o.dlq_count} (CRÍTICO: ver runbook event-outbox / DLQ)`);
    }
    const oldest = o.oldest_pending_seconds;
    if (oldest != null && oldest > 300) {
      level = 'critical';
      reasons.push(`oldest_pending_seconds=${oldest} > 300 (CRÍTICO: fila presa ou worker caído)`);
    }

    if (o.high_retry_pressure > 0) {
      if (level !== 'critical') level = 'degraded';
      reasons.push(`outbox_high_retry_pressure=${o.high_retry_pressure} (muitas linhas com attempts>=3)`);
    }
    if (o.pending_older_than_15m > 0) {
      if (level !== 'critical') level = 'degraded';
      reasons.push(`pending_older_than_15m=${o.pending_older_than_15m} (backlog antigo)`);
    }

    const lat = consolidated.latency;
    const LAT_AVG_DEGRADED = 60;
    const LAT_MAX_DEGRADED = 120;
    if (lat) {
      if (lat.avg_latency_seconds != null && lat.avg_latency_seconds > LAT_AVG_DEGRADED) {
        if (level === 'ok') level = 'degraded';
        reasons.push(`latency_avg_seconds=${lat.avg_latency_seconds} > ${LAT_AVG_DEGRADED}`);
      }
      if (lat.max_latency_seconds != null && lat.max_latency_seconds > LAT_MAX_DEGRADED) {
        if (level !== 'critical') level = 'degraded';
        reasons.push(`latency_max_seconds=${lat.max_latency_seconds} > ${LAT_MAX_DEGRADED}`);
      }
    }

    const hdb = consolidated.handlers.db;
    if (hdb && hdb.deadTotal > 0) {
      level = 'critical';
      reasons.push(`handler_dead_total=${hdb.deadTotal} (CRÍTICO: runbook handler-failures)`);
    }

    return { level, reasons, consolidated };
  }
}

export const outboxMetricsService = new OutboxMetricsService();