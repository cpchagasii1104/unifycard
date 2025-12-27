// frontend/src/api/transparency.ts
// API para Transparência Financeira - FASE 7

import { apiFetch } from './client';

export interface StatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  amount: number;
  direction: 'in' | 'out';
  balanceAfter: number;
  createdAt: string;
  metadata: {
    type?: string;
    targetType?: string;
    targetId?: string;
    originTransactionId?: string;
    splitGroupId?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface StatementResult {
  entries: StatementEntry[];
  total: number;
  hasMore: boolean;
}

export interface SplitDetail {
  baseTransaction: {
    transactionId: string;
    amount: number;
    type: string;
    createdAt: string;
    metadata: Record<string, any>;
  };
  splits: Array<{
    transactionId: string;
    targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
    targetId?: string;
    percentage: number;
    amount: number;
    createdAt: string;
  }>;
  totalPercentage: number;
  totalAmount: number;
}

export interface RegionalFundEntry {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  origin: string;
  originTransactionId?: string;
  destination?: string;
  context?: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export interface RegionalFundView {
  accountId: string;
  regionId?: string;
  currentBalance: number;
  entries: RegionalFundEntry[];
  summary: {
    totalIn: number;
    totalOut: number;
    netAmount: number;
  };
}

export interface RegionalFundAdminView {
  regionId: string;
  accountId: string;
  currentBalance: number;
  entries: RegionalFundEntry[];
  summary: {
    totalIn: number;
    totalOut: number;
    netAmount: number;
    byOrigin: Record<string, number>;
    byContext: Record<string, number>;
    byPeriod: Array<{
      period: string;
      totalIn: number;
      totalOut: number;
    }>;
  };
}

/**
 * Busca extrato financeiro do usuário
 */
export async function getUserStatement(options: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<StatementResult> {
  const { limit = 50, offset = 0, startDate, endDate } = options;
  
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (startDate) {
    params.append('startDate', startDate.toISOString());
  }
  if (endDate) {
    params.append('endDate', endDate.toISOString());
  }

  const response = await apiFetch(`/bank/statement?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao buscar extrato: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.statement) {
    throw new Error('Resposta inválida do servidor');
  }
  
  return data.statement;
}

/**
 * Busca detalhe de split de uma transação
 */
export async function getTransactionSplits(transactionId: string): Promise<SplitDetail | null> {
  const response = await apiFetch(`/bank/transaction/${transactionId}/splits`);
  const data = await response.json();
  return data.splitDetail || null;
}

/**
 * Busca fundo regional do usuário
 */
export async function getUserRegionalFund(options: {
  limit?: number;
  offset?: number;
} = {}): Promise<RegionalFundView | null> {
  const { limit = 50, offset = 0 } = options;
  
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  try {
    const response = await apiFetch(`/bank/regional-fund?${params.toString()}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ao buscar fundo regional: ${response.status}`);
    }
    
    const data = await response.json();
    return data.regionalFund || null;
  } catch (error: any) {
    // Se retornar 404, fundo não existe para o usuário
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Busca fundo regional (visão admin)
 */
export async function getAdminRegionalFund(
  regionId: string,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<RegionalFundAdminView | null> {
  const { limit = 100, offset = 0, startDate, endDate } = options;
  
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (startDate) {
    params.append('startDate', startDate.toISOString());
  }
  if (endDate) {
    params.append('endDate', endDate.toISOString());
  }

  try {
    const response = await apiFetch(`/admin/bank/regional-fund/${regionId}?${params.toString()}`);
    const data = await response.json();
    return data.regionalFund || null;
  } catch (error: any) {
    // Se retornar 404, fundo não existe para a região
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}




