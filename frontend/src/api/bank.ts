// frontend/src/api/bank.ts
// API para Wallet e Statement do Unify Bank
//
// Conformidade §4.7 (07_NOMENCLATURA_CANONICA): monetário sempre em centavos
// com sufixo `_cents`. Backend retorna `balanceCents` canônico; o campo
// `balance` legado é mantido como opcional apenas para tolerância a
// instâncias antigas do backend (em runtime atual sempre vem `balanceCents`).
// Todos os consumers internos foram migrados para `balanceCents`/`amountCents`
// via `centsToReais` (ver `frontend/src/utils/money.ts`).

import { apiFetch, extractErrorMessage } from './client';

export interface BankBalance {
  success: boolean;
  /** Saldo em centavos (canônico §4.7). Backend `/bank/balance` retorna sempre. */
  balanceCents?: number;
  /** @deprecated tolerância para instâncias antigas do backend. Não usar em código novo. */
  balance?: number;
  currency: string;
  hasAccount: boolean;
}

export interface BankStatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  /** Valor em centavos (canônico §4.7). Backend retorna sempre. */
  amountCents: number;
  direction: 'in' | 'out';
  /** Saldo após a entrada, em centavos (canônico §4.7). Backend retorna sempre. */
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
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar saldo: ${response.status}`));
  }
  
  const data = await response.json();
  return data;
}

export interface P2PTransferResult {
  success: boolean;
  transaction: {
    transactionId: string;
    eventId: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  };
  fromUserId: string;
  toUserId: string;
  fromAccountBalanceCents: number;
  toAccountBalanceCents: number;
}

/**
 * Transferência P2P entre usuários (segundo contexto econômico ponta-a-ponta)
 *
 * Backend: POST /bank/p2p-transfer → bankP2PTransferService.transferP2P
 *          → bank-integration motor canônico (mesmo de event_ticket)
 *          → context: 'p2p_transfer', concept_id: 'split-payment'
 *
 * Causalidade preservada: ledger imutável, double-entry, autoria rastreável.
 */
export async function p2pTransfer(input: {
  toUserId: string;
  amountCents: number;
}): Promise<P2PTransferResult> {
  const response = await apiFetch('/bank/p2p-transfer', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao transferir: ${response.status}`));
  }

  return await response.json();
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
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar extrato: ${response.status}`));
  }
  
  const data = await response.json();
  
  if (!data.statement) {
    throw new Error('Resposta inválida do servidor');
  }
  
  return data.statement;
}







