// backend/src/modules/events/event-sector.repository.ts
// SLICE S3 (SETORES) — Repository para event_sectors (SETOR SELF-CONTAINED de bilheteria estádio-style).
//
// Espelha a estrutura de event-ticket.repository.ts (tenant-scoped, runQueryWithTenant/runQueriesWithTenant).
// O setor é SELF-CONTAINED: NÃO reusa/sobrecarrega linhas de event_tickets (aquele eixo ticket_type é ZONA
// GENERAL/VIP/BACKSTAGE, ORTOGONAL a inteira/meia). Bank-free: inteira_price_cents/meia_price_cents são
// valores DECLARADOS de catálogo (Δbank=0); venda/decremento/elegibilidade da meia = PORTA-01 (Fatia 2), FORA.
//
// createSectorReconciled/updateSectorReconciled (BUG D1): a reconciliação SUM(capacity) <= max_attendees
// roda dentro de UMA ÚNICA transação/client, serializada por pg_advisory_xact_lock(tenant,event) — mesma
// casa da trava de core/events/event.service.ts (createEventBoundToGroup: BEGIN → set_config tenant →
// pg_advisory_xact_lock(hashtextextended(...)) → leitura → escrita → COMMIT). Antes, o SELECT SUM
// (runQueriesWithTenant) e o INSERT (runQueryWithTenant) eram DUAS chamadas com clients DIFERENTES —
// TOCTOU real: duas criações concorrentes podiam ambas ler o SUM antigo, ambas passar o check e ambas
// inserir, furando SUM(capacity) <= max_attendees.

import { runQueriesWithTenant, pool } from '@core/database/pool';
import { AppError } from '@core/errors';

