// backend/src/modules/reporting/reporting.types.ts
// Reporting Engine - BI Financeiro e Exportação Reguladora
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação

/**
 * KPIs Financeiros Principais
 */
export interface FinancialKPIs {
  // Gross Merchandise Value (GMV)
  totalGMVCents: number;
  // Receita da plataforma (comissões)
  platformRevenueCents: number;
  // Valor em escrow (aguardando release)
  escrowHeldCents: number;
  // Valor pago (payouts executados)
  totalPaidCents: number;
  // Invoices emitidas
  invoicesIssuedCount: number;
  invoicesIssuedTotalCents: number;
  // Invoices pendentes (DRAFT)
  invoicesPendingCount: number;
  invoicesPendingTotalCents: number;
  // Currency
  currency: string;
  // Período
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Receita por Período
 */
export interface RevenueByPeriod {
  period: string; // YYYY-MM ou YYYY-MM-DD
  revenueCents: number;
  transactionCount: number;
  currency: string;
}

/**
 * Receita por Tipo de Serviço
 */
export interface RevenueByServiceType {
  serviceType: string;
  revenueCents: number;
  transactionCount: number;
  currency: string;
}

/**
 * Comissão da Plataforma
 */
export interface PlatformCommission {
  period: string;
  commissionCents: number;
  transactionCount: number;
  currency: string;
}

/**
 * Trust & Risk Overview
 */
export interface TrustOverview {
  actorId: string;
  currentScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  lastEventAt: Date | null;
  evidencePackIds: string[];
}

/**
 * Dispute Overview
 */
export interface DisputeOverview {
  packId: string;
  contextType: string;
  contextId: string;
  disputeStatus: 'NONE' | 'OPEN' | 'IN_MEDIATION' | 'RESOLVED';
  openedAt: Date | null;
  resolvedAt: Date | null;
  resolutionTimeDays: number | null;
  actorIds: string[];
}

/**
 * Filtros para relatórios
 */
export interface ReportingFilters {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  status?: string;
  currency?: string;
  limit?: number;
  offset?: number;
}

/**
 * Tipo de exportação
 */
export type ExportType = 'ledger' | 'payouts' | 'invoices' | 'trust' | 'disputes';

/**
 * Formato de exportação
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Input para exportação
 */
export interface ExportInput {
  exportType: ExportType;
  format: ExportFormat;
  filters?: ReportingFilters;
}




