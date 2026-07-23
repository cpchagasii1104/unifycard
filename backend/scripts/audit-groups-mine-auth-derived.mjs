#!/usr/bin/env node
// Guard estrutural — GROUPS-MINE-AUTH-DERIVED (B3f / ONDA DECISION-0131 · DECISION-0113).
//
// `GET /groups/mine` JÁ foi corrigido (commits c00435da + 7c76cfb5): a rota é SELF-SCOPED e deriva o
// sujeito do USUÁRIO AUTENTICADO (`req.user?.userId`, JWT server-side), NÃO de actorId/actionContext
// (canal-1 = hint, não autoridade — DECISION-0113). O runtime estava certo mas DESTRAVADO (sem guard).
// Este guard TRAVA o comportamento (zero runtime change) e FALHA se regredir:
//   (a) o handler GET /mine deixar de derivar `req.user?.userId`;
//   (b) o handler perder o fail-closed 401 UNAUTHENTICATED;
//   (c) o handler virar não-read-only (INSERT/UPDATE) ou passar a usar actionContext/actorId/
//       ensureUserActor/getActiveActor (re-acoplar autoridade de cliente);
//   (d) o bypass do action-context.plugin deixar de ser EXATO (`method==='GET' && rawPath==='/groups/mine'`)
//       ou passar a usar endsWith/includes (alargaria o bypass para outras rotas);
//   (e) o repository getUserGroups perder a resolução Actor-first do cutover D9.2-B
//       (findUserActorId + listByMember de group_actor_memberships) ou voltar a group_members.
// Integrado em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const ROUTES = join(ROOT, 'src', 'modules', 'groups', 'groups.routes.ts');
const PLUGIN = join(ROOT, 'src', 'plugins', 'action-context.plugin.ts');
const REPO = join(ROOT, 'src', 'modules', 'groups', 'groups.repository.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Recorta o handler de GET /groups/mine: do registro exato `'/mine',` até a próxima rota fastify.X.
function sliceMineHandler(code) {
  const start = code.indexOf("'/mine',");
  if (start < 0) return null;
  const rest = code.slice(start + "'/mine',".length);
  const nextIdx = rest.search(/fastify\.(get|post|put|patch|delete)\b/);
  return nextIdx > 0 ? rest.slice(0, nextIdx) : rest;
}

function runGuard() {
  const failures = [];
  for (const [label, p] of [['groups.routes.ts', ROUTES], ['action-context.plugin.ts', PLUGIN], ['groups.repository.ts', REPO]]) {
    if (!existsSync(p)) { console.error(`GATE FAIL [groups-mine-auth-derived]: ${label} ausente.`); process.exit(1); }
  }
  const routes = stripComments(readFileSync(ROUTES, 'utf8'));
  const plugin = stripComments(readFileSync(PLUGIN, 'utf8'));
  const repo = stripComments(readFileSync(REPO, 'utf8'));

  const handler = sliceMineHandler(routes);
  if (!handler) {
    failures.push("rota GET /groups/mine ('/mine') não encontrada em groups.routes.ts — REGISTRO precisa revisão.");
  } else {
    // (a) sujeito derivado do usuário autenticado (JWT server-side).
    if (!/req\.user\?\.userId/.test(handler)) {
      failures.push('GET /groups/mine NÃO deriva mais `req.user?.userId` — sujeito self-scoped deve vir do JWT, não de actorId/actionContext (DECISION-0113).');
    }
    // (b) fail-closed 401.
    if (!/reply\.code\(401\)/.test(handler) || !/UNAUTHENTICATED/.test(handler)) {
      failures.push('GET /groups/mine perdeu o fail-closed 401 UNAUTHENTICATED (userId ausente deve negar).');
    }
    // (c) read-only + sem re-acoplar autoridade de cliente.
    if (/\b(INSERT|UPDATE|DELETE)\b/i.test(handler)) {
      failures.push('GET /groups/mine deixou de ser read-only (INSERT/UPDATE/DELETE no handler).');
    }
    if (/actionContext|actorId|ensureUserActor|getActiveActor/.test(handler)) {
      failures.push('GET /groups/mine voltou a referenciar actionContext/actorId/ensureUserActor/getActiveActor — re-acoplamento de autoridade de cliente proibido (self-scoped).');
    }
  }

  // (d) bypass do plugin EXATO (não endsWith/includes para /groups/mine).
  if (!/req\.method === 'GET' && rawPath === '\/groups\/mine'/.test(plugin)) {
    failures.push("action-context.plugin perdeu o bypass EXATO `method==='GET' && rawPath==='/groups/mine'`.");
  }
  if (/(endsWith|includes)\([^)]*groups\/mine/.test(plugin)) {
    failures.push('action-context.plugin usa endsWith/includes para groups/mine — bypass deve ser path EXATO (não alargar para outras rotas).');
  }

  // (e) D9.2-B (DECISION-0188): membership Actor-first — o repository resolve o user ao
  //     user-actor canônico e lê a casa nova via listByMember; group_members (legado
  //     congelado) NÃO pode reaparecer como fonte.
  if (!/findUserActorId/.test(repo) || !/listByMember/.test(repo)) {
    failures.push('groups.repository getUserGroups perdeu a resolução Actor-first (findUserActorId + listByMember da casa group_actor_memberships) — namespace de membership alterado silenciosamente.');
  }
  if (/\bgroup_members\b/.test(repo)) {
    failures.push('groups.repository voltou a referenciar group_members — casa legada CONGELADA no cutover D9.2-B (DECISION-0188 D4).');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [groups-mine-auth-derived]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[groups-mine-auth-derived] GET /groups/mine self-scoped por req.user?.userId; 401 fail-closed; read-only; sem actionContext/actorId; bypass EXATO no plugin; repo resolve Actor-first (findUserActorId+listByMember; sem group_members).');
  console.log('GATE OK [groups-mine-auth-derived] — comportamento auth-derived TRAVADO (DECISION-0113); regressão p/ actorId/actionContext, perda de 401, write, ou bypass alargado mordem.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
