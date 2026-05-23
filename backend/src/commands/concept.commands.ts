import { canonicalConceptResolutionQueueService } from '@core/catalog/canonical/canonical-concept-resolution-queue.service';
import { recordConceptResolutionQueueEnqueueAudit } from '@core/catalog/canonical/canonical-concept-resolution-audit';
import { pool } from '@core/database/pool';

export async function ensureConceptResolutionPendingCommand(
  canonicalProductId: string
): Promise<boolean> {
  const inserted =
    await canonicalConceptResolutionQueueService.ensurePendingQueueEntryForCanonicalProduct(
      canonicalProductId
    );
  if (inserted) {
    try {
      const r = await pool.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM canonical_products WHERE id = $1::uuid LIMIT 1`,
        [canonicalProductId]
      );
      const tenantId = r.rows[0]?.tenant_id;
      if (tenantId) {
        await recordConceptResolutionQueueEnqueueAudit(tenantId, canonicalProductId);
      }
    } catch {
      // auditoria não bloqueante
    }
  }
  return inserted;
}