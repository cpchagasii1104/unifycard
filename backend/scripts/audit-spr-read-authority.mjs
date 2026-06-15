#!/usr/bin/env node
// Guard estrutural — F-C1-MONEY-SPR-READ-AUTHORITY-HARDENING (DECISION-0113 · ONDA 0131 C1_MONEY).
// Trava a autoridade de LEITURA de service-payment-request: os 2 GET money-adjacent devem exigir, server-side,
// que req.user REPRESENTE o payer OU o receiver (canRepresentActor sobre payerActorId/receiverActorId) e negar
// 403 caso contrário. tenant_id/actionContext não autorizam sozinhos. FALHA se qualquer GET perder o binding.
// NÃO cobre o POST create (decisão de produto pendente — ver DT). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Cada GET de leitura money-adjacent deve provar representabilidade do payer OU receiver.
const READ_SURFACES = [
  { rel: 'src/modules/services/service-payment-request.routes.ts', what: 'GET /:serviceId/bookings/:bookingId/payments' },
  { rel: 'src/modules/services/service-payment-execution.routes.ts', what: 'GET /:paymentRequestId/execution' },
];

function runGuard() {
  const failures = [];
  for (const { rel, what } of READ_SURFACES) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel} (${what}).`); continue; }
    const code = stripComments(readFileSync(p, 'utf-8'));
    if (!/\bcanRepresentActor\s*\(/.test(code)) {
      failures.push(`${rel} (${what}) perdeu o binding canRepresentActor — leitura money-adjacent sem autoridade server-side (DECISION-0113).`);
    }
    if (!/payerActorId/.test(code) || !/receiverActorId/.test(code)) {
      failures.push(`${rel} (${what}) deixou de resolver payer/receiver (payerActorId/receiverActorId) — owner da relação financeira não derivado.`);
    }
    if (!/\.status\(\s*403\s*\)/.test(code)) {
      failures.push(`${rel} (${what}) perdeu o 403 fail-closed — sem representar payer/receiver deve negar.`);
    }
  }
  if (failures.length > 0) {
    console.error('GATE FAIL [spr-read-authority]:');
    failures.forEach((f) => console.error('  ❌ ' + f));
    process.exit(1);
  }
  console.log('[spr-read-authority] 2 GET money-adjacent com binding: canRepresentActor sobre payer/receiver + 403 fail-closed.');
  console.log('GATE OK [spr-read-authority] — leitura de service-payment-request exige representar payer OU receiver (DECISION-0113); tenant/actionContext não autorizam.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
