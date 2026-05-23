import { pool } from '@core/database/pool';
import type { AuthorityDecision, AuthorityDecisionSource } from './authority-decision.types';
import type { AuthorityLayerTrace } from './authority-decision.types';

export async function insertAuthorityDecisionAudit(row: {
  tenantId: string;
  actorId: string;
  actionType: string;
  decision: AuthorityDecision;
  decisionSource: AuthorityDecisionSource;
  confidence: number;
  decisionReason: string;
  layerSummary: AuthorityLayerTrace[];
}): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO authority_decision_audit (
        tenant_id,
        actor_id,
        action_type,
        decision,
        decision_source,
        confidence,
        decision_reason,
        layer_summary
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        row.tenantId,
        row.actorId,
        row.actionType,
        row.decision,
        row.decisionSource,
        row.confidence,
        row.decisionReason,
        JSON.stringify(row.layerSummary),
      ]
    );
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === '42P01') {
      return;
    }
    console.warn('[authority_decision_audit] insert falhou (não bloqueante):', e);
  }
}