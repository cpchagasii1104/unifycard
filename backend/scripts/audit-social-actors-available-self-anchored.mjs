#!/usr/bin/env node
// Guard estrutural — F-SOCIAL-ACTORS-AVAILABLE-DEAD-HINT-BRANCH-HYGIENE
//   (DT-SOCIAL-ACTORS-AVAILABLE-DEAD-HINT-BRANCH · B3 · authority · money-free).
//
// GET /social/actors/available lista os actors DISPONÍVEIS PARA O PRÓPRIO USUÁRIO. O subject da listagem
// (listingUserId → findAvailableActors) DEVE ancorar SEMPRE no principal server-side req.user.id; jamais
// ser derivado de req.actionContext.actorId (HINT do cliente), o que listaria os actors/empresas
// representáveis de OUTRO user (cross-user leak). O branch morto que flipava o subject pelo hint (contido
// por skip do action-context middleware, mas armadilha latente) foi removido nesta fatia.
//
// MORDE (regressão real) no handler /actors/available:
//   (A) listingUserId (ou o arg de findAvailableActors) deixar de ancorar em req.user.id;
//   (B) listingUserId voltar a ser derivado de req.actionContext (hint) — reatribuição condicional;
//   (C) reaparecer actorRepository.findById(... req.actionContext.actorId ...) no handler (resolução do
//       hint para trocar o subject).
// Heurística textual comment-stripped (não AST). Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/social/social-2.0.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [social-actors-available-self-anchored]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Segmenta o handler GET /actors/available até o próximo fastify.<verb>.
const marks = [];
const re = /fastify\.(post|get|put|delete)(?:<[\s\S]*?>)?\(\s*'([^']+)'/g;
let m;
while ((m = re.exec(code)) !== null) marks.push({ path: m[2], start: m.index });
const idx = marks.findIndex((mk) => mk.path === '/actors/available');
if (idx < 0) {
  failures.push(`${REL}: handler GET /actors/available não encontrado (rota renomeada/removida?).`);
} else {
  const body = code.slice(marks[idx].start, idx + 1 < marks.length ? marks[idx + 1].start : code.length);

  // (A) listingUserId ancorado em req.user.id
  if (!/const\s+listingUserId\s*=\s*req\.user!?\.id\b/.test(body)) {
    failures.push(`${REL} /actors/available: listingUserId não ancora em req.user.id (subject deve ser o principal server-side).`);
  }
  // (A') findAvailableActors recebe listingUserId (não um subject derivado de hint)
  if (!/findAvailableActors\(\s*req\.tenant\.id\s*,\s*listingUserId\s*\)/.test(body)) {
    failures.push(`${REL} /actors/available: findAvailableActors deve receber listingUserId ancorado no principal.`);
  }
  // (B) sem reatribuição de listingUserId a partir de hint/actor derivado
  if (/listingUserId\s*=\s*actor\??\.user_id/.test(body) || /(let|var)\s+listingUserId\b/.test(body)) {
    failures.push(`${REL} /actors/available: listingUserId reatribuído/mutável — o subject não pode ser flipado por hint (usar const ancorado em req.user.id).`);
  }
  // (C) sem resolução do actionContext.actorId (hint) para trocar o subject
  if (/req\.actionContext\??\.actorId/.test(body)) {
    failures.push(`${REL} /actors/available: req.actionContext.actorId reapareceu no handler — hint do cliente não pode governar o subject da listagem (cross-user leak).`);
  }
  if (/actorRepository\.findById\s*\(/.test(body)) {
    failures.push(`${REL} /actors/available: actorRepository.findById reapareceu no handler — resolver o hint para trocar o subject reabre o branch morto.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [social-actors-available-self-anchored]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [social-actors-available-self-anchored] — GET /actors/available ancora o subject da listagem no principal server-side (req.user.id), sem derivar de req.actionContext (hint). Branch morto cross-user removido/congelado. B3 blindado.');
