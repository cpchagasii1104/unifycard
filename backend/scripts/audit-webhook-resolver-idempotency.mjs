#!/usr/bin/env node
// Guard — F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1 (#35 da Matriz Consolidada Camada 1).
//
// Invariante: o caminho webhook PIX → payment-event-resolver → bank transaction é IDEMPOTENTE por
// (tenant_id, reference_type, reference_id) — uma 2ª entrega do mesmo evento NÃO duplica efeito financeiro.
// O dedup é estrutural (advisory lock + SELECT FOR UPDATE por referência + constraint UNIQUE + ON CONFLICT
// na ingestão), NÃO disciplina de caller. Inclui o D1 (DECISION-0154): caminho GHOST SPRINT-85
// (/webhooks/pix/:provider + tabela pix_webhook_events) DESCARTADO; canônico vivo = /gateway/pix/webhook.
//
// MORDE (exit 1) se:
//   (1) bank-transaction.service.transfer perder o advisory lock por (tenant, ref_type, ref_id);
//   (2) transfer perder o SELECT FOR UPDATE de idempotência por (reference_type, reference_id);
//   (3) transfer perder o tratamento de unique-violation (23505) com retorno idempotente;
//   (4) transfer/resolver perder o hard-fail BANK_REFERENCE_REQUIRED (dedup sem chave = caller discipline);
//   (5) a migration `uq_bank_transactions_reference` (tenant_id, reference_type, reference_id) sumir;
//   (6) a ingestão canônica (gateway-webhook-repository) perder ON CONFLICT (provider, reference_id);
//   (7) o resolver deixar de passar referenceType/referenceId ao transfer (dedup keyed);
//   (8) ALGUMA migration criar a tabela `pix_webhook_events` (revival do ghost SPRINT-85);
//   (9) app.builder voltar a registrar pixWebhookRoutes / /webhooks/pix (revival do ghost);
//  (10) pix.routes voltar a exportar pixWebhookRoutes (revival do ghost);
//  (11) o webhook canônico /gateway/pix/webhook (pix-webhook.controller) sumir do app.builder.
// Integrado em validate:regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf-8') : null);
const norm = (s) => s.replace(/\s+/g, ' '); // colapsa whitespace p/ matar quebras de linha em SQL multilinha
const failures = [];

// ── (A) Dedup financeiro: bank-transaction.service.transfer ────────────────────────────
const TX = 'src/modules/bank/bank-transaction.service.ts';
const tx = read(TX);
if (tx === null) {
  failures.push(`${TX}: ausente (chokepoint de idempotência financeira por referência).`);
} else {
  const txn = norm(tx);
  // (1) advisory lock por (tenant, refType, refId)
  if (!/pg_advisory_xact_lock\s*\(\s*hashtext\(\s*\$1::text\s*\)\s*,\s*hashtext\(\s*\(\s*\$2\s*\|\|\s*\$3\s*\)::text\s*\)\s*\)/.test(txn)) {
    failures.push(`${TX}: perdeu o advisory lock pg_advisory_xact_lock(hashtext(tenant), hashtext(refType||refId)) — serialização da idempotência por referência.`);
  }
  // (2) SELECT FOR UPDATE de idempotência por (reference_type, reference_id)
  if (!/FROM bank_transactions WHERE tenant_id = \$1 AND reference_type = \$2 AND reference_id = \$3 LIMIT 1 FOR UPDATE/.test(txn)) {
    failures.push(`${TX}: perdeu o SELECT ... reference_type=$2 AND reference_id=$3 ... FOR UPDATE — short-circuit idempotente antes do INSERT.`);
  }
  // (3) tratamento de unique-violation (23505) com retorno idempotente
  if (!/function isUniqueViolation/.test(tx) || !/['"]23505['"]/.test(tx)) {
    failures.push(`${TX}: perdeu a detecção de unique_violation (23505) — constraint uq_bank_transactions_reference não seria absorvida idempotentemente.`);
  }
  if (!/if\s*\(\s*isUniqueViolation\(\s*insertErr\s*\)\s*\)/.test(tx)) {
    failures.push(`${TX}: perdeu o ramo isUniqueViolation(insertErr) — corrida de 2ª entrega não retornaria a transação existente.`);
  }
  // (4) hard-fail sem chave de referência
  if (!/BANK_REFERENCE_REQUIRED/.test(tx)) {
    failures.push(`${TX}: perdeu BANK_REFERENCE_REQUIRED — transfer aceitaria escrita sem chave de dedup (caller discipline).`);
  }
  // (anti intent_type/metadata como chave de dedup): o dedup deve ser por reference_type/reference_id, não metadata
  if (/reference_type\s*=\s*\$\d[\s\S]{0,40}metadata\s*->/.test(txn)) {
    failures.push(`${TX}: dedup aparentemente derivado de metadata — chave de idempotência deve ser (reference_type, reference_id) determinística.`);
  }
}

// ── (B) Constraint de banco: uq_bank_transactions_reference ────────────────────────────
let constraintFound = false;
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir)) {
  if (!f.endsWith('.sql')) continue;
  const sql = norm(readFileSync(join(migDir, f), 'utf-8'));
  if (/CREATE UNIQUE INDEX[^;]*uq_bank_transactions_reference[^;]*ON bank_transactions\s*\(\s*tenant_id\s*,\s*reference_type\s*,\s*reference_id\s*\)/i.test(sql)) {
    constraintFound = true;
    break;
  }
}
if (!constraintFound) {
  failures.push(`migrations/: UNIQUE INDEX uq_bank_transactions_reference (tenant_id, reference_type, reference_id) ausente — sem ela o dedup vira best-effort.`);
}

