// backend/src/modules/reports/inventory-report.types.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Estoque

export interface InventoryReportFilters {
  variantId?: string;
  productId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface InventoryBalance {
  productVariantId: string;
  variantName?: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unit: string;
}

export interface InventoryConsumption {
  period: string; // 'YYYY-MM-DD'
  variantId: string;
  variantName?: string;
  consumedQuantity: number;
  unit: string;
}

export interface InventoryReport {
  period: {
    startDate?: Date;
    endDate?: Date;
  };
  balances: InventoryBalance[];
  consumption: InventoryConsumption[];
  summary: {
    totalVariants: number;
    totalCurrentQuantity: number;
    totalReservedQuantity: number;
    totalAvailableQuantity: number;
  };
}







