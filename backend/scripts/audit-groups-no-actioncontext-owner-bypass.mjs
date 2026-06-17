#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R1-GROUPS-HANDROLLED-BYPASS-CONTAINMENT (DECISION-0113 / Z2).
// MORDE o gate hand-rolled de groups que tratava `actionContext.actorId` declarado como AUTORIDADE:
//   const isOwner = group.ownerActorId === req.actionContext.actorId;  ← PROIBIDO (actorId = hint, não authority).
// A autoridade correta = o USUÁRIO AUTENTICADO (req.user.userId) REPRESENTA o owner actor (canRepresentActor).
// Em validate:regression-guards. Escopado a groups.routes.ts (contenção localizada; não fecha DT-mãe 0113).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const REL = 'src/modules/groups/groups.routes.ts';
const failures = [];
const p = join(ROOT, REL);

if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${REL}.`);
} else {
  const code = stripTs(readFileSync(p, 'utf-8'));

  // PROIBIDO: ownership por comparação direta com o actorId declarado (bypass spoofável).
  if (/ownerActorId\s*===\s*(req\.)?actionContext\.actorId/.test(code) ||
      /(req\.)?actionContext\.actorId\s*===\s*group\.ownerActorId/.test(code)) {
    failures.push(`${REL}: ownership por \`ownerActorId === actionContext.actorId\` (actorId declarado = authority) — PROIBIDO (DECISION-0113/Z2). Use canRepresentActor.`);
  }
  // PROIBIDO: userIdForCheck derivado do actor DECLARADO (alimentava admin/RBAC com identidade spoofável).
  if (/userIdForCheck\s*=\s*actor\.user_id/.test(code)) {
    failures.push(`${REL}: userIdForCheck derivado do actor declarado (actionContext.actorId) — use req.user.userId (autenticado).`);
  }
  // OBRIGATÓRIO: o gate de owner usa canRepresentActor sobre o usuário AUTENTICADO.
  if (!/canRepresentActor\s*\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(code)) {
    failures.push(`${REL}: ownership de grupo DEVE usar canRepresentActor(tenantId, userIdForCheck, group.ownerActorId) — autoridade pelo usuário autenticado.`);
  }
  // OBRIGATÓRIO: userIdForCheck vem do usuário autenticado (req.user.userId).
  if (!/const\s+userIdForCheck\s*=\s*req\.user\.userId/.test(code)) {
    failures.push(`${REL}: userIdForCheck DEVE vir de req.user.userId (autenticado server-side), não do actorId declarado.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [groups-no-actioncontext-owner-bypass]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [groups-no-actioncontext-owner-bypass]');
