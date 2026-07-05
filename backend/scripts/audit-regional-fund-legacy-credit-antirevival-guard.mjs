#!/usr/bin/env node
// Guard estrutural — F-REGIONAL-FUND-LEGACY-CREDIT-ANTIREVIVAL (Onda 1 de zeragem de dívidas
// técnicas, 2026-07-05, reclassificação de DT-REGIONAL-FUNDS-TOTAL-BALANCE-CENTS-DEPRECATION).
//
// `regionalFundService.recordRegionalFundCredit` escreve DIRETO em `regional_funds.
// total_balance_cents` — um 2º mecanismo de contabilidade PARALELO ao `bank_ledger` (SSOT único,
// DECISION-0024). Investigação de reachability completa (não achado teórico) confirmou:
//   (a) `MarketplaceTerminalModule` (marketplace-terminal.service.ts) — chama
//       recordRegionalFundCredit direto — NUNCA é importado/instanciado em lugar nenhum do
//       backend. 100% morto.
//   (b) `MarketplaceCompanyAggregatorService.activatePaymentTerminal` (marketplace-company.
//       service.ts) delega pra `companyApplicationService.activatePaymentTerminal`, que TAMBÉM
//       chama recordRegionalFundCredit (com amountCents hardcoded em 0, dentro de try/catch que
//       engole qualquer erro) — mas esse método do agregador nunca é chamado por
//       marketplace.service.ts (a facade viva) nem por marketplace.routes.ts (a única rota
//       registrada em app.builder.ts pra esse módulo). Morto pelo caminho HTTP.
// Os únicos callers REAIS de regionalFundService em produção usam só a leitura
// (getRegionalFundByRegion) ou uma função DIFERENTE que grava no Bank de verdade
// (topUpRegionalFundBankFromReserve, via bank_transactions/bank_accounts) — não
// recordRegionalFundCredit.
//
// Mesma classe de achado já fechada nesta sessão via F-TREASURY-SPLIT-SUPERSEDED-ANTIREVIVAL e
// F-B2B-PAYMENT-INTENT-DEAD-CODE-ANTIREVIVAL: não revive, não apaga (schema/coluna preservados
// pra auditoria), CONGELA — se um caller novo aparecer nesses dois pontos, este guard morde
// ANTES do caminho reabrir sem proteção (recordRegionalFundCredit não passa pelo sink
// compartilhado do Bank, não tem firewall próprio).
//
// MORDE:
//   (a) MarketplaceTerminalModule ganhar um importador novo fora da própria definição;
//   (b) activatePaymentTerminal (marketplace-company.service.ts) ganhar um caller novo fora da
//       própria definição — sinal de que o agregador voltou a ser exercitado pela facade/rota.
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const ALLOW_TERMINAL_MODULE_CALLER = new Set([
  join('src', 'modules', 'marketplace', 'marketplace-terminal.service.ts'),
]);
const ALLOW_AGGREGATOR_METHOD_CALLER = new Set([
  join('src', 'modules', 'marketplace', 'services', 'marketplace-company.service.ts'),
  join('src', 'modules', 'marketplace', 'marketplace-terminal.service.ts'), // própria definição, já coberta pelo check (a)
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
  const src = stripTs(readFileSync(file, 'utf8'));

  if (/\bMarketplaceTerminalModule\b/.test(src) && !ALLOW_TERMINAL_MODULE_CALLER.has(rel)) {
    failures.push(`${rel}: referencia MarketplaceTerminalModule fora da allowlist — trilho morto (recordRegionalFundCredit direto) ganhando caller novo.`);
  }
  if (/\bactivatePaymentTerminal\b/.test(src) && !ALLOW_AGGREGATOR_METHOD_CALLER.has(rel) && rel !== join('src', 'modules', 'marketplace', 'application', 'services', 'company-application.service.ts')) {
    failures.push(`${rel}: referencia activatePaymentTerminal fora da allowlist — caminho até recordRegionalFundCredit reaberto (facade/rota voltou a chamar o agregador).`);
  }
}

if (failures.length) {
  console.error('GATE FAIL [regional-fund-legacy-credit-antirevival-guard]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [regional-fund-legacy-credit-antirevival-guard] — recordRegionalFundCredit (2º mecanismo de contabilidade paralelo ao bank_ledger) segue inalcançável pelos dois caminhos mortos conhecidos; nenhum caller novo apareceu.');
