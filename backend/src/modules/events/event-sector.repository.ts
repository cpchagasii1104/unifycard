// backend/src/modules/events/event-sector.repository.ts
// SLICE S3 (SETORES) — Repository para event_sectors (SETOR SELF-CONTAINED de bilheteria estádio-style).
//
// Espelha a estrutura de event-ticket.repository.ts (tenant-scoped, runQueryWithTenant/runQueriesWithTenant).
// O setor é SELF-CONTAINED: NÃO reusa/sobrecarrega linhas de event_tickets (aquele eixo ticket_type é ZONA
// GENERAL/VIP/BACKSTAGE, ORTOGONAL a inteira/meia). Bank-free: inteira_price_cents/meia_price_cents são
// valores DECLARADOS de catálogo (Δbank=0); venda/decremento/elegibilidade da meia = PORTA-01 (Fatia 2), FORA.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

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

  /** Cria SETOR self-contained. meia_quota_bps ausente → DEFAULT do DB (4000 = piso legal 40%). */
  async createSector(
    tenantId: string,
    eventId: string,
    input: CreateEventSectorInput
  ): Promise<EventSector> {
    const row = await runQueryWithTenant<EventSectorRow>(
      tenantId,
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

    if (!row) {
      throw new Error('Erro ao criar setor');
    }

    return this.toSector(row);
  }

  /** Edita SETOR (catálogo). COALESCE preserva campos não informados. Bank-free. */
  async updateSector(
    tenantId: string,
    sectorId: string,
    input: UpdateEventSectorInput
  ): Promise<EventSector> {
    const row = await runQueryWithTenant<EventSectorRow>(
      tenantId,
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

    if (!row) {
      throw new Error('Setor não encontrado');
    }

    return this.toSector(row);
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

  /**
   * events.max_attendees do evento (SSOT da capacidade do evento inteiro; os setores reconciliam A ELA,
   * NUNCA ao lado dela). NULL = sem teto declarado. tenant-scoped.
   */
  async getEventMaxAttendees(tenantId: string, eventId: string): Promise<number | null> {
    const rows = await runQueriesWithTenant<{ max_attendees: number | null }>(
      tenantId,
      `SELECT max_attendees FROM events WHERE tenant_id = $1 AND id = $2`,
      [tenantId, eventId]
    );
    return rows?.[0]?.max_attendees ?? null;
  }
}

export const eventSectorRepository = new EventSectorRepository();
