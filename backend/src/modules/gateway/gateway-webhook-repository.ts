// Gateway Webhook Repository — idempotência de webhooks (PIX, Stripe, etc.).
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { pool } from '@core/database/pool';

/**
 * Registra um webhook recebido. Retorna true se foi novo, false se duplicado.
 */
export async function recordWebhookEvent(
  provider: string,
  referenceId: string,
  payloadHash: string
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO gateway_webhook_events (provider, reference_id, payload_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, reference_id) DO NOTHING
     RETURNING id`,
    [provider, referenceId, payloadHash]
  );
  return result.rowCount !== null && result.rowCount > 0;
}