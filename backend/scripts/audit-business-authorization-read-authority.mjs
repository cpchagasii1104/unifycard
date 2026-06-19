#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8L-BUSINESS-AUTHORIZATION-READ-SENSITIVE (DECISION-0113 / Z2).
//
// GET /business-permissions/check revela permissão/role (leitura sensível). O SUBJECT da checagem DEVE ser o
// utilizador autenticado (req.user, server-side); o actionContext.actorId client-declared NÃO pode governar quem é
// o operador. query.actorId é apenas o CONTEXTO org (alvo). MORDE se: o subject voltar a ser actionContext.actorId/
// body/query como autoridade; sumir o subject derivado de req.user; checkPermission deixar de usar o subject
// server-side; sumir o 401 nomeado quando req.user ausente; ou aparecer bank_*/write. Comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/core/authorization/business-authorization.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [business-authorization-read-authority]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) subject derivado de req.user (server-side).
if (!/const\s+subjectUserId\s*=\s*req\.user\??\.\s*id\b/.test(code)) {
  failures.push(`${REL}: subject DEVE vir de req.user (const subjectUserId = req.user?.id).`);
}
// 2) 401 nomeado quando req.user ausente.
if (!/status\(\s*401\s*\)/.test(code) || !/BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED/.test(code)) {
  failures.push(`${REL}: perdeu o 401 nomeado BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED quando subject ausente.`);
}
// 3) checkPermission DEVE usar o subject server-side como 2º arg (NÃO actionContext.actorId).
if (!/checkPermission\(\s*[A-Za-z_$][\w$.]*\s*,\s*subjectUserId\s*,/.test(code)) {
  failures.push(`${REL}: checkPermission DEVE receber subjectUserId (req.user) como subject, não ator client-declared.`);
}
// 4) actionContext.actorId NÃO pode voltar a governar a checagem (nem como subject nem passado ao service).
if (/actionContext\s*\.\s*actorId/.test(code)) {
  failures.push(`${REL}: voltou a referenciar actionContext.actorId — não pode governar a leitura sensível de permissão.`);
}
// 5) o subject NÃO pode ser body/query (client-declared) no checkPermission.
if (/checkPermission\([^)]*req\.(body|query)/.test(code)) {
  failures.push(`${REL}: checkPermission não pode receber req.body/req.query como subject.`);
}
// 6) zero bank_* / write.
if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
  failures.push(`${REL}: referencia bank_ledger/transactions/splits — proibido (read-sensitive, zero money).`);
}
if (/\b(INSERT|UPDATE|DELETE)\s/i.test(code)) {
  failures.push(`${REL}: apareceu escrita (INSERT/UPDATE/DELETE) — a rota é READ-ONLY.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [business-authorization-read-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [business-authorization-read-authority] — GET /business-permissions/check: subject=req.user.id (subjectUserId) server-side; 401 BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED se ausente; checkPermission(tenantId, subjectUserId, orgActorId); actionContext.actorId não governa; query é só contexto; zero bank_*/write. Leitura sensível bound.');
