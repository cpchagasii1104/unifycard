// backend/src/modules/dashboard/dashboard.service.ts
// SPRINT 49: DASHBOARDS OPERACIONAIS (BI INTERNO)

import { salesReportService } from '../reports/sales-report.service';
import { financialReportService } from '../reports/financial-report.service';
import { inventoryReportService } from '../reports/inventory-report.service';
import type {
  DashboardFilters,
  DashboardOverview,
  TodayOverview,
  MonthOverview,
  ChannelSplit,
} from './dashboard.types';

/**
 * Service para dashboards operacionais
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO recalcula regras
 * - NÃO cria métricas novas
 * - Dashboard = visualização de relatórios existentes
 * - Usa SalesReportService, FinancialReportService, InventoryReportService
 */
class DashboardService {
  /**
   * Obtém visão geral do dashboard
   */
  async getOverview(
    tenantId: string,
    userId: string | undefined, // Pode ser undefined em alguns contextos
    actingActorId: string | undefined, // Pode ser undefined se não especificado
    filters: DashboardFilters = {}
  ): Promise<DashboardOverview> {
    // 1. Visão do dia
    const today = await this.getTodayOverview(tenantId, userId, actingActorId, filters);

    // 2. Visão do mês
    const month = await this.getMonthOverview(tenantId, userId, actingActorId, filters);

    // 3. Divisão por canal
    const channels = await this.getChannelSplit(tenantId, userId, actingActorId, filters);

    // 4. Estoque crítico
    const inventory = await this.getCriticalInventory(tenantId);

    return {
      today,
      month,
      channels,
      inventory,
    };
  }

  /**
   * Visão do dia
   */
  async getTodayOverview(
    tenantId: string,
    userId: string | undefined,
    actingActorId: string | undefined,
    filters: DashboardFilters = {}
  ): Promise<TodayOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Relatório de vendas do dia
    const salesReport = await salesReportService.generateReport(tenantId, {
      ...filters,
      userId,
      actorId: actingActorId,
      startDate: today,
      endDate: tomorrow,
    });

    // 2. Relatório financeiro do dia
    const financialReport = await financialReportService.generateReport(tenantId, {
      ...filters,
      startDate: today,
      endDate: tomorrow,
    });

    // 3. Relatório de estoque (sem filtro de data)
    const inventoryReport = await inventoryReportService.generateReport(tenantId, {});

