#!/usr/bin/env node
// Gate estrutural — Lote L5: contenção fail-closed dos módulos FROZEN/FANTASMA (2026-07-06).
// 4 módulos estavam MONTADOS batendo em tabelas schema-ghost (to_regclass=NULL): venue (tabs/menus/
// menu_items, rota PÚBLICA), work-instant (jobs/workers/worker_skills/job_assignments), policy-engine
// (policy_rules/policy_decisions), core/residence (global_user_residence, superado por /profile/
// residence-address DECISION-0074). Sem contenção, qualquer acesso emitia 42P01 (500 cru). Decisão
// (GO Clayton 2026-07-06): CONTER fail-closed (501 nomeado, blanket) — mesmo padrão institucional de
// organization/automation/saúde. Este gate TRAVA a contenção: nenhuma rota pode voltar a chamar service,
// e cada arquivo deve manter seu código de contenção nomeado + handler 501. Integrado em
// validate:regression-guards. Heurística textual comment-stripped — falso positivo torna o gate MAIS
// restritivo, nunca menos.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Cada alvo: arquivo de rota, código de contenção esperado, nº mínimo de rotas contidas,
// e os símbolos de service/repository que NÃO podem reaparecer (religação = frente própria).
const TARGETS = [
  {
    rel: 'modules/venue/venue.routes.ts',
    code: 'VENUE_SCHEMA_GHOST_CONTAINED',
    minContained: 15,
    forbiddenServices: [/venueMenuService\./, /tabService\./, /orderService\./, /paymentExecutionService\./, /paymentIntentService\./],
  },
  {
    rel: 'modules/work-instant/instant.routes.ts',
    code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
    minContained: 4,
    forbiddenServices: [/instantService\./],
  },
  {
    rel: 'modules/work-instant/worker-status.routes.ts',
    code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
    minContained: 4,
    forbiddenServices: [/workerStatusService\./],
  },
  {
    rel: 'modules/work-instant/status.routes.ts',
    code: 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED',
    minContained: 4,
    forbiddenServices: [/instantRepository\./, /workerService\./, /assignmentService\./, /trackingService\./],
  },
  {
    rel: 'modules/policy-engine/policy.routes.ts',
    code: 'POLICY_ENGINE_SCHEMA_GHOST_CONTAINED',
    minContained: 11,
    forbiddenServices: [/policyEngineService\./],
  },
  {
    rel: 'core/residence/residence.routes.ts',
    code: 'RESIDENCE_SCHEMA_GHOST_CONTAINED',
    minContained: 3,
    forbiddenServices: [/residenceService\./],
  },
];

const failures = [];
let checked = 0;

for (const t of TARGETS) {
  const p = join(SRC, t.rel);
  if (!existsSync(p)) {
    failures.push(`FORBIDDEN_REGRESSION: rota contida desapareceu: ${t.rel}`);
    continue;
  }
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Código de contenção nomeado presente.
  if (!new RegExp(t.code).test(code)) {
    failures.push(`L5_CONTAINMENT_REGRESSION: ${t.rel} perdeu o código ${t.code}.`);
  }
  // 2) Handler retorna 501 nomeado.
  if (!new RegExp(`reply\\.status\\(501\\)\\.send\\(${t.code}\\)`).test(code)) {
    failures.push(`L5_CONTAINMENT_REGRESSION: ${t.rel} contenção não retorna 501 nomeado (${t.code}).`);
  }
  // 3) Todas as rotas usam o handler `contained`.
  const containedRegs = (code.match(/,\s*contained\)/g) || []).length;
  if (containedRegs < t.minContained) {
    failures.push(`L5_CONTAINMENT_REGRESSION: ${t.rel} esperado >= ${t.minContained} rotas contidas (, contained)), encontradas ${containedRegs}.`);
  }
  // 4) PROIBIDO: qualquer chamada a service/repository (rota contida não toca DB).
  for (const m of t.forbiddenServices) {
    if (m.test(code)) {
      failures.push(`L5_CONTAINMENT_REGRESSION: ${t.rel} voltou a chamar service/repository (${m}) — religação exige frente própria.`);
    }
  }
  // 5) PROIBIDO: acesso cru ao pool/DB na superfície contida.
  if (/pool\.query|runQueryWithTenant|runQueriesWithTenant/.test(code)) {
    failures.push(`L5_CONTAINMENT_REGRESSION: ${t.rel} acessa o DB diretamente numa rota contida — proibido sobre schema ghost.`);
  }
}

console.log(`[l5-frozen-modules-ghost-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [l5-frozen-modules-ghost-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [l5-frozen-modules-ghost-containment] — venue/work-instant(x3)/policy-engine/residence contidos fail-closed (501 nomeado); zero service/DB nas rotas.');
