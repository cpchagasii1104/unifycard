// audit-demand-orchestration-boundary.mjs — DECISION-0164
// FRONTEIRAS do motor de demanda: (1) Δbank=0 (módulo NUNCA toca bank_*/ledger/payment);
// (2) catraca 0113 em TODA rota (assertRepresentsActor 1:1 com rotas);
// (3) RLS FORCE + GUC canônico app.current_tenant nas 2 tabelas (migration);
// (4) vocabulários compostos da fonte (types), nunca re-enumerados no service.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
let fail = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  OK ' : '  ❌ '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail++;
};

const files = {
  routes: read('src/modules/demands/demand.routes.ts'),
  service: read('src/modules/demands/demand.service.ts'),
  repo: read('src/modules/demands/demand.repository.ts'),
  types: read('src/modules/demands/demand.types.ts'),
  mig: read('migrations/20260707120000_service_demand_substrate.sql'),
};

// (1) Δbank=0 — exceto comentários de fronteira
for (const [k, src] of Object.entries(files)) {
  if (k === 'mig') continue;
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  check(`Δbank=0 em ${k}`, !/bank_ledger|bank_transactions|bank_accounts|payment_intents|executePayment/.test(code));
}

// (2) catraca 0113: cada rota fastify.<verb> tem assertRepresentsActor
const routeCount = (files.routes.match(/fastify\.(get|post|patch|put|delete)</g) || []).length
  + (files.routes.match(/fastify\.(get|post|patch|put|delete)\('/g) || []).length;
const gateCount = (files.routes.match(/assertRepresentsActor\(req, reply/g) || []).length;
check('catraca 0113 em toda rota (gate 1:1)', routeCount > 0 && gateCount >= routeCount, `rotas=${routeCount} gates=${gateCount}`);
check('rotas usam canRepresentActor (não RBAC-stub)', files.routes.includes('canRepresentActor'));

// (3) RLS canônica nas duas tabelas
for (const t of ['service_demands', 'service_demand_responses']) {
  check(`RLS FORCE em ${t}`, files.mig.includes(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`));
}
check('GUC canônico app.current_tenant (nunca app.tenant_id)',
  (files.mig.match(/app\.current_tenant/g) || []).length >= 4 && !files.mig.includes("app.tenant_id"));

// (4) vocabulários compostos da fonte
check('service importa vocabulários da fonte', /DEMAND_VINCULOS.*DEMAND_ACCEPTANCE_MODES|DEMAND_ACCEPTANCE_MODES/.test(files.service)
  && files.service.includes("from './demand.types'"));
check('fonte define os 4+1 vocabulários', ['DEMAND_VINCULOS', 'DEMAND_ACCEPTANCE_MODES', 'DEMAND_PRICING_MODES', 'DEMAND_STATUSES', 'DEMAND_RESPONSE_STATUSES']
  .every((s) => files.types.includes(`export const ${s}`)));

// (5) selos de coerência do motor
check('vaga atômica (fillSlot com WHERE status/quantity)', files.repo.includes("status = 'open' AND quantity_filled < quantity"));
check('anti-double-commit de agenda presente', files.repo.includes('hasScheduleConflict') && files.service.includes('hasScheduleConflict'));
check('plateia 0162 na leitura (ótica do emissor)', files.repo.includes('audience_relationship_types') && files.repo.includes('requester_label ELSE ar.target_label'));

// (6) FIX YALA #6 — audiência é CONTROLE DE ACESSO, não só filtro de lista:
// assertAudience obrigatório no read-por-id E no respond (o guard antigo dava falso-verde)
const assertCalls = (files.service.match(/await this\.assertAudience\(/g) || []).length;
check('assertAudience em getWithResponses + respond (≥2 call-sites)', assertCalls >= 2, `calls=${assertCalls}`);
check('predicado de audiência por id existe no repo', files.repo.includes('isActorInAudience'));
// (7) FIX YALA #4 — transições de resposta são CONDICIONAIS (anti double-release/over-fill)
check('transição condicional (updateResponseStatusIf) em uso no service',
  files.service.includes('updateResponseStatusIf') && !/await demandRepository\.updateResponseStatus\(/.test(files.service));

if (fail) { console.log(`\nDEMAND-ORCHESTRATION-BOUNDARY: FAIL (${fail})`); process.exit(1); }
console.log('\nDEMAND-ORCHESTRATION-BOUNDARY: OK');
