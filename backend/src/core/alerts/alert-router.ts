/**
 * INFRA-6 — encaminhamento de alertas a partir de `metric_event` / logs canónicos.
 * Não bloqueia o fluxo principal; falhas de webhook são engolidas.
 *
 * Variáveis: `SLACK_ALERT_WEBHOOK`, `PAGER_ALERT_WEBHOOK` (opcionais).
 */

const SLACK_WEBHOOK = process.env.SLACK_ALERT_WEBHOOK?.trim();
const PAGER_WEBHOOK = process.env.PAGER_ALERT_WEBHOOK?.trim();

const FETCH_TIMEOUT_MS = 8_000;

/** Eventos que disparam pelo menos Slack (quando webhook configurado). */
const SLACK_METRIC_EVENTS = new Set([
  'reconciliation_drift_detected',
  'handler_dead_letter',
  'saga_failure',
  'outbox_dlq_nonzero',
  'saga_compensation_partial_commit',
]);

function metricEventFrom(
  message: string,
  context: Record<string, unknown>
): string | undefined {
  const me = context.metric_event;
  if (typeof me === 'string' && me.length > 0) return me;
  if (message === 'SAGA_COMPENSATION_PARTIAL_COMMIT') return 'saga_compensation_partial_commit';
  return undefined;
}

function shouldConsider(message: string, context: Record<string, unknown>): boolean {
  const me = metricEventFrom(message, context);
  if (me && SLACK_METRIC_EVENTS.has(me)) return true;
  if (message === 'SAGA_COMPENSATION_PARTIAL_COMMIT') return true;
  return false;
}

function isPagerSeverity(context: Record<string, unknown>, metricEvent: string | undefined): boolean {
  const sev = typeof context.severity === 'string' ? context.severity.toLowerCase() : '';
  if (sev === 'critical') return true;
  if (metricEvent === 'handler_dead_letter' || metricEvent === 'saga_failure') return true;
  if (metricEvent === 'saga_compensation_partial_commit') return true;
  if (metricEvent === 'outbox_dlq_nonzero') return true;
  return false;
}

function pagerForReconciliationDrift(context: Record<string, unknown>, metricEvent: string | undefined): boolean {
  if (metricEvent !== 'reconciliation_drift_detected') return true;
  return typeof context.severity === 'string' && context.severity.toLowerCase() === 'critical';
}

function compactDetails(context: Record<string, unknown>, maxKeys = 24): { title: string; value: string; short: boolean }[] {
  const out: { title: string; value: string; short: boolean }[] = [];
  let n = 0;
  for (const [k, v] of Object.entries(context)) {
    if (n >= maxKeys) break;
    if (k === 'metric_event') continue;
    let s: string;
    try {
      s = typeof v === 'string' ? v : JSON.stringify(v);
    } catch {
      s = String(v);
    }
    if (s.length > 500) s = `${s.slice(0, 497)}...`;
    out.push({ title: k.slice(0, 80), value: s, short: true });
    n += 1;
  }
  return out;
}

/**
 * Envia payload ao Slack Incoming Webhook (text + attachments opcionais).
 */
export async function sendSlackAlert(payload: {
  text: string;
  attachments?: Array<{ color?: string; fields?: Array<{ title: string; value: string; short?: boolean }> }>;
}): Promise<void> {
  if (!SLACK_WEBHOOK) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Slack HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * Webhook genérico para Pager / on-call (JSON simples, sem SDK).
 */
export async function sendPagerAlert(payload: {
  summary: string;
  severity: string;
  metric_event?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!PAGER_WEBHOOK) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PAGER_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: payload.metric_event ?? 'unificard_alert',
        summary: payload.summary,
        severity: payload.severity,
        details: payload.details ?? {},
        ts: new Date().toISOString(),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Pager HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(t);
  }
}

async function routeAlerts(message: string, context: Record<string, unknown>): Promise<void> {
  const metricEvent = metricEventFrom(message, context);
  if (!shouldConsider(message, context)) return;

  const severityRaw =
    (typeof context.severity === 'string' && context.severity) ||
    (metricEvent === 'handler_dead_letter' || metricEvent === 'saga_failure' ? 'critical' : 'warning');
  const severity = severityRaw.toLowerCase();

  const headline = `[${severity}] ${metricEvent ?? message}`;
  const fields = compactDetails(context);

  const color =
    severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : '#439FE0';

  if (SLACK_WEBHOOK) {
    await sendSlackAlert({
      text: headline,
      attachments: [{ color, fields }],
    });
  }

  const pager =
    PAGER_WEBHOOK &&
    isPagerSeverity(context, metricEvent) &&
    pagerForReconciliationDrift(context, metricEvent);
  if (pager) {
    await sendPagerAlert({
      summary: headline,
      severity: 'critical',
      metric_event: metricEvent,
      details: context,
    });
  }
}

/**
 * Chamado pelo `canonicalLogger` após métricas — nunca deve lançar para fora.
 */
function dispatchInternal(message: string, context: Record<string, unknown>): void {
  try {
    void routeAlerts(message, context).catch(() => {
      /* falha de rede / webhook — ignorar */
    });
  } catch {
    /* defesa em profundidade */
  }
}

export const alertRouter = {
  /**
   * `context` deve incluir `metric_event` quando aplicável; `message` é o 2º argumento do logger.
   */
  dispatch(message: string, context?: Record<string, unknown>): void {
    dispatchInternal(message, context ?? {});
  },
};