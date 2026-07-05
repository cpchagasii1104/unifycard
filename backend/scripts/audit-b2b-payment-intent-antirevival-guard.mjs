#!/usr/bin/env node
// Guard estrutural — F-B2B-PAYMENT-INTENT-DEAD-CODE-ANTIREVIVAL (ressalva R1 da auditoria Yala do
// decision pack PORTA-1, 2026-07-05).
//
// bank-ledger.service.ts::createTransactionFromIntent (linha ~213) grava bank_transactions/
// bank_ledger DIRETO em SQL cru — um trilho de escrita financeira SEPARADO do sink compartilhado
// (bank-transaction.service.ts), portanto FORA do alcance de
// assertBankTransactionSinkFirewallEnabled. Seu único caller,
// completeB2bPaymentFromIntentCommand (commands/financial.commands.ts), não tem NENHUM importador
// vivo em todo o backend — 100% código morto hoje.
//
// RISCO NOMEADO pela Yala: a Fatia 9 é justamente "PDV + orquestração B2B" — esse código será
// tentado a reviver justamente no trabalho que vem a seguir. Mesmo padrão já usado pro
// treasury-split (F-TREASURY-SPLIT-SUPERSEDED-ANTIREVIVAL): não revive, não apaga, CONGELA — se
// um caller novo aparecer, ele precisa vir com firewall próprio (o sink compartilhado não o
// protege), então este guard morde ANTES que o caminho reabra sem proteção.
//
// MORDE:
//   (a) completeB2bPaymentFromIntentCommand ganhar um importador novo fora da allowlist
//       (commands/financial.commands.ts, commands/index.ts — a própria definição/reexport);
//   (b) createTransactionFromIntent ganhar um caller novo fora de bank-ledger.service.ts (própria
//       definição) e commands/financial.commands.ts (o wrapper já mapeado).
//
// FIX (2ª rodada da auditoria Yala, 2026-07-05): o check (b) original exigia `createTransaction
// FromIntent\(` (parêntese colado) — um `import { createTransactionFromIntent as settleB2b }` +
// chamada via alias (`settleB2b(...)`) evadia o guard (nem a linha de import nem a chamada casam
// com o nome seguido de parêntese). Trocado por `\bcreateTransactionFromIntent\b` (sem parêntese)
// — pega QUALQUER menção ao nome original, inclusive em import/alias, sem falso positivo (o único
// texto que colide por prefixo, `CreateTransactionFromIntentInput`/`...Result`, começa com C
// maiúsculo — token diferente, `\b` não confunde).
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const ALLOW_COMMAND_CALLER = new Set([
  join('src', 'commands', 'financial.commands.ts'),
  join('src', 'commands', 'index.ts'),
]);
const ALLOW_FUNCTION_CALLER = new Set([
  join('src', 'modules', 'bank', 'bank-ledger.service.ts'), // própria definição
  join('src', 'commands', 'financial.commands.ts'),          // wrapper já mapeado (dead)
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const failures = [];
const files = existsSync(SRC) ? walk(SRC) : [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, 'utf8');
  const src = stripTs(raw);

  if (/\bcompleteB2bPaymentFromIntentCommand\b/.test(src) && !ALLOW_COMMAND_CALLER.has(rel)) {
    failures.push(`${rel}: referencia completeB2bPaymentFromIntentCommand fora da allowlist — B2B payment intent (dead code) ganhando caller novo sem firewall próprio.`);
  }
  if (/\bcreateTransactionFromIntent\b/.test(src) && !ALLOW_FUNCTION_CALLER.has(rel)) {
    failures.push(`${rel}: chama createTransactionFromIntent fora da allowlist — grava bank_transactions/bank_ledger DIRETO, fora do sink compartilhado (sem proteção do firewall).`);
  }
}

if (failures.length) {
  console.error('GATE FAIL [b2b-payment-intent-antirevival-guard]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [b2b-payment-intent-antirevival-guard] — createTransactionFromIntent (B2B, escreve fora do sink compartilhado) e completeB2bPaymentFromIntentCommand seguem 100% mortos; nenhum caller novo apareceu sem firewall próprio.');
