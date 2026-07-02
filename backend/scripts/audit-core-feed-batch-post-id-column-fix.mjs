#!/usr/bin/env node
// Guard estrutural — F-CORE-FEED-BATCH-GETPOSTSBATCH-COLUMN-FIX
//   (DT-CORE-FEED-BATCH-POST-ID-SCHEMA-MISMATCH).
//
// core/feed/feed-plugin.service.ts::getPostsBatch consultava `posts WHERE post_id = ANY($1)`, mas
// `posts` usa PK `id` (migration 20260530300000) — `post_id` NUNCA existiu como coluna. O bug derrubava
// POST /feed/plugin/render-batch (rota VIVA, compartilhada por TODOS os plugins de feed, não só
// serviços) com erro de coluna inexistente. Corrigido para `SELECT id AS post_id ... WHERE id = ANY($1)`
// — o alias preserva o contrato downstream (postsMap por p.post_id, tipo de retorno, cache) sem tocar
// mais nada no método renderBatch.
//
// AMPLIADO (Opção 2, achado colateral no mesmo método renderBatch): posts.intent grava a string legada
// (ex.: 'service_offer'), não o enum ActorIntent ('OFFER_SERVICE') — o cast direto `as ActorIntent`
// nunca batia com canHandle dos plugins (comparação estrita ao enum), então NENHUM plugin resolvia via
// renderBatch. Corrigido com LEGACY_INTENT_MAP (mesma fonte do ActorIntent já importado, @core/social/ports).
//
// MORDE (regressão real):
//   (A) getPostsBatch voltar a usar `WHERE post_id = ANY` (coluna inexistente, sem alias id AS post_id);
//   (B) o SELECT perder o alias `id AS post_id` OU o `WHERE id = ANY($1)` correto;
//   (C) a rota POST /feed/plugin/render-batch (feed-plugin.routes.ts) parar de chamar
//       feedPluginService.renderBatch — não pode virar dead-code sem revisão consciente;
//   (D) renderBatch voltar a fazer `post.intent as ActorIntent` cru sem passar por LEGACY_INTENT_MAP
//       (regressão do bug de resolução de plugin).
// Heurística textual comment-stripped (não AST). Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SERVICE_REL = 'src/core/feed/feed-plugin.service.ts';
const ROUTES_REL = 'src/core/feed/feed-plugin.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const failures = [];

const service = read(SERVICE_REL);
if (service === null) {
  failures.push(`arquivo ausente: ${SERVICE_REL}`);
} else {
  const start = service.search(/private\s+async\s+getPostsBatch\s*\(/);
  if (start < 0) {
    failures.push(`${SERVICE_REL}: método getPostsBatch não encontrado (renomeado/removido?).`);
  } else {
    const body = service.slice(start);

    // (A) sem WHERE post_id = ANY cru (coluna inexistente).
    if (/WHERE\s+post_id\s*=\s*ANY/.test(body)) {
      failures.push(`${SERVICE_REL} getPostsBatch: reapareceu "WHERE post_id = ANY" — coluna inexistente em posts (PK é id).`);
    }
    // (B) com alias id AS post_id + WHERE id = ANY($1) correto.
    if (!/SELECT\s+id\s+AS\s+post_id/.test(body)) {
      failures.push(`${SERVICE_REL} getPostsBatch: alias "id AS post_id" ausente — contrato downstream (p.post_id) quebraria.`);
    }
    if (!/WHERE\s+id\s*=\s*ANY\s*\(\s*\$1\s*\)/.test(body)) {
      failures.push(`${SERVICE_REL} getPostsBatch: "WHERE id = ANY($1)" ausente — a correção do schema mismatch foi perdida.`);
    }
  }

  // (D) renderBatch resolve intent via LEGACY_INTENT_MAP (não cast cru).
  const rbStart = service.search(/async\s+renderBatch\s*\(/);
  const rbEnd = service.search(/private\s+async\s+getPostsBatch\s*\(/);
  const rbBody = rbStart >= 0 ? service.slice(rbStart, rbEnd >= 0 ? rbEnd : service.length) : '';
  if (!rbBody) {
    failures.push(`${SERVICE_REL}: método renderBatch não encontrado.`);
  } else {
    if (!/LEGACY_INTENT_MAP\s*\[\s*rawIntent\s*\]/.test(rbBody)) {
      failures.push(`${SERVICE_REL} renderBatch: LEGACY_INTENT_MAP[rawIntent] ausente — intent legado (ex.: 'service_offer') deixaria de resolver para o enum ActorIntent, e nenhum plugin resolveria.`);
    }
    if (/const\s+intent\s*=\s*post\.intent\s+as\s+ActorIntent/.test(rbBody)) {
      failures.push(`${SERVICE_REL} renderBatch: reapareceu "post.intent as ActorIntent" cru — regressão do bug de resolução de plugin (sem passar por LEGACY_INTENT_MAP).`);
    }
  }
  if (!/import\s*\{[^}]*LEGACY_INTENT_MAP[^}]*\}\s*from\s*['"]@core\/social\/ports['"]/.test(service)) {
    failures.push(`${SERVICE_REL}: import de LEGACY_INTENT_MAP de @core/social/ports ausente.`);
  }
}

// (C) rota viva não pode virar dead-code silenciosamente.
const routes = read(ROUTES_REL);
if (routes === null) {
  failures.push(`arquivo ausente: ${ROUTES_REL}`);
} else if (!/feedPluginService\.renderBatch\s*\(/.test(routes)) {
  failures.push(`${ROUTES_REL}: chamada a feedPluginService.renderBatch( sumiu — a rota /render-batch não pode desconectar do sink sem revisão consciente.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [core-feed-batch-post-id-column-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [core-feed-batch-post-id-column-fix] — getPostsBatch usa SELECT id AS post_id ... WHERE id = ANY($1) (posts PK real); WHERE post_id=ANY cru não reaparece; renderBatch resolve intent via LEGACY_INTENT_MAP; rota POST /feed/plugin/render-batch segue conectada ao sink.');
