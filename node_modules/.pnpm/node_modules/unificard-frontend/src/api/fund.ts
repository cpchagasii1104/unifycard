// frontend/src/api/fund.ts
// API para Fundo Regional

import { apiFetch } from './client';

export interface RevenueByModule {
  module: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  lastTransactionDate?: string;
}

export interface OperationalCost {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  lastTransactionDate?: string;
}

export interface FundDashboardData {
  summary: {
    currentBalance: number;
    totalRevenue: number;
    totalCosts: number;
    netBalance: number;
    period: {
      start: string;
      end: string;
      days: number;
    };
  };
  revenue: {
    byModule: RevenueByModule[];
    total: number;
    growth: {
      currentPeriod: number;
      previousPeriod: number;
      percentage: number;
    };
  };
  costs: {
    byCategory: OperationalCost[];
    total: number;
    growth: {
      currentPeriod: number;
      previousPeriod: number;
      percentage: number;
    };
  };
  statistics: {
    averageDailyRevenue: number;
    averageDailyCosts: number;
    averageTransactionValue: number;
    mostActiveModule: string;
    mostProfitableModule: string;
  };
}

export interface RegionalFundView {
  summary: {
    currentBalance: number;
    totalContributions: number;
    totalReceived: number;
    fromServices: {
      work: number;
    };
    lastUpdated: string;
    explanation: {
      text: string;
      example: string;
    };
    splitBreakdown: {
      worker: number;
      platform: number;
      regionalFund: number;
      community: number;
    };
  };
  history: {
    entries: Array<{
      date: string;
      amount: number;
      transactionCount: number;
    }>;
    period: {
      start: string;
      end: string;
      days: number;
      label: string;
    };
    totalInPeriod: number;
  };
  projection: {
    currentBalance: number;
    dailyAverage: number;
    daysAnalyzed: number;
    estimates: {
      in30Days: {
        estimatedBalance: number;
        estimatedIncrease: number;
      };
      in90Days: {
        estimatedBalance: number;
        estimatedIncrease: number;
      };
    };
    calculatedAt: string;
    disclaimer: string;
  };
}

/**
 * Busca dados do dashboard do Fundo Regional
 */
export async function getFundDashboard(days: number = 30): Promise<FundDashboardData> {
  const response = await apiFetch(`/fund/dashboard?days=${days}`);
  return response.json();
}

/**
 * Busca visão completa do Fundo Regional
 */
export async function getFundView(days: number = 30): Promise<RegionalFundView> {
  const response = await apiFetch(`/fund?days=${days}`);
  return response.json();
}

/**
 * Alias para getFundView (compatibilidade)
 */
export const getFundCompleteView = getFundView;

/**
 * Busca resumo do Fundo Regional
 */
export async function getFundSummary() {
  const response = await apiFetch('/fund/summary');
  return response.json();
}

/**
 * Busca histórico do Fundo Regional
 */
export async function getFundHistory(days: number = 30) {
  const response = await apiFetch(`/fund/history?days=${days}`);
  return response.json();
}

/**
 * Busca projeção do Fundo Regional
 */
export async function getFundProjection() {
  const response = await apiFetch('/fund/projection');
  return response.json();
}
