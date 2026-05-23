import { createHash } from 'crypto';
import type { PoolClient } from 'pg';

/** SHA256 → UUID v4 variant — mesmo padrão dos outros `event_id` determinísticos do repo */
export function outboxEventIdFromSeed(seed: string): string {
  const hash = createHash('sha256').update(seed).digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function insertEventOutboxRow(
  client: PoolClient,
  row: {
    tenantId: string;
    eventId: string;
    eventType: string;
    eventVersion?: number;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `
    INSERT INTO event_outbox (tenant_id, event_id, event_type, event_version, payload, metadata)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, COALESCE($6::jsonb, '{}'::jsonb))
    ON CONFLICT (event_id) DO NOTHING
    `,
    [
      row.tenantId,
      row.eventId,
      row.eventType,
      row.eventVersion ?? 1,
      JSON.stringify(row.payload),
      JSON.stringify(row.metadata ?? {}),
    ]
  );
}