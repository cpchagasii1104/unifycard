#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R6.2-SOCIAL-POSTS-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// Sela a contenção LOCALIZADA de `POST /social/posts` (social-2.0.routes.ts): criar post "como" um actor
// declarado (`validated.actor_id`) exige que o principal autenticado (req.user.userId) prove representação
// via canRepresentActor (fail-closed → 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE) ANTES de criar o post.
// `requirePermission('publish_feed')` é permissão de MÓDULO/capability, não autoridade sobre o actor autor.
//
// MORDE se:
//   - o gate canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id) sumir;
//   - canRepresentActor ocorrer DEPOIS do sink social2Service.createPost;
//   - o subject não vier de req.user.userId (actor declarado/actionContext.actorId como subject = spoof);
//   - o 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE for removido;
//   - R6.1 services regredir (perder seu binding canRepresentActor).
//
// NOTA: a defesa em profundidade NÃO é adicionada no service (social-2.0.service.ts createPost) porque o
// service tem CALLERS INTERNOS confiáveis (votes/groups/events/seed) que postam como actors de grupo/evento;
// gatear o service quebraria fluxos fora do escopo. O gate vive na ÚNICA superfície client-declared (a rota).
//
// Heurística file-level (não AST). Escopado a social-2.0.routes.ts. Em validate:regression-guards.

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

const ROUTES = 'src/modules/social/social-2.0.routes.ts';
const SERVICES_ROUTES = 'src/modules/services/services.routes.ts';

// ── social-2.0.routes.ts (gate de POST /social/posts) ──────────────────────────────────────
// 🔒 DECISION-0189A §2 (YALA CLOSEOUT, Finding B): o gate canônico EVOLUIU de canRepresentActor
// (representação — para empresa era GESTÃO, sombreando o grant fino can_publish_feed) para a
// DECISÃO EXATA canActAs(publish_feed) sobre o AUTOR declarado. Isto é FORTALECIMENTO, não
// afrouxamento: a chave exata subsume a representação (self · membership grant · delegação
// exata) e mata a sombra. Este guard agora MORDE se o pre-gate de representação VOLTAR.
const rc = readStripped(ROUTES);
if (rc !== null) {
  // REQUIRE: decisão exata com subject server-side e target = actor AUTOR declarado.
  if (!/canActAs\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*,\s*'publish_feed'/.test(rc)) {
    failures.push(`${ROUTES}: POST /social/posts DEVE decidir por canActAs(req.tenant.id, req.user.userId, validated.actor_id, 'publish_feed') (DECISION-0189A).`);
  }
  // REQUIRE: 403 fail-closed com code canônico novo.
  if (!/status\(\s*403\s*\)[\s\S]{0,300}SOCIAL_POST_PUBLISH_FEED_DENIED/.test(rc)) {
    failures.push(`${ROUTES}: DEVE retornar 403 com code SOCIAL_POST_PUBLISH_FEED_DENIED quando a chave exata negar.`);
  }
  // POSICIONAL: gate ANTES do sink createPost.
  const idxGate = rc.search(/canActAs\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*,\s*'publish_feed'/);
  const idxSink = rc.search(/social2Service\.createPost\s*\(/);
  if (idxSink !== -1 && (idxGate === -1 || idxGate > idxSink)) {
    failures.push(`${ROUTES}: o gate canActAs(publish_feed) DEVE ocorrer ANTES de social2Service.createPost.`);
  }
  // FORBID: a SOMBRA de representação sobre o autor NÃO pode voltar (Finding B).
  if (/canRepresentActor\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*\)/.test(rc)) {
    failures.push(`${ROUTES}: PROIBIDO — pre-gate canRepresentActor sobre o autor voltou (sombra do grant fino — Finding B da YALA).`);
  }
  // FORBID: actor declarado / actionContext.actorId como SUBJECT do gate.
  if (/canActAs\(\s*[^,)]*,\s*validated\.actor_id\s*,\s*validated\.actor_id/.test(rc)) {
    failures.push(`${ROUTES}: PROIBIDO — validated.actor_id como SUBJECT do gate. Subject = req.user.userId.`);
  }
  if (/canActAs\(\s*[^,)]*,\s*req\.actionContext[^,)]*,\s*validated\.actor_id/.test(rc)) {
    failures.push(`${ROUTES}: PROIBIDO — req.actionContext como SUBJECT do gate (client-declared).`);
  }
}

// ── R6.1 services não-regressão ────────────────────────────────────────────────────────────
const sr = readStripped(SERVICES_ROUTES);
if (sr !== null && !/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/.test(sr)) {
  failures.push(`${SERVICES_ROUTES}: PROIBIDO — R6.1 services regrediu (perdeu canRepresentActor no POST /services).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [social-posts-actor-binding]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [social-posts-actor-binding] — POST /social/posts vincula o actor autor declarado via canActAs(publish_feed) exato no AUTOR (DECISION-0189A; sombra de representação morta) antes do write.');
