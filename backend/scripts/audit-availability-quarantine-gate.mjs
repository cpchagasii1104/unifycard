#!/usr/bin/env node
// Gate estrutural — F-AVAILABILITY-WRITE-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena no SSOT temporal `availability`: todo writer vivo passa pelo chokepoint de
// autoridade-ATIVA antes de INSERT/UPDATE.
//   - o helper assertAvailabilityOwnerAuthorityActive resolve authorityActorId polimórfico (resolveAvailabilityOwner)
//     e chama isActorEffectivelyBlocked — NUNCA isActorEffectivelyBlocked(ownerId) cru;
//   - unifiedAvailabilityService.createAvailability e updateAvailability chamam o helper ANTES da escrita
//     (repository.create / repository.updateAvailability) — único chokepoint de WRITE;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - schedules/schedule_slots continuam SEM writer vivo (INSERT/UPDATE).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const HELPER = join(ROOT, 'src/core/availability/availability-owner-authority.ts');
const SVC = join(ROOT, 'src/core/availability/unified-availability.service.ts');
const AUTHZ = join(ROOT, 'src/core/authorization/authorization.service.ts');
const SRC = join(ROOT, 'src');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// 1) helper: resolve authorityActorId polimórfico + isActorEffectivelyBlocked (nunca ownerId cru)
{
  const raw = read(HELPER);
  if (!raw) {
    failures.push('AVAILABILITY_QUARANTINE_REGRESSION: availability-owner-authority.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    if (!/export async function assertAvailabilityOwnerAuthorityActive\b/.test(code)) {
      failures.push('AVAILABILITY_QUARANTINE_REGRESSION: helper assertAvailabilityOwnerAuthorityActive ausente.');
    }
    const m = code.match(/export async function assertAvailabilityOwnerAuthorityActive[\s\S]*?\n}/);
    const body = m ? m[0] : '';
    if (body) {
      if (!/resolveAvailabilityOwner\s*\(/.test(body)) failures.push('AVAILABILITY_QUARANTINE_REGRESSION: helper não resolve authorityActorId via resolveAvailabilityOwner (risco ownerId cru).');
      if (!/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*owner\.authorityActorId/.test(body)) {
        failures.push('AVAILABILITY_QUARANTINE_REGRESSION: helper não chama isActorEffectivelyBlocked sobre owner.authorityActorId (ownerId cru ou ausente).');
      }
    }
    // proibido isActorEffectivelyBlocked sobre ownerId cru em qualquer lugar do arquivo
    if (/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*ownerId\b/.test(code)) {
      failures.push('AVAILABILITY_QUARANTINE_REGRESSION: quarentena chamada com ownerId CRU (deve ser authorityActorId resolvido).');
    }
  }
}

// 2) service: create e update chamam o helper ANTES do repository write
{
  const raw = read(SVC);
  if (!raw) {
    failures.push('AVAILABILITY_QUARANTINE_REGRESSION: unified-availability.service.ts ausente.');
  } else {
    const code = stripTs(raw);
    for (const [method, writeRe] of [
      ['createAvailability', /unifiedAvailabilityRepository\.create\s*\(/],
      ['updateAvailability', /unifiedAvailabilityRepository\.updateAvailability\s*\(/],
    ]) {
      checked++;
      const start = code.indexOf(`async ${method}(`);
      if (start < 0) { failures.push(`AVAILABILITY_QUARANTINE_REGRESSION: método ${method} não localizado.`); continue; }
      const after = code.slice(start);
      const nextM = after.slice(5).search(/\n  async /);
      const body = nextM >= 0 ? after.slice(0, nextM + 5) : after;
      const iGate = body.search(/assertAvailabilityOwnerAuthorityActive\s*\(/);
      const iWrite = body.search(writeRe);
      if (iGate < 0) failures.push(`AVAILABILITY_QUARANTINE_REGRESSION: ${method} NÃO chama assertAvailabilityOwnerAuthorityActive — writer sem quarentena.`);
      else if (iWrite >= 0 && iGate > iWrite) failures.push(`AVAILABILITY_QUARANTINE_REGRESSION: ${method} escreve ANTES do gate de quarentena (tarde demais).`);
    }
  }
}

// 3) canRepresentActor não recebeu quarentena
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) {
      failures.push('AVAILABILITY_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
    }
  }
}

// 4) schedules/schedule_slots continuam SEM writer vivo
{
  const walk = (dir, acc = []) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e); const st = statSync(p);
      if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
      else if (e.endsWith('.ts')) acc.push(p);
    }
    return acc;
  };
  checked++;
  const offenders = [];
  for (const f of walk(SRC)) {
    const rel = f.replace(SRC, '').replace(/\\/g, '/');
    if (rel.includes('.test.') || rel.startsWith('/scripts/')) continue;
    const c = stripTs(read(f) || '');
    if (/INSERT\s+INTO\s+schedule(_slots)?\b/i.test(c) || /UPDATE\s+schedule(_slots)?\b/i.test(c)) offenders.push(rel);
  }
  if (offenders.length > 0) failures.push(`AVAILABILITY_QUARANTINE_REGRESSION: writer vivo revivido em schedules/schedule_slots: ${offenders.join(', ')}`);
}

console.log(`[availability-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [availability-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [availability-quarantine-gate] — create/update de availability bloqueiam owner quarentenado (authorityActorId resolvido) ANTES da escrita; canRepresentActor puro; schedules sem writer vivo.');
