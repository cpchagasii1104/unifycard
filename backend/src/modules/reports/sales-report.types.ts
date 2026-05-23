// backend/src/modules/reports/sales-report.types.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Vendas

export interface SalesReportFilters {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  channel?: 'PDV' | 'MARKETPLACE' | 'ALL';
  // SPRINT 51: Multi-empresa e consolidação
  organizationUnitId?: string;
  consolidated?: boolean; // Se true, inclui dados de unidades filhas
  scopeActorIds?: string[];
}

export interface SalesByPeriod {
  period: string; // 'YYYY-MM-DD' ou 'YYYY-MM'
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  totalFailed: number;
}

export interface SalesByChannel {
  channel: 'PDV' | 'MARKETPLACE';
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
}

export interface SalesByActor {
  actorId: string;
  actorName?: string;
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
}

export interface AverageTicket {
  period: string;
  averageTicket: number;
  totalOrders: number;
  totalAmount: number;
}

export interface SalesReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalOrders: number;
    totalAmount: number;
    totalPaid: number;
    totalFailed: number;
    averageTicket: number;
  };
  byPeriod: SalesByPeriod[];
  byChannel: SalesByChannel[];
  byActor: SalesByActor[];
  averageTicketByPeriod: AverageTicket[];
}

