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
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    const { accountsPayableRepository } = await import('./accounts-payable.repository');
    
    const filters: any = {
      status: 'PENDING',
    };

    if (startDate) {
      filters.dueDateFrom = startDate;
    }

    if (endDate) {
      filters.dueDateTo = endDate;
    }

    const payables = await accountsPayableRepository.listPayables(tenantId, filters);

    return payables.map((payable) => ({
      id: payable.id,
      type: 'PAYABLE' as const,
      date: payable.dueDate,
      amountCents: payable.amountCents,
      currency: payable.currency,
      description: `Conta a pagar - ${payable.referenceType}`,
      status: payable.status,
      metadata: {
        payableId: payable.id,
        supplierId: payable.supplierId,
        referenceType: payable.referenceType,
        referenceId: payable.referenceId,
      },
    }));
  }

  /**
   * Busca contas a receber futuras
   */
  async getUpcomingReceivables(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    const { accountsReceivableRepository } = await import('./accounts-receivable.repository');
    
    const filters: any = {
      status: 'PENDING',
    };

    if (startDate) {
      filters.expectedAtFrom = startDate;
    }

    if (endDate) {
      filters.expectedAtTo = endDate;
    }

    const receivables = await accountsReceivableRepository.listReceivables(tenantId, filters);

    return receivables.map((receivable) => ({
      id: receivable.id,
      type: 'RECEIVABLE' as const,
      date: receivable.expectedAt,
      amountCents: receivable.amountCents,
      currency: receivable.currency,
      description: `Conta a receber - ${receivable.sourceType}`,
      status: receivable.status,
      metadata: {
        receivableId: receivable.id,
        actorId: receivable.actorId,
        sourceType: receivable.sourceType,
        sourceId: receivable.sourceId,
      },
    }));
  }

  /**
   * Busca settlements futuros
   */
  async getUpcomingSettlements(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialAgendaItem[]> {
    const { settlementRepository } = await import('./settlement.repository');
    
    const filters: any = {
      status: 'PENDING',
    };

    const settlements = await settlementRepository.listSettlements(tenantId, filters);

    // Filtrar por data planejada (se houver no metadata)
    let filtered = settlements;
    if (startDate || endDate) {
      filtered = settlements.filter((settlement) => {
        const plannedAt = settlement.metadata?.plannedAt
          ? new Date(settlement.metadata.plannedAt)
          : settlement.createdAt;

        if (startDate && plannedAt < startDate) {
          return false;
        }

        if (endDate && plannedAt > endDate) {
          return false;
        }

        return true;
      });
    }

    return filtered.map((settlement) => ({
      id: settlement.id,
      type: 'SETTLEMENT' as const,
      date: settlement.metadata?.plannedAt
        ? new Date(settlement.metadata.plannedAt)
        : settlement.createdAt,
      amountCents: settlement.feeAmountCents,
      currency: settlement.currency,
      description: `Settlement regional - ${settlement.sourceType}`,
      status: settlement.status,
      metadata: {
        settlementId: settlement.id,
        regionId: settlement.regionId,
        sourceType: settlement.sourceType,
        sourceId: settlement.sourceId,
      },
    }));
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
        totalInflow += item.amount;
      } else {
        totalOutflow += item.amount;
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
        byDate[dateKey].inflow += item.amount;
      } else {
        byDate[dateKey].outflow += item.amount;
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







