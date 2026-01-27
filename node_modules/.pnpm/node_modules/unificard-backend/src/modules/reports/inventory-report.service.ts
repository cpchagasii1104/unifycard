// backend/src/modules/reports/inventory-report.service.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Estoque

import { runQueriesWithTenant } from '@core/database/pool';
import type {
  InventoryReportFilters,
  InventoryReport,
  InventoryBalance,
  InventoryConsumption,
} from './inventory-report.types';

/**
 * Service para relatórios de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO cria nova lógica econômica
 * - NÃO recalcula valores
 * - Apenas consolida dados existentes
 * - Relatórios = leitura
 */
class InventoryReportService {
  /**
   * Gera relatório completo de estoque
   */
  async generateReport(
    tenantId: string,
    filters: InventoryReportFilters = {}
  ): Promise<InventoryReport> {
    // 1. Saldos (real, reservado, disponível)
    const balances = await this.getBalances(tenantId, filters);

    // 2. Consumo por período
    const consumption = await this.getConsumption(tenantId, filters);

    // 3. Resumo
    const summary = this.calculateSummary(balances);

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      balances,
      consumption,
      summary,
    };
  }

  /**
   * Saldos de estoque (real, reservado, disponível)
   */
  private async getBalances(
    tenantId: string,
    filters: InventoryReportFilters
  ): Promise<InventoryBalance[]> {
    let query = `
      SELECT
        pv.id as variant_id,
        pv.sku as variant_name,
        COALESCE(SUM(
          CASE 
            WHEN im.movement_type = 'IN' THEN im.quantity
            WHEN im.movement_type = 'OUT' THEN -im.quantity
            WHEN im.movement_type = 'ADJUSTMENT' THEN im.quantity
            ELSE 0
          END
        ), 0) as current_quantity,
        COALESCE(SUM(
          CASE WHEN ir.status = 'ACTIVE' THEN ir.quantity ELSE 0 END
        ), 0) as reserved_quantity,
        pv.metadata->>'unit' as unit
      FROM product_variants pv
      LEFT JOIN inventory_movements im ON pv.id = im.product_variant_id
      LEFT JOIN inventory_reservations ir ON pv.id = ir.product_variant_id
      WHERE pv.tenant_id = $1
    `;

    const params: any[] = [tenantId];

    if (filters.variantId) {
      query += ` AND pv.id = $${params.length + 1}`;
      params.push(filters.variantId);
    }

    if (filters.productId) {
      query += ` AND pv.product_id = $${params.length + 1}`;
      params.push(filters.productId);
    }

    query += `
      GROUP BY pv.id, pv.sku, pv.metadata
      ORDER BY pv.sku ASC
    `;

    const rows = await runQueriesWithTenant<{
      variant_id: string;
      variant_name: string;
      current_quantity: string;
      reserved_quantity: string;
      unit: string;
    }>(tenantId, query, params);

    return rows.map((row) => {
      const currentQuantity = parseFloat(row.current_quantity) || 0;
      const reservedQuantity = parseFloat(row.reserved_quantity) || 0;
      return {
        productVariantId: row.variant_id,
        variantName: row.variant_name,
        currentQuantity,
        reservedQuantity,
        availableQuantity: currentQuantity - reservedQuantity,
        unit: row.unit || 'UN',
      };
    });
  }

  /**
   * Consumo por período
   */
  private async getConsumption(
    tenantId: string,
    filters: InventoryReportFilters
  ): Promise<InventoryConsumption[]> {
    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    let query = `
      SELECT
        DATE(im.created_at) as period,
        im.product_variant_id as variant_id,
        pv.sku as variant_name,
        SUM(CASE WHEN im.movement_type = 'OUT' THEN im.quantity ELSE 0 END) as consumed_quantity,
        im.unit
      FROM inventory_movements im
      INNER JOIN product_variants pv ON im.product_variant_id = pv.id
      WHERE im.tenant_id = $1
        AND im.movement_type = 'OUT'
        AND im.created_at >= $2
        AND im.created_at <= $3
    `;

    const params: any[] = [tenantId, startDate, endDate];

    if (filters.variantId) {
      query += ` AND im.product_variant_id = $${params.length + 1}`;
      params.push(filters.variantId);
    }

    if (filters.productId) {
      query += ` AND pv.product_id = $${params.length + 1}`;
      params.push(filters.productId);
    }

    query += `
      GROUP BY DATE(im.created_at), im.product_variant_id, pv.sku, im.unit
      ORDER BY period ASC, variant_id ASC
    `;

    const rows = await runQueriesWithTenant<{
      period: Date;
      variant_id: string;
      variant_name: string;
      consumed_quantity: string;
      unit: string;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      period: row.period.toISOString().split('T')[0],
      variantId: row.variant_id,
      variantName: row.variant_name,
      consumedQuantity: parseFloat(row.consumed_quantity) || 0,
      unit: row.unit || 'UN',
    }));
  }

  /**
   * Calcula resumo dos saldos
   */
  private calculateSummary(balances: InventoryBalance[]): InventoryReport['summary'] {
    return {
      totalVariants: balances.length,
      totalCurrentQuantity: balances.reduce((sum, b) => sum + b.currentQuantity, 0),
      totalReservedQuantity: balances.reduce((sum, b) => sum + b.reservedQuantity, 0),
      totalAvailableQuantity: balances.reduce((sum, b) => sum + b.availableQuantity, 0),
    };
  }
}

export const inventoryReportService = new InventoryReportService();







