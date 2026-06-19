#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8C-SYSTEM-NOTIFICATION-READ-STATE-AUTHORITY (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// A tabela `system_notifications` é SCHEMA-GHOST (migration 257 arquivada em migrations_archive/0921; ausente do
// schema canônico e de unificard_dev). As rotas eram dead-at-db + ungated-authority (recipientActorId
// client-declared / nenhum dono). DECISÃO: CONTER fail-closed (501 nomeado), NÃO religar/migrar/redesenhar.
// Este gate trava a contenção: TODAS as rotas devem retornar 501 SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED e
// NENHUMA pode voltar a chamar service/repository/DB nem a usar actionContext.actorId/recipientActorId como
// autoridade. MORDE se a contenção regredir. Heurística textual comment-stripped (não AST). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/system-notifications/system-notification.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [system-notification-schema-ghost-containment]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) Código de contenção nomeado presente.
if (!/SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED/.test(code)) {
  failures.push(`${REL} perdeu o código de contenção SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED.`);
}

// 2) Todas as 5 superfícies devem retornar 501 contido. Conta as 5 rotas registradas e os 501 contidos.
const routeRegs = (code.match(/fastify\.(get|post)\b/g) || []).length;
if (routeRegs < 5) {
  failures.push(`${REL}: esperado >= 5 rotas registradas (list/unread-count/:id/read/mark-all-read), encontradas ${routeRegs} — não remover rotas.`);
}
const contained501 = (code.match(/reply\.status\(\s*501\s*\)\.send\(\s*CONTAINED\s*\)/g) || []).length;
if (contained501 < 5) {
  failures.push(`${REL}: esperado >= 5 rotas contidas (501 CONTAINED), encontradas ${contained501}.`);
}

// 3) PROIBIDO: qualquer chamada ao service / repository (rota contida não pode tocar o substrato ghost).
for (const re of [/systemNotificationService\./, /systemNotificationRepository\./, /\.markAsRead\(/, /\.markAllAsRead\(/, /\.listNotifications\(/, /\.countUnread\(/, /\.getNotificationById\(/, /\.createNotification\(/]) {
  if (re.test(code)) failures.push(`${REL}: voltou a chamar o service/repository (${re}) — religação exige frente própria (schema + binding canônico).`);
}

// 4) PROIBIDO: tocar a tabela ghost diretamente.
if (/system_notifications/.test(code)) {
  failures.push(`${REL}: referencia a tabela system_notifications (schema-ghost) — proibido na rota contida.`);
}

// 5) PROIBIDO: usar canal client-declared como autoridade na rota contida.
for (const re of [/actionContext\s*\.\s*actorId/, /recipientActorId/]) {
  if (re.test(code)) failures.push(`${REL}: voltou a referenciar canal client-declared (${re}) — a rota contida não lê ator do cliente.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [system-notification-schema-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [system-notification-schema-ghost-containment] — 5 rotas contidas fail-closed (501 SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED); zero service/repository/DB; sem actionContext.actorId/recipientActorId; tabela ghost não tocada.');
