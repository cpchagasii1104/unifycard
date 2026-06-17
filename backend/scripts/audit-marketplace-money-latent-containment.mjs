#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// Sela a contenção EXPLÍCITA das 6 rotas money-latent A1–A6 (settlement/regionAccount/unifycard):
//   A1 POST /marketplace/settlements/:id/settle
//   A2 POST /marketplace/regions/:id/account/credit
//   A3 POST /marketplace/regions/:id/account/debit
//   A4 POST /marketplace/unifycard/authorize
//   A5 POST /marketplace/unifycard/capture
//   A6 POST /marketplace/unifycard/settle
// Hoje os sinks morrem por Proxy ("migrated to Bank"); a contenção foi tornada EXPLÍCITA (403
// fail-closed no edge) para que religar o Bank sem gate de authority não ressuscite autoria
// spoofável (actionContext.actorId cru).
//
// MORDE se:
//   - faltar o code de contenção (_HTTP_EXECUTION_DISABLED) em qualquer um dos 3 sub-domínios;
//   - uma rota voltar a CHAMAR o sink de mutação (settlementService.settle / regionAccountService
//     .credit|.debit / unifyCardService.authorize|.capture|.settle) — alcançável de novo;
//   - uma rota money-latent importar/escrever Bank diretamente (bank_ledger/bank_transactions/bank_splits);
//   - o stub Proxy "migrated to Bank" for removido de settlement/region-account/unifycard.service
//     (relink do Bank sem gate explícito).
//
// Heurística file-level (não AST). Escopado às rotas/serviços marketplace money-latent (contenção
// localizada; NÃO religa Bank, NÃO fecha DT-mãe 0113). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Strip de comentários (evita `://` em urls via [^:"'`]) — line comments + block comments.
const stripTs = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const readStripped = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) {
    failures.push(`arquivo ausente: ${rel}`);
    return null;
  }
  return stripTs(readFileSync(p, 'utf-8'));
};

const SETTLEMENT_ROUTES = 'src/modules/marketplace/settlement.routes.ts';
const UNIFYCARD_ROUTES = 'src/modules/marketplace/unifycard.routes.ts';

// ── settlement.routes.ts (A1/A2/A3) ───────────────────────────────────────────────────────
const sr = readStripped(SETTLEMENT_ROUTES);
if (sr !== null) {
  // REQUIRE: códigos de contenção presentes.
  if (!/SETTLEMENT_HTTP_EXECUTION_DISABLED/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: DEVE conter o code de contenção SETTLEMENT_HTTP_EXECUTION_DISABLED.`);
  }
  if (!/REGION_ACCOUNT_HTTP_EXECUTION_DISABLED/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: DEVE conter o code de contenção REGION_ACCOUNT_HTTP_EXECUTION_DISABLED.`);
  }
  // REQUIRE: 403 fail-closed para settle + credit + debit.
  if (!/reply\.status\(\s*403\s*\)\.send\(\s*SETTLEMENT_HTTP_EXECUTION_DISABLED\s*\)/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: /settlements/:id/settle DEVE retornar reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED).`);
  }
  const regionSends = (sr.match(/reply\.status\(\s*403\s*\)\.send\(\s*REGION_ACCOUNT_HTTP_EXECUTION_DISABLED\s*\)/g) || []).length;
  if (regionSends < 2) {
    failures.push(`${SETTLEMENT_ROUTES}: credit E debit DEVEM retornar reply.status(403).send(REGION_ACCOUNT_HTTP_EXECUTION_DISABLED) (encontrado=${regionSends}, esperado≥2).`);
  }
  // FORBID: sinks de mutação alcançáveis.
  if (/settlementService\.settle\s*\(/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: PROIBIDO — settlementService.settle(...) alcançável pela rota (sink money-latent religado sem gate).`);
  }
  if (/regionAccountService\.credit\s*\(/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: PROIBIDO — regionAccountService.credit(...) alcançável pela rota.`);
  }
  if (/regionAccountService\.debit\s*\(/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: PROIBIDO — regionAccountService.debit(...) alcançável pela rota.`);
  }
  // FORBID: Bank direto.
  if (/bank_ledger|bank_transactions|bank_splits/.test(sr)) {
    failures.push(`${SETTLEMENT_ROUTES}: PROIBIDO — referência direta a bank_ledger/bank_transactions/bank_splits na rota money-latent.`);
  }
}

// ── unifycard.routes.ts (A4/A5/A6) ─────────────────────────────────────────────────────────
const ur = readStripped(UNIFYCARD_ROUTES);
if (ur !== null) {
  if (!/UNIFYCARD_HTTP_EXECUTION_DISABLED/.test(ur)) {
    failures.push(`${UNIFYCARD_ROUTES}: DEVE conter o code de contenção UNIFYCARD_HTTP_EXECUTION_DISABLED.`);
  }
  const ucSends = (ur.match(/reply\.status\(\s*403\s*\)\.send\(\s*UNIFYCARD_HTTP_EXECUTION_DISABLED\s*\)/g) || []).length;
  if (ucSends < 3) {
    failures.push(`${UNIFYCARD_ROUTES}: authorize/capture/settle DEVEM retornar reply.status(403).send(UNIFYCARD_HTTP_EXECUTION_DISABLED) (encontrado=${ucSends}, esperado≥3).`);
  }
  if (/unifyCardService\.authorize\s*\(/.test(ur)) {
    failures.push(`${UNIFYCARD_ROUTES}: PROIBIDO — unifyCardService.authorize(...) alcançável pela rota.`);
  }
  if (/unifyCardService\.capture\s*\(/.test(ur)) {
    failures.push(`${UNIFYCARD_ROUTES}: PROIBIDO — unifyCardService.capture(...) alcançável pela rota.`);
  }
  if (/unifyCardService\.settle\s*\(/.test(ur)) {
    failures.push(`${UNIFYCARD_ROUTES}: PROIBIDO — unifyCardService.settle(...) alcançável pela rota.`);
  }
  if (/bank_ledger|bank_transactions|bank_splits/.test(ur)) {
    failures.push(`${UNIFYCARD_ROUTES}: PROIBIDO — referência direta a bank_ledger/bank_transactions/bank_splits na rota money-latent.`);
  }
}

// ── Stubs Proxy (morde se "migrated to Bank" removido = relink sem gate) ────────────────────
const STUBS = [
  'src/modules/marketplace/settlement.service.ts',
  'src/modules/marketplace/region-account.service.ts',
  'src/modules/marketplace/unifycard.service.ts',
];
for (const rel of STUBS) {
  const code = readStripped(rel);
  if (code !== null && !/migrated to Bank/.test(code)) {
    failures.push(`${rel}: PROIBIDO — stub Proxy "migrated to Bank" removido sem gate de authority (relink do Bank exige frente própria: decisão + binding + Bank canônico + E2E + reseal Yala).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [marketplace-money-latent-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [marketplace-money-latent-containment] — A1–A6 contidas (403 fail-closed); sinks money-latent inalcançáveis; stubs Proxy intactos; Bank não tocado.');
