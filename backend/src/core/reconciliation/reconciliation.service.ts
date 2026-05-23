// INFRA-3 — SSOT (append-only) vs projeções derivadas: só leitura, deteção e relatório.
// Não altera domínio, outbox, handlers nem dados.

import { pool } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';

export type ReconciliationKind = 'inventory' | 'ledger' | 'reservation';

export type ReconciliationDriftFinding = {
  type: ReconciliationKind;
  entityId: string;
  drift: number;
  severity: 'low' | 'critical';
};

type InternalDriftRow = {
  kind: ReconciliationKind;
  rowTenantId: string;
  entityId: string;
  drift: number;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function metricTenantId(tenantId: string | null | undefined): string {
  return tenantId && tenantId.trim() !== '' ? tenantId.trim() : '_all_tenants';
}

function emitDrift(row: InternalDriftRow): void {
  canonicalLogger.info(null, 'reconciliation_drift_detected', {
    metric_event: 'reconciliation_drift_detected',
    tenantId: row.rowTenantId,
    reconciliationKind: row.kind,
    severity: 'critical',
    entityId: row.entityId,
    drift: row.drift,
  });
}

function emitRunCompleted(
  kind: ReconciliationKind | 'full',
  tenantIdForMetric: string,
  driftCount: number
): void {
  const severity: 'low' | 'critical' = driftCount > 0 ? 'critical' : 'low';
  canonicalLogger.info(null, 'reconciliation_run_completed', {
    metric_event: 'reconciliation_run_completed',
    tenantId: tenantIdForMetric,
    reconciliationKind: kind,
    severity,
    driftCount,
  });
}

function toPublic(row: InternalDriftRow): ReconciliationDriftFinding {
  return {
    type: row.kind,
    entityId: row.entityId,
    drift: row.drift,
    severity: 'critical',
  };
}

function emitKindMetrics(
  kind: ReconciliationKind,
  rows: InternalDriftRow[],
  scopeTenantId: string | null | undefined
): void {
  const tid = metricTenantId(scopeTenantId ?? null);
  for (const row of rows) {
    emitDrift(row);
  }
  emitRunCompleted(kind, tid, rows.length);
}

type InventoryRow = {
  tenant_id: string;
  product_variant_id: string;
  drift: string;
};

type LedgerRow = {
  tenant_id: string;
  account_id: string;
  drift_cents: string;
};

type ReservationRow = {
  tenant_id: string;
  product_variant_id: string;
  drift: string;
};

class ReconciliationService {
  private async fetchInventoryRows(
    tenantId: string | null | undefined
  ): Promise<InventoryRow[]> {
    const result = await pool.query<InventoryRow>(
      `
      SELECT
        ib.tenant_id,
        ib.product_variant_id,
        ABS(
          ib.current_quantity
          - SUM(
            CASE im.movement_type
              WHEN 'IN' THEN im.quantity
              WHEN 'OUT' THEN -im.quantity
              ELSE im.quantity
            END
          )
        )::text AS drift
      FROM inventory_balances ib
      JOIN inventory_movements im
        ON im.product_variant_id = ib.product_variant_id
        AND im.tenant_id = ib.tenant_id
      WHERE ($1::uuid IS NULL OR ib.tenant_id = $1::uuid)
      GROUP BY ib.tenant_id, ib.product_variant_id, ib.current_quantity
      HAVING ABS(
        ib.current_quantity
        - SUM(
          CASE im.movement_type
            WHEN 'IN' THEN im.quantity
            WHEN 'OUT' THEN -im.quantity
            ELSE im.quantity
          END
        )
      ) > 0
      ORDER BY ib.tenant_id, ib.product_variant_id
      `,
      [tenantId ?? null]
    );
    return result.rows;
  }

  private async fetchLedgerRows(tenantId: string | null | undefined): Promise<LedgerRow[]> {
    const result = await pool.query<LedgerRow>(
      `
      SELECT
        ba.tenant_id,
        ba.id AS account_id,
        (
          COALESCE(SUM(
            CASE
              WHEN bl.direction = 'credit' THEN bl.amount_cents
              WHEN bl.direction = 'debit' THEN -bl.amount_cents
              ELSE 0
            END
          ), 0) - ba.reconciliation_balance_cents
        )::bigint::text AS drift_cents
      FROM bank_accounts ba
      LEFT JOIN bank_ledger bl
        ON bl.account_id = ba.id AND bl.tenant_id = ba.tenant_id
      WHERE ba.reconciliation_balance_cents IS NOT NULL
        AND ($1::uuid IS NULL OR ba.tenant_id = $1::uuid)
      GROUP BY ba.tenant_id, ba.id, ba.reconciliation_balance_cents
      HAVING COALESCE(SUM(
        CASE
          WHEN bl.direction = 'credit' THEN bl.amount_cents
          WHEN bl.direction = 'debit' THEN -bl.amount_cents
          ELSE 0
        END
      ), 0) <> ba.reconciliation_balance_cents
      ORDER BY ba.tenant_id, ba.id
      `,
      [tenantId ?? null]
    );
    return result.rows;
  }

  private async fetchReservationRows(
    tenantId: string | null | undefined
  ): Promise<ReservationRow[]> {
    const result = await pool.query<ReservationRow>(
      `
      SELECT
        tenant_id,
        product_variant_id,
        (
          SUM(quantity) - SUM(CASE WHEN status = 'ACTIVE' THEN quantity ELSE 0 END)
        )::text AS drift
      FROM inventory_reservations
      WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
      GROUP BY tenant_id, product_variant_id
      HAVING SUM(quantity) <> SUM(CASE WHEN status = 'ACTIVE' THEN quantity ELSE 0 END)
      ORDER BY tenant_id, product_variant_id
      `,
      [tenantId ?? null]
    );
    return result.rows;
  }

  private mapInventory(rows: InventoryRow[]): InternalDriftRow[] {
    return rows.map((row) => ({
      kind: 'inventory',
      rowTenantId: row.tenant_id,
      entityId: row.product_variant_id,
      drift: toNumber(row.drift),
    }));
  }

  private mapLedger(rows: LedgerRow[]): InternalDriftRow[] {
    return rows.map((row) => ({
      kind: 'ledger',
      rowTenantId: row.tenant_id,
      entityId: row.account_id,
      drift: toNumber(row.drift_cents),
    }));
  }

  private mapReservation(rows: ReservationRow[]): InternalDriftRow[] {
    return rows.map((row) => ({
      kind: 'reservation',
      rowTenantId: row.tenant_id,
      entityId: row.product_variant_id,
      drift: toNumber(row.drift),
    }));
  }

  async runInventoryReconciliation(
    tenantId?: string | null
  ): Promise<ReconciliationDriftFinding[]> {
    const internal = this.mapInventory(await this.fetchInventoryRows(tenantId));
    emitKindMetrics('inventory', internal, tenantId);
    return internal.map(toPublic);
  }

  async runLedgerReconciliation(tenantId?: string | null): Promise<ReconciliationDriftFinding[]> {
    const internal = this.mapLedger(await this.fetchLedgerRows(tenantId));
    emitKindMetrics('ledger', internal, tenantId);
    return internal.map(toPublic);
  }

  async runReservationReconciliation(
    tenantId?: string | null
  ): Promise<ReconciliationDriftFinding[]> {
    const internal = this.mapReservation(await this.fetchReservationRows(tenantId));
    emitKindMetrics('reservation', internal, tenantId);
    return internal.map(toPublic);
  }

  async runFullReconciliation(tenantId?: string | null): Promise<{
    inventory: ReconciliationDriftFinding[];
    ledger: ReconciliationDriftFinding[];
    reservation: ReconciliationDriftFinding[];
    totalDrifts: number;
  }> {
    const inventory = this.mapInventory(await this.fetchInventoryRows(tenantId));
    const ledger = this.mapLedger(await this.fetchLedgerRows(tenantId));
    const reservation = this.mapReservation(await this.fetchReservationRows(tenantId));

    emitKindMetrics('inventory', inventory, tenantId);
    emitKindMetrics('ledger', ledger, tenantId);
    emitKindMetrics('reservation', reservation, tenantId);

    const totalDrifts = inventory.length + ledger.length + reservation.length;
    emitRunCompleted('full', metricTenantId(tenantId ?? null), totalDrifts);

    return {
      inventory: inventory.map(toPublic),
      ledger: ledger.map(toPublic),
      reservation: reservation.map(toPublic),
      totalDrifts,
    };
  }
}

export const reconciliationService = new ReconciliationService();