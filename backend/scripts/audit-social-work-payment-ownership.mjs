#!/usr/bin/env node
// Guard estrutural — WAVE-1 BATCH-4 (F-RBAC-V2-PERMISSION-OWNERSHIP / DECISION-0131 · AUTHORITY_LAW Art.17).
//
// A superfície MONEY `GET /social/work/posts/:postId/payments` era DIVERGENT-MONEY: autorizada SÓ por role
// (requirePermission RBAC-V2 role-based + userHasAnyRole inline). Corrigida p/ autoridade CANÔNICA por
// REPRESENTABILIDADE do actor AUTOR do post (canRepresentActor sobre posts.actor_id), SEM role-fallback.
// (NÃO usa socialService.getPost — SQL defasado, post_id/global_user_id inexistentes no schema atual.)
// FALHA (exit 1) se a rota GET payments:
//   (a) voltar a usar userHasAnyRole/actorHasAnyRole (role como autoridade);
//   (b) voltar a ter requirePermission (preHandler role-only que bloqueia o owner antes do primitivo canônico);
//   (c) perder o gate canônico (SELECT FROM posts + postActorId + canRepresentActor + 403 fail-closed).
// Escopo: SÓ o bloco da rota GET payments (a rota POST /pay e seu requirePermission ficam fora deste guard).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'social', 'social-work-payment.routes.ts');
const MARKER = '/posts/:postId/payments';
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  if (!existsSync(FILE)) { console.error('GATE FAIL [social-work-payment-ownership]: social-work-payment.routes.ts ausente.'); process.exit(1); }
  const code = stripComments(readFileSync(FILE, 'utf8'));

  const idx = code.indexOf(MARKER);
  if (idx < 0) {
    console.error('GATE FAIL [social-work-payment-ownership]: rota GET /posts/:postId/payments não encontrada.');
    process.exit(1);
  }
  const block = code.slice(idx); // do marcador da rota GET payments até o fim do arquivo

  // (a) sem role como autoridade.
  if (/\b(userHasAnyRole|actorHasAnyRole)\s*\(/.test(block)) {
    failures.push('GET payments voltou a usar userHasAnyRole/actorHasAnyRole (role-solo) — proibido (money DIVERGENT).');
  }
  // (b) sem requirePermission (role-only preHandler) na rota GET payments.
  if (/requirePermission\s*\(/.test(block)) {
    failures.push('GET payments voltou a ter requirePermission (preHandler role-only bloqueia o owner antes do primitivo canônico).');
  }
  // (c) gate canônico de representabilidade presente (canRepresentActor sobre o actor autor do post).
  if (!/\bFROM\s+posts\b/i.test(block)) failures.push('GET payments sem resolução do recurso (SELECT ... FROM posts) p/ obter o actor autor.');
  if (!/canRepresentActor\s*\(/.test(block)) failures.push('GET payments sem primitivo canônico canRepresentActor.');
  if (!/postActorId/.test(block)) failures.push('GET payments sem o actor autor do post (postActorId) ligado ao canRepresentActor.');
  if (!/status\(403\)/.test(block)) failures.push('GET payments sem 403 fail-closed.');

  if (failures.length > 0) {
    console.error('GATE FAIL [social-work-payment-ownership]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[social-work-payment-ownership] GET payments: representabilidade canônica (FROM posts → postActorId → canRepresentActor → 403); sem userHasAnyRole/actorHasAnyRole; sem requirePermission role-only. Money não autorizada por role.');
  console.log('GATE OK [social-work-payment-ownership] — superfície money gateada por ownership canônico, sem role-fallback (Art.17).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
