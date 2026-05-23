/**
 * Prompt 53.1 — Materialização periódica: reavalia score/nível a partir de actor_events.
 */

import { pool } from '@core/database/pool';
import { evaluateActorRisk } from '@modules/risk-identity/risk-engine.service';

const INTERVAL_MS = Number(process.env.RISK_IDENTITY_RECONCILE_INTERVAL_MS || 900_000);

async function runBatch(): Promise<void> {
  try {
    const r = await pool.query<{ actor_id: string; tenant_id: string }>(
      `SELECT DISTINCT ae.actor_id, ae.tenant_id
       FROM actor_events ae
       WHERE ae.created_at > now() - INTERVAL '14 days'
       LIMIT 800`
    );
    for (const row of r.rows) {
      try {
        await evaluateActorRisk(row.tenant_id, row.actor_id);
      } catch (e) {
        console.warn('[RiskIdentityReconcile]', row.actor_id, e);
      }
    }
  } catch (e) {
    console.error('[RiskIdentityReconcile] batch error', e);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startRiskIdentityReconcileWorker(): void {
  if (intervalId !== null) return;
  runBatch().catch(() => {});
  intervalId = setInterval(() => runBatch().catch(() => {}), INTERVAL_MS);
  console.log(`[RiskIdentityReconcile] Started (interval ${INTERVAL_MS}ms)`);
}