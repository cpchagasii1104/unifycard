#!/usr/bin/env node
// Gate estrutural — F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING).
// Os 4 writes do módulo dedicado `votes` (POST / · /:id/publish · /:id/vote · /:id/close) derivam autoria
// de `req.activeActor`, que NENHUM hook popula no backend → escritas MORTAS (401 enganoso). Decisão IA
// Diretora: CONTER fail-closed (501 nomeado), NÃO religar. Este gate trava a contenção: nenhum write pode
// voltar a chamar o votesService de escrita nem a usar `actionContext.actorId`/`activeActor` cru como
// autoridade sem religação canônica + binding (frente própria). Integrado em validate:regression-guards.
// Heurística textual comment-stripped, não AST — falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ROUTES_REL = 'modules/votes/votes.routes.ts';

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let checked = 0;

const p = join(SRC, ROUTES_REL);
if (!existsSync(p)) {
  failures.push(`FORBIDDEN_REGRESSION: rota de votes desapareceu: ${ROUTES_REL}`);
} else {
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Código de contenção nomeado presente.
  if (!/VOTES_ACTIVE_ACTOR_WIRING_MISSING/.test(code)) {
    failures.push(`VOTES_CONTAINMENT_REGRESSION: ${ROUTES_REL} perdeu o código de contenção VOTES_ACTIVE_ACTOR_WIRING_MISSING.`);
  }

  // 2) Os 4 writes devem RETORNAR a contenção fail-closed (501). Conta os usos do payload contido.
  const containedUses = (code.match(/reply\.status\(501\)\.send\(VOTES_WRITES_CONTAINED\)/g) || []).length;
  if (containedUses < 4) {
    failures.push(`VOTES_CONTAINMENT_REGRESSION: ${ROUTES_REL} esperado >= 4 writes contidos (501 VOTES_WRITES_CONTAINED), encontrados ${containedUses}.`);
  }

  // 3) PROIBIDO: qualquer chamada ao votesService de ESCRITA (rota morta/contida não pode escrever).
  for (const m of [
    /votesService\.createVote\(/,
    /votesService\.publishVote\(/,
    /votesService\.closeVote\(/,
    /votesService\.vote\(/,
  ]) {
    if (m.test(code)) {
      failures.push(`VOTES_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a chamar um write do votesService (${m}) — religação exige frente própria com binding (DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT).`);
    }
  }

  // 4) PROIBIDO: actionContext.actorId no arquivo (era usado como userId — conflação). Sem religação não volta.
  if (/actionContext\.actorId/.test(code)) {
    failures.push(`VOTES_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a referenciar actionContext.actorId (conflação actor↔user / authority crua — proibido sem religação+binding).`);
  }

  // 5) PROIBIDO: write passar req.activeActor / activeActor.actor_id ao votesService. Como (3) já proíbe
  //    qualquer write call, basta garantir que nenhuma escrita do service receba o campo fantasma; cobrimos
  //    via (3). Aqui reforçamos: o campo morto não pode alimentar um write (não há write call).
  //    (Reads PODEM ler activeActor — ex.: has_voted no GET /:id — então NÃO proibimos o identificador todo.)

  // 6) Reads preservados (não conter leitura por engano).
  if (!/votesService\.listVotes\(/.test(code) || !/votesService\.getVote\(/.test(code)) {
    failures.push(`VOTES_CONTAINMENT_REGRESSION: ${ROUTES_REL} perdeu um read (listVotes/getVote) — a contenção é só dos writes, reads permanecem.`);
  }
}

console.log(`[votes-writes-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [votes-writes-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [votes-writes-containment] — 4 writes de votes contidos fail-closed (501 nomeado); zero write service call; sem actionContext.actorId; reads preservados.');
