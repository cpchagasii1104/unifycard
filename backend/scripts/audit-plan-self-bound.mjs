#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8F (plan) — PLAN SELF-BOUND WRITE (DECISION-0113 fatia 5.1 / Z2).
//
// PUT /plan (UPDATE users SET plan) é per-user do PRÓPRIO caller (self-only). O canal-1 actionContext.actorId
// NÃO é autoridade: o SUBJECT e o privilégio derivam do actor do `req.user` autenticado
// (findByUserId(req.tenant.id, req.user.userId) → callerActor.actor_id), com 403 ANTES do UPDATE, e o sink
// atualiza o user_id DO CALLER (userRow.user_id). Este gate trava essa ligação (justifica a saída do baseline
// canal-1): MORDE se o subject voltar a vir do actionContext.actorId, se o 403 sumir/rodar depois do sink, ou se
// o UPDATE deixar de mirar o user resolvido do caller. Heurística textual comment-stripped (não AST). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/core/plan/plan.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [plan-self-bound]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Recorta o handler PUT '/' (write). Vai do registro PUT até o fim do arquivo.
const putIdx = code.search(/fastify\.put\b/);
if (putIdx < 0) { failures.push(`${REL}: handler PUT (write de plano) não encontrado.`); }
const put = putIdx >= 0 ? code.slice(putIdx) : '';

// 1) SUBJECT server-side: derivado de req.user.userId via findByUserId (NÃO do actionContext).
const SUBJECT = /findByUserId\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*\)/;
if (put && !SUBJECT.test(put)) {
  failures.push(`${REL} PUT: SUBJECT deve derivar de req.user.userId via findByUserId(req.tenant.id, req.user.userId) — não encontrado (spoof de actionContext.actorId?).`);
}
// 2) write-subject = actor do caller.
if (put && !/callerActor\.actor_id/.test(put)) {
  failures.push(`${REL} PUT: o actor do write deve ser callerActor.actor_id (derivado do req.user), não o actionContext.actorId.`);
}
// 3) 403 (privilégio) ANTES do UPDATE users (sink).
const sink = put.search(/UPDATE\s+users/i);
const gate403 = put.search(/status\(\s*403\s*\)/);
if (put) {
  if (sink < 0) failures.push(`${REL} PUT: sink esperado ausente (UPDATE users).`);
  if (gate403 < 0) failures.push(`${REL} PUT: 403 de privilégio ausente.`);
  if (sink >= 0 && gate403 >= 0 && gate403 > sink) failures.push(`${REL} PUT: 403 de privilégio roda DEPOIS do UPDATE (gate@${gate403} sink@${sink}) — mover ANTES.`);
}
// 4) o UPDATE mira o user resolvido do caller (userRow.user_id), nunca um id client-declared.
if (put && !/userRow\.user_id/.test(put)) {
  failures.push(`${REL} PUT: o UPDATE deve mirar userRow.user_id (caller resolvido server-side).`);
}
// 5) PROIBIDO: actionContext.actorId como SUBJECT de findByUserId / canRepresentActor no PUT.
if (/findByUserId\(\s*[^,)]*,\s*req\.actionContext\.actorId/.test(put) || /findByUserId\(\s*[^,)]*,\s*actionContext\.actorId/.test(put)) {
  failures.push(`${REL} PUT: PROIBIDO — actionContext.actorId como subject de findByUserId. Subject = req.user.userId.`);
}

// ── GET '/' (read "meu plano") — R8G: também self-bound (subject de req.user, não actionContext) ──
// Recorta o handler GET (do registro GET até o registro PUT).
const getIdx = code.search(/fastify\.get\b/);
const getEnd = putIdx >= 0 ? putIdx : code.length;
const get = getIdx >= 0 ? code.slice(getIdx, getEnd) : '';
if (getIdx < 0) {
  failures.push(`${REL}: handler GET (read de plano) não encontrado.`);
} else {
  if (!SUBJECT.test(get)) {
    failures.push(`${REL} GET: SUBJECT do read deve derivar de req.user.userId via findByUserId — não encontrado (read por actionContext.actorId = W3).`);
  }
  // PROIBIDO: read por actionContext.actorId (subject client-declared).
  if (/getUserPlanByActorId\(\s*[^,)]*,\s*req\.actionContext\.actorId/.test(get) || /getUserPlanByActorId\(\s*[^,)]*,\s*actionContext\.actorId/.test(get)) {
    failures.push(`${REL} GET: PROIBIDO — getUserPlanByActorId com actionContext.actorId como subject. Subject = actor do req.user (self-only).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [plan-self-bound]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [plan-self-bound] — PUT /plan self-bound: subject=req.user.userId (findByUserId→callerActor.actor_id), 403 de privilégio ANTES do UPDATE, sink mira userRow.user_id do caller; actionContext.actorId não é autoridade.');
