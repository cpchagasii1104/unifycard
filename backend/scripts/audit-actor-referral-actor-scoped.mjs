#!/usr/bin/env node
// Guard estrutural — F-ACTOR-REFERRAL-CODE-SUBSTRATE (DECISION-0139).
// Cerca de regressão para o referral ACTOR-SCOPED: o código e os earnings pertencem ao
// owner_actor_id (não ao CPF/user por reflexo); referral_code = lookup, nunca authority;
// body/metadata não define dono; actor_system fail-closed; earnings → actor_wallet do owner;
// FK sempre actors(id); bank_ledger só via writer canônico.
// MORDE regressão real (não grep decorativo). Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'migrations');

const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// ── Migration do substrato (actor_referral_codes) ───────────────────────────────────────────
const SUBSTRATE_MIGRATION = '20260617120000_actor_referral_codes_and_actor_links.sql';
const migPath = join(MIGRATIONS_DIR, SUBSTRATE_MIGRATION);
if (!existsSync(migPath)) {
  failures.push(`migration do substrato ausente: ${SUBSTRATE_MIGRATION}.`);
} else {
  const sql = stripSql(readFileSync(migPath, 'utf-8'));
  // FK do owner DEVE ser actors(id) — nunca users(id) nem actors(actor_id).
  if (!/owner_actor_id\s+uuid\s+NOT NULL\s+REFERENCES\s+actors\s*\(\s*id\s*\)/i.test(sql)) {
    failures.push(`${SUBSTRATE_MIGRATION}: owner_actor_id deve ser NOT NULL REFERENCES actors(id) (07/DECISION-0139).`);
  }
  if (/owner_actor_id[\s\S]{0,60}REFERENCES\s+users/i.test(sql)) {
    failures.push(`${SUBSTRATE_MIGRATION}: owner_actor_id NÃO pode referenciar users (dono econômico é ACTOR, não user).`);
  }
  if (/REFERENCES\s+actors\s*\(\s*actor_id\s*\)/i.test(sql)) {
    failures.push(`${SUBSTRATE_MIGRATION}: FK para actors(actor_id) proibida — usar actors(id) (PK).`);
  }
  // 1 código ativo por actor (partial unique index).
  if (!/CREATE\s+UNIQUE\s+INDEX[\s\S]{0,120}actor_referral_codes[\s\S]{0,120}WHERE\s+code_status\s*=\s*'active'/i.test(sql)) {
    failures.push(`${SUBSTRATE_MIGRATION}: faltou partial UNIQUE INDEX (1 código ativo por owner_actor_id).`);
  }
  // code_status (não 'status' genérico).
  if (/\bstatus\s+text\s+NOT NULL\s+DEFAULT\s+'active'/i.test(sql) && !/code_status/i.test(sql)) {
    failures.push(`${SUBSTRATE_MIGRATION}: usar code_status (não 'status' genérico) — 07 §3.4.`);
  }
}

// ── Runtime ─────────────────────────────────────────────────────────────────────────────────
const checkFile = (rel, { requires = [], forbids = [] }) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}.`); return; }
  const code = stripTs(readFileSync(p, 'utf-8'));
  for (const { re, msg } of requires) if (!re.test(code)) failures.push(`${rel}: ${msg}`);
  for (const { re, msg } of forbids) if (re.test(code)) failures.push(`${rel}: ${msg}`);
};

// resolver/serviço canônico: fail-closed actor_system + resolve owner_actor_id.
checkFile('src/core/referral/actor-referral-code.service.ts', {
  requires: [
    { re: /ACTOR_SYSTEM_REFERRAL_FORBIDDEN/, msg: 'perdeu o fail-closed de actor_system (DECISION-0139).' },
    { re: /owner_actor_id/, msg: 'perdeu a resolução por owner_actor_id (dono econômico = actor).' },
  ],
});

// getActiveReferral devolve o OWNER ACTOR (não user bruto).
checkFile('src/core/referral/referral-helper.service.ts', {
  requires: [{ re: /referrerActorId/, msg: 'getActiveReferral deve devolver referrerActorId (owner econômico), não user bruto (DECISION-0139).' }],
});

// vínculo grava os eixos econômicos (referrer_actor_id/referred_actor_id) server-side.
checkFile('src/core/referral/referral.service.ts', {
  requires: [
    { re: /referrer_actor_id/, msg: 'applyReferralCodeTx deve gravar referrer_actor_id (owner econômico).' },
    { re: /referred_actor_id/, msg: 'applyReferralCodeTx deve gravar referred_actor_id (actor_human do indicado).' },
  ],
});

// split engine: earning → actor_wallet do owner; NÃO conta-user do referrer.
checkFile('src/modules/bank/bank-split-engine.service.ts', {
  requires: [
    { re: /ensureActorWalletAccount\(/, msg: 'referral split deve mirar actor_wallet do owner (ensureActorWalletAccount) — DECISION-0139.' },
    { re: /referrerActorId/, msg: 'referral split deve usar o owner actor (referrerActorId).' },
  ],
  forbids: [
    { re: /const\s+referrerUserId\s*=\s*await\s+getActiveReferral/, msg: 'referral split voltou a resolver conta do USER (getActiveReferral→referrerUserId→conta user). Use owner actor + actor_wallet.' },
  ],
});

// generateShareableLink: embute código do actor SERVER-SIDE; body/metadata não define dono.
checkFile('src/core/publication/publication-engine.service.ts', {
  requires: [{ re: /getActiveCodeForActor\(/, msg: 'generateShareableLink deve embutir o código do actor server-side (getActiveCodeForActor).' }],
  forbids: [{ re: /input\.referral_code\s*\|\|\s*metadata\.referral_code/, msg: 'body/metadata.referral_code NÃO pode escolher o dono econômico do link (DECISION-0139 §1.9).' }],
});

// rota de código de actor: autoridade obrigatória (canRepresentActor).
checkFile('src/core/referral/referral.routes.ts', {
  requires: [
    { re: /actor-code/, msg: 'rota actor-code ausente (gestão de código por actor).' },
    { re: /canRepresentActor/, msg: 'gestão de código de actor DEVE exigir canRepresentActor (referral_code não é authority).' },
  ],
});

if (failures.length > 0) {
  console.error('GATE FAIL [actor-referral-actor-scoped]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [actor-referral-actor-scoped]');
