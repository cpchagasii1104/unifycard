// backend/src/core/authorization/financial-projection-hold.ts
// DECISION-0189C D5 — barreira de PROJEÇÃO financeira sob PORTA 01.
//
// Enquanto a PORTA 01 estiver fechada, superfícies de reporting/risk NÃO podem chamar
// listOrders/listInvoices nem projetar valores/contagens derivados de payouts/invoices — e as
// permissões tenant-operator NÃO superam esse HOLD. Serviços chamam `assertFinancialProjectionAllowed`
// ANTES de qualquer query de agregado financeiro; rotas respondem 503 `PORTA_01_CLOSED` para a
// superfície inteira (separação não é inequívoca — o sinal de risco DERIVA do dado financeiro).

import { isPorta01Closed } from './company-policy-registry';

export { isPorta01Closed };

/** Corpo 503 estável e sanitizado da superfície financeira em HOLD. */
export const FINANCIAL_PROJECTION_HELD_BODY = { code: 'PORTA_01_CLOSED', financialDataStatus: 'PORTA_01_CLOSED' } as const;

/** Erro tipado da barreira de service (defesa em profundidade contra caller direto). */
export class Porta01FinancialHoldError extends Error {
  code = 'PORTA_01_CLOSED';
  constructor() {
    super('PORTA_01_CLOSED: projeção de agregados financeiros (payouts/invoices) bloqueada enquanto a PORTA 01 estiver fechada (DECISION-0189C D5)');
    this.name = 'Porta01FinancialHoldError';
  }
}

/** Barreira de service: lança se a PORTA 01 estiver fechada. Chamar ANTES de listOrders/listInvoices. */
export function assertFinancialProjectionAllowed(): void {
  if (isPorta01Closed()) throw new Porta01FinancialHoldError();
}
