#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8N (automation + human-mvp SCHEMA-GHOST containment; DECISION-0113 / Z2)
// + DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II (invariante de enum, 2026-07-31).
//
// automation.routes.ts (HTTP) e human-mvp (tabelas human_mvp_* ausentes) são schema-ghost (dead-at-db)
// na SUPERFÍCIE HTTP. As rotas foram contidas: 501 AUTOMATION_SCHEMA_GHOST_CONTAINED /
// HUMAN_MVP_SCHEMA_GHOST_CONTAINED antes de qualquer service/sink. MORDE se: alguma rota voltar a chamar o service
// (alertService/scheduledActionService/humanMvp*Service); reaparecer actionContext.actorId como autoridade;
// sumir o code de contenção; tocar bank_*; OU se o gate run-due (AUTOMATION_RUN_DUE_HTTP_DISABLED) sumir.
// 🔴 A tabela `alerts` deixou de ser schema-ghost em 2026-07-31 (migrations/20260731120000_alerts_substrate.sql,
// DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II) — automationService.processEvent()/alertService.createAlert()
// (chamados de dentro do domínio, NÃO da rota HTTP contida acima) agora gravam de verdade em 3 callers vivos.
// `scheduled_actions` segue ausente/schema-ghost — não confundir os dois substratos.
// Invariante nova: nenhum caller vivo de `alertService.createAlert()` escreve `type:` fora do enum `alert_type`
// (fonte única = a própria migration, nunca uma segunda lista hardcoded aqui). MORDE se: a migration sumir/mudar
// de nome; um caller conhecido escrever um `type:` fora do enum extraído; o número de call-sites conhecidos mudar
// (8 hoje — 6 automation.service.ts + 1 subscription.service.ts + 1 penalty.service.ts) sem atualizar este guard.
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

// ── invariante: nenhum caller vivo de createAlert() escreve `type` fora do enum alert_type ──
// Fonte única = migrations/20260731120000_alerts_substrate.sql (nunca uma segunda lista aqui).
const ALERTS_MIGRATION = 'migrations/20260731120000_alerts_substrate.sql';
const migSql = read(ALERTS_MIGRATION);
if (migSql === null) {
  failures.push(`arquivo ausente: ${ALERTS_MIGRATION} — sem ele não há como extrair a fonte única do enum alert_type.`);
} else {
  const enumMatch = migSql.match(/CREATE TYPE alert_type AS ENUM\s*\(([\s\S]*?)\)\s*;/);
  if (!enumMatch) {
    failures.push(`${ALERTS_MIGRATION}: não achou "CREATE TYPE alert_type AS ENUM (...)" — guard não extrai o vocabulário.`);
  } else {
    const validTypes = new Set([...enumMatch[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]));
    if (validTypes.size === 0) failures.push(`${ALERTS_MIGRATION}: extraiu 0 valores de alert_type.`);

    const ALERT_CALLERS = [
      'src/modules/automation/automation.service.ts',
      'src/modules/subscriptions/subscription.service.ts',
      'src/core/reputation/penalty.service.ts',
    ];
    let sitesFound = 0;
    for (const rel of ALERT_CALLERS) {
      const content = read(rel);
      if (content === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
      const callRe = /alertService\s*\.\s*createAlert\s*\([\s\S]*?type:\s*([^,]+),/g;
      let m;
      while ((m = callRe.exec(content)) !== null) {
        sitesFound++;
        const segment = m[1].trim();
        const literals = [...segment.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
        if (literals.length === 0) {
          failures.push(`${rel}: createAlert() com \`type:\` não-literal ("${segment}") — guard não consegue verificar estruturalmente, use literal do enum.`);
          continue;
        }
        for (const lit of literals) {
          if (!validTypes.has(lit)) {
            failures.push(`${rel}: createAlert() escreve type='${lit}', fora do enum alert_type (${[...validTypes].sort().join(', ')}).`);
          }
        }
      }
    }
    if (sitesFound !== 8) {
      failures.push(`esperado exatamente 8 chamadas alertService.createAlert(...) com \`type:\` literal nos 3 callers conhecidos (6 automation.service.ts + 1 subscription.service.ts + 1 penalty.service.ts), encontradas ${sitesFound}. Caller sumiu ou apareceu sem atualizar o guard.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [automation-human-mvp-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [automation-human-mvp-ghost-containment] — automation (9 rotas) + human-mvp (5 rotas) contidas (501 *_SCHEMA_GHOST_CONTAINED) antes de service/sink; run-due preserva 403; zero service/actionContext.actorId/bank_* nas rotas. alerts (tabela) fora do schema-ghost desde 2026-07-31; 8/8 call-sites de createAlert() escrevem `type` dentro do enum alert_type extraído da migration.');
