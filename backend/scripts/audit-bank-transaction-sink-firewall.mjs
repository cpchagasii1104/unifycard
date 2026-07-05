#!/usr/bin/env node
// Guard estrutural — F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, passo 2 do decision pack PORTA-1,
// GO de Clayton via AskUserQuestion: "firewall default-OFF DENTRO do sink").
//
// O sink compartilhado (bankTransactionService.transfer / createTransactionWithSplit) é chamado por
// ≥18 módulos de produção (P2P transfer, payout, escrow, checkout, PDV, rides, gateway-resolver,
// workers, etc.) — a maioria SEM firewall próprio, contida só porque bank_ledger está vazio hoje
// ("tabela vazia" NÃO é prova de segurança, doutrina financial-worker-gate.ts). Generaliza a lição
// do trilho rides (DT-RIDES-MONEY-NO-FIREWALL... CLOSED, "catraca no sink, não na borda") para TODO
// movimento de dinheiro de uma vez — um gate no sink protege todos os callers, presentes e futuros.
//
// MORDE:
//   (A) bank-transaction-sink-firewall.ts sumir ou perder o flag/assert/403;
//   (B) transfer() perder assertBankTransactionSinkFirewallEnabled como uma das PRIMEIRAS linhas;
//   (C) createTransactionWithSplit() perder o mesmo assert;
//   (D) createSimpleTransaction() perder o mesmo assert (3º entrypoint — achado DURANTE a
//       implementação: grava bank_transactions/ledger direto, não delega aos outros dois);
//   (E) o flag deixar de ser estrito (=== 'true').
// Complementa (não substitui) os firewalls por-caller já existentes (checkout/PDV/rides) — aqueles
// continuam vigiados por seus próprios guards; este é a defesa-em-profundidade no SINK compartilhado.
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// (A) firewall existe, flag estrito, assert, 403.
const FW = join(ROOT, 'src', 'modules', 'bank', 'bank-transaction-sink-firewall.ts');
if (!existsSync(FW)) {
  failures.push(`firewall ausente: ${FW} — sink de dinheiro sem kill-switch runtime.`);
} else {
  const src = stripTs(readFileSync(FW, 'utf-8'));
  if (!/BANK_TRANSACTION_SINK_FIREWALL_ENABLED/.test(src)) failures.push(`${FW}: flag BANK_TRANSACTION_SINK_FIREWALL_ENABLED ausente.`);
  if (!/=== 'true'/.test(src)) failures.push(`${FW}: flag não é estrito (=== 'true') — risco de fail-open por '1'/'TRUE'/'yes'.`);
  if (!/export function assertBankTransactionSinkFirewallEnabled/.test(src)) failures.push(`${FW}: assertBankTransactionSinkFirewallEnabled ausente.`);
  if (!/throw new AppError\(\s*403/.test(src)) failures.push(`${FW}: assert não lança 403 fail-closed.`);
}

// (B)+(C)+(D) os TRÊS entrypoints públicos do sink chamam o assert bem no início do corpo.
const SINK = join(ROOT, 'src', 'modules', 'bank', 'bank-transaction.service.ts');
if (!existsSync(SINK)) {
  failures.push(`arquivo ausente: ${SINK}`);
} else {
  const src = stripTs(readFileSync(SINK, 'utf-8'));
  for (const method of ['async transfer(', 'async createTransactionWithSplit(', 'async createSimpleTransaction(']) {
    const idx = src.indexOf(method);
    if (idx < 0) {
      failures.push(`${SINK}: ${method} não encontrado.`);
      continue;
    }
    // Corpo = do início da declaração até ~1500 chars depois (o assert deve estar bem no topo,
    // antes de qualquer destructuring/validação — a folga cobre assinaturas com tipo de input
    // inline longo, ex.: createTransactionWithSplit) — não até o próximo método (evita
    // falso-negativo se um assert legítimo de outro método vazar pro corpo por engano de indentação).
    const body = src.slice(idx, idx + 1500);
    if (!/assertBankTransactionSinkFirewallEnabled\(/.test(body)) {
      failures.push(`${SINK}: ${method} (SINK compartilhado) não chama assertBankTransactionSinkFirewallEnabled no início do corpo — gate no sink quebrado, ≥18 callers ficam sem proteção.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [bank-transaction-sink-firewall]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [bank-transaction-sink-firewall] — sink compartilhado (transfer + createTransactionWithSplit + createSimpleTransaction) com firewall runtime default-off NO SINK (não por-caller); flag estrito 403 fail-closed. Protege ≥18 callers de produção (P2P/payout/escrow/checkout/PDV/rides/gateway/workers/event-payment) de uma vez — achado A1/A2 do READINESS_PORTA1.md fechado.');
