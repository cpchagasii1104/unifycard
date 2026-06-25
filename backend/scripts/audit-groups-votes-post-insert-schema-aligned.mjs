#!/usr/bin/env node
// Gate estrutural — F-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT (correção funcional).
// Fecha DT-GROUPS-VOTES-POST-INSERT-SCHEMA-DRIFT: o INSERT INTO posts inline de votes.service::createVote
// referenciava colunas inexistentes (global_user_id, media) → createVote falhava 42703. Trava o alinhamento ao
// schema VIVO de `posts` (actor-keyed):
//   - o posts-insert de createVote usa actor_id e NÃO global_user_id;
//   - NÃO usa a coluna `media` (schema vivo é media_ids UUID[] default '{}'; aqui omitida);
//   - RETURNING id (PK real), NÃO post_id;
//   - intent='vote' preservado;
//   - createVote NÃO recebe mais globalUserId (param removido);
//   - os gates de quarentena de createVote/vote/closeVote (8ª–10ª fatias) NÃO regridem.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/groups/votes.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const raw = read(SVC);
if (!raw) {
  failures.push('POST_INSERT_SCHEMA_REGRESSION: votes.service.ts ausente.');
} else {
  const code = stripTs(raw);
  const cv = sliceMethod(code, 'async createVote(');

  // o posts-insert deve existir
  checked++;
  const iPost = cv.search(/INSERT\s+INTO\s+posts\b/i);
  if (iPost < 0) {
    failures.push('POST_INSERT_SCHEMA_REGRESSION: createVote perdeu o INSERT INTO posts inline (post intent=vote).');
  } else {
    // recortar o bloco do INSERT (do INSERT até o fim da chamada trx.query)
    const insertBlock = cv.slice(iPost, iPost + 700);

    // actor-keyed: usa actor_id, NÃO global_user_id
    checked++;
    if (!/\bactor_id\b/.test(insertBlock)) failures.push('POST_INSERT_SCHEMA_REGRESSION: posts-insert não usa actor_id (schema vivo é actor-keyed).');
    if (/\bglobal_user_id\b/.test(insertBlock)) failures.push('POST_INSERT_SCHEMA_REGRESSION: posts-insert voltou a usar global_user_id (coluna inexistente → 42703).');

    // coluna `media` (bare) não existe; schema vivo é media_ids
    checked++;
    if (/(^|[(,\s])media(\s*,|\s+)/.test(insertBlock) && !/media_ids/.test(insertBlock)) {
      failures.push('POST_INSERT_SCHEMA_REGRESSION: posts-insert usa a coluna `media` (inexistente; schema vivo é media_ids UUID[]).');
    }

    // RETURNING id (PK real), não post_id
    checked++;
    if (/RETURNING\s+post_id\b/i.test(insertBlock)) failures.push('POST_INSERT_SCHEMA_REGRESSION: posts-insert faz RETURNING post_id (coluna inexistente; PK é id).');
    if (!/RETURNING\s+id\b/i.test(insertBlock)) failures.push('POST_INSERT_SCHEMA_REGRESSION: posts-insert não faz RETURNING id.');

    // intent='vote' preservado
    checked++;
    if (!/'vote'/.test(cv)) failures.push('POST_INSERT_SCHEMA_REGRESSION: createVote perdeu intent=\'vote\'.');
  }

  // createVote não recebe mais globalUserId
  checked++;
  const sig = cv.slice(0, cv.indexOf('): Promise'));
  if (/\bglobalUserId\b/.test(sig)) failures.push('POST_INSERT_SCHEMA_REGRESSION: createVote ainda declara o param globalUserId (deve ter sido removido — actor-keyed).');

  // gates de quarentena (8ª–10ª) preservados
  checked++;
  if (cv.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/) < 0) failures.push('POST_INSERT_SCHEMA_REGRESSION: gate de quarentena de createVote regrediu.');
  if (sliceMethod(code, 'async vote(').search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/) < 0) failures.push('POST_INSERT_SCHEMA_REGRESSION: gate de quarentena de vote() regrediu.');
  if (sliceMethod(code, 'async closeVote(').search(/this\.assertActorNotQuarantined\(tenantId,\s*userActor\.actor_id\)/) < 0) failures.push('POST_INSERT_SCHEMA_REGRESSION: gate de quarentena de closeVote regrediu.');
}

console.log(`[groups-votes-post-insert-schema-aligned] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [groups-votes-post-insert-schema-aligned]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [groups-votes-post-insert-schema-aligned] — posts-insert de createVote alinhado ao schema vivo (actor_id, sem global_user_id/media, RETURNING id); intent=vote preservado; param globalUserId removido; gates de quarentena intactos.');
