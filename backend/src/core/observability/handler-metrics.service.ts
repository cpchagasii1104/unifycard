// Agregação em memória de eventos `metric_event` emitidos pelo canonicalLogger (camada 2 / handler).
// Não altera domínio nem pipeline — só observabilidade (CORE_OBSERVABILITY_CONTRACT).
// Tipagem mínima aqui para evitar dependência circular com canonical-logger.

import { pool } from '@core/database/pool';
import { getAuthorityMode } from '../compliance/authority-mode';

/** Nomes Prometheus-style por valor de `metric_event` (HANDLER_EXECUTION §7). */
const METRIC_EVENT_TO_NAME: Record<string, string> = {
  handler_failure_created: 'handler_failure_created_total',
  handler_retry_attempt: 'handler_retry_attempt_total',
  handler_dead_letter: 'handler_dead_letter_total',
  handler_failure_event_log_missing: 'handler_failure_event_log_missing_total',
  handler_retry_failed: 'handler_retry_failed_total',
  reconciliation_drift_detected: 'reconciliation_drift_detected_total',
  reconciliation_run_completed: 'reconciliation_run_completed_total',
  saga_transition: 'saga_transition_total',
  saga_timeout: 'saga_timeout_total',
  saga_failure: 'saga_failure_total',
  ledger_compensation_created: 'ledger_compensation_created_total',
  ledger_compensation_failed: 'ledger_compensation_failed_total',
  saga_compensation_triggered: 'saga_compensation_triggered_total',
  saga_compensation_skipped: 'saga_compensation_skipped_total',
  saga_compensation_success: 'saga_compensation_success_total',
};

export type HandlerMetricLogContext = Record<string, unknown>;

type LabelKey = {
  handler_key: string;
  event_type: string;
  tenant_id: string;
};

function labelsKey(l: LabelKey): string {
  return `${l.handler_key}\x1e${l.event_type}\x1e${l.tenant_id}`;
}