    return {
      date: today,
      sales: {
        totalOrders: salesReport.summary.totalOrders,
        totalAmount: salesReport.summary.totalAmount,
        totalPaid: salesReport.summary.totalPaid,
        averageTicket: salesReport.summary.averageTicket,
      },
      inventory: {
        totalVariants: inventoryReport.summary.totalVariants,
        lowStockCount: inventoryReport.balances.filter(
          (b) => b.availableQuantity > 0 && b.availableQuantity < 10
        ).length,
        outOfStockCount: inventoryReport.balances.filter(
          (b) => b.availableQuantity <= 0
        ).length,
      },
      financial: {
        totalReceived: financialReport.summary.totalReceived,
        pendingAmount: financialReport.summary.pendingAmount,
        failedAmount: financialReport.summary.failedAmount,
      },
    };
  }

  /**
   * Visão do mês
   */
  async getMonthOverview(
    tenantId: string,
    userId: string | undefined,
    actingActorId: string | undefined,
    filters: DashboardFilters = {}
  ): Promise<MonthOverview> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Relatório de vendas do mês
    const salesReport = await salesReportService.generateReport(tenantId, {
      ...filters,
      userId,
      actorId: actingActorId,
      startDate: monthStart,
      endDate: monthEnd,
    });

    // 2. Relatório financeiro do mês
    const financialReport = await financialReportService.generateReport(tenantId, {
      ...filters,
      startDate: monthStart,
      endDate: monthEnd,
    });

    // 3. Tendências diárias (últimos 30 dias)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const salesReport30Days = await salesReportService.generateReport(tenantId, {
      ...filters,
      userId,
      actorId: actingActorId,
      startDate: thirtyDaysAgo,
      endDate: now,
    });

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      sales: {
        totalOrders: salesReport.summary.totalOrders,
        totalAmount: salesReport.summary.totalAmount,
        totalPaid: salesReport.summary.totalPaid,
        averageTicket: salesReport.summary.averageTicket,
      },
      financial: {
        totalReceived: financialReport.summary.totalReceived,
        totalPaidOut: financialReport.summary.totalPaidOut,
        platformFees: financialReport.summary.platformFees,
      },
      trends: {
        dailySales: salesReport30Days.byPeriod.map((period) => ({
          date: period.period,
          amount: period.totalPaid,
          orders: period.totalOrders,
        })),
      },
    };
  }

  /**
   * Divisão por canal
   */
  async getChannelSplit(
    tenantId: string,
    userId: string | undefined,
    actingActorId: string | undefined,
    filters: DashboardFilters = {}
  ): Promise<ChannelSplit[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Relatório de vendas do mês por canal
    const salesReport = await salesReportService.generateReport(tenantId, {
      ...filters,
      userId,
      actorId: actingActorId,
      startDate: monthStart,
      endDate: monthEnd,
    });

    // Calcular total para porcentagem
    const totalPaid = salesReport.summary.totalPaid;

    return salesReport.byChannel.map((channel) => ({
      channel: channel.channel,
      sales: {
        totalOrders: channel.totalOrders,
        totalAmount: channel.totalAmount,
        totalPaid: channel.totalPaid,
        averageTicket: channel.totalOrders > 0 ? channel.totalPaid / channel.totalOrders : 0,
      },
      percentage: totalPaid > 0 ? (channel.totalPaid / totalPaid) * 100 : 0,
    }));
  }

  /**
   * Estoque crítico
   */
  private async getCriticalInventory(tenantId: string): Promise<DashboardOverview['inventory']> {
    const inventoryReport = await inventoryReportService.generateReport(tenantId, {});

    // Variantes com estoque crítico (disponível < 10)
    const criticalVariants = inventoryReport.balances
      .filter((b) => b.availableQuantity < 10)
      .slice(0, 10) // Top 10 mais críticos
      .map((b) => ({
        variantId: b.productVariantId,
        variantName: b.variantName || 'Variante',
        currentQuantity: b.currentQuantity,
        reservedQuantity: b.reservedQuantity,
        availableQuantity: b.availableQuantity,
      }));

    return {
      totalVariants: inventoryReport.summary.totalVariants,
      lowStockCount: inventoryReport.balances.filter(
        (b) => b.availableQuantity > 0 && b.availableQuantity < 10
      ).length,
      outOfStockCount: inventoryReport.balances.filter(
        (b) => b.availableQuantity <= 0
      ).length,
      criticalVariants,
    };
  }

  /**
   * Dashboard de vendas
   */
  async getSalesDashboard(
    tenantId: string,
    filters: DashboardFilters = {}
  ) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const salesReport = await salesReportService.generateReport(tenantId, {
      ...filters,
      startDate: monthStart,
      endDate: monthEnd,
    });

    return {
      summary: salesReport.summary,
      byPeriod: salesReport.byPeriod,
      byChannel: salesReport.byChannel,
      byActor: salesReport.byActor,
      averageTicketByPeriod: salesReport.averageTicketByPeriod,
    };
  }

  /**
   * Dashboard de estoque
   */
  async getInventoryDashboard(
    tenantId: string,
    filters: DashboardFilters = {}
  ) {
    const inventoryReport = await inventoryReportService.generateReport(tenantId, {});

    return {
      summary: inventoryReport.summary,
      balances: inventoryReport.balances,
      consumption: inventoryReport.consumption,
      critical: {
        lowStock: inventoryReport.balances.filter(
          (b) => b.availableQuantity > 0 && b.availableQuantity < 10
        ),
        outOfStock: inventoryReport.balances.filter(
          (b) => b.availableQuantity <= 0
        ),
      },
    };
  }
}

export const dashboardService = new DashboardService();

