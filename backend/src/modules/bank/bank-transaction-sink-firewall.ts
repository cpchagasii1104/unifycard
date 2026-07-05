// bank-transaction-sink-firewall.ts
// 🔴 F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, passo 2 do decision pack PORTA-1) — contenção
// fail-closed DENTRO DO SINK COMPARTILHADO (`bankTransactionService.transfer` +
// `createTransactionWithSplit`), não por-caller.
//
// ACHADO (READINESS_PORTA1.md, YALA #3 + achado A2): o firewall financeiro hoje existe só
// POR-CALLER (checkout, PDV, rides — cada um com seu próprio flag) — mas ≥18 módulos de produção
// chamam `transfer`/`createTransactionWithSplit` DIRETO (P2P transfer, escrow, payout, regional-fund,
// gateway-resolver, workers, etc.), a maioria SEM firewall próprio, contida só porque o `bank_ledger`
// está vazio hoje. "Tabela vazia" NÃO é prova de segurança (doutrina em financial-worker-gate.ts).
// P2P transfer (`bank-p2p-transfer.service.ts`) é o vetor mais grave: nenhum firewall, nenhuma
// impersonação, mas drenaria o PRÓPRIO saldo de qualquer autenticado assim que o ledger fosse
// semeado — sem este gate.
//
// Clayton decidiu (AskUserQuestion, Fatia 9): firewall default-OFF DENTRO do SINK, não por-caller —
// generaliza a lição do trilho rides (`DT-RIDES-MONEY-NO-FIREWALL...` CLOSED, "catraca no sink, não
// na borda") para TODO movimento de dinheiro de uma vez. Callers com firewall próprio (checkout/PDV/
// rides) GANHAM defesa-em-profundidade dupla; os demais (P2P/payout/escrow/gateway/workers) GANHAM a
// PRIMEIRA camada de proteção que nunca tiveram.
//
// Este firewall ESPELHA o padrão já estabelecido (checkout/rides): default OFF (fail-closed); NÃO
// move dinheiro; NÃO apaga código; NÃO finge operar — lança 403 honesto ANTES de qualquer validação/
// lock/ledger. Reabrir = trocar o flag (após o resto do decision pack PORTA-1 fechar: Core de
// Aprovação já vivo para payout, split materializado, saldo semeado com E2E de dinheiro real) — nunca
// acidental, nunca por efeito colateral de outra fatia.

import { AppError } from '@core/errors';

export const BANK_TRANSACTION_SINK_FIREWALL_FLAG = 'BANK_TRANSACTION_SINK_FIREWALL_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/''/'1'/'TRUE'/'yes' = desligado (fail-closed). */
export function isBankTransactionSinkFirewallEnabled(): boolean {
  return process.env[BANK_TRANSACTION_SINK_FIREWALL_FLAG] === 'true';
}

/**
 * Gate fail-closed do SINK compartilhado de dinheiro. Lança 403 HONESTO ANTES de qualquer
 * validação/lock/ledger, enquanto o flag estiver OFF. NÃO move dinheiro; NÃO há NODE_ENV
 * auto-enable; NÃO há fail-open. `operation` identifica QUAL entrypoint do sink foi chamado
 * (`transfer` | `createTransactionWithSplit`) para a mensagem/auditoria.
 */
export function assertBankTransactionSinkFirewallEnabled(operation: string): void {
  if (isBankTransactionSinkFirewallEnabled()) return;
  throw new AppError(
    403,
    `Runtime financeiro do sink de dinheiro desabilitado por contenção (F-BANK-TRANSACTION-SINK-FIREWALL; ` +
      `operação ${operation}) até a abertura soberana de dinheiro (PORTA-1: Core de Aprovação + split ` +
      'materializado + saldo semeado com E2E de dinheiro real). Nenhum dinheiro é movido; nenhum lock é ' +
      'tomado; o ledger do Bank não é tocado.',
    'BANK_TRANSACTION_SINK_FIREWALL_DISABLED'
  );
}
