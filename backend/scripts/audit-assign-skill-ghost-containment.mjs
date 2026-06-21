#!/usr/bin/env node
// Guard estrutural — F-OFFER-1 (assign-skill SCHEMA-GHOST containment; DECISION-0143).
//
// `user_skills_categories` está AUSENTE do schema vivo (genesis). A rota POST /categories/assign-skill
// gravava nela via categoriesService.assignSkillToUser (INSERT → 42P01). Contida em 501 EXPLÍCITO
// (ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING) ANTES de qualquer service/sink — conter ≠ matar: aponta o
// destino canônico de re-acoplamento (POST /profile/professional/c1/concepts → actor_professional_concepts;
// ponte declaração→service em F-OFFER-2). O service categoriesService.assignSkillToUser permanece INTOCADO (dead-via-route).
//
// MORDE se: a rota voltar a chamar assignSkillToUser / assignSkillToUserSchema (reabrir o INSERT ghost);
// sumir o code ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING; a rota referenciar actionContext.actorId como autoridade;
// ou tocar bank_*. (human-mvp create-offer já é coberto por audit-automation-human-mvp-ghost-containment.mjs.)
// Comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const failures = [];

const ROUTE = 'src/core/categories/categories.routes.ts';
const src = read(ROUTE);
if (src === null) {
  failures.push(`arquivo ausente: ${ROUTE}`);
} else {
  // 1) rota existe e está contida com o code de re-acoplamento.
  if (!/['"`]\/assign-skill['"`]/.test(src)) failures.push(`${ROUTE}: rota /assign-skill sumiu (esperada, contida em 501).`);
  if (!/ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING/.test(src)) failures.push(`${ROUTE}: perdeu o code de contenção ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING.`);
  if (!/status\(501\)/.test(src)) failures.push(`${ROUTE}: contenção deve responder status(501).`);

  // 2) PROIBIDO voltar a chamar o service/sink ghost (reabrir o INSERT em tabela ausente).
  if (/assignSkillToUser\s*\(/.test(src)) failures.push(`${ROUTE}: voltou a chamar categoriesService.assignSkillToUser( — schema-ghost deve ficar contido (501) antes de qualquer service/sink.`);
  if (/assignSkillToUserSchema/.test(src)) failures.push(`${ROUTE}: voltou a referenciar assignSkillToUserSchema — caminho do ghost reaberto.`);

  // 3) handler contido não lê ator do cliente nem toca dinheiro.
  if (/actionContext\s*\.\s*actorId/.test(src)) failures.push(`${ROUTE}: referencia actionContext.actorId — handler contido não lê ator do cliente (autoridade é server-side).`);
  if (/bank_ledger|bank_transactions|bank_splits/.test(src)) failures.push(`${ROUTE}: referencia bank_* — contenção não toca dinheiro.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [assign-skill-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [assign-skill-ghost-containment] — POST /categories/assign-skill contido (501 ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING) antes de service/sink; zero assignSkillToUser/actionContext.actorId/bank_*; service legado dead-via-route. Ghost user_skills_categories blindado.');
