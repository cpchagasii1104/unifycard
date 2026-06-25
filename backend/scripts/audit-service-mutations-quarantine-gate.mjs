#!/usr/bin/env node
// Gate estrutural — F-SERVICE-MUTATIONS-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena nas mutações de serviço (create/edit/disable):
//   - createService chama assertActorNotQuarantined(scopeActor=input.actorId) ANTES de servicesRepository.create,
//     e também o grantee quando há caminho de grant;
//   - updateService chama assertActorNotQuarantined(scopeActor=currentService.actorId) ANTES de
//     servicesRepository.update, e também o grantee no caminho de grant;
//   - o gate recebe actorId RESOLVIDO (input.actorId/currentService.actorId/granteeActorId), NUNCA userId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - composição capability preservada (canRepresentActor OR hasCapabilityGrant) + required caps edit/disable exatas;
//   - caso misto ainda exige services:edit E services:disable.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/services/services.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const raw = read(SVC);
if (!raw) {
  failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: services.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper de quarentena usa isActorEffectivelyBlocked (nunca userId cru)
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente.');
  else if (!/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: helper não chama isActorEffectivelyBlocked(tenantId, actorId).');
  }

  // createService: gate scopeActor ANTES de repository.create + grantee no caminho de grant
  {
    checked++;
    const body = sliceMethod(code, 'async createService(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*input\.actorId\)/);
    const iGrantee = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*granteeActorId\)/);
    const iWrite = body.search(/servicesRepository\.create\s*\(/);
    if (iGate < 0) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: createService NÃO checa scopeActor (input.actorId) — mutação sem quarentena.');
    else if (iWrite >= 0 && iGate > iWrite) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: createService escreve ANTES do gate (tarde demais).');
    if (iGrantee < 0) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: createService NÃO checa o grantee (operador via grant) — grant antigo atravessaria quarentena.');
    // composição capability preservada
    if (!/hasCapabilityGrant\(tenantId,\s*granteeActorId,\s*'services:create'/.test(body)) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: createService perdeu a composição hasCapabilityGrant(services:create).');
    }
    // gate não usa userId cru
    if (/assertActorNotQuarantined\(tenantId,\s*userId\b/.test(body)) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: createService usa userId CRU no gate (deve ser actorId resolvido).');
    }
  }

  // updateService: gate scopeActor ANTES de repository.update + grantee + required caps exatas
  {
    checked++;
    const body = sliceMethod(code, 'async updateService(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*currentService\.actorId\)/);
    const iGrantee = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*granteeActorId\)/);
    const iWrite = body.search(/servicesRepository\.update\s*\(/);
    if (iGate < 0) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService NÃO checa scopeActor (currentService.actorId).');
    else if (iWrite >= 0 && iGate > iWrite) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService escreve ANTES do gate (tarde demais).');
    if (iGrantee < 0) failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService NÃO checa o grantee no caminho de grant.');
    // required caps edit/disable exatas + misto exige as duas
    if (!/requiredCaps\.add\('services:disable'\)/.test(body) || !/requiredCaps\.add\('services:edit'\)/.test(body)) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService perdeu required caps exatas (services:edit/services:disable).');
    }
    if (!/isDisableTransition\s*=\s*input\.status === ServiceStatus\.PAUSED/.test(body)) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService perdeu a semântica disable = status→paused.');
    }
    if (/assertActorNotQuarantined\(tenantId,\s*userId\b/.test(body)) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: updateService usa userId CRU no gate.');
    }
  }
}

// canRepresentActor não recebeu quarentena
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) {
      failures.push('SERVICE_MUTATIONS_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
    }
  }
}

console.log(`[service-mutations-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-mutations-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-mutations-quarantine-gate] — create/update de serviço bloqueiam scopeActor E grantee quarentenado (actorId resolvido) ANTES da escrita; composição capability + required caps exatas preservadas; canRepresentActor puro.');
