#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R5-INTENT-EXECUTE-BUYER-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// Sela a contenção LOCALIZADA de POST /intent/execute: o `buyerActorId` vem do canal-1
// `actionContext.actorId` (CLIENT-DECLARED) = HINT, nunca autoridade. Antes de criar
// order/itens/reserva/saga em nome do buyer actor, o principal autenticado (req.user.userId,
// server-side) DEVE provar representação via canRepresentActor (fail-closed → 403).
//
// MORDE se:
//   - `buyerActorId = actionContext?.actorId` existir SEM canRepresentActor no arquivo;
//   - createOrderWithItemsAndReservations puder ser chamado ANTES do binding (gate depois do sink);
//   - o 403 BUYER_ACTOR_NOT_REPRESENTABLE for removido;
//   - o gate usar o actor DECLARADO (buyerActorId/actionContext.actorId) como SUBJECT
//     (subject deve vir de req.user.userId server-side; subject == target client-declared = spoof).
//
// Heurística file-level (não AST). Escopado a core/intent/intent-execute.routes.ts (contenção
// localizada; NÃO fecha DT-mãe DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED nem Z2 inteiro).
// Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/core/intent/intent-execute.routes.ts';

// Strip de comentários (evita `://` em urls via [^:"'`]) — line comments + block comments.
const stripTs = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);

if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${REL}`);
} else {
  const code = stripTs(readFileSync(p, 'utf-8'));

  // ── REQUIRE: binding server-side presente ──────────────────────────────────────────────
  if (!/\bcanRepresentActor\s*\(/.test(code)) {
    failures.push(
      'DEVE chamar authorizationService.canRepresentActor(...) — buyerActorId client-declared exige binding server-side (DECISION-0113/0131).'
    );
  }
  // SUBJECT server-side: const ligado a req.user.userId (canônico Z2), usado como 2º arg do canRepresentActor.
  if (!/const\s+authUserId\s*=\s*\(?[^\n;]*req[^\n;]*\.user\??\.userId/.test(code)) {
    failures.push(
      'DEVE derivar o subject de req.user.userId server-side (const authUserId = ... req.user.userId).'
    );
  }
  if (!/canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/.test(code)) {
    failures.push(
      'DEVE chamar canRepresentActor(tenantId, authUserId, buyerActorId) — subject = req.user.userId, target = buyer declarado.'
    );
  }
  // 403 fail-closed com código canônico.
  if (!/BUYER_ACTOR_NOT_REPRESENTABLE/.test(code)) {
    failures.push('DEVE retornar 403 com code BUYER_ACTOR_NOT_REPRESENTABLE quando não representável (fail-closed).');
  }
  if (!/status\(\s*403\s*\)[\s\S]{0,160}BUYER_ACTOR_NOT_REPRESENTABLE/.test(code)) {
    failures.push('O code BUYER_ACTOR_NOT_REPRESENTABLE DEVE acompanhar um reply.status(403) (negação, não 200).');
  }

  // ── REQUIRE POSICIONAL: gate ANTES do sink material ─────────────────────────────────────
  const idxGate = code.search(/canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/);
  const idxSink = code.search(/createOrderWithItemsAndReservations\s*\(/);
  if (idxSink !== -1) {
    if (idxGate === -1 || idxGate > idxSink) {
      failures.push(
        'O gate canRepresentActor DEVE ocorrer ANTES de createOrderWithItemsAndReservations (binding antes de qualquer write material).'
      );
    }
  }

  // ── FORBID: actor DECLARADO como subject (spoof) ────────────────────────────────────────
  if (/canRepresentActor\(\s*tenantId\s*,\s*buyerActorId\b/.test(code)) {
    failures.push(
      'PROIBIDO (DECISION-0113/Z2): canRepresentActor com buyerActorId como SUBJECT (2º arg). Subject deve vir de req.user.userId.'
    );
  }
  if (/canRepresentActor\([^,)]*,\s*actionContext\??\.\s*actorId\b/.test(code)) {
    failures.push(
      'PROIBIDO (DECISION-0113/Z2): canRepresentActor com actionContext.actorId (client-declared) como SUBJECT.'
    );
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [intent-execute-buyer-actor-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [intent-execute-buyer-actor-binding] — buyerActorId vinculado server-side (canRepresentActor, fail-closed 403) antes de qualquer write.');
