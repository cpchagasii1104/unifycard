// frontend/src/api/reporting.ts
// API client para Reporting Institucional
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { apiFetchJson, apiFetch } from './client';

/**
 * KPIs Financeiros Principais
 */
export interface FinancialKPIs {
  totalGMVCents: number;
  platformRevenueCents: number;
  escrowHeldCents: number;
  totalPaidCents: number;
  invoicesIssuedCount: number;
  invoicesIssuedTotalCents: number;
  invoicesPendingCount: number;
  invoicesPendingTotalCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Receita por Período
 */
export interface RevenueByPeriod {
  period: string;
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
  lastEventAt: string | null;
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
  openedAt: string | null;
  resolvedAt: string | null;
  resolutionTimeDays: number | null;
  actorIds: string[];
}

/**
 * Filtros para relatórios
 */
export interface ReportingFilters {
  startDate?: string;
  endDate?: string;
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
 * Busca KPIs Financeiros
 */
export async function getFinancialKPIs(filters: ReportingFilters = {}): Promise<FinancialKPIs> {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.actorId) queryParams.append('actorId', filters.actorId);
  if (filters.currency) queryParams.append('currency', filters.currency);

  const data = await apiFetchJson<{ kpis: FinancialKPIs }>(`/reporting/financial-kpis?${queryParams.toString()}`);
  return data.kpis;
}

/**
 * Busca Receita por Período
 */
export async function getRevenueByPeriod(filters: ReportingFilters = {}): Promise<RevenueByPeriod[]> {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.currency) queryParams.append('currency', filters.currency);

  const data = await apiFetchJson<{ revenue: RevenueByPeriod[] }>(`/reporting/revenue-by-period?${queryParams.toString()}`);
  return data.revenue;
}

/**
 * Busca Receita por Tipo de Serviço
 */
export async function getRevenueByServiceType(filters: ReportingFilters = {}): Promise<RevenueByServiceType[]> {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.currency) queryParams.append('currency', filters.currency);

  const data = await apiFetchJson<{ revenue: RevenueByServiceType[] }>(`/reporting/revenue-by-service-type?${queryParams.toString()}`);
  return data.revenue;
}

/**
 * Busca Comissão da Plataforma
 */
export async function getPlatformCommission(filters: ReportingFilters = {}): Promise<PlatformCommission[]> {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.currency) queryParams.append('currency', filters.currency);

  const data = await apiFetchJson<{ commission: PlatformCommission[] }>(`/reporting/platform-commission?${queryParams.toString()}`);
  return data.commission;
}

/**
 * Busca Trust Overview
 */
export async function getTrustOverview(filters: ReportingFilters = {}): Promise<TrustOverview[]> {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ overview: TrustOverview[] }>(`/reporting/trust-overview?${queryParams.toString()}`);
  return data.overview;
}

/**
 * Busca Dispute Overview
 */
export async function getDisputeOverview(filters: ReportingFilters = {}): Promise<DisputeOverview[]> {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ overview: DisputeOverview[] }>(`/reporting/dispute-overview?${queryParams.toString()}`);
  return data.overview;
}

/**
 * Exporta dados
 */
export async function exportData(
  exportType: ExportType,
  format: ExportFormat,
  filters: ReportingFilters = {}
): Promise<Blob> {
  const response = await apiFetch('/reporting/export', {
    method: 'POST',
    body: JSON.stringify({
      exportType,
      format,
      filters,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao exportar dados' }));
    throw new Error(error.error || 'Erro ao exportar dados');
  }

  return response.blob();
}




