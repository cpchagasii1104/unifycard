#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8N (automation + human-mvp SCHEMA-GHOST containment; DECISION-0113 / Z2).
//
// automation (tabelas alerts/scheduled_actions ausentes) e human-mvp (tabelas human_mvp_* ausentes) são
// schema-ghost (dead-at-db). As rotas foram contidas: 501 AUTOMATION_SCHEMA_GHOST_CONTAINED /
// HUMAN_MVP_SCHEMA_GHOST_CONTAINED antes de qualquer service/sink. MORDE se: alguma rota voltar a chamar o service
// (alertService/scheduledActionService/humanMvp*Service); reaparecer actionContext.actorId como autoridade;
// sumir o code de contenção; tocar bank_*; OU se o gate run-due (AUTOMATION_RUN_DUE_HTTP_DISABLED) sumir.
// Comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const failures = [];

// ── automation ──
const AUTO = 'src/modules/automation/automation.routes.ts';
const auto = read(AUTO);
if (auto === null) { failures.push(`arquivo ausente: ${AUTO}`); }
else {
  if (!/AUTOMATION_SCHEMA_GHOST_CONTAINED/.test(auto)) failures.push(`${AUTO}: perdeu o code AUTOMATION_SCHEMA_GHOST_CONTAINED.`);
  // run-due preserva seu gate próprio (R18).
  if (!/AUTOMATION_RUN_DUE_HTTP_DISABLED/.test(auto)) failures.push(`${AUTO}: perdeu o gate run-due AUTOMATION_RUN_DUE_HTTP_DISABLED.`);
  // proibido voltar a chamar os services / executar.
  for (const re of [/alertService\s*\./, /scheduledActionService\s*\./, /executeDueActions\s*\(/, /auditService\s*\./]) {
    if (re.test(auto)) failures.push(`${AUTO}: voltou a chamar service/sink (${re}) — schema-ghost deve ficar contido (501) antes de qualquer service.`);
  }
  if (/actionContext\s*\.\s*actorId/.test(auto)) failures.push(`${AUTO}: voltou a referenciar actionContext.actorId — handlers contidos não leem ator do cliente.`);
  if (/bank_ledger|bank_transactions|bank_splits/.test(auto)) failures.push(`${AUTO}: referencia bank_*.`);
  // pelo menos 5 rotas contidas (3 GET alerts + 2 writes alerts + ...): exige >=8 ocorrências do 501 ghost.
  const contained = (auto.match(/AUTOMATION_GHOST_BODY/g) || []).length;
  if (contained < 9) failures.push(`${AUTO}: esperado >= 9 referências a AUTOMATION_GHOST_BODY (rotas contidas), encontradas ${contained}.`);
}

// ── human-mvp ──
const HM = 'src/modules/human-mvp/human-mvp.routes.ts';
const hm = read(HM);
if (hm === null) { failures.push(`arquivo ausente: ${HM}`); }
else {
  if (!/HUMAN_MVP_SCHEMA_GHOST_CONTAINED/.test(hm)) failures.push(`${HM}: perdeu o code HUMAN_MVP_SCHEMA_GHOST_CONTAINED.`);
  for (const re of [/humanMvpSkillService\s*\./, /humanMvpServiceOfferService\s*\./, /humanMvpOpportunityService\s*\./, /humanMvpEventInstanceService\s*\./, /humanMvpActivityExecutionService\s*\./]) {
    if (re.test(hm)) failures.push(`${HM}: voltou a chamar service/sink (${re}) — schema-ghost deve ficar contido (501).`);
  }
  if (/actionContext\s*\.\s*actorId/.test(hm)) failures.push(`${HM}: voltou a referenciar actionContext.actorId — handler contido não lê ator do cliente.`);
  if (/bank_ledger|bank_transactions|bank_splits/.test(hm)) failures.push(`${HM}: referencia bank_*.`);
  const containedHm = (hm.match(/HUMAN_MVP_GHOST_BODY/g) || []).length;
  if (containedHm < 5) failures.push(`${HM}: esperado >= 5 rotas contidas (HUMAN_MVP_GHOST_BODY), encontradas ${containedHm}.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [automation-human-mvp-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [automation-human-mvp-ghost-containment] — automation (9 rotas) + human-mvp (5 rotas) contidas (501 *_SCHEMA_GHOST_CONTAINED) antes de service/sink; run-due preserva 403; zero service/actionContext.actorId/bank_* nas rotas. Schema-ghost blindado.');
