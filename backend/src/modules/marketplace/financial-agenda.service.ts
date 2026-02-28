// backend/src/modules/marketplace/financial-agenda.service.ts
// SPRINT 85: AGENDA FINANCEIRA (CASHFLOW PROJETADO)

import type {
  FinancialAgendaItem,
  CashflowProjection,
  FinancialAgendaFilters,
} from './financial-agenda.types';

/**
 * Service para Agenda Financeira
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY
 * - Nenhuma execução
 * - Nenhuma alteração
 * - Apenas projeção
 */
class FinancialAgendaService {
  /**
   * Busca contas a pagar futuras
   */
  async getUpcomingPayables(
    _tenantId: string,
    _startDate?: Date,
    _endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    // accounts-payable.repository removido (migrado/SSOT) — projeção read-only retorna vazio
    return [];
  }

  /**
   * Busca contas a receber futuras
   */
  async getUpcomingReceivables(
    _tenantId: string,
    _startDate?: Date,
    _endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    // accounts-receivable.repository removido (migrado/SSOT) — projeção read-only retorna vazio
    return [];
  }

  /**
   * Busca settlements futuros
   */
  async getUpcomingSettlements(
    _tenantId: string,
    _startDate?: Date,
    _endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    // settlement.repository removido (migrado/SSOT) — projeção read-only retorna vazio
    return [];
  }

  /**
   * Busca ações programadas futuras
   */
  async getUpcomingScheduledActions(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    const { scheduledActionRepository } = await import('../../modules/automation/scheduled-action.repository');
    
    const filters: any = {
      status: 'SCHEDULED',
    };

    const actions = await scheduledActionRepository.listActions(tenantId, filters);

    // Filtrar por scheduled_for
    let filtered = actions;
    if (startDate || endDate) {
      filtered = actions.filter((action) => {
        if (startDate && action.scheduledFor < startDate) {
          return false;
        }

        if (endDate && action.scheduledFor > endDate) {
          return false;
        }

        return true;
      });
    }

    // Filtrar apenas ações financeiras (payout, payment, etc.)
    const financialActions = filtered.filter((action) => {
      const financialTypes = ['PAYOUT', 'PAYMENT', 'SETTLEMENT'];
      return financialTypes.includes(action.actionType);
    });

    return financialActions.map((action) => ({
      id: action.id,
      type: 'SCHEDULED_ACTION' as const,
      date: action.scheduledFor,
      amountCents: action.metadata?.amount_cents || 0,
      currency: action.metadata?.currency || 'BRL',
      description: `Ação programada - ${action.actionType}`,
      status: action.status,
      metadata: {
        actionId: action.id,
        actionType: action.actionType,
        referenceType: action.referenceType,
        referenceId: action.referenceId,
      },
    }));
  }

  /**
   * Busca agenda financeira completa
   */
  async getAgenda(
    tenantId: string,
    filters: FinancialAgendaFilters = {}
  ): Promise<FinancialAgendaItem[]> {
    const startDate = filters.startDate || new Date();
    const endDate = filters.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 dias

    const allItems: FinancialAgendaItem[] = [];

    // Buscar todos os tipos se não especificado
    const types = filters.types || ['PAYABLE', 'RECEIVABLE', 'SETTLEMENT', 'SCHEDULED_ACTION'];

    if (types.includes('PAYABLE')) {
      const payables = await this.getUpcomingPayables(tenantId, startDate, endDate);
      allItems.push(...payables);
    }

    if (types.includes('RECEIVABLE')) {
      const receivables = await this.getUpcomingReceivables(tenantId, startDate, endDate);
      allItems.push(...receivables);
    }

    if (types.includes('SETTLEMENT')) {
      const settlements = await this.getUpcomingSettlements(tenantId, startDate, endDate);
      allItems.push(...settlements);
    }

    if (types.includes('SCHEDULED_ACTION')) {
      const actions = await this.getUpcomingScheduledActions(tenantId, startDate, endDate);
      allItems.push(...actions);
    }

    // Ordenar por data
    allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Aplicar limit e offset
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    return allItems.slice(offset, offset + limit);
  }

  /**
   * Calcula projeção de cashflow
   */
  async getCashflowProjection(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CashflowProjection> {
    const items = await this.getAgenda(tenantId, {
      startDate: periodStart,
      endDate: periodEnd,
    });

    // Calcular totais
    let totalInflow = 0;
    let totalOutflow = 0;

    items.forEach((item) => {
      if (item.type === 'RECEIVABLE' || item.type === 'SETTLEMENT') {
        totalInflow += item.amountCents;
      } else {
        totalOutflow += item.amountCents;
      }
    });

    const netCashflow = totalInflow - totalOutflow;

    // Agrupar por data
    const byDate: Record<string, { inflow: number; outflow: number; net: number }> = {};

    items.forEach((item) => {
      const dateKey = item.date.toISOString().split('T')[0];

      if (!byDate[dateKey]) {
        byDate[dateKey] = { inflow: 0, outflow: 0, net: 0 };
      }

      if (item.type === 'RECEIVABLE' || item.type === 'SETTLEMENT') {
        byDate[dateKey].inflow += item.amountCents;
      } else {
        byDate[dateKey].outflow += item.amountCents;
      }

      byDate[dateKey].net = byDate[dateKey].inflow - byDate[dateKey].outflow;
    });

    return {
      periodStart,
      periodEnd,
      items,
      totalInflow,
      totalOutflow,
      netCashflow,
      byDate,
    };
  }
}

export const financialAgendaService = new FinancialAgendaService();







