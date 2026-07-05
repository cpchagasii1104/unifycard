#!/usr/bin/env node
// Guard estrutural — DT-RAW-POOL-RLS-ACCESS-INHERITS-STALE-GUC (achado N4 da re-auditoria
// adversarial rodada 2, 2026-07-02; parcialmente corrigido D_FIX Onda 2, 2026-07-05).
//
// pool.query/pool.connect cru em tabelas com RLS+FORCE herda GUC stale (app.current_tenant/
// app.is_platform_admin) de um uso anterior da mesma conexão física — corrigido pra
// runQueryWithTenant/runQueriesWithTenant nos 2 pontos de superfície viva confirmados:
//   - actor-bank-destination.service.ts (6 call sites, tabela actor_bank_destinations)
//   - product-offering.service.ts::updateOwnOffer (product_offers, RLS+FORCE — o mais grave,
//     UPDATE sem RETURNING podia ser no-op silencioso sob GUC stale)
// `categories` (leitura crua também citada na dívida) NÃO tem RLS — risco zero, intocado por
// desenho (fixá-lo seria churn sem redução de risco real).
//
// MORDE se pool.query/pool.connect cru reaparecer nesses 2 arquivos. Heurística textual
// comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const ABD = join(ROOT, 'src', 'modules', 'wallet', 'actor-bank-destination.service.ts');
if (!existsSync(ABD)) {
  failures.push(`arquivo ausente: ${ABD}`);
} else {
  const src = stripTs(readFileSync(ABD, 'utf8'));
  if (/\bpool\.(query|connect)\(/.test(src)) {
    failures.push(`${ABD}: pool.query/connect cru reapareceu — reabre DT-RAW-POOL-RLS-ACCESS-INHERITS-STALE-GUC.`);
  }
  if (!/runQueryWithTenant/.test(src) || !/runQueriesWithTenant/.test(src)) {
    failures.push(`${ABD}: runQueryWithTenant/runQueriesWithTenant ausentes — fix não está mais presente.`);
  }
}

const PO = join(ROOT, 'src', 'modules', 'marketplace', 'product-offering.service.ts');
if (!existsSync(PO)) {
  failures.push(`arquivo ausente: ${PO}`);
} else {
  const src = stripTs(readFileSync(PO, 'utf8'));
  const fnStart = src.indexOf('async updateOwnOffer(');
  const fnBody = fnStart >= 0 ? src.slice(fnStart, fnStart + 1800) : '';
  if (!fnBody) {
    failures.push(`${PO}: updateOwnOffer não encontrado.`);
  } else {
    if (/\bpool\.query\(/.test(fnBody)) {
      failures.push(`${PO}: updateOwnOffer voltou a usar pool.query cru contra product_offers (RLS+FORCE).`);
    }
    if (!/RETURNING id/.test(fnBody)) {
      failures.push(`${PO}: updateOwnOffer perdeu o RETURNING id — reabre risco de UPDATE no-op silencioso sob GUC stale.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [raw-pool-rls-access-stale-guc-fix]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [raw-pool-rls-access-stale-guc-fix] — actor-bank-destination.service.ts e product-offering.service.ts::updateOwnOffer usam tenant-context real; UPDATE em product_offers detecta no-op via RETURNING.');