// ── (C) Dedup de ingestão: gateway-webhook-repository ──────────────────────────────────
const WHK = 'src/modules/gateway/gateway-webhook-repository.ts';
const whk = read(WHK);
if (whk === null) {
  failures.push(`${WHK}: ausente (idempotência de ingestão de webhook).`);
} else if (!/ON CONFLICT\s*\(\s*provider\s*,\s*reference_id\s*\)\s*DO NOTHING/i.test(norm(whk))) {
  failures.push(`${WHK}: perdeu ON CONFLICT (provider, reference_id) DO NOTHING — webhook duplicado seria re-enfileirado.`);
}

// ── (D) Resolver passa a chave de dedup ao transfer ────────────────────────────────────
const RES = 'src/modules/gateway/payment-event-resolver.ts';
const res = read(RES);
if (res === null) {
  failures.push(`${RES}: ausente (consumidor de evento de pagamento).`);
} else {
  if (!/referenceType:\s*refType/.test(res) || !/referenceId:\s*refId/.test(res)) {
    failures.push(`${RES}: transfer não recebe referenceType/referenceId — perderia a chave de idempotência por referência.`);
  }
  if (!/BANK_REFERENCE_REQUIRED/.test(res)) {
    failures.push(`${RES}: perdeu BANK_REFERENCE_REQUIRED — aceitaria evento sem chave de referência.`);
  }
}

// ── (E) D1 anti-revival: ghost SPRINT-85 não pode voltar ───────────────────────────────
for (const f of readdirSync(migDir)) {
  if (!f.endsWith('.sql')) continue;
  const sql = norm(readFileSync(join(migDir, f), 'utf-8'));
  if (/CREATE TABLE[^;]*\bpix_webhook_events\b/i.test(sql)) {
    failures.push(`migrations/${f}: cria a tabela pix_webhook_events — REVIVAL do ghost SPRINT-85 (D1 DISCARD, DECISION-0154). Exige decisão.`);
  }
}
const builder = read('src/app.builder.ts');
if (builder === null) {
  failures.push('src/app.builder.ts: ausente.');
} else {
  const b = builder;
  // strip comentários de linha p/ não confundir os breadcrumbs de DISCARD com registro vivo
  const bCode = b.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1');
  if (/\bregister\s*\(\s*pixWebhookRoutes\b/.test(bCode) || /import\([^)]*pix\.routes[^)]*\)[\s\S]{0,120}pixWebhookRoutes/.test(bCode)) {
    failures.push('src/app.builder.ts: registra pixWebhookRoutes (/webhooks/pix) — REVIVAL do ghost SPRINT-85 (D1 DISCARD).');
  }
  // (11) webhook canônico vivo deve permanecer
  if (!/pix-webhook\.controller/.test(b) || !/\/gateway/.test(b)) {
    failures.push('src/app.builder.ts: perdeu o registro do webhook canônico /gateway/pix/webhook (pix-webhook.controller) — caminho vivo de ingestão.');
  }
}
const pixRoutes = read('src/modules/payments/pix.routes.ts');
if (pixRoutes !== null) {
  const prCode = pixRoutes.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1');
  if (/export\s+const\s+pixWebhookRoutes\b/.test(prCode)) {
    failures.push('src/modules/payments/pix.routes.ts: re-exporta pixWebhookRoutes — REVIVAL do ghost SPRINT-85 (D1 DISCARD).');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [webhook-resolver-idempotency]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  '[webhook-resolver-idempotency] transfer: advisory lock + SELECT FOR UPDATE por (reference_type,reference_id) + 23505 idempotente + BANK_REFERENCE_REQUIRED; ' +
  'constraint uq_bank_transactions_reference viva; ingestão ON CONFLICT(provider,reference_id); resolver passa a chave; ' +
  'D1: ghost SPRINT-85 (pix_webhook_events / /webhooks/pix / pixWebhookRoutes) DESCARTADO e sem revival; canônico /gateway/pix/webhook vivo.'
);
console.log('GATE OK [webhook-resolver-idempotency] — replay/dedup do caminho webhook→resolver→bank estrutural (Δbank=0 na 2ª entrega).');
