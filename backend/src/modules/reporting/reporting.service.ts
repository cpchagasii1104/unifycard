// backend/src/modules/reporting/reporting.service.ts
// Reporting Service - BI Financeiro e Exportação Reguladora
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Backend é única fonte de verdade

import type {
  FinancialKPIs,
  RevenueByPeriod,
  RevenueByServiceType,
  PlatformCommission,
  TrustOverview,
  DisputeOverview,
  ReportingFilters,
  ExportType,
  ExportFormat,
} from './reporting.types';
import {
  sumBankTransactionVolumeCents,
  sumPlatformFeeFromBankSplitsCents,
  sumBankTransactionVolumeByMonth,
  sumBankTransactionVolumeByReferenceType,
  sumPlatformFeeByMonthFromSplits,
  listBankLedgerRowsForExport,
} from './reporting-bank-aggregates';

class ReportingService {
  /**
   * Calcula KPIs Financeiros Principais
   * 🔴 BLINDAGEM: Agregações a partir de bank_transactions / bank_splits (SSOT), não do economy ledger (stub).
   */
  async getFinancialKPIs(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<FinancialKPIs> {
    const { payoutService } = await import('../payout/payout.service');
    const { invoiceService } = await import('../invoicing/invoice.service');
    const { escrowService } = await import('../escrow/escrow.service');

    const startDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Último ano
    const endDate = filters.endDate || new Date();

    // 1. Volume de transações (bank_transactions no período) — proxy operacional de GMV
    const totalGMVCents = await sumBankTransactionVolumeCents(tenantId, startDate, endDate);

    // 2. Receita de fee da plataforma (bank_splits.split_type = 'fee')
    const platformRevenueCents = await sumPlatformFeeFromBankSplitsCents(tenantId, startDate, endDate);

    // 3. Valor em Escrow (soma de escrows não RELEASED)
    let escrowHeldCents = 0;
    try {
      // Buscar escrows ativos
      const escrows = await escrowService.listEscrowAccounts(tenantId, {
        status: 'FUNDS_HELD' as any,
        limit: 1000,
      });
      // Calcular valor total (simplificado - em produção, buscar do ledger)
      escrowHeldCents = escrows.reduce((sum, e) => {
        const held = e.totalAmountCents - (e.releasedAmountCents || 0) - (e.refundedAmountCents || 0);
        return sum + Math.max(0, held);
      }, 0);
    } catch (err) {
      // Ignorar erro
    }

    // 4. Valor Pago (soma de payouts EXECUTED)
    const executedPayouts = await payoutService.listOrders(tenantId, {
      status: 'EXECUTED',
      startDate,
      endDate,
      limit: 10000,
    });
    const totalPaidCents = executedPayouts.reduce((sum, p) => sum + p.amountCents, 0);

    // 5. Invoices
    const allInvoices = await invoiceService.listInvoices(tenantId, {
      startDate,
      endDate,
      limit: 10000,
    });
    const invoicesIssued = allInvoices.filter((i) => i.status === 'issued');
    const invoicesPending = allInvoices.filter((i) => i.status === 'draft');

    const invoicesIssuedCount = invoicesIssued.length;
    const invoicesIssuedTotalCents = invoicesIssued.reduce((sum, i) => sum + i.totalCents, 0);
    const invoicesPendingCount = invoicesPending.length;
    const invoicesPendingTotalCents = invoicesPending.reduce((sum, i) => sum + i.totalCents, 0);

    return {
      totalGMVCents,
      platformRevenueCents,
      escrowHeldCents,
      totalPaidCents,
      invoicesIssuedCount,
      invoicesIssuedTotalCents,
      invoicesPendingCount,
      invoicesPendingTotalCents,
      currency: filters.currency || 'BRL',
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /**
   * Receita por Período
   */
  async getRevenueByPeriod(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<RevenueByPeriod[]> {
    const startDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    const rows = await sumBankTransactionVolumeByMonth(tenantId, startDate, endDate);
    return rows.map((r) => ({
      period: r.period,
      revenueCents: r.revenueCents,
      transactionCount: r.transactionCount,
      currency: filters.currency || 'BRL',
    }));
  }

  /**
   * Receita por Tipo de Serviço
   */
  async getRevenueByServiceType(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<RevenueByServiceType[]> {
    const startDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    const rows = await sumBankTransactionVolumeByReferenceType(tenantId, startDate, endDate);
    return rows.map((r) => ({
      serviceType: r.referenceType,
      revenueCents: r.revenueCents,
      transactionCount: r.transactionCount,
      currency: filters.currency || 'BRL',
    }));
  }

  /**
   * Comissão da Plataforma por Período
   */
  async getPlatformCommission(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<PlatformCommission[]> {
    const startDate = filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate || new Date();

    const rows = await sumPlatformFeeByMonthFromSplits(tenantId, startDate, endDate);
    return rows.map((r) => ({
      period: r.period,
      commissionCents: r.commissionCents,
      transactionCount: r.transactionCount,
      currency: filters.currency || 'BRL',
    }));
  }

  /**
   * Trust & Risk Overview
   */
  async getTrustOverview(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<TrustOverview[]> {
    const { trustEngineService } = await import('../trust/trust-engine.service');

    // Buscar todos os trust profiles
    const { trustRepository } = await import('../trust/trust.repository');
    const profiles = await trustRepository.listProfiles(tenantId, {
      limit: 1000,
    });

    // Filtrar por risk level se fornecido
    let filtered = profiles;
    if (filters.status) {
      filtered = profiles.filter((p) => p.riskLevel === filters.status);
    }

    // Buscar evidence packs relacionados
    const overviews: TrustOverview[] = [];
    for (const profile of filtered) {
      try {
        const { trustRepository } = await import('../trust/trust.repository');
        const events = await trustRepository.listEvents(tenantId, {
          actorId: profile.actorId,
          limit: 100,
        });

        const evidencePackIds = Array.from(
          new Set(events.map((e) => e.evidencePackId).filter((id) => id))
        );

        overviews.push({
          actorId: profile.actorId,
          currentScore: profile.currentScore,
          riskLevel: profile.riskLevel,
          totalEvents: profile.totalEvents,
          positiveEvents: profile.positiveEvents,
          negativeEvents: profile.negativeEvents,
          lastEventAt: profile.lastEventAt,
          evidencePackIds,
        });
      } catch (err) {
        // Ignorar erro
      }
    }

    return overviews;
  }

  /**
   * Dispute Overview
   */
  async getDisputeOverview(
    tenantId: string,
    filters: ReportingFilters = {}
  ): Promise<DisputeOverview[]> {
    const { evidenceService } = await import('../evidence/evidence.service');

    // Buscar todos os evidence packs
    const packs = await evidenceService.listPacks(tenantId, {
      limit: 1000,
    });

    // Filtrar por status de disputa
    let filtered = packs;
    if (filters.status) {
      filtered = packs.filter((p) => p.disputeStatus === filters.status);
    }

    const overviews: DisputeOverview[] = [];

    for (const pack of filtered) {
      if (pack.disputeStatus === 'NONE') continue;

      const openedAt = pack.openedAt;
      const resolvedAt = pack.resolvedAt;

      let resolutionTimeDays: number | null = null;
      if (openedAt && resolvedAt) {
        resolutionTimeDays = Math.round(
          (resolvedAt.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // Extrair actorIds do timeline (simplificado)
      const actorIds = Array.from(
        new Set(
          pack.timeline
            .map((e) => e.actorId)
            .filter((id) => id && id !== 'system')
        )
      );

      overviews.push({
        packId: pack.packId,
        contextType: pack.contextType,
        contextId: pack.contextId,
        disputeStatus: pack.disputeStatus,
        openedAt,
        resolvedAt,
        resolutionTimeDays,
        actorIds,
      });
    }

    return overviews;
  }

  /**
   * Exporta dados em formato CSV ou JSON
   */
  async exportData(
    tenantId: string,
    exportType: ExportType,
    format: ExportFormat,
    filters: ReportingFilters = {}
  ): Promise<{ data: any; filename: string; mimeType: string }> {
    let data: any;
    let filename: string;

    switch (exportType) {
      case 'ledger': {
        data = await listBankLedgerRowsForExport(
          tenantId,
          filters.startDate,
          filters.endDate,
          100000
        );
        filename = `bank-ledger-export-${new Date().toISOString().split('T')[0]}`;
        break;
      }
      case 'payouts': {
        const { payoutService } = await import('../payout/payout.service');
        const orders = await payoutService.listOrders(tenantId, {
          status: filters.status as any,
          startDate: filters.startDate,
          endDate: filters.endDate,
          limit: 100000,
        });
        data = orders;
        filename = `payouts-export-${new Date().toISOString().split('T')[0]}`;
        break;
      }
      case 'invoices': {
        const { invoiceService } = await import('../invoicing/invoice.service');
        const invoices = await invoiceService.listInvoices(tenantId, {
          status: filters.status as any,
          startDate: filters.startDate,
          endDate: filters.endDate,
          limit: 100000,
        });
        data = invoices;
        filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
        break;
      }
      case 'trust': {
        data = await this.getTrustOverview(tenantId, filters);
        filename = `trust-export-${new Date().toISOString().split('T')[0]}`;
        break;
      }
      case 'disputes': {
        data = await this.getDisputeOverview(tenantId, filters);
        filename = `disputes-export-${new Date().toISOString().split('T')[0]}`;
        break;
      }
      default:
        throw new Error(`Tipo de exportação não suportado: ${exportType}`);
    }

    // Converter para formato solicitado
    if (format === 'csv') {
      // Converter para CSV (simplificado)
      const csv = this.convertToCSV(data);
      return {
        data: csv,
        filename: `${filename}.csv`,
        mimeType: 'text/csv',
      };
    } else {
      // JSON
      return {
        data: JSON.stringify(data, null, 2),
        filename: `${filename}.json`,
        mimeType: 'application/json',
      };
    }
  }

  /**
   * Converte dados para CSV (simplificado)
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Obter todas as chaves únicas
    const keys = new Set<string>();
    for (const item of data) {
      Object.keys(item).forEach((key) => keys.add(key));
    }

    const headers = Array.from(keys);
    const rows = [headers.join(',')];

    for (const item of data) {
      const values = headers.map((key) => {
        const value = item[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/,/g, ';'); // Escapar vírgulas
      });
      rows.push(values.join(','));
    }

    return rows.join('\n');
  }
}

export const reportingService = new ReportingService();

