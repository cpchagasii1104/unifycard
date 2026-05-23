import { runQueryWithTenant } from '@core/database/pool';

export type ClaimOutcome =
  | { kind: 'acquired' }
  | { kind: 'replay'; payload: unknown }
  | { kind: 'busy' };

type IdemRow = {
  status: string;
  response_payload: unknown;
};

export async function claimIntentIdempotency(
  tenantId: string,
  idempotencyKey: string
): Promise<ClaimOutcome> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const inserted = await runQueryWithTenant<{ tenant_id: string }>(
      tenantId,
      `
      INSERT INTO idempotency_keys (tenant_id, key, status, created_at)
      VALUES ($1::uuid, $2, 'processing', now())
      ON CONFLICT (tenant_id, key) DO NOTHING
      RETURNING tenant_id
      `,
      [tenantId, idempotencyKey]
    );

    if (inserted) {
      return { kind: 'acquired' };
    }

    const row = await runQueryWithTenant<IdemRow>(
      tenantId,
      `
      SELECT status, response_payload
      FROM idempotency_keys
      WHERE tenant_id = $1::uuid AND key = $2
      `,
      [tenantId, idempotencyKey]
    );

    if (row) {
      if (row.status === 'completed') {
        return { kind: 'replay', payload: row.response_payload };
      }
      return { kind: 'busy' };
    }
  }

  throw new Error('idempotency_keys: claim failed after retries');
}

export async function completeIntentIdempotency(
  tenantId: string,
  idempotencyKey: string,
  responsePayload: unknown
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `
    UPDATE idempotency_keys
    SET status = 'completed',
        response_payload = $3::jsonb
    WHERE tenant_id = $1::uuid
      AND key = $2
      AND status = 'processing'
    `,
    [tenantId, idempotencyKey, JSON.stringify(responsePayload)]
  );
}

export async function failIntentIdempotency(
  tenantId: string,
  idempotencyKey: string
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `
    DELETE FROM idempotency_keys
    WHERE tenant_id = $1::uuid AND key = $2
    `,
    [tenantId, idempotencyKey]
  );
}