#!/usr/bin/env node
// Guard estrutural — F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX (achado colateral da
// auditoria Yala do decision pack PORTA-1, 2026-07-05).
//
// isFinancialEnabled() (core/features/feature-flags.ts) delegava a isFeatureEnabled(), um helper
// GENÉRICO fail-OPEN (retorna true quando a env var está ausente) — correto pras outras 3 flags
// do arquivo (RFQ/Bundles/Messaging, não-financeiras), ERRADO pra esta: o único caller
// (POST /service-orders/:id/confirm-financial-terms) grava bank_splits DIRETO, e o comentário da
// rota declarava (falsamente) "atrás de isFinancialEnabled() → 503, inalcançável por ora" — a
// superfície só não escrevia por acidente de tipo (transactionId fictício não-UUID batendo em
// 22P02 antes do INSERT), não por design. MORDE se:
//   (a) isFinancialEnabled() voltar a delegar a isFeatureEnabled('FEATURE_FINANCIAL_ENABLED')
//       (reintroduz fail-open);
//   (b) isFinancialEnabled() parar de exigir a string exata 'true' (fail-open por '1'/'TRUE'/etc).
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'features', 'feature-flags.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  const idx = src.indexOf('function isFinancialEnabled');
  if (idx < 0) {
    failures.push(`${FILE}: isFinancialEnabled não encontrada.`);
  } else {
    // Janela curta — só o corpo da própria função, não a próxima (isMessagingEnabled legitimamente
    // chama isFeatureEnabled logo em seguida no mesmo arquivo).
    const body = src.slice(idx, idx + 120);
    if (/isFeatureEnabled\(/.test(body)) {
      failures.push(`${FILE}: isFinancialEnabled voltou a delegar a isFeatureEnabled (helper genérico fail-OPEN) — reabre o achado da auditoria Yala.`);
    }
    if (!/process\.env\.FEATURE_FINANCIAL_ENABLED === 'true'/.test(body)) {
      failures.push(`${FILE}: isFinancialEnabled não exige a string exata 'true' — risco de fail-open por '1'/'TRUE'/etc.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [service-order-confirm-terms-financial-flag-failclosed]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log("GATE OK [service-order-confirm-terms-financial-flag-failclosed] — isFinancialEnabled() é fail-closed real (=== 'true' exato), não delega mais ao helper genérico fail-open. Achado da auditoria Yala fechado.");
