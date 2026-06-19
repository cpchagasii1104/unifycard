#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8B-PROFILE-C1-BASELINE-RECONCILIATION (DECISION-0113 fatia 5.2/5.3 · Z2).
//
// Prova MATERIAL do binding dos 4 trilhos profile-c1 (interest / learning / professional / lifestyle), para
// justificar a saída do quarteto do BASELINE canal-1 (recognized, NÃO mascarado). Para cada superfície:
//   ROTA: o SUBJECT é server-side — `req.user?.userId` (via requireContext), threadado ao service; o
//         `actionContext.actorId` é apenas o TARGET (hint). Sem `req.user?.userId` → 401.
//   SERVICE: `resolveActorGuarded(tenantId, actorId, userId)` chama `canRepresentActor(tenantId, userId, actorId)`
//         fail-closed (403) e TODA superfície pública (read + writes) chama `await this.resolveActorGuarded(...)`
//         ANTES de qualquer chamada ao repository (sink). lifestyle ainda exige performer server-side
//         (resolvePerformerActorId/findByUserId), nunca o subject como fallback de autoria.
// MORDE se: o gate canRepresentActor sumir de qualquer service; um método público chamar o repository ANTES
// (ou sem) resolveActorGuarded; a rota deixar de derivar o subject de req.user; lifestyle perder o performer.
// Heurística textual comment-stripped (não AST) — falso positivo torna o gate MAIS restritivo. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const read = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); return null; }
  return stripTs(readFileSync(p, 'utf-8'));
};

// Extrai o corpo de um método `async <name>(` até o próximo `async <ident>(` ou fim.
const methodBody = (code, name) => {
  const re = new RegExp(`async\\s+${name}\\s*\\(`);
  const m = re.exec(code);
  if (!m) return null;
  const start = m.index;
  const nextRe = /async\s+[A-Za-z_$][\w$]*\s*\(/g;
  nextRe.lastIndex = start + m[0].length;
  const next = nextRe.exec(code);
  return code.slice(start, next ? next.index : code.length);
};

const SURFACES = [
  {
    name: 'interest-c1',
    routes: 'src/core/profile/interest-c1/interest-c1.routes.ts',
    service: 'src/core/profile/interest-c1/interest-c1.service.ts',
    repoVar: 'interestC1Repository',
    methods: ['getInterestC1', 'declareConcept', 'updateConcept', 'retireConcept'],
  },
  {
    name: 'learning-c1',
    routes: 'src/core/profile/learning-c1/learning-c1.routes.ts',
    service: 'src/core/profile/learning-c1/learning-c1.service.ts',
    repoVar: 'learningC1Repository',
    methods: ['getLearningC1', 'declareConcept', 'updateConcept', 'retireConcept'],
  },
  {
    name: 'professional-c1',
    routes: 'src/core/profile/professional-c1/professional-c1.routes.ts',
    service: 'src/core/profile/professional-c1/professional-c1.service.ts',
    repoVar: 'professionalC1Repository',
    methods: ['getProfessionalC1', 'updateBio', 'declareConcept', 'updateConcept', 'retireConcept'],
  },
  {
    name: 'lifestyle',
    routes: 'src/core/profile/lifestyle/lifestyle.routes.ts',
    service: 'src/core/profile/lifestyle/lifestyle.service.ts',
    repoVar: 'lifestyleRepository',
    methods: ['getLifestyle', 'declareAttribute', 'retireAttribute'],
    requiresPerformer: true, // LGPD: autoria server-side, nunca o subject como fallback.
  },
];

// canRepresentActor(tenantId, userId, actorId) — subject=userId (server-side), target=actorId.
const CAN_REP = /canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*actorId\s*\)/;

for (const s of SURFACES) {
  const route = read(s.routes);
  const svc = read(s.service);
  if (route === null || svc === null) continue;

  // ── ROTA: subject server-side (req.user.userId) ──
  if (!/req\.user\??\.userId/.test(route)) {
    failures.push(`${s.routes}: SUBJECT deve vir de req.user.userId (requireContext) — não encontrado.`);
  }
  // ── ROTA: target/hint é o actionContext.actorId (canal-1) ──
  if (!/actionContext\??\.\s*actorId/.test(route)) {
    failures.push(`${s.routes}: esperado actionContext.actorId como TARGET (hint) do trilho profile-c1 — não encontrado.`);
  }
  // ── ROTA: PROIBIDO usar req.user.userId como o TARGET/actorId do service (subject != target) ──
  // (o actorId passado ao service deve ser o actionContext.actorId, não o userId).
  if (/Service\.\w+\(\s*tenantId\s*,\s*userId\b/.test(route)) {
    failures.push(`${s.routes}: PROIBIDO passar userId como actorId (target) ao service — target = actionContext.actorId.`);
  }

  // ── SERVICE: gate canônico ──
  if (!CAN_REP.test(svc)) {
    failures.push(`${s.service}: resolveActorGuarded DEVE chamar canRepresentActor(tenantId, userId, actorId).`);
  }
  if (!/resolveActorGuarded\s*\(/.test(svc)) {
    failures.push(`${s.service}: resolveActorGuarded ausente.`);
  }

  // ── SERVICE: cada método público gateia ANTES do repository (sink) ──
  const repoCall = new RegExp(`\\b${s.repoVar}\\.`);
  for (const mName of s.methods) {
    const body = methodBody(svc, mName);
    if (!body) { failures.push(`${s.service}: método público ${mName} não encontrado (mudou a superfície?).`); continue; }
    const g = body.search(/this\.resolveActorGuarded\s*\(/);
    const sink = body.search(repoCall);
    if (g < 0) { failures.push(`${s.service}.${mName}: NÃO chama this.resolveActorGuarded (gate ausente).`); continue; }
    if (sink >= 0 && g > sink) {
      failures.push(`${s.service}.${mName}: resolveActorGuarded roda DEPOIS do sink ${s.repoVar} (gate@${g} sink@${sink}) — mover ANTES.`);
    }
  }

  // ── lifestyle (LGPD): performer server-side, sem fallback p/ subject ──
  if (s.requiresPerformer) {
    if (!/resolvePerformerActorId\s*\(/.test(route) || !/findByUserId\s*\(/.test(route)) {
      failures.push(`${s.routes}: lifestyle DEVE derivar performedByActorId server-side (resolvePerformerActorId/findByUserId).`);
    }
    if (/performedByActorId[^\n]*\?\?\s*actorId/.test(svc) || /performedByActorId\s*=\s*actorId/.test(svc)) {
      failures.push(`${s.service}: PROIBIDO performedByActorId cair no subject (actorId) como fallback de autoria.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [profile-c1-actor-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [profile-c1-actor-binding] — interest/learning/professional/lifestyle: subject=req.user.userId; canRepresentActor(tenantId, userId, actorId) ANTES de todo sink; lifestyle com performer server-side. Quarteto bound (justifica saída do baseline canal-1).');
