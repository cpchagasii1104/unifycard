// frontend/src/api/transparency.ts
// API para Transparência Financeira - FASE 7

import { apiFetch, extractErrorMessage } from './client';

// Conformidade §4.7 (07_NOMENCLATURA_CANONICA): campos monetários com sufixo `_cents`,
// alinhados ao shape real do backend (core/unifybank/transparency.service.ts).
// Convergência DT-TRANSPARENCY-API-CENTS-CONVERGENCE (Frente 1) + summary fields (Frente 2).
//
// totalPercentage permanece sem sufixo Cents — é percentual, não monetário.

export interface StatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  amountCents: number;
  direction: 'in' | 'out';
  balanceAfterCents: number;
  createdAt: string;
  context?: string; // event_ticket, service_booking, ride_payment, donation, p2p_transfer, etc.
  status?: 'completed' | 'reversed' | 'pending' | 'failed';
  referenceType?: string; // event, booking, ride, group, etc.
  referenceId?: string; // ID da referência
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
    amountCents: number;
    type: string;
    createdAt: string;
    metadata: Record<string, any>;
  };
  splits: Array<{
    transactionId: string;
    targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'reserve' | 'platform';
    targetId?: string;
    percentage: number;
    amountCents: number;
    createdAt: string;
  }>;
  totalPercentage: number;
  totalAmountCents: number;
}

export interface RegionalFundEntry {
  transactionId: string;
  type: 'credit' | 'debit';
  amountCents: number;
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
  currentBalanceCents: number;
  entries: RegionalFundEntry[];
  summary: {
    totalInCents: number;
    totalOutCents: number;
    netAmountCents: number;
  };
}

export interface RegionalFundAdminView {
  regionId: string;
  accountId: string;
  currentBalanceCents: number;
  entries: RegionalFundEntry[];
  summary: {
    totalInCents: number;
    totalOutCents: number;
    netAmountCents: number;
    byOriginCents: Record<string, number>;
    byContextCents: Record<string, number>;
    byPeriod: Array<{
      period: string;
      totalInCents: number;
      totalOutCents: number;
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

  const response = await apiFetch(`/bank/statement?${params.toString()}`, {}, { silent401: true });
  
  if (!response.ok) {
    // 401 = sem acesso bancário (esperado, não é erro)
    if (response.status === 401) {
      const error = new Error('FEATURE_UNAVAILABLE') as any;
      error.code = 'FEATURE_UNAVAILABLE';
      error.status = 401;
      throw error;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar extrato: ${response.status}`));
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
  const response = await apiFetch(`/bank/transaction/${transactionId}/splits`, {}, { silent401: true });
  
  if (!response.ok) {
    // 401 = sem acesso bancário (esperado, não é erro)
    if (response.status === 401) {
      return null;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar splits: ${response.status}`));
  }
  
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
    const response = await apiFetch(`/bank/regional-fund?${params.toString()}`, {}, { silent401: true });
    
    if (!response.ok) {
      // 401 = sem acesso bancário (esperado, não é erro)
      if (response.status === 401) {
        return null;
      }
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(errorData, `Erro ao buscar fundo regional: ${response.status}`));
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




