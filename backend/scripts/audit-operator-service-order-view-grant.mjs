#!/usr/bin/env node
// Guard estrutural — F-OPERATOR-SERVICE-ORDER-VIEW-GRANT (2026-06-26).
// Sela a menor fatia material da operação empresarial por capability: um operador/membro com grant
// explícito `service_order:view` consegue LER ordem de serviço daquele provider/actor — sem virar owner,
// sem canActAs genérico, sem referral, sem global admin e SEM tocar dinheiro. Invariantes travados:
//   (A) 'service_order:view' está na allowlist NÃO-financeira (types) E no CHECK efetivo da migration
//       (chk_acg_capability_nonfinancial) E existe no registry vivo permission-keys.ts (DECISION-0136 W1).
//   (B) NENHUMA capability de ESCRITA/estado é concedível (update_status/start/complete/cancel/dispute/
//       refund/payment/payout/settlement/checkout NÃO entram na allowlist nem na migration).
//   (C) Enforcement vive no SERVICE layer: service-order.service.canViewOrderForParty compõe, ADITIVO e
//       fail-closed, canRepresentActor OU hasCapabilityGrant('service_order:view') — match EXATO, money-free.
//   (D) A rota de read (service-order.routes.ts) liga o fallback de grant SÓ no read operacional
//       (GET :id via allowViewGrant) e NÃO no financial-terms; a rota NUNCA chama hasCapabilityGrant /
//       importa o grant service (enforcement em rota é proibido — DECISION-0136/0138).
//   (E) Autoridade não vem de actionContext.actorId cru, de referral, de role visual nem de
//       business-permissions.types.ts; o read path é money-free (sem Bank/payment/payout/settlement/checkout).
// Heurística textual comment-stripped (não AST) — falso positivo torna o gate MAIS restritivo.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const TYPES = join(SRC, 'modules/authority/actor-capability-grant.types.ts');
const PK = join(SRC, 'core/authorization/permission-keys.ts');
const SO_SVC = join(SRC, 'modules/services/service-order.service.ts');
const SO_ROUTES = join(SRC, 'modules/services/service-order.routes.ts');
const MIG_DIR = join(ROOT, 'migrations');

const KEY = 'service_order:view';
// Capabilities de ESCRITA/estado/financeiro que NUNCA podem virar concedíveis nesta frente.
const FORBIDDEN_GRANTABLE = /'service_order:(update_status|start|complete|cancel|dispute|refund|confirm|create)'|'booking:manage'|'(payment|payout|settlement|checkout|split|refund):[a-z_]+'/;
const MONEY_RX = /\b(bank_ledger|bank_transactions|bank_splits|bank_accounts|payment_intent|payment_request|payout|settlement|checkout|bankAccountService|splitService)\b/;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '');
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// (A) allowlist (types) + (B) sem capability de escrita ───────────────────────────────────────────
{
  const raw = read(TYPES);
  must(!!raw, 'OPERATOR_SO_VIEW: actor-capability-grant.types.ts ausente.');
  if (raw) {
    checked++;
    const block = (stripTs(raw).match(/NON_FINANCIAL_CAPABILITY_ALLOWLIST[\s\S]*?\]/) || [''])[0];
    must(block.includes(`'${KEY}'`),
      `OPERATOR_SO_VIEW: '${KEY}' ausente da NON_FINANCIAL_CAPABILITY_ALLOWLIST (types) — grant não concedível.`);
    must(!FORBIDDEN_GRANTABLE.test(block),
      'OPERATOR_SO_VIEW: allowlist (types) contém capability de ESCRITA/estado/financeira (proibido — só leitura).');
    must(!MONEY_RX.test(block),
      'OPERATOR_SO_VIEW: allowlist (types) contém substrato financeiro (proibido).');
  }
}

// (A) CHECK efetivo da migration (última que (re)define a allowlist) ────────────────────────────────
{
  const files = existsSync(MIG_DIR)
    ? readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort()
    : [];
  let effectiveBlock = '';
  let effectiveFile = '';
  for (const f of files) {
    const sql = stripSql(read(join(MIG_DIR, f)) || '');
    const m = sql.match(/chk_acg_capability_nonfinancial CHECK \([\s\S]*?\)\s*\)/g);
    if (m && m.length) { effectiveBlock = m[m.length - 1]; effectiveFile = f; }
  }
  checked++;
  must(!!effectiveBlock,
    'OPERATOR_SO_VIEW: nenhuma migration define chk_acg_capability_nonfinancial (allowlist física ausente).');
  if (effectiveBlock) {
    must(effectiveBlock.includes(`'${KEY}'`),
      `OPERATOR_SO_VIEW: CHECK efetivo (${effectiveFile}) NÃO contém '${KEY}' — trava física desalinhada da allowlist.`);
    must(!FORBIDDEN_GRANTABLE.test(effectiveBlock),
      `OPERATOR_SO_VIEW: CHECK efetivo (${effectiveFile}) contém capability de ESCRITA/estado/financeira (proibido).`);
    must(!MONEY_RX.test(effectiveBlock),
      `OPERATOR_SO_VIEW: CHECK efetivo (${effectiveFile}) contém substrato financeiro (proibido).`);
  }
}

