#!/usr/bin/env node
// Gate estrutural — F-COMPANY-OPERATIONAL-ACTIVATION-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena na ativação operacional de empresa: actor institucional (page) ou responsável
// bloqueado NÃO pode tornar a empresa operacional.
//   - activateCompanyOperationally chama isActorEffectivelyBlocked ANTES da escrita (BEGIN/FOR UPDATE/UPDATE);
//   - canRepresentActor NÃO recebeu quarentena (continua puro — quarentena vive na AÇÃO);
//   - o gate de ATIVAÇÃO de offering (services-offering-activation-gate) segue usando isActorEffectivelyBlocked.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/core/companies/companies.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const OFFERING_GATE = join(process.cwd(), 'src/modules/services/services-offering-activation-gate.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const raw = read(SVC);
if (!raw) {
  failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: companies.service.ts ausente.');
} else {
  const code = stripTs(raw);
  const start = code.indexOf('async activateCompanyOperationally(');
  if (start < 0) {
    failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: método activateCompanyOperationally não localizado.');
  } else {
    checked++;
    // fatiar do método até o próximo "  async " / "  private "
    const after = code.slice(start);
    const nextM = after.slice(5).search(/\n  (async|private) /);
    const body = nextM >= 0 ? after.slice(0, nextM + 5) : after;

    const iGate = body.search(/isActorEffectivelyBlocked\s*\(/);
    const iBegin = body.search(/BEGIN/);
    const iForUpdate = body.search(/FOR UPDATE/);
    const iUpdate = body.search(/UPDATE\s+companies/i);
    const firstWrite = Math.min(...[iBegin, iForUpdate, iUpdate].filter((i) => i >= 0));

    if (iGate < 0) {
      failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: activateCompanyOperationally NÃO chama isActorEffectivelyBlocked — actor bloqueado ativa empresa.');
    } else if (Number.isFinite(firstWrite) && iGate > firstWrite) {
      failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: gate de quarentena vem DEPOIS da 1ª escrita (BEGIN/FOR UPDATE/UPDATE) — tarde demais.');
    }
  }
}

// canRepresentActor NÃO pode ter recebido quarentena
const authz = read(AUTHZ);
if (authz) {
  checked++;
  const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
  if (m && /isActorEffectivelyBlocked/.test(m[0])) {
    failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

// offering-activation-gate continua com seu próprio gate de quarentena
const og = read(OFFERING_GATE);
if (og) {
  checked++;
  if (!/isActorEffectivelyBlocked/.test(stripTs(og))) {
    failures.push('COMPANY_ACTIVATION_QUARANTINE_REGRESSION: services-offering-activation-gate perdeu o gate de quarentena (regressão).');
  }
}

console.log(`[company-activation-quarantine] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [company-activation-quarantine]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [company-activation-quarantine] — ativação operacional bloqueia actor quarentenado ANTES da escrita; canRepresentActor puro; offering-gate intacto.');
