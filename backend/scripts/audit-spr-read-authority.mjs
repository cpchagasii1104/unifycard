#!/usr/bin/env node
// Guard estrutural — F-C1-MONEY-SPR-{READ,CREATE}-AUTHORITY-HARDENING (DECISION-0113 · ONDA 0131 C1_MONEY).
// LEITURA: os 2 GET money-adjacent devem exigir, server-side, que req.user REPRESENTE payer OU receiver
//   (canRepresentActor sobre payerActorId/receiverActorId) e negar 403; tenant_id/actionContext não autorizam.
// CRIAÇÃO (Opção A, decisão de produto Clayton): o POST create exige que o emissor REPRESENTE o RECEIVER
//   derivado do SERVICE (service.actorId); payer/receiver derivados server-side (service/booking), NUNCA do body.
// FALHA se qualquer GET perder o binding, OU o POST create perder canRepresentActor / derivação server-side /
// 403, OU voltar a usar body (parsed.data.{payer,receiver}ActorId) como autoridade. Em validate:regression-guards.

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

  // POST create (Opção A): autoridade pelo RECEIVER derivado server-side; body não-autoritativo.
  const sprRel = 'src/modules/services/service-payment-request.routes.ts';
  const sprPath = join(ROOT, sprRel);
  if (existsSync(sprPath)) {
    const full = stripComments(readFileSync(sprPath, 'utf-8'));
    // Recorta o handler do POST create (do 1º fastify.post até o 1º fastify.get).
    const postIdx = full.search(/fastify\.post\b/);
    const getIdx = full.search(/fastify\.get\b/);
    const post = postIdx >= 0 ? full.slice(postIdx, getIdx > postIdx ? getIdx : full.length) : '';
    if (!post) {
      failures.push(`${sprRel}: POST create não encontrado — REGISTRO precisa revisão.`);
    } else {
      if (!/\bcanRepresentActor\s*\(/.test(post)) failures.push(`${sprRel} (POST create) sem canRepresentActor — emissor da cobrança não vinculado ao receiver (Opção A).`);
      if (!/service\.actorId/.test(post)) failures.push(`${sprRel} (POST create) não deriva o receiver de service.actorId (server-side) — receiver não pode vir do body.`);
      if (!/booking\.requesterActorId/.test(post)) failures.push(`${sprRel} (POST create) não deriva o payer de booking.requesterActorId (server-side) — payer não pode vir do body.`);
      if (!/\.status\(\s*403\s*\)/.test(post)) failures.push(`${sprRel} (POST create) perdeu o 403 fail-closed (sem representar o receiver → negar).`);
      if (/(payerActorId|receiverActorId)\s*:\s*parsed\.data\.(payer|receiver)ActorId/.test(post)) {
        failures.push(`${sprRel} (POST create) usa parsed.data.{payer,receiver}ActorId (body) como parte da cobrança — body NÃO é autoridade; derive de service/booking.`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [spr-read-authority]:');
    failures.forEach((f) => console.error('  ❌ ' + f));
    process.exit(1);
  }
  console.log('[spr-read-authority] 2 GET (payer OU receiver) + POST create (receiver derivado, Opção A): canRepresentActor + 403; body não-autoritativo.');
  console.log('GATE OK [spr-read-authority] — leitura exige representar payer/receiver; criação exige representar o RECEIVER derivado (service.actor_id); body/actionContext não autorizam (DECISION-0113).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