function escapeLabel(v: string): string {
  return String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function normalizeLabels(ctx: HandlerMetricLogContext): LabelKey {
  const handlerKey =
    typeof ctx.handlerKey === 'string' && ctx.handlerKey ? ctx.handlerKey : '_unknown';
  const eventType =
    typeof ctx.eventType === 'string' && ctx.eventType ? ctx.eventType : '_unknown';
  let tenant = typeof ctx.tenantId === 'string' && ctx.tenantId ? ctx.tenantId : '_unknown';
  if (tenant !== '_unknown' && tenant.length > 36) {
    tenant = `${tenant.slice(0, 8)}_trunc`;
  }
  return { handler_key: handlerKey, event_type: eventType, tenant_id: tenant };
}

/** Labels INFRA-3 / INFRA-6: type × tenant_id × severity (dimensões pedidas). */
function normalizeReconciliationLabelsKey(ctx: HandlerMetricLogContext): string {
  const recType =
    typeof ctx.reconciliationKind === 'string' && ctx.reconciliationKind
      ? ctx.reconciliationKind
      : '_unknown';
  let tenant = typeof ctx.tenantId === 'string' && ctx.tenantId ? ctx.tenantId : '_unknown';
  if (tenant !== '_unknown' && tenant.length > 36) {
    tenant = `${tenant.slice(0, 8)}_trunc`;
  }
  const sev = typeof ctx.severity === 'string' && ctx.severity ? ctx.severity : '_unknown';
  return `${recType}\x1e${tenant}\x1e${sev}`;
}

function isReconciliationMetricName(name: string): boolean {
  return name === 'reconciliation_drift_detected_total' || name === 'reconciliation_run_completed_total';
}

/** Labels INFRA-4 / INFRA-4.1 — from_status × to_status × tenant_id. */
function normalizeSagaLedgerLabelsKey(ctx: HandlerMetricLogContext): string {
  const from = typeof ctx.sagaFromStatus === 'string' && ctx.sagaFromStatus ? ctx.sagaFromStatus : '_na';
  const to = typeof ctx.sagaToStatus === 'string' && ctx.sagaToStatus ? ctx.sagaToStatus : '_na';
  let tenant = typeof ctx.tenantId === 'string' && ctx.tenantId ? ctx.tenantId : '_unknown';
  if (tenant !== '_unknown' && tenant.length > 36) {
    tenant = `${tenant.slice(0, 8)}_trunc`;
  }
  return `${from}\x1e${to}\x1e${tenant}`;
}

function isSagaLedgerMetricName(name: string): boolean {
  return (
    name === 'saga_transition_total' ||
    name === 'saga_timeout_total' ||
    name === 'saga_failure_total' ||
    name === 'ledger_compensation_created_total' ||
    name === 'ledger_compensation_failed_total'
  );
}

/** INFRA-4.2 — skip_reason × tenant_id */
function normalizeSagaCompensationSkippedLabelsKey(ctx: HandlerMetricLogContext): string {
  const skipReason =
    typeof ctx.sagaCompensationSkipReason === 'string' && ctx.sagaCompensationSkipReason
      ? ctx.sagaCompensationSkipReason
      : '_unknown';
  let tenant = typeof ctx.tenantId === 'string' && ctx.tenantId ? ctx.tenantId : '_unknown';
  if (tenant !== '_unknown' && tenant.length > 36) {
    tenant = `${tenant.slice(0, 8)}_trunc`;
  }
  return `${skipReason}\x1e${tenant}`;
}

function isSagaCompensationSkippedMetricName(name: string): boolean {
  return name === 'saga_compensation_skipped_total';
}

class HandlerMetricsService {
  /** chave: metricNamePrometheus \x1f metric_event raw \x1f labelsKey */
  private labeledCounters = new Map<string, number>();
  private retryAttemptsByMinute = new Map<string, number>();
  private startedAt = new Date();

  ingestFromLogContext(context: HandlerMetricLogContext): void {
    const raw = context.metric_event;
    if (typeof raw !== 'string' || !raw.trim()) {
      return;
    }
    const metricEvent = raw.trim();
    const metricName = METRIC_EVENT_TO_NAME[metricEvent] ?? 'handler_metric_event_total';
    const lk = isReconciliationMetricName(metricName)
      ? normalizeReconciliationLabelsKey(context)
      : isSagaCompensationSkippedMetricName(metricName)
        ? normalizeSagaCompensationSkippedLabelsKey(context)
        : isSagaLedgerMetricName(metricName)
          ? normalizeSagaLedgerLabelsKey(context)
          : labelsKey(normalizeLabels(context));
    const mapKey = `${metricName}\x1f${metricEvent}\x1f${lk}`;
    this.labeledCounters.set(mapKey, (this.labeledCounters.get(mapKey) ?? 0) + 1);

    if (metricEvent === 'handler_retry_attempt') {
      const minute = new Date();
      minute.setSeconds(0, 0);
      const mk = minute.toISOString();
      this.retryAttemptsByMinute.set(mk, (this.retryAttemptsByMinute.get(mk) ?? 0) + 1);
      const cutoff = Date.now() - 120 * 60 * 1000;
      for (const k of this.retryAttemptsByMinute.keys()) {
        if (new Date(k).getTime() < cutoff) {
          this.retryAttemptsByMinute.delete(k);
        }
      }
    }
  }

  getTotals(): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const [mapKey, n] of this.labeledCounters.entries()) {
      const metricName = mapKey.split('\x1f')[0];
      totals[metricName] = (totals[metricName] ?? 0) + n;
    }
    return totals;
  }

  getByHandlerKey(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [mapKey, n] of this.labeledCounters.entries()) {
      const parts = mapKey.split('\x1f');
      if (parts.length < 3) continue;
      const labelParts = parts[2].split('\x1e');
      const hk = labelParts[0] ?? '_unknown';
      out[hk] = (out[hk] ?? 0) + n;
    }
    return out;
  }

  getRetriesLastMinutes(minutes: number): { minute: string; count: number }[] {
    const now = new Date();
    now.setSeconds(0, 0);
    const rows: { minute: string; count: number }[] = [];
    for (let i = minutes - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() - i);
      const mk = d.toISOString();
      rows.push({ minute: mk, count: this.retryAttemptsByMinute.get(mk) ?? 0 });
    }
    return rows;
  }

  getPrometheusExposition(): string {
    const lines: string[] = [];
    const seenTypes = new Set<string>();
    const help = (name: string, text: string) => {
      lines.push(`# HELP ${name} ${text}`);
      lines.push(`# TYPE ${name} counter`);
    };
    for (const [mapKey, value] of this.labeledCounters.entries()) {
      const [metricName, metricEvent, lk] = mapKey.split('\x1f');
      const [hk, et, tid] = lk.split('\x1e');
      if (!seenTypes.has(metricName)) {
        seenTypes.add(metricName);
        help(
          metricName,
          metricName === 'handler_metric_event_total'
            ? 'Unknown metric_event values from canonical logs.'
            : `Counter for metric_event family (${metricName}).`
        );
      }
      let labelStr: string;
      if (isReconciliationMetricName(metricName)) {
        const [recType, recTenant, sev] = lk.split('\x1e');
        labelStr = `type="${escapeLabel(recType ?? '_unknown')}",tenant_id="${escapeLabel(recTenant ?? '_unknown')}",severity="${escapeLabel(sev ?? '_unknown')}"`;
      } else if (isSagaLedgerMetricName(metricName)) {
        const [fromS, toS, tid] = lk.split('\x1e');
        labelStr = `from_status="${escapeLabel(fromS ?? '_na')}",to_status="${escapeLabel(toS ?? '_na')}",tenant_id="${escapeLabel(tid ?? '_unknown')}"`;
      } else if (isSagaCompensationSkippedMetricName(metricName)) {
        const [skipReason, tid] = lk.split('\x1e');
        labelStr = `skip_reason="${escapeLabel(skipReason ?? '_unknown')}",tenant_id="${escapeLabel(tid ?? '_unknown')}"`;
      } else if (metricName === 'handler_metric_event_total') {
        labelStr = `metric_event="${escapeLabel(metricEvent)}",handler_key="${escapeLabel(hk)}",event_type="${escapeLabel(et)}",tenant_id="${escapeLabel(tid)}"`;
      } else {
        labelStr = `handler_key="${escapeLabel(hk)}",event_type="${escapeLabel(et)}",tenant_id="${escapeLabel(tid)}"`;
      }
      lines.push(`${metricName}{${labelStr}} ${value}`);
    }
    return lines.length ? lines.join('\n') + '\n' : '';
  }

  getJsonDashboard(): {
    startedAt: string;
    totals: Record<string, number>;
    byHandlerKey: Record<string, number>;
    retriesPerMinute: { minute: string; count: number }[];
  } {
    return {
      startedAt: this.startedAt.toISOString(),
      totals: this.getTotals(),
      byHandlerKey: this.getByHandlerKey(),
      retriesPerMinute: this.getRetriesLastMinutes(15),
    };
  }

  async fetchDbSnapshot(): Promise<{
    pendingByHandler: { handler_key: string; count: string }[];
    deadByHandler: { handler_key: string; count: string }[];
    avgAttemptsByHandler: { handler_key: string; avg_attempts: string }[];
    deadTotal: number;
    pendingTotal: number;
  } | null> {
    try {
      const pending = await pool.query<{ handler_key: string; count: string }>(
        `
        SELECT handler_key, COUNT(*)::text AS count
        FROM event_handler_failures
        WHERE status IN ('pending', 'retrying')
        GROUP BY handler_key
        ORDER BY COUNT(*) DESC
        `
      );
      const dead = await pool.query<{ handler_key: string; count: string }>(
        `
        SELECT handler_key, COUNT(*)::text AS count
        FROM event_handler_failures
        WHERE status = 'dead'
        GROUP BY handler_key
        ORDER BY COUNT(*) DESC
        `
      );
      const avg = await pool.query<{ handler_key: string; avg_attempts: string }>(
        `
        SELECT handler_key, ROUND(AVG(attempts)::numeric, 2)::text AS avg_attempts
        FROM event_handler_failures
        GROUP BY handler_key
        ORDER BY AVG(attempts) DESC
        `
      );
      const deadSum = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM event_handler_failures WHERE status = 'dead'`
      );
      const pendSum = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM event_handler_failures WHERE status IN ('pending', 'retrying')`
      );
      return {
        pendingByHandler: pending.rows,
        deadByHandler: dead.rows,
        avgAttemptsByHandler: avg.rows,
        deadTotal: Number(deadSum.rows[0]?.c ?? 0),
        pendingTotal: Number(pendSum.rows[0]?.c ?? 0),
      };
    } catch (e) {
      const code =
        typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
      if (code === '42P01') {
        if (getAuthorityMode() === 'strict') {
          console.error(
            '[handler-metrics] CRITICAL: tabela event_handler_failures ausente (42P01) em strict mode — ' +
            'métricas indisponíveis, investigar infraestrutura imediatamente'
          );
        } else {
          console.error('[handler-metrics] 42P01: tabela ausente (permissive mode)');
        }
        return null;
      }
      throw e;
    }
  }

  async evaluateAlertHints(): Promise<{
    level: 'ok' | 'degraded' | 'critical';
    reasons: string[];
    db: Awaited<ReturnType<HandlerMetricsService['fetchDbSnapshot']>>;
  }> {
    const reasons: string[] = [];
    let level: 'ok' | 'degraded' | 'critical' = 'ok';
    const db = await this.fetchDbSnapshot();
    if (db) {
      if (db.deadTotal > 0) {
        level = 'critical';
        reasons.push(`dead_letter_rows=${db.deadTotal} (CRÍTICO: rever runbook handler-failures)`);
      }
      if (db.pendingTotal > 50) {
        if (level !== 'critical') level = 'degraded';
        reasons.push(`pending_backlog=${db.pendingTotal} (possível degradação do worker)`);
      }
      for (const row of db.avgAttemptsByHandler) {
        const a = Number(row.avg_attempts);
        if (a >= 5) {
          if (level === 'ok') level = 'degraded';
          reasons.push(`high_avg_attempts handler_key=${row.handler_key} avg=${row.avg_attempts}`);
        }
      }
    }
    const totals = this.getTotals();
    if ((totals.handler_dead_letter_total ?? 0) > 0 && level === 'ok') {
      level = 'critical';
      reasons.push('handler_dead_letter_total>0 from log counters');
    }
    return { level, reasons, db };
  }
}

export const handlerMetricsService = new HandlerMetricsService();

export function ingestHandlerMetricFromContext(context: HandlerMetricLogContext): void {
  handlerMetricsService.ingestFromLogContext(context);
}