// backend/src/modules/marketplace/inventory-sla.service.ts
// SPRINT 58: SLA LOGÍSTICO E AGING DE ESTOQUE (READ-ONLY)

import { runQueriesWithTenant } from '@core/database/pool';
import type {
  StockAging,
  GetStockAgingOptions,
  TransferSla,
  GetTransferSlaOptions,
  SlaConfig,
} from './inventory-sla.types';

/**
 * Service para SLA logístico e aging de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY: Nenhuma mutação de estado
 * - NÃO cria automação
 * - NÃO cria alertas automáticos
 * - NÃO move estoque
 * - NÃO ajusta dados
 * - Apenas fornece visibilidade para decisão humana
 */
class InventorySlaService {
  /**
   * Calcula aging de estoque (tempo que itens ficam parados)
   * 
   * SPRINT 58: Calcula dias desde último movimento IN
   */
  async getStockAging(
    tenantId: string,
    options: GetStockAgingOptions = {}
  ): Promise<StockAging[]> {
    const conditions: string[] = [];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Construir condições dinâmicas
    if (options.actorId) {
      // Para filtrar por actor, precisamos calcular saldo por actor
      // Por enquanto, vamos retornar todos e filtrar depois
      // TODO: Otimizar com JOIN em inventory_movements se houver actor_id lá
    }

    if (options.productVariantId) {
      conditions.push(`im.product_variant_id = $${paramIndex}`);
      params.push(options.productVariantId);
      paramIndex++;
    }

    // Calcular aging baseado em inventory_movements
    // Para cada variante, pegar último movimento IN e calcular dias desde então
    const query = `
      WITH last_movements AS (
        SELECT DISTINCT ON (im.product_variant_id)
          im.product_variant_id,
          im.movement_type,
          im.created_at,
          im.unit
        FROM inventory_movements im
        WHERE im.tenant_id = $1
          ${options.productVariantId ? `AND im.product_variant_id = $${paramIndex - 1}` : ''}
        ORDER BY im.product_variant_id, im.created_at DESC
      ),
      current_balances AS (
        SELECT
          im.product_variant_id,
          SUM(
            CASE 
              WHEN im.movement_type = 'IN' THEN im.quantity
              WHEN im.movement_type = 'OUT' THEN -im.quantity
              WHEN im.movement_type = 'ADJUSTMENT' THEN im.quantity
              ELSE 0
            END
          ) AS current_quantity,
          MAX(im.unit) AS unit
        FROM inventory_movements im
        WHERE im.tenant_id = $1
          ${options.productVariantId ? `AND im.product_variant_id = $${paramIndex - 1}` : ''}
        GROUP BY im.product_variant_id
        HAVING SUM(
          CASE 
            WHEN im.movement_type = 'IN' THEN im.quantity
            WHEN im.movement_type = 'OUT' THEN -im.quantity
            WHEN im.movement_type = 'ADJUSTMENT' THEN im.quantity
            ELSE 0
          END
        ) > 0
      ),
      last_in_movements AS (
        SELECT DISTINCT ON (im.product_variant_id)
          im.product_variant_id,
          im.created_at AS last_inAt
        FROM inventory_movements im
        WHERE im.tenant_id = $1
          AND im.movement_type = 'IN'
          ${options.productVariantId ? `AND im.product_variant_id = $${paramIndex - 1}` : ''}
        ORDER BY im.product_variant_id, im.created_at DESC
      )
      SELECT
        cb.product_variant_id,
        cb.current_quantity::numeric,
        cb.unit,
        COALESCE(
          EXTRACT(EPOCH FROM (NOW() - lim.last_inAt)) / 86400,
          0
        )::integer AS days_in_stock,
        lim.last_inAt AS last_movementAt,
        'IN' AS last_movement_type
      FROM current_balances cb
      LEFT JOIN last_in_movements lim ON cb.product_variant_id = lim.product_variant_id
      WHERE cb.current_quantity > 0
        ${options.minDaysInStock ? `AND COALESCE(EXTRACT(EPOCH FROM (NOW() - lim.last_inAt)) / 86400, 0) >= $${paramIndex}` : ''}
        ${options.maxDaysInStock ? `AND COALESCE(EXTRACT(EPOCH FROM (NOW() - lim.last_inAt)) / 86400, 0) <= $${paramIndex + (options.minDaysInStock ? 1 : 0)}` : ''}
      ORDER BY days_in_stock DESC
      LIMIT ${options.limit || 100}
      OFFSET ${options.offset || 0}
    `;

    // Ajustar params para incluir filtros de dias
    if (options.minDaysInStock) {
      params.push(options.minDaysInStock);
      paramIndex++;
    }
    if (options.maxDaysInStock) {
      params.push(options.maxDaysInStock);
    }

    const rows = await runQueriesWithTenant<any>(
      tenantId,
      query,
      params
    );

    // SPRINT 58: Por enquanto, não temos actor_id em movements
    // Retornar com actorId vazio ou null
    // TODO: Adicionar actor_id em inventory_movements se necessário
    return rows.map((row: any) => ({
      productVariantId: row.product_variant_id,
      actorId: '', // TODO: Adicionar actor_id quando disponível
      currentQuantity: parseFloat(row.current_quantity),
      unit: row.unit || 'un',
      daysInStock: parseInt(row.days_in_stock) || 0,
      lastMovementAt: row.last_movementAt ? new Date(row.last_movementAt) : null,
      lastMovementType: row.last_movement_type as 'IN' | 'OUT' | 'ADJUSTMENT' | null,
    }));
  }

