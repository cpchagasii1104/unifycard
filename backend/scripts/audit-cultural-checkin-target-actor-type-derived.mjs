#!/usr/bin/env node
// Guard estrutural — F-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-DERIVED (DT-CULTURAL-CHECKIN-TARGET-
// ACTOR-TYPE-SELF-DIVERGENCE). O handler POST /cultural/events/:eventId/check-in usava
// `req.body.target_actor_type` sem validar coerência com o actor_id resolvido — com target=self (ou
// omitido), permitia gravar actor_id correto porém actor_type divergente; como a UNIQUE é
// (tenant,event,actor_id,actor_type), o mesmo actor "dobrava" presença sob tipos distintos.
// NÃO é brecha de autoridade (actor_id já era sempre correto) — é integridade de dado.
//
// Corrigido: actor_type SEMPRE derivado server-side (self → actor.actor_type; representável →
// actor-alvo REAL via findById, 404 se inexistente). Rota LATENTE (cultural_event_checkins não
// existe no schema vivo — impacto zero hoje), mas a lógica é blindada para não virar armadilha
// quando o schema cultural for reativado.
//
// MORDE:
//   (A) `req.body.target_actor_type` voltar a alimentar `actorType` diretamente (sem derivação);
//   (B) a derivação para o caso self (`actorId === actor.actor_id`) sumir;
//   (C) a derivação para o caso representável (findById do actor-alvo real) sumir;
//   (D) o 404 honesto para actor-alvo inexistente sumir.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'cultural', 'cultural.routes.ts');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf-8'));
  const idx = src.indexOf(`'/events/:eventId/check-in'`);
  if (idx < 0) {
    failures.push(`handler POST /events/:eventId/check-in não encontrado.`);
  } else {
    const bodyEndIdx = src.indexOf('culturalEventService.checkIn(', idx);
    const body = bodyEndIdx > idx ? src.slice(idx, bodyEndIdx) : src.slice(idx, idx + 3000);

    // (A) NÃO pode voltar a usar req.body.target_actor_type diretamente como valor de actorType.
    if (/const actorType = req\.body\.target_actor_type/.test(body)) {
      failures.push(`actorType voltou a vir direto de req.body.target_actor_type (sem derivação server-side) — regressão exata do bug original.`);
    }
    // (B) self: deriva de actor.actor_type.
    if (!/actorId === actor\.actor_id/.test(body) || !/actor\.actor_type/.test(body)) {
      failures.push(`derivação do caso self (actorId === actor.actor_id → actor.actor_type) ausente.`);
    }
    // (C) representável: findById do actor-alvo real.
    if (!/getActorRepository\(\)\.findById\(req\.tenant\.id, actorId\)/.test(body)) {
      failures.push(`derivação do caso representável (findById do actor-alvo real) ausente.`);
    }
    // (D) 404 honesto.
    if (!/CULTURAL_CHECKIN_TARGET_NOT_FOUND/.test(body)) {
      failures.push(`404 honesto (CULTURAL_CHECKIN_TARGET_NOT_FOUND) para actor-alvo inexistente ausente.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [cultural-checkin-target-actor-type-derived]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [cultural-checkin-target-actor-type-derived] — actor_type do check-in cultural é SEMPRE derivado server-side (self ou actor-alvo real via findById), nunca do body cru. DT-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-SELF-DIVERGENCE blindada.');