// (A) registry vivo permission-keys.ts contém a key (CHECK ≠ registry paralelo) ─────────────────────
{
  const pk = read(PK);
  must(!!pk, 'OPERATOR_SO_VIEW: permission-keys.ts ausente.');
  if (pk) {
    checked++;
    must(pk.includes(`'${KEY}'`),
      `OPERATOR_SO_VIEW: '${KEY}' não existe em permission-keys.ts (registry vivo) — DECISION-0136 W1.`);
  }
}

// (C) Enforcement no SERVICE layer: canViewOrderForParty aditivo, exato, money-free ─────────────────
{
  const raw = read(SO_SVC);
  must(!!raw, 'OPERATOR_SO_VIEW: service-order.service.ts ausente.');
  if (raw) {
    checked++;
    const code = stripTs(raw);
    const body = sliceMethod(code, 'async canViewOrderForParty(');
    must(!!body,
      'OPERATOR_SO_VIEW: service-order.service.ts perdeu canViewOrderForParty (autoridade de leitura no service).');
    must(/canRepresentActor\(/.test(body),
      'OPERATOR_SO_VIEW: canViewOrderForParty não compõe canRepresentActor (owner/representação nativa ANTES do grant).');
    must(new RegExp(`hasCapabilityGrant\\([^)]*['"]${KEY}['"]`).test(body),
      `OPERATOR_SO_VIEW: canViewOrderForParty não compõe hasCapabilityGrant('${KEY}') — fallback de grant ausente/regrediu.`);
    must(!MONEY_RX.test(body),
      'OPERATOR_SO_VIEW: canViewOrderForParty referencia substrato financeiro (read deve ser money-free).');
    // match EXATO de capability (sem wildcard/prefix) e sem referral.
    must(!/['"]service_order:\*['"]/.test(body) && !/\.startsWith\(\s*['"]service_order:/.test(body),
      'OPERATOR_SO_VIEW: canViewOrderForParty usa wildcard/prefix de capability (match deve ser EXATO).');
    must(!/referral_code/.test(body),
      'OPERATOR_SO_VIEW: canViewOrderForParty usa referral_code (comercial ≠ authority — proibido).');
  }
}

// (D)+(E) Rota de read: fallback de grant SÓ no read operacional; financial-terms estrito; money-free;
//         sem hasCapabilityGrant/grant-service na rota; sem business-permissions como autoridade. ────
{
  const raw = read(SO_ROUTES);
  must(!!raw, 'OPERATOR_SO_VIEW: service-order.routes.ts ausente.');
  if (raw) {
    checked++;
    const code = stripTs(raw);
    // GET :id liga allowViewGrant; helper assertOrderParty entende o opt-in.
    must(/allowViewGrant/.test(code),
      'OPERATOR_SO_VIEW: routes não liga o fallback de grant no read (allowViewGrant ausente).');
    must(/assertOrderParty\(req, reply, tenantId, order, \{ allowViewGrant: true \}\)/.test(code),
      'OPERATOR_SO_VIEW: GET :id não passa { allowViewGrant: true } ao assertOrderParty (read operacional sem fallback).');
    // financial-terms PERMANECE estrito (sem allowViewGrant): grant não estende visão financeira.
    must(/assertOrderParty\(req, reply, tenantId, order\)\)/.test(code),
      'OPERATOR_SO_VIEW: financial-terms deixou de ser PARTE-estrito (não pode herdar allowViewGrant).');
    // GET list usa o caminho aditivo via service (não decide autoridade de grant na rota).
    must(/serviceOrderService\.canViewOrderForParty\(/.test(code),
      'OPERATOR_SO_VIEW: GET list não usa serviceOrderService.canViewOrderForParty (autoridade aditiva no service).');
    // Enforcement em rota é PROIBIDO: nada de hasCapabilityGrant / grant service na rota.
    must(!/hasCapabilityGrant\(/.test(code),
      'OPERATOR_SO_VIEW: routes chama hasCapabilityGrant( — enforcement de capability não vive em rota (DECISION-0136/0138).');
    must(!/actorCapabilityGrantService/.test(code),
      'OPERATOR_SO_VIEW: routes importa actorCapabilityGrantService — grant service não pode aparecer em rota de negócio.');
    // autoridade não vem de role visual paralelo nem de referral.
    must(!/business-permissions|BusinessPermission|BusinessAction/.test(code),
      'OPERATOR_SO_VIEW: routes usa business-permissions.types.ts como autoridade (vocabulário paralelo proibido).');
    must(!/referral_code/.test(code),
      'OPERATOR_SO_VIEW: routes usa referral_code (comercial ≠ authority — proibido).');
    // o read path não pode ganhar substrato financeiro nas janelas de read (GET :id / GET list / helper).
    const idWindow = (code.match(/'\/service-orders\/:id'[\s\S]{0,600}/) || [''])[0];
    must(!MONEY_RX.test(idWindow),
      'OPERATOR_SO_VIEW: read GET :id referencia substrato financeiro (read deve ser money-free).');
  }
}

console.log(`[operator-service-order-view-grant] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [operator-service-order-view-grant]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log(`GATE OK [operator-service-order-view-grant] — '${KEY}' concedível (types+CHECK+registry), só leitura; enforcement aditivo/exato/money-free no service; read operacional liga grant, financial-terms estrito; zero hasCapabilityGrant/grant-service/referral/business-permissions na rota.`);
