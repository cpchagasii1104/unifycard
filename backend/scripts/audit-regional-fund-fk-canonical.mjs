#!/usr/bin/env node
// Guard estrutural — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 2 (DECISION-0166 D3, fatia 2e).
//
// Trava a geografia CANÔNICA POR FK do fundo regional contra regressão:
//   (A) SUBSTRATO: migration 2a com regional_fund_accounts (FKs compostas hierárquicas, UNIQUE
//       NULLS NOT DISTINCT por escopo, UNIQUE bank_account_id) e SEM coluna de saldo.
//   (B) RESOLVER: ensureRegionalFundAccount existe no Bank, resolve por regional_fund_accounts,
//       recusa neighborhood (HOLD D4); o SINK STRING (ensureRegionalFundBankAccountForRegion /
//       regionKey 'country-state-city') NÃO pode voltar.
//   (C) CAMINHO VIVO: resolver regional do pipeline canônico usa o ensure por FK e NÃO degrada
//       IDs para string (iso/abbreviation/nome como chave).
//   (D) ANTI-RECRIAÇÃO: nenhuma migration posterior recria regional_funds/regional_fund_allocations;
//       nenhum código vivo lê/escreve nelas; saldo em coluna (total_balance_cents) não volta.
//   (E) TOMBSTONE: regional-fund.service segue fail-closed (REGIONAL_FUNDS_RETIRED) e o
//       repository do trilho morto não existe.
// MORDE em qualquer retorno da geografia-string como chave financeira. stripComments OBRIGATÓRIO
// (TS e SQL) — comentário não é prova. Heurística textual; NÃO altera runtime.
// Em validate:regression-guards via agregador audit-legacy-service-availability-containment-suite.mjs.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const readTs = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const readSql = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripSql(readFileSync(p, 'utf-8')) : null; };
const need = (src, file, re, why) => { if (src === null) { failures.push(`arquivo ausente: ${file}`); return; } if (!re.test(src)) failures.push(`${file}: ${why}`); };
const forbid = (src, file, re, why) => { if (src !== null && re.test(src)) failures.push(`${file}: ${why}`); };

// ── (A) substrato 2a ──
const MA = 'migrations/20260710100000_create_regional_fund_accounts.sql';
const ma = readSql(MA);
need(ma, MA, /CREATE TABLE IF NOT EXISTS regional_fund_accounts/, 'tabela regional_fund_accounts ausente (2a revertida).');
need(ma, MA, /UNIQUE NULLS NOT DISTINCT\s*\(tenant_id, scope_level, country_id, state_id, city_id, neighborhood_id\)/, 'UNIQUE por escopo territorial (NULLS NOT DISTINCT) sumiu.');
need(ma, MA, /fk_rfa_city FOREIGN KEY \(state_id, city_id\)/, 'FK composta hierárquica (state,city)→cities sumiu — geografia cruzada deixaria de ser barrada.');
need(ma, MA, /uq_rfa_bank_account UNIQUE \(bank_account_id\)/, 'UNIQUE(bank_account_id) sumiu — uma conta poderia servir 2 escopos.');
forbid(ma, MA, /balance|total_.*cents|amount_cents/i, 'coluna de saldo apareceu em regional_fund_accounts — bank_ledger deixaria de ser a única verdade.');

// ── (B) resolver por FK no Bank + sink string morto ──
const BA = 'src/modules/bank/bank-account.service.ts';
const ba = readTs(BA);
need(ba, BA, /async ensureRegionalFundAccount\(/, 'ensureRegionalFundAccount (resolver por FK) ausente.');
need(ba, BA, /FROM regional_fund_accounts/, 'resolver não consulta regional_fund_accounts — a FK deixou de ser a verdade.');
need(ba, BA, /REGIONAL_FUND_NEIGHBORHOOD_HOLD/, 'recusa fail-closed de neighborhood (HOLD D4) sumiu.');
forbid(ba, BA, /async ensureRegionalFundBankAccountForRegion\(/, 'SINK STRING ensureRegionalFundBankAccountForRegion voltou.');
forbid(ba, BA, /\$\{region\.country\}-\$\{region\.state\}-\$\{region\.city\}/, 'chave financeira country-state-city (regionKey string) voltou.');

// ── (C) caminho vivo sem degradação ──
const SPE = 'src/modules/services/service-payment-execution.service.ts';
const spe = readTs(SPE);
need(spe, SPE, /ensureRegionalFundAccount\(/, 'resolver regional do pipeline não usa o ensure por FK.');
forbid(spe, SPE, /resolveCountryStateCityFromAddress/, 'função de degradação FK→string reapareceu no pipeline.');
forbid(spe, SPE, /iso_alpha2|abbreviation AS state_code/, 'lookup de códigos/nomes (degradação) reapareceu no resolver regional.');
forbid(spe, SPE, /ensureRegionalFundBankAccountForRegion\(/, 'pipeline voltou a chamar o sink string.');

// ── (D) anti-recriação do trilho paralelo ──
const DROP_MIG = '20260710110000';
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql') && f > `${DROP_MIG}_z`)) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (/CREATE TABLE (IF NOT EXISTS )?regional_funds\b/.test(src)) failures.push(`migrations/${f}: recria a tabela paralela regional_funds.`);
  if (/CREATE TABLE (IF NOT EXISTS )?regional_fund_allocations\b/.test(src)) failures.push(`migrations/${f}: recria regional_fund_allocations.`);
  if (/regional_fund_accounts[\s\S]{0,400}(total_balance_cents|balance_cents)/.test(src)) failures.push(`migrations/${f}: adiciona coluna de saldo a regional_fund_accounts.`);
}
function walkTs(dir, out = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walkTs(full, out);
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
for (const f of walkTs(join(ROOT, 'src'))) {
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/(FROM|INTO|UPDATE)\s+regional_funds\b/.test(src)) failures.push(`${f.replace(ROOT, '.')}: código vivo lê/escreve a tabela paralela regional_funds (excisada na 2d).`);
  if (/(FROM|INTO|UPDATE)\s+regional_fund_allocations\b/.test(src)) failures.push(`${f.replace(ROOT, '.')}: código vivo usa regional_fund_allocations (excisada na 2d).`);
  if (/total_balance_cents/.test(src)) failures.push(`${f.replace(ROOT, '.')}: total_balance_cents (saldo em coluna fora do bank_ledger) reapareceu.`);
}

// ── (E) tombstone íntegro ──
const RF = 'src/modules/marketplace/regional-fund.service.ts';
const rf = readTs(RF);
need(rf, RF, /REGIONAL_FUNDS_RETIRED/, 'tombstone perdeu o fail-closed REGIONAL_FUNDS_RETIRED.');
forbid(rf, RF, /regional-fund\.repository|regionalFundRepository/, 'tombstone voltou a importar o repository do trilho morto.');
if (existsSync(join(ROOT, 'src/modules/marketplace/regional-fund.repository.ts'))) {
  failures.push('src/modules/marketplace/regional-fund.repository.ts: repository do trilho paralelo RESSUSCITADO.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [regional-fund-fk-canonical]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [regional-fund-fk-canonical] — DECISION-0166 D3 travada: fundo regional por FK canônica (regional_fund_accounts com hierarquia material + UNIQUE por escopo, sem coluna de saldo), resolver ensureRegionalFundAccount (neighborhood HOLD), pipeline sem degradação FK→string, sink string morto, trilho paralelo regional_funds/allocations excisado sem recriação, tombstone fail-closed.');
