// frontend/src/api/bank.ts
// API para Wallet e Statement do Unify Bank

import { apiFetch } from './client';

export interface BankBalance {
  success: boolean;
  balance: number;
  currency: string;
  hasAccount: boolean;
}

export interface BankStatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  amount: number;
  direction: 'in' | 'out';
  balanceAfter: number;
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

export interface BankStatement {
  entries: BankStatementEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Busca saldo atual (MFI) do usuário autenticado
 */
export async function getBankBalance(): Promise<BankBalance> {
  const response = await apiFetch('/bank/balance', {}, { silent401: true });
  
  if (!response.ok) {
    if (response.status === 401) {
      return {
        success: true,
        balance: 0,
        currency: 'BRL',
        hasAccount: false,
      };
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao buscar saldo: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Busca extrato financeiro do usuário autenticado
 */
export async function getBankStatement(options: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<BankStatement> {
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
    if (response.status === 401) {
      return {
        entries: [],
        total: 0,
        hasMore: false,
      };
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao buscar extrato: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.statement) {
    throw new Error('Resposta inválida do servidor');
  }
  
  return data.statement;
}







