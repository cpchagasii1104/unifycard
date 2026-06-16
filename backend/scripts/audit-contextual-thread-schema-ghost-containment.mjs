#!/usr/bin/env node
// Gate estrutural — F-CONTEXTUAL-THREAD-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST).
// O módulo `contextual-messaging` está MONTADO mas suas tabelas (`contextual_threads`/`contextual_messages`)
// são schema ghost (zero migration canônica). Todas as 7 rotas (3 writes + 4 reads) batiam no repository →
// 42P01. Decisão IA Diretora: CONTER fail-closed (501 nomeado), NÃO religar. Este gate trava a contenção:
// nenhuma rota pode voltar a chamar o service/repository, usar actionContext.actorId/body.actorId cru, ou
// fazer binding (canRepresentActor) sobre a superfície morta. Integrado em validate:regression-guards.
// Heurística textual comment-stripped, não AST — falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ROUTES_REL = 'modules/contextual-messaging/contextual-thread.routes.ts';

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let checked = 0;

const p = join(SRC, ROUTES_REL);
if (!existsSync(p)) {
  failures.push(`FORBIDDEN_REGRESSION: rota de contextual-thread desapareceu: ${ROUTES_REL}`);
} else {
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Código de contenção nomeado + handler 501.
  if (!/CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED/.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} perdeu o código CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED.`);
  }
  if (!/reply\.status\(501\)\.send\(CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED\)/.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} contenção não retorna 501 nomeado.`);
  }

  // 2) As 7 rotas (3 writes + 4 reads) devem usar o handler contido. Conta as registrações `, contained)`.
  const containedRegs = (code.match(/,\s*contained\)/g) || []).length;
  if (containedRegs < 7) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} esperado >= 7 rotas contidas (, contained)), encontradas ${containedRegs}.`);
  }

  // 3) PROIBIDO: qualquer chamada ao service (rota morta/contida não acessa service/repository/DB).
  if (/contextualThreadService\./.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a chamar contextualThreadService.* — religação exige frente própria (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST).`);
  }

  // 4) PROIBIDO: actionContext.actorId cru (sendMessage gravava senderActor com ele — conflação latente).
  if (/actionContext\.actorId/.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a usar actionContext.actorId cru (autoria latente — proibido sem religação+binding).`);
  }

  // 5) PROIBIDO: ler body.actorId / req.body como autoridade (addParticipant aceitava body.actorId cru).
  if (/req\.body|\.body\.actorId/.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a ler req.body/body.actorId (autoridade cliente-declarada — proibido na superfície contida).`);
  }

  // 6) PROIBIDO: canRepresentActor — não se faz binding sobre rota morta/ghost (seria reanimar superfície).
  if (/canRepresentActor/.test(code)) {
    failures.push(`CONTEXTUAL_CONTAINMENT_REGRESSION: ${ROUTES_REL} introduziu canRepresentActor numa rota contida — binding sobre superfície morta é proibido (DT-CONTEXTUAL-THREAD-WRITE-AUTHORSHIP-BINDING-LATENT).`);
  }
}

console.log(`[contextual-thread-schema-ghost-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [contextual-thread-schema-ghost-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [contextual-thread-schema-ghost-containment] — 7 rotas contidas fail-closed (501 nomeado); zero service/DB; sem actionContext.actorId/body.actorId/canRepresentActor.');
