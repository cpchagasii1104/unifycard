#!/usr/bin/env node
// Guard estrutural — F-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK (Onda 1 zeragem de DT, 2026-07-05).
//
// `AvailableActor.user_id?` (frontend/src/api/social.ts) é NULL para actor_type='page'/'group' —
// só `user` tem esse campo populado (confirmado por consulta ao schema vivo: actors.user_id NULL
// pra TODO page/group). Dois consumidores reais liam `activeActor?.user_id` num campo de
// atribuição (`completedBy`, wizard de onboarding de empresa e de evento) — EXATAMENTE o cenário
// onde o actor ativo costuma ser 'page' (empresa), gravando `undefined`/`''` em vez da
// identidade real de quem completou o fluxo. Corrigido pra `activeActor?.actor_id` (sempre
// populado, user E page).
//
// MORDE se `activeActor?.user_id` / `activeActor.user_id` (ou `selectedActor` equivalente)
// reaparecer em QUALQUER arquivo do frontend — reintroduziria o mesmo bug de atribuição vazia
// pra contexto de empresa/página. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd(); // backend/ — sobe um nível pra achar frontend/
const FRONTEND_SRC = join(ROOT, '..', 'frontend', 'src');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const PATTERN = /\b(activeActor|selectedActor)\??\.\s*user_id\b/;

const failures = [];
if (!existsSync(FRONTEND_SRC)) {
  failures.push(`diretório ausente: ${FRONTEND_SRC}`);
} else {
  for (const file of walk(FRONTEND_SRC)) {
    const rel = relative(join(ROOT, '..'), file);
    const src = stripTs(readFileSync(file, 'utf8'));
    if (PATTERN.test(src)) {
      failures.push(`${rel}: lê .user_id de activeActor/selectedActor (AvailableActor) — NULL pra actor_type='page'/'group'. Use .actor_id (sempre populado).`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [available-actor-user-id-misuse]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [available-actor-user-id-misuse] — nenhum consumidor de activeActor/selectedActor lê .user_id (NULL pra page/group); atribuição usa .actor_id (sempre populado).');
