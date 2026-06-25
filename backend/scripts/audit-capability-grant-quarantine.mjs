#!/usr/bin/env node
// Gate estrutural — F-CAPABILITY-GRANT-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena no capability-grant: actor de escopo bloqueado NÃO pode conceder/revogar.
//   - grant() e revoke() chamam isActorEffectivelyBlocked (via assertScopeAuthorityNotQuarantined) ANTES da escrita
//     (repository.insert / repository.revoke);
//   - canRepresentActor NÃO recebeu quarentena (continua puro — a quarentena vive na AÇÃO, não na representação).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/authority/actor-capability-grant.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const raw = read(SVC);
if (!raw) {
  failures.push('CAPABILITY_GRANT_QUARANTINE_REGRESSION: actor-capability-grant.service.ts ausente.');
} else {
  const code = stripTs(raw);
  // helper de quarentena importa/usa isActorEffectivelyBlocked
  if (!/isActorEffectivelyBlocked/.test(code)) {
    failures.push('CAPABILITY_GRANT_QUARANTINE_REGRESSION: service não usa isActorEffectivelyBlocked — gate de quarentena ausente.');
  }
  const gateRe = /assertScopeAuthorityNotQuarantined\s*\(/;

  for (const [method, writeRe] of [['grant', /actorCapabilityGrantRepository\.insert\s*\(/], ['revoke', /actorCapabilityGrantRepository\.revoke\s*\(/]]) {
    const m = code.match(new RegExp(`async ${method}\\([\\s\\S]*?(?=\\n {2}(async|\\w+\\(|\\}))`, ''));
    // fallback: fatiar do "async <method>(" até o próximo "async " ou fim
    let body = m ? m[0] : '';
    if (!body) {
      const start = code.indexOf(`async ${method}(`);
      if (start >= 0) { const next = code.indexOf('\n  async ', start + 5); body = code.slice(start, next > 0 ? next : code.length); }
    }
    if (!body) { failures.push(`CAPABILITY_GRANT_QUARANTINE_REGRESSION: método ${method} não localizado.`); continue; }
    checked++;
    const iGate = body.search(gateRe);
    const iWrite = body.search(writeRe);
    if (iGate < 0) {
      failures.push(`CAPABILITY_GRANT_QUARANTINE_REGRESSION: ${method}() NÃO chama assertScopeAuthorityNotQuarantined — actor bloqueado mexe na autoridade.`);
    } else if (iWrite >= 0 && iGate > iWrite) {
      failures.push(`CAPABILITY_GRANT_QUARANTINE_REGRESSION: ${method}() faz a escrita ANTES do gate de quarentena (gate tarde demais).`);
    }
  }
}

// canRepresentActor NÃO pode ter recebido quarentena (representação ≠ ação)
const authz = read(AUTHZ);
if (authz) {
  checked++;
  const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
  if (m && /isActorEffectivelyBlocked/.test(m[0])) {
    failures.push('CAPABILITY_GRANT_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA (quarentena vive na ação).');
  }
}

console.log(`[capability-grant-quarantine] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [capability-grant-quarantine]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [capability-grant-quarantine] — grant/revoke bloqueiam actor de escopo quarentenado ANTES da escrita; canRepresentActor segue puro.');
