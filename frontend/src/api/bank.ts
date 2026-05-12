// frontend/src/api/bank.ts
// API para Wallet e Statement do Unify Bank
//
// Conformidade §4.7 (07_NOMENCLATURA_CANONICA): monetário sempre em centavos
// com sufixo `_cents`. Backend retorna `balanceCents` canônico; `balance` é
// campo legado mantido por compatibilidade (cópia literal de `balanceCents`
// no backend — ver bank-http.routes.ts:165-171). Frontend consome `balanceCents`.

import { apiFetch } from './client';

export interface BankBalance {
  success: boolean;
  /**
   * Saldo em centavos (canônico §4.7). Backend `/bank/balance` retorna sempre.
   * Marcado opcional apenas para tolerar caminho local de fallback (401).
   */
  balanceCents?: number;
  /**
   * @deprecated Cópia legada de `balanceCents` (backend retorna ambos por
   * compat — ver bank-http.routes.ts:165-171). Consumers ainda usam
   * (CompanyFinancialTab, CompanyOverviewTab, HomeContextual). Migrar para
   * `balanceCents` via `centsToReais` antes de exibir, depois remover.
   */
  balance?: number;
  currency: string;
  hasAccount: boolean;
}

export interface BankStatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  /** Valor em centavos (canônico §4.7). Backend retorna sempre. */
  amountCents: number;
  /**
   * @deprecated Campo legado preservado APENAS para não quebrar build de
   * consumers ainda não migrados (CompanyFinancialTab, CompanyOverviewTab,
   * HomeContextual, activity-aggregation.service). Backend NÃO envia este
   * campo — em runtime será `undefined`. Migrar consumers para `amountCents`
   * via `centsToReais` antes de exibir, depois remover daqui.
   */
  amount?: number;
  direction: 'in' | 'out';
  /** Saldo após a entrada, em centavos (canônico §4.7). Backend retorna sempre. */
  balanceAfterCents: number;
  /** @deprecated mesma motivação que `amount`. */
  balanceAfter?: number;
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
        balanceCents: 0,
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







