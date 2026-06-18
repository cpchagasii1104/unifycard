#!/usr/bin/env node
// Guard estrutural — F-REFERRAL-REGISTER-ACTOR-CODE-GATE (DECISION-0139).
// Cerca de regressão da PORTA DE ENTRADA do cadastro: /auth/check-referral e a pré-validação de
// authService.register DEVEM reconhecer código ACTOR-SCOPED (actor_referral_codes) E o legado
// (users.referral_code) via RESOLVER ÚNICO read-only — na mesma ordem do writer soberano. O writer
// transacional applyReferralCodeTx continua sendo o ÚNICO a materializar user_referral_links.
// MORDE regressão real (não grep decorativo). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const readStripped = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}.`); return null; }
  return stripTs(readFileSync(p, 'utf-8'));
};

const checkFile = (rel, { requires = [], forbids = [] }) => {
  const code = readStripped(rel);
  if (code === null) return;
  for (const { re, msg } of requires) if (!re.test(code)) failures.push(`${rel}: ${msg}`);
  for (const { re, msg } of forbids) if (re.test(code)) failures.push(`${rel}: ${msg}`);
};

// ── 1) RESOLVER ÚNICO read-only (referral.service.ts) ────────────────────────────────────────
const REFERRAL_SVC = 'src/core/referral/referral.service.ts';
const svc = readStripped(REFERRAL_SVC);
if (svc !== null) {
  if (!/resolveReferralCodeCandidate\s*\(/.test(svc)) {
    failures.push(`${REFERRAL_SVC}: resolver único resolveReferralCodeCandidate ausente (porta de entrada actor-scoped).`);
  }
  if (!/FROM\s+actor_referral_codes/i.test(svc)) {
    failures.push(`${REFERRAL_SVC}: resolver deve consultar actor_referral_codes (substrato canônico).`);
  }
  // fail-closed actor_system server-side (recusa owner system mesmo p/ linha crua).
  if (!/actor_type\s+NOT\s+IN\s*\(\s*'system'\s*,\s*'actor_system'\s*\)/i.test(svc)) {
    failures.push(`${REFERRAL_SVC}: resolver deve recusar owner actor_system server-side (actor_type NOT IN ('system','actor_system')).`);
  }
  // ORDEM: actor_referral_codes ANTES do fallback legado users.referral_code (mesma ordem do writer).
  const iActor = svc.search(/FROM\s+actor_referral_codes/i);
  const iLegacy = svc.search(/FROM\s+users\s+WHERE[\s\S]{0,80}UPPER\(referral_code\)/i);
  if (iActor < 0 || iLegacy < 0) {
    failures.push(`${REFERRAL_SVC}: resolver deve ter actor-scoped E fallback legado (users.referral_code).`);
  } else if (iActor > iLegacy) {
    failures.push(`${REFERRAL_SVC}: resolver consulta o legado users.referral_code ANTES do actor_referral_codes — inverter (actor-scoped primeiro).`);
  }
  // Writer soberano: a materialização do vínculo (INSERT em user_referral_links) só existe AQUI.
  if (!/INSERT\s+INTO\s+user_referral_links/i.test(svc)) {
    failures.push(`${REFERRAL_SVC}: applyReferralCodeTx deve permanecer o writer de user_referral_links (INSERT ausente).`);
  }
}

// ── 2) /auth/check-referral (auth.routes.ts) ─────────────────────────────────────────────────
checkFile('src/core/auth/auth.routes.ts', {
  requires: [
    { re: /resolveReferralCodeCandidate\s*\(/, msg: '/auth/check-referral deve usar o resolver único resolveReferralCodeCandidate (não só users.referral_code).' },
  ],
  forbids: [
    { re: /UPPER\(referral_code\)/i, msg: '/auth/check-referral voltou a consultar users.referral_code direto (legacy-only). Usar resolveReferralCodeCandidate.' },
    { re: /INSERT\s+INTO\s+user_referral_links/i, msg: 'check-referral NÃO pode materializar vínculo (é read-only; writer = applyReferralCodeTx).' },
  ],
});

// ── 3) authService.register pré-validação (auth.service.ts) ──────────────────────────────────
checkFile('src/core/auth/auth.service.ts', {
  requires: [
    { re: /resolveReferralCodeCandidate\s*\(/, msg: 'register pré-validação deve usar o resolver único resolveReferralCodeCandidate (não só users.referral_code).' },
    { re: /applyReferralCodeTx\s*\(/, msg: 'register deve continuar materializando via writer soberano applyReferralCodeTx (não bypassar).' },
  ],
  forbids: [
    { re: /UPPER\(referral_code\)/i, msg: 'register pré-validação voltou a consultar users.referral_code direto (legacy-only). Usar resolveReferralCodeCandidate.' },
    { re: /INSERT\s+INTO\s+user_referral_links/i, msg: 'register NÃO pode materializar vínculo fora do writer transacional applyReferralCodeTx.' },
  ],
});

// ── 4) Bank intocado na frente de cadastro/referral ──────────────────────────────────────────
const BANK_WRITE = /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+bank_(ledger|transactions|splits)\b/i;
for (const rel of [REFERRAL_SVC, 'src/core/auth/auth.routes.ts', 'src/core/auth/auth.service.ts']) {
  const code = readStripped(rel);
  if (code !== null && BANK_WRITE.test(code)) {
    failures.push(`${rel}: escrita em bank_ledger/bank_transactions/bank_splits proibida nesta frente (não move dinheiro).`);
  }
}

// ── 5) R6.2 social-posts NÃO alterada por acidente (cross-check do gate selado) ───────────────
checkFile('src/modules/social/social-2.0.routes.ts', {
  requires: [
    { re: /canRepresentActor\(req\.tenant\.id,\s*req\.user\.userId,\s*validated\.actor_id\)/, msg: 'gate R6.2 social-posts (canRepresentActor subject=req.user.userId) sumiu — esta frente NÃO deve tocar social-posts.' },
    { re: /SOCIAL_POST_ACTOR_NOT_REPRESENTABLE/, msg: 'código 403 R6.2 social-posts sumiu — esta frente NÃO deve tocar social-posts.' },
  ],
});

if (failures.length > 0) {
  console.error('GATE FAIL [referral-register-actor-code-gate]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [referral-register-actor-code-gate]');
