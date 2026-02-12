// backend/src/modules/marketplace/financial-agenda.types.ts
// SPRINT 85: AGENDA FINANCEIRA (CASHFLOW PROJETADO)

/**
 * Item de agenda financeira
 */
export interface FinancialAgendaItem {
  id: string;
  type: 'PAYABLE' | 'RECEIVABLE' | 'SETTLEMENT' | 'SCHEDULED_ACTION';
  date: Date;
  amountCents: number; // em centavos
  currency: string;
  description: string;
  status: string;
  metadata: Record<string, any>;
}

/**
 * Projeção de cashflow
 */
export interface CashflowProjection {
  periodStart: Date;
  periodEnd: Date;
  items: FinancialAgendaItem[];
  totalInflow: number; // em centavos
  totalOutflow: number; // em centavos
  netCashflow: number; // em centavos
  byDate: Record<string, {
    inflow: number;
    outflow: number;
    net: number;
  }>;
}

/**
 * Filtros para agenda financeira
 */
export interface FinancialAgendaFilters {
  startDate?: Date;
  endDate?: Date;
  types?: Array<'PAYABLE' | 'RECEIVABLE' | 'SETTLEMENT' | 'SCHEDULED_ACTION'>;
  limit?: number;
  offset?: number;
}






