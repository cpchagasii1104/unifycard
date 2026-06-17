#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R6.1-SERVICES-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// Sela a contenção LOCALIZADA do bolsão legado /services: POST /services e PUT /services/:id
// criavam/atualizavam serviço em nome de um actor sem provar representação (POST confiava em
// body.actorId; PUT tinha check fraco `actor.user_id !== userId && actor_type !== 'user'`). Agora o
// principal autenticado (req.user.userId) DEVE provar representação do actor DONO via canRepresentActor
// (fail-closed → 403 SERVICE_ACTOR_NOT_REPRESENTABLE) ANTES de qualquer write.
//
// MORDE se:
//   - a rota/service escrever serviço sem canRepresentActor;
//   - canRepresentActor ocorrer DEPOIS do sink (createService/updateService);
//   - o actorId declarado for usado como SUBJECT (spoof);
//   - o subject não vier de req.user.userId;
//   - o 403 SERVICE_ACTOR_NOT_REPRESENTABLE for removido;
//   - o check fraco de existência/`actor.user_id` voltar a substituir representabilidade no service;
//   - service-offering.service.ts regredir (perder canRepresentActor).
//
// Heurística file-level (não AST). Escopado a services.routes.ts + services.service.ts (contenção
// localizada; NÃO fecha DT-mãe 0113). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const readStripped = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); return null; }
  return stripTs(readFileSync(p, 'utf-8'));
};

const ROUTES = 'src/modules/services/services.routes.ts';
const SERVICE = 'src/modules/services/services.service.ts';
const OFFERING = 'src/modules/services/service-offering.service.ts';

// ── services.routes.ts (gate de rota) ──────────────────────────────────────────────────────
const rc = readStripped(ROUTES);
if (rc !== null) {
  if (!/const\s+userId\s*=\s*\(?[^\n;]*req[^\n;]*\.user\??\.userId/.test(rc)) {
    failures.push(`${ROUTES}: DEVE derivar o subject de req.user.userId server-side (const userId = ... req.user.userId).`);
  }
  if (!/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/.test(rc)) {
    failures.push(`${ROUTES}: POST /services DEVE chamar canRepresentActor(req.tenant.id, userId, parsed.data.actorId).`);
  }
  if (!/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*current\.actorId\s*\)/.test(rc)) {
    failures.push(`${ROUTES}: PUT /services/:id DEVE chamar canRepresentActor(req.tenant.id, userId, current.actorId) sobre o dono server-resolved.`);
  }
  if (!/status\(\s*403\s*\)[\s\S]{0,200}SERVICE_ACTOR_NOT_REPRESENTABLE/.test(rc)) {
    failures.push(`${ROUTES}: DEVE retornar 403 com code SERVICE_ACTOR_NOT_REPRESENTABLE quando não representável.`);
  }
  // Posicional: gate ANTES do sink.
  const idxPostGate = rc.search(/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/);
  const idxCreate = rc.search(/servicesService\.createService\s*\(/);
  if (idxCreate !== -1 && (idxPostGate === -1 || idxPostGate > idxCreate)) {
    failures.push(`${ROUTES}: o gate canRepresentActor DEVE ocorrer ANTES de servicesService.createService.`);
  }
  const idxPutGate = rc.search(/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*current\.actorId\s*\)/);
  const idxUpdate = rc.search(/servicesService\.updateService\s*\(/);
  if (idxUpdate !== -1 && (idxPutGate === -1 || idxPutGate > idxUpdate)) {
    failures.push(`${ROUTES}: o gate canRepresentActor DEVE ocorrer ANTES de servicesService.updateService.`);
  }
  // FORBID: actor declarado como subject.
  if (/canRepresentActor\([^,)]*,\s*parsed\.data\.actorId\s*,/.test(rc)) {
    failures.push(`${ROUTES}: PROIBIDO — canRepresentActor com parsed.data.actorId como SUBJECT (2º arg). Subject = req.user.userId.`);
  }
  if (/canRepresentActor\([^,)]*,\s*req\.actionContext\??\.\s*actorId\b/.test(rc)) {
    failures.push(`${ROUTES}: PROIBIDO — canRepresentActor com actionContext.actorId (client-declared) como SUBJECT.`);
  }
}

// ── services.service.ts (defesa em profundidade + remoção do check fraco) ───────────────────
const sc = readStripped(SERVICE);
if (sc !== null) {
  if (!/canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*input\.actorId\s*\)/.test(sc)) {
    failures.push(`${SERVICE}: createService DEVE chamar canRepresentActor(tenantId, userId, input.actorId).`);
  }
  if (!/canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*currentService\.actorId\s*\)/.test(sc)) {
    failures.push(`${SERVICE}: updateService DEVE chamar canRepresentActor(tenantId, userId, currentService.actorId).`);
  }
  // FORBID: o check fraco anterior (bypass para actor-type 'user').
  if (/actor\.user_id\s*!==\s*userId\s*&&\s*actor\.actor_type\s*!==\s*'user'/.test(sc)) {
    failures.push(`${SERVICE}: PROIBIDO — check fraco \`actor.user_id !== userId && actor.actor_type !== 'user'\` reintroduzido (substitua por canRepresentActor).`);
  }
}

// ── service-offering.service.ts (não-regressão do padrão canônico) ─────────────────────────
const oc = readStripped(OFFERING);
if (oc !== null && !/canRepresentActor\s*\(/.test(oc)) {
  failures.push(`${OFFERING}: PROIBIDO — service-offering perdeu canRepresentActor (regressão do padrão canônico).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [services-actor-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [services-actor-binding] — POST/PUT /services vinculam o actor dono via canRepresentActor (req.user.userId, fail-closed 403) antes do write.');