  /**
   * Calcula SLA de transferências (tempo entre estados)
   * 
   * SPRINT 58: Calcula tempos entre SHIPPED → conferência (receipt) → RECEIVED
   */
  async getTransferSla(
    tenantId: string,
    options: GetTransferSlaOptions = {},
    config: SlaConfig = {}
  ): Promise<TransferSla[]> {
    const conditions: string[] = ['st.tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.fromActorId) {
      conditions.push(`st.from_actor_id = $${paramIndex}`);
      params.push(options.fromActorId);
      paramIndex++;
    }

    if (options.toActorId) {
      conditions.push(`st.to_actor_id = $${paramIndex}`);
      params.push(options.toActorId);
      paramIndex++;
    }

    // F-REPORTS-TRANSFERS-SLA-REPRESENTATION: escopo self — transferências em que o actor é PARTE (origem OU destino).
    if (options.participantActorId) {
      conditions.push(`(st.from_actor_id = $${paramIndex} OR st.to_actor_id = $${paramIndex})`);
      params.push(options.participantActorId);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`st.status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    // SLA padrão (configurável)
    const maxDaysShippedToReceiving = options.maxDaysShippedToReceiving || config.maxDaysShippedToReceiving || 3;
    const maxDaysReceivingToReceived = options.maxDaysReceivingToReceived || config.maxDaysReceivingToReceived || 1;

    const query = `
      WITH receipt_info AS (
        SELECT
          str.stock_transfer_id,
          MIN(str.created_at) AS receiving_started_at
        FROM stock_transfer_receipts str
        WHERE str.tenant_id = $1
        GROUP BY str.stock_transfer_id
      )
      SELECT
        st.id AS stock_transfer_id,
        st.from_actor_id,
        st.to_actor_id,
        st.status,
        st.created_at,
        st.shipped_at,
        ri.receiving_started_at,
        st.received_at,
        CASE 
          WHEN st.shipped_at IS NOT NULL AND ri.receiving_started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ri.receiving_started_at - st.shipped_at)) / 86400
          ELSE NULL
        END AS days_shipped_to_receiving,
        CASE 
          WHEN ri.receiving_started_at IS NOT NULL AND st.received_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (st.received_at - ri.receiving_started_at)) / 86400
          ELSE NULL
        END AS days_receiving_to_received,
        CASE 
          WHEN st.shipped_at IS NOT NULL AND st.received_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (st.received_at - st.shipped_at)) / 86400
          ELSE NULL
        END AS total_days
      FROM stock_transfers st
      LEFT JOIN receipt_info ri ON st.id = ri.stock_transfer_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY st.created_at DESC
      LIMIT ${options.limit || 100}
      OFFSET ${options.offset || 0}
    `;

    const rows = await runQueriesWithTenant<any>(
      tenantId,
      query,
      params
    );

    return rows.map((row: any) => {
      const daysShippedToReceiving = row.days_shipped_to_receiving ? parseFloat(row.days_shipped_to_receiving) : null;
      const daysReceivingToReceived = row.days_receiving_to_received ? parseFloat(row.days_receiving_to_received) : null;
      
      // Verificar se está atrasado
      let isOverdue = false;
      let overdueReason: string | undefined;

      if (row.status === 'shipped' && row.shipped_at) {
        const daysSinceShipped = (Date.now() - new Date(row.shipped_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceShipped > maxDaysShippedToReceiving) {
          isOverdue = true;
          overdueReason = `Atrasado: ${daysSinceShipped.toFixed(1)} dias desde SHIPPED (SLA: ${maxDaysShippedToReceiving} dias)`;
        }
      } else if (row.status === 'PENDING' && row.receiving_started_at) {
        const daysSinceReceiving = (Date.now() - new Date(row.receiving_started_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceReceiving > maxDaysReceivingToReceived) {
          isOverdue = true;
          overdueReason = `Atrasado: ${daysSinceReceiving.toFixed(1)} dias em conferência (SLA: ${maxDaysReceivingToReceived} dias)`;
        }
      }

      // Se apenasOverdue, filtrar
      if (options.onlyOverdue && !isOverdue) {
        return null;
      }

      return {
        stockTransferId: row.stock_transfer_id,
        fromActorId: row.from_actor_id,
        toActorId: row.to_actor_id,
        status: row.status,
        daysInDraft: row.created_at && row.shipped_at
          ? (new Date(row.shipped_at).getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
          : null,
        daysShippedToReceiving,
        daysReceivingToReceived,
        totalDays: row.total_days ? parseFloat(row.total_days) : null,
        createdAt: row.created_at
          ? (typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString())
          : '',
        shippedAt: row.shipped_at ? new Date(row.shipped_at) : null,
        receivingStartedAt: row.receiving_started_at ? new Date(row.receiving_started_at) : null,
        receivedAt: row.received_at ? new Date(row.received_at) : null,
        isOverdue,
        overdueReason,
      };
    }).filter((item: any) => item !== null) as TransferSla[];
  }

  /**
   * Lista transferências atrasadas
   * 
   * SPRINT 58: Wrapper para getTransferSla com onlyOverdue=true
   */
  async getOverdueTransfers(
    tenantId: string,
    options: Omit<GetTransferSlaOptions, 'onlyOverdue'> = {},
    config: SlaConfig = {}
  ): Promise<TransferSla[]> {
    return await this.getTransferSla(tenantId, { ...options, onlyOverdue: true }, config);
  }
}

export const inventorySlaService = new InventorySlaService();








