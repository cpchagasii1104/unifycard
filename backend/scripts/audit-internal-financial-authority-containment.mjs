#!/usr/bin/env node
// Guard estrutural — F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (fail-closed P1).
//
// Os controllers financeiros montados em `/internal` FORA do protectedScope (sem authPlugin/tenantPlugin)
// liam tenant_id de body/query como AUTORIDADE e/ou liam/escreviam o SSOT de dinheiro (bank_ledger/
// bank_transactions/...) cross-tenant sem subject server-side. Esta fatia os reduziu a 501
// INTERNAL_FINANCIAL_AUTHORITY_CONTAINED. MORDE se qualquer um voltar a: ler req.body/req.query, chamar
// pool.query (SELECT bank_*), ou chamar o service/repository material — antes de existir subject interno
// autenticado server-side. tenant_id declarado pelo cliente NÃO é autoridade (DECISION-0113). Estático.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const CONTAINED = [
  'src/modules/freezes/financial-freeze.controller.ts',
  'src/modules/governance/governance-proposal.controller.ts',
  'src/modules/treasury/treasury-account.controller.ts',
  'src/modules/audit/financial-audit-export.controller.ts',
  'src/modules/observability/financial-simulator.controller.ts',
  'src/modules/observability/financial-dashboard.controller.ts',
  'src/modules/observability/financial-operations-panel.controller.ts',
];

// padrões PROIBIDOS num controller /internal financeiro contido (qualquer um = vazou a contenção)
const FORBIDDEN = [
  [/req\.body/, 'lê req.body (entrada de cliente)'],
  [/req\.query/, 'lê req.query (entrada de cliente)'],
  [/pool\.query/, 'executa pool.query (acesso a DB/SSOT por HTTP)'],
  [/getClientWithTenant/, 'abre client de DB por HTTP'],
  [/create(Freeze|Proposal|TreasuryAccount|FinancialAlert)\s*\(/, 'chama writer material'],
  [/(listActiveFreezesFiltered|listOpenProposals|listTreasuryAccounts|voteProposal|releaseFreeze|cancelFreeze)\s*\(/, 'chama service/repo material'],
  [/bankTransactionService|paymentExecutionService|bankAccountService/, 'chama service de banco'],
];

for (const rel of CONTAINED) {
  const src = read(rel);
  if (src === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  if (!/INTERNAL_FINANCIAL_AUTHORITY_CONTAINED/.test(src)) failures.push(`${rel}: sem código de contenção INTERNAL_FINANCIAL_AUTHORITY_CONTAINED.`);
  if (!/status\(501\)/.test(src)) failures.push(`${rel}: não retorna 501 (contenção fail-closed ausente).`);
  for (const [re, why] of FORBIDDEN) {
    if (re.test(src)) failures.push(`${rel}: ${why} — a contenção vazou (deveria ser 501 puro até subject server-side).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [internal-financial-authority-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [internal-financial-authority-containment] — 7 controllers /internal financeiros contidos a 501 (sem req.body/req.query/pool.query/service material); tenant_id de cliente não é autoridade (DECISION-0113). Superfície HTTP insegura desligada até subject interno server-side.');
