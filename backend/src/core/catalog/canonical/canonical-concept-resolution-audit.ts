import { insertAuthorityDecisionAudit } from '@core/compliance/authority-decision-audit.repository';

/** Actor sintético para eventos de sistema sem utilizador (sem FK em `authority_decision_audit`). */
const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Regista enfileiramento da fila de resolução de conceito (auditoria P1-7).
 * `decision: allow` = operação de enqueue permitida / registada (não é gate ATL/KYC).
 */
export async function recordConceptResolutionQueueEnqueueAudit(
  tenantId: string,
  canonicalProductId: string
): Promise<void> {
  await insertAuthorityDecisionAudit({
    tenantId,
    actorId: SYSTEM_ACTOR_ID,
    actionType: 'concept_resolution_queue_enqueue',
    decision: 'allow',
    decisionSource: 'system',
    confidence: 1,
    decisionReason: `CANONICAL_CONCEPT_RESOLUTION_PENDING_ENQUEUED:${canonicalProductId}`,
    layerSummary: [
      {
        layer: 'REST',
        outcome: 'pass',
        reason: `canonical_product_id=${canonicalProductId}`,
      },
    ],
  });
}

/**
 * Chamar quando um humano confirmar `concept_id` / estado na fila (P1-7).
 * Invocar a partir da rota ou serviço que persistir a confirmação — não duplica enqueue.
 */
export async function recordConceptResolutionHumanConfirmedAudit(input: {
  tenantId: string;
  actorId: string;
  canonicalProductId: string;
  conceptId: string;
  reason?: string;
}): Promise<void> {
  await insertAuthorityDecisionAudit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    actionType: 'concept_resolution_human_confirmed',
    decision: 'allow',
    decisionSource: 'manual',
    confidence: 1,
    decisionReason:
      input.reason ?? `CONCEPT_CONFIRMED_FOR_CANONICAL:${input.canonicalProductId}->${input.conceptId}`,
    layerSummary: [
      {
        layer: 'REST',
        outcome: 'pass',
        reason: `canonical_product_id=${input.canonicalProductId};concept_id=${input.conceptId}`,
      },
    ],
  });
}