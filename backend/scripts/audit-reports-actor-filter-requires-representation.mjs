#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R3-REPORTS-ACTOR-FILTER-BINDING (DECISION-0113 / Z2).
// MORDE o vazamento cross-actor por `query.actorId` em reports/sales·inventory/suggestions·holding-costs:
//   options.actorId = query.actorId;  |  filters.actorId = query.actorId;  ← PROIBIDO (sem representação).
// `reports:view_operational` prova acesso ao MÓDULO, NÃO autoridade sobre o actor filtrado. O actor filtrado
// DEVE ser resolvido server-side por resolveReportActorId (canRepresentActor) — 403 se não representa.
// Em validate:regression-guards. Escopado a reports.routes.ts (contenção localizada; não fecha DT-mãe 0113).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const REL = 'src/modules/reports/reports.routes.ts';
const failures = [];
const p = join(ROOT, REL);

if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${REL}.`);
} else {
  const code = stripTs(readFileSync(p, 'utf-8'));

  // PROIBIDO: actor filter por actorId declarado sem binding (vazamento cross-actor).
  if (/options\.actorId\s*=\s*query\.actorId/.test(code)) {
    failures.push(`${REL}: \`options.actorId = query.actorId\` (actorId declarado vira filtro sem representação) — PROIBIDO (DECISION-0113/Z2). Resolva via resolveReportActorId.`);
  }
  if (/filters\.actorId\s*=\s*query\.actorId/.test(code)) {
    failures.push(`${REL}: \`filters.actorId = query.actorId\` (actorId declarado vira filtro sem representação) — PROIBIDO (DECISION-0113/Z2). Resolva via resolveReportActorId.`);
  }
  // OBRIGATÓRIO: o helper canônico de binding existe.
  if (!/async function resolveReportActorId/.test(code)) {
    failures.push(`${REL}: helper resolveReportActorId (canRepresentActor) ausente — necessário para gatear o actor de relatório.`);
  }
  // OBRIGATÓRIO: o filtro de actor é o actorId AUTORIZADO (não o cru).
  if (!/options\.actorId\s*=\s*authorizedActorId/.test(code) && !/filters\.actorId\s*=\s*authorizedActorId/.test(code)) {
    failures.push(`${REL}: o filtro de actor DEVE ser \`*.actorId = authorizedActorId\` (resolvido por resolveReportActorId), não query.actorId cru.`);
  }
  // OBRIGATÓRIO: sales + suggestions + holding-costs gateados além das 5 já gateadas (≥8 chamadas do helper).
  const calls = (code.match(/resolveReportActorId\s*\(\s*req\s*,\s*reply\s*\)/g) || []).length;
  if (calls < 8) {
    failures.push(`${REL}: resolveReportActorId chamado ${calls}x — esperado ≥8 (financial+margin×3+pricing + sales + inventory/suggestions + holding-costs). As 3 rotas operacionais devem gatear query.actorId.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [reports-actor-filter-requires-representation]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [reports-actor-filter-requires-representation]');