export interface EventSector {
  id: string;
  tenantId: string;
  eventId: string;
  sectorNumber: number;
  name: string;
  capacity: number;
  meiaQuotaBps: number;
  inteiraPriceCents: number;
  meiaPriceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventSectorInput {
  sectorNumber: number;
  name: string;
  capacity: number;
  meiaQuotaBps?: number; // default DB = 4000 (piso legal 40%)
  inteiraPriceCents: number;
  meiaPriceCents: number;
}

export interface UpdateEventSectorInput {
  name?: string;
  capacity?: number;
  meiaQuotaBps?: number;
  inteiraPriceCents?: number;
  meiaPriceCents?: number;
}

interface EventSectorRow {
  id: string;
  tenant_id: string;
  event_id: string;
  sector_number: number;
  name: string;
  capacity: number;
  meia_quota_bps: number;
  inteira_price_cents: string | number;
  meia_price_cents: string | number;
  created_at: Date;
  updated_at: Date;
}

class EventSectorRepository {
  private toSector(row: EventSectorRow): EventSector {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventId: row.event_id,
      sectorNumber: row.sector_number,
      name: row.name,
      capacity: row.capacity,
      meiaQuotaBps: row.meia_quota_bps,
      // BIGINT chega como string em node-pg (segurança 64-bit) — coagir p/ número (valor DECLARADO, Δbank=0).
      inteiraPriceCents: Number(row.inteira_price_cents),
      meiaPriceCents: Number(row.meia_price_cents),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria SETOR self-contained SOB TRANSAÇÃO + advisory xact lock por (tenant,event) — serializa a
   * reconciliação SUM(capacity) <= max_attendees contra a corrida TOCTOU (BUG D1). meia_quota_bps
   * ausente → DEFAULT do DB (4000 = piso legal 40%). Mesma casa da trava de
   * core/events/event.service.ts createEventBoundToGroup (pg_advisory_xact_lock(hashtextextended)).
   */
  async createSectorReconciled(
    tenantId: string,
    eventId: string,
    input: CreateEventSectorInput
  ): Promise<EventSector> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
      // Advisory xact lock por tenant+event — serializa QUALQUER criação/edição de setor deste
      // evento (a mesma trava é tomada por updateSectorReconciled) antes de ler o SUM.
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended('event_sector_capacity:' || $1::text || ':' || $2::text, 0))`,
        [tenantId, eventId]
      );

      const evRes = await client.query<{ max_attendees: number | null }>(
        `SELECT max_attendees FROM events WHERE tenant_id = $1 AND id = $2`,
        [tenantId, eventId]
      );
      const maxAttendees = evRes.rows[0]?.max_attendees ?? null;

      if (maxAttendees !== null && maxAttendees !== undefined) {
        const sumRes = await client.query<{ total: string | null }>(
          `SELECT COALESCE(SUM(capacity), 0)::bigint AS total FROM event_sectors WHERE tenant_id = $1 AND event_id = $2`,
          [tenantId, eventId]
        );
        const existing = Number(sumRes.rows[0]?.total ?? 0);
        const total = existing + input.capacity;
        if (total > maxAttendees) {
          throw new AppError(
            400,
            `SECTOR_CAPACITY_EXCEEDS_EVENT: a soma da capacidade dos setores (${total}) excede events.max_attendees (${maxAttendees}). Os setores reconciliam A max_attendees (SSOT), nunca ao lado dela.`,
            'SECTOR_CAPACITY_EXCEEDS_EVENT'
          );
        }
      }

      const insRes = await client.query<EventSectorRow>(
        `
        INSERT INTO event_sectors (
          tenant_id, event_id, sector_number, name, capacity,
          meia_quota_bps, inteira_price_cents, meia_price_cents
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 4000), $7, $8)
        RETURNING id, tenant_id, event_id, sector_number, name, capacity,
                  meia_quota_bps, inteira_price_cents, meia_price_cents, created_at, updated_at
        `,
        [
          tenantId,
          eventId,
          input.sectorNumber,
          input.name,
          input.capacity,
          input.meiaQuotaBps ?? null,
          input.inteiraPriceCents,
          input.meiaPriceCents,
        ]
      );
      const row = insRes.rows[0];
      if (!row) {
        throw new Error('Erro ao criar setor');
      }

      await client.query('COMMIT');
      return this.toSector(row);
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* conexão possivelmente inutilizada */ }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Edita SETOR (catálogo) SOB a MESMA transação + advisory xact lock de createSectorReconciled —
   * uma edição de capacity concorrente com uma criação (ou outra edição) do MESMO evento é serializada
   * pela MESMA chave (tenant,event) antes de reconciliar o SUM. COALESCE preserva campos não
   * informados. effectiveCapacity é o valor JÁ resolvido (input.capacity ?? capacity atual) pelo
   * caller (service) — a exclusão do próprio setor na soma usa sectorId. Bank-free.
   */
  async updateSectorReconciled(
    tenantId: string,
    sectorId: string,
    eventId: string,
    input: UpdateEventSectorInput,
    effectiveCapacity: number
  ): Promise<EventSector> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended('event_sector_capacity:' || $1::text || ':' || $2::text, 0))`,
        [tenantId, eventId]
      );

      const evRes = await client.query<{ max_attendees: number | null }>(
        `SELECT max_attendees FROM events WHERE tenant_id = $1 AND id = $2`,
        [tenantId, eventId]
      );
      const maxAttendees = evRes.rows[0]?.max_attendees ?? null;

      if (maxAttendees !== null && maxAttendees !== undefined) {
        const sumRes = await client.query<{ total: string | null }>(
          `SELECT COALESCE(SUM(capacity), 0)::bigint AS total FROM event_sectors
           WHERE tenant_id = $1 AND event_id = $2 AND id <> $3`,
          [tenantId, eventId, sectorId]
        );
        const existing = Number(sumRes.rows[0]?.total ?? 0);
        const total = existing + effectiveCapacity;
        if (total > maxAttendees) {
          throw new AppError(
            400,
            `SECTOR_CAPACITY_EXCEEDS_EVENT: a soma da capacidade dos setores (${total}) excede events.max_attendees (${maxAttendees}). Os setores reconciliam A max_attendees (SSOT), nunca ao lado dela.`,
            'SECTOR_CAPACITY_EXCEEDS_EVENT'
          );
        }
      }

      const updRes = await client.query<EventSectorRow>(
        `
        UPDATE event_sectors
        SET name = COALESCE($3, name),
            capacity = COALESCE($4, capacity),
            meia_quota_bps = COALESCE($5, meia_quota_bps),
            inteira_price_cents = COALESCE($6, inteira_price_cents),
            meia_price_cents = COALESCE($7, meia_price_cents),
            updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, tenant_id, event_id, sector_number, name, capacity,
                  meia_quota_bps, inteira_price_cents, meia_price_cents, created_at, updated_at
        `,
        [
          tenantId,
          sectorId,
          input.name ?? null,
          input.capacity ?? null,
          input.meiaQuotaBps ?? null,
          input.inteiraPriceCents ?? null,
          input.meiaPriceCents ?? null,
        ]
      );
      const row = updRes.rows[0];
      if (!row) {
        throw new Error('Setor não encontrado');
      }

      await client.query('COMMIT');
      return this.toSector(row);
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* conexão possivelmente inutilizada */ }
      throw e;
    } finally {
      client.release();
    }
  }

  async getSectorById(tenantId: string, sectorId: string): Promise<EventSector | null> {
    const rows = await runQueriesWithTenant<EventSectorRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, sector_number, name, capacity,
             meia_quota_bps, inteira_price_cents, meia_price_cents, created_at, updated_at
      FROM event_sectors
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, sectorId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toSector(rows[0]);
  }

  async listSectorsByEvent(tenantId: string, eventId: string): Promise<EventSector[]> {
    const rows = await runQueriesWithTenant<EventSectorRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, sector_number, name, capacity,
             meia_quota_bps, inteira_price_cents, meia_price_cents, created_at, updated_at
      FROM event_sectors
      WHERE tenant_id = $1 AND event_id = $2
      ORDER BY sector_number ASC
      `,
      [tenantId, eventId]
    );

    return rows.map((row) => this.toSector(row));
  }

  /**
   * Soma a capacity dos setores JÁ persistidos do evento (opcionalmente excluindo um setor, para UPDATE).
   * Insumo da reconciliação com events.max_attendees (writer-enforced). tenant-scoped.
   */
  async sumSectorCapacityByEvent(
    tenantId: string,
    eventId: string,
    excludeSectorId?: string
  ): Promise<number> {
    const rows = await runQueriesWithTenant<{ total: string | null }>(
      tenantId,
      `
      SELECT COALESCE(SUM(capacity), 0)::bigint AS total
      FROM event_sectors
      WHERE tenant_id = $1 AND event_id = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)
      `,
      [tenantId, eventId, excludeSectorId ?? null]
    );
    return Number(rows?.[0]?.total ?? 0);
  }
}

export const eventSectorRepository = new EventSectorRepository();
