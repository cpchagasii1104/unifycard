// Fila humana: canonical_products → concepts (SSOT); sem auto-resolução.

import { pool } from '../../database/pool';

export const canonicalConceptResolutionQueueService = {
  /**
   * Garante um item `pending` na fila para este canónico. Idempotente.
   * @returns true se inseriu nova linha.
   */
  async ensurePendingQueueEntryForCanonicalProduct(canonicalProductId: string): Promise<boolean> {
    const r = await pool.query(
      `
      INSERT INTO canonical_concept_resolution_queue (
        canonical_product_id,
        status,
        created_at
      )
      SELECT $1::uuid, 'pending', NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM canonical_concept_resolution_queue q
        WHERE q.canonical_product_id = $1::uuid AND q.status = 'pending'
      )
      RETURNING id
      `,
      [canonicalProductId]
    );
    return (r.rowCount ?? 0) > 0;
  },
};