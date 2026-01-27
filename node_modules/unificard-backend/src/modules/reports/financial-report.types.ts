// backend/src/modules/reports/financial-report.types.ts
// SPRINT 46: RELATÓRIOS OPERACIONAIS - Financeiro

export interface FinancialReportFilters {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
}

export interface FinancialSummary {
  totalReceived: number;
  totalPaidOut: number;
  platformFees: number;
  pendingAmount: number;
  failedAmount: number;
}

export interface FinancialByPeriod {
  period: string; // 'YYYY-MM-DD'
  totalReceived: number;
  totalPaidOut: number;
  platformFees: number;
}

export interface FinancialBySplit {
  role: string; // 'SELLER' | 'PLATFORM' | 'FUND' | 'OTHER'
  totalAmount: number;
  totalPayouts: number;
  successfulPayouts: number;
  failedPayouts: number;
}

export interface FinancialReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: FinancialSummary;
  byPeriod: FinancialByPeriod[];
  bySplit: FinancialBySplit[];
  pending: Array<{
    paymentIntentId: string;
    orderId: string;
    amount: number;
    status: string;
    errorCode?: string;
  }>;
}







