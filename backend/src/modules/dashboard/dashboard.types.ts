// backend/src/modules/dashboard/dashboard.types.ts
// SPRINT 49: DASHBOARDS OPERACIONAIS (BI INTERNO)

export interface DashboardFilters {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  channel?: 'PDV' | 'MARKETPLACE' | 'ALL';
  // SPRINT 51: Multi-empresa e consolidação
  organizationUnitId?: string;
  consolidated?: boolean;
}

export interface TodayOverview {
  date: Date;
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  inventory: {
    totalVariants: number;
    lowStockCount: number; // Variantes com estoque < 10
    outOfStockCount: number; // Variantes com estoque = 0
  };
  financial: {
    totalReceived: number;
    pendingAmount: number;
    failedAmount: number;
  };
}

export interface MonthOverview {
  month: string; // 'YYYY-MM'
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  financial: {
    totalReceived: number;
    totalPaidOut: number;
    platformFees: number;
  };
  trends: {
    dailySales: Array<{
      date: string;
      amount: number;
      orders: number;
    }>;
  };
}

export interface ChannelSplit {
  channel: 'PDV' | 'MARKETPLACE';
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    averageTicket: number;
  };
  percentage: number; // % do total
}

export interface DashboardOverview {
  today: TodayOverview;
  month: MonthOverview;
  channels: ChannelSplit[];
  inventory: {
    totalVariants: number;
    lowStockCount: number;
    outOfStockCount: number;
    criticalVariants: Array<{
      variantId: string;
      variantName: string;
      currentQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    }>;
  };
}

