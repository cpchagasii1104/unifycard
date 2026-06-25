#!/usr/bin/env node
// Gate estrutural — F-REPORTS-TRANSFERS-SLA-REPRESENTATION (executa DECISION-0113).
// Trava o reader actor-keyed GET /reports/transfers/sla ao padrão canônico das rotas irmãs:
//   - fromActorId/toActorId NÃO são aceitos crus → cada um passa por canRepresentActor (403 senão);
//   - ausência de filtro de actor NÃO vira leitura tenant-wide → escopa ao actor representado (self)
//     via resolveReportActorId + options.participantActorId;
//   - o helper canônico resolveReportActorId continua existindo (irmãs não regrediram).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROUTES = join(process.cwd(), 'src/modules/reports/reports.routes.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const raw = existsSync(ROUTES) ? readFileSync(ROUTES, 'utf8') : null;

if (!raw) {
  failures.push('REPORTS_SLA_REGRESSION: reports.routes.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper canônico DECISION-0113 ainda presente (irmãs não regrediram)
  if (!/async function resolveReportActorId\b/.test(code) || !/canRepresentActor/.test(code)) {
    failures.push('REPORTS_SLA_REGRESSION: helper canônico resolveReportActorId/canRepresentActor ausente (rotas irmãs regrediram).');
  }

  // bloco do handler /transfers/sla
  const m = code.match(/fastify\.get\(\s*'\/transfers\/sla'[\s\S]*?(?=\n {2}fastify\.get\(|\n {2}\/\/ SPRINT \d+:|\nconst reportsRoutes|\n};\s*$)/);
  const body = m ? m[0] : '';
  if (!body) {
    failures.push('REPORTS_SLA_REGRESSION: handler /transfers/sla não localizado.');
  } else {
    checked++;
    // gate específico por actor: fromActorId/toActorId passam por canRepresent(String(query.<x>ActorId))
    const hasFromGate = /canRepresent\w*\s*\(\s*String\(\s*query\.fromActorId\s*\)/.test(body);
    const hasToGate = /canRepresent\w*\s*\(\s*String\(\s*query\.toActorId\s*\)/.test(body);
    const hasForbid = /REPORT_ACTOR_NOT_REPRESENTABLE/.test(body);
    const hasSelfScope = /participantActorId/.test(body) && /resolveReportActorId\s*\(/.test(body);

    if (!hasFromGate) failures.push('REPORTS_SLA_REGRESSION: fromActorId NÃO passa por canRepresentActor — actorId cru (divergência §9 voltou).');
    if (!hasToGate) failures.push('REPORTS_SLA_REGRESSION: toActorId NÃO passa por canRepresentActor — actorId cru (divergência §9 voltou).');
    if (!hasForbid) failures.push('REPORTS_SLA_REGRESSION: /transfers/sla sem 403 REPORT_ACTOR_NOT_REPRESENTABLE p/ actor alheio.');
    if (!hasSelfScope) failures.push('REPORTS_SLA_REGRESSION: sem filtro de actor não escopa self (participantActorId/resolveReportActorId) → risco tenant-wide.');
    // não pode mover dinheiro / tocar bank
    if (/\bbank_(transactions|ledger|accounts|splits)\b|bankTransactionService|createTransaction/i.test(body)) {
      failures.push('REPORTS_SLA_REGRESSION: /transfers/sla passou a tocar bank_* (fora do escopo; é leitura logística money-free).');
    }
  }
}

console.log(`[reports-transfers-sla-representation] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [reports-transfers-sla-representation]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [reports-transfers-sla-representation] — fromActorId/toActorId via canRepresentActor (403 senão); sem filtro → self-scoped (participantActorId); money-free; irmãs intactas.');
