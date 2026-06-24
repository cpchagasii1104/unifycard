#!/usr/bin/env node
// Gate estrutural — F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION.
// Trava os invariantes do elo B1 (sugestão de concept company-scoped a partir da evidência fiscal):
//   - suggestEconomicActivityConceptForCompany é READ-ONLY (sem INSERT/UPDATE/DELETE);
//   - NÃO autoativa (não chama activateCompanyOperationally) nem publica (publishCompanyConcept);
//   - reusa suggestConceptForCnae preservando o filtro review_status='approved' (sugestão só aprovada);
//   - a rota GET /:companyId/economic-activity-suggestion é company-scoped por canManageCompany e é GET;
//   - CNAE/referral não viram autoridade (sem referral_code no caminho).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src/core/companies/companies.service.ts');
const ROUTES = join(ROOT, 'src/core/companies/companies.routes.ts');
const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1) Service: método company-scoped READ-ONLY + filtro approved no resolver reusado.
{
  const raw = read(SVC);
  if (!raw) {
    failures.push('EAS_REGRESSION: companies.service.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    // extrai o corpo do método (até o próximo `async ` no mesmo nível ou fim do arquivo).
    const m = code.match(/async suggestEconomicActivityConceptForCompany\([\s\S]*?(?=\n {2}async |\n}\s*$)/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('EAS_REGRESSION: método suggestEconomicActivityConceptForCompany ausente (enforcement do elo B1 some).');
    } else {
      if (/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i.test(body)) {
        failures.push('EAS_REGRESSION: suggestEconomicActivityConceptForCompany contém ESCRITA (INSERT/UPDATE/DELETE) — deve ser READ-ONLY.');
      }
      if (/activateCompanyOperationally\s*\(|publishCompanyConcept\s*\(/.test(body)) {
        failures.push('EAS_REGRESSION: suggestEconomicActivityConceptForCompany chama ativação/publicação — sugestão NÃO autoativa/publica.');
      }
      if (!/suggestConceptForCnae\s*\(/.test(body)) {
        failures.push('EAS_REGRESSION: método não reusa suggestConceptForCnae (resolver canônico) — risco de trilho paralelo.');
      }
      if (/referral_code/.test(body)) {
        failures.push('EAS_REGRESSION: referral_code no caminho de sugestão (comercial ≠ authority).');
      }
    }
    // o resolver reusado precisa manter o filtro de sugestão aprovada.
    if (!/review_status\s*=\s*'approved'/.test(code)) {
      failures.push("EAS_REGRESSION: suggestConceptForCnae perdeu o filtro review_status='approved' — sugestão não-curada vazaria.");
    }
  }
}

// 2) Rota: company-scoped (canManageCompany), GET, sem ativar/publicar.
{
  const raw = read(ROUTES);
  if (!raw) {
    failures.push('EAS_REGRESSION: companies.routes.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    // captura o handler inteiro: da string da rota até a PRÓXIMA registração `fastify.` (comentários já strippados).
    const m = code.match(/'\/:companyId\/economic-activity-suggestion'[\s\S]*?(?=\n {2}fastify\.)/);
    const handler = m ? m[0] : '';
    if (!/fastify\.get<[^>]*>\('\/:companyId\/economic-activity-suggestion'|fastify\.get\('\/:companyId\/economic-activity-suggestion'/.test(code)) {
      failures.push('EAS_REGRESSION: rota economic-activity-suggestion não é fastify.get (deve ser READ-ONLY GET).');
    }
    if (handler) {
      if (!/canManageCompany\s*\(/.test(handler)) {
        failures.push('EAS_REGRESSION: rota economic-activity-suggestion sem canManageCompany — autoridade company-scoped ausente.');
      }
      if (/activateCompanyOperationally\s*\(|publishCompanyConcept\s*\(/.test(handler)) {
        failures.push('EAS_REGRESSION: handler da sugestão chama ativação/publicação — proibido.');
      }
    } else {
      failures.push('EAS_REGRESSION: handler da rota economic-activity-suggestion não localizado.');
    }
  }
}

console.log(`[economic-activity-suggestion-readonly] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [economic-activity-suggestion-readonly]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log("GATE OK [economic-activity-suggestion-readonly] — sugestão company-scoped READ-ONLY; canManageCompany; não autoativa/publica; filtro approved; CNAE/referral não são autoridade.");
