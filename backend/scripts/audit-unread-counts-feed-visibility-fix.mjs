#!/usr/bin/env node
// Guard estrutural — F-UNREAD-COUNTS-FEED-VISIBILITY-FIX (DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN).
//
// GET /feed/unread-counts (core/feed/feed.routes.ts) e GET /social/unread-counts (modules/social/
// social.routes.ts) tinham o contador `feed` quebrado: `posts.visibility = 'PUBLIC'` — coluna que
// NUNCA existiu no schema vivo (20260530300000_social_posts.sql). O erro era mascarado por
// `countOrNull` (retornava null honesto, nunca 0 falso, nunca 500) — mas o contador nunca funcionava.
// Corrigido para o MESMO predicado já usado pelo contador `services` na mesma tabela (is_published +
// not is_deleted + fora de grupo), preservando o escopo JÁ ratificado (feed tenant-wide público).
//
// MORDE (regressão real), em CADA um dos 2 arquivos:
//   (A) `visibility = 'PUBLIC'` reaparecer (coluna fantasma, sempre quebrava);
//   (B) o bloco `feed` (entre `// Feed:` e `// Grupos:`) perder o predicado vivo
//       (is_published=true / is_deleted=false / metadata->>'groupId' IS NULL);
//   (C) o bloco `feed` ganhar member-scoping (`group_members`) — o escopo é TENANT-WIDE público, não
//       member-scoped (isso seria mudança de produto não ratificada, não parte deste fix);
//   (D) `countOrNull` (defesa em profundidade) sumir do handler.
// Heurística textual comment-stripped (não AST). Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILES = [
  'src/core/feed/feed.routes.ts',
  'src/modules/social/social.routes.ts',
];
// NOTA: os marcadores de bloco (`// Feed:` / `// Grupos:`) são comentários — a busca de bloco usa o
// texto CRU (não comment-stripped), senão o próprio marcador desaparece. Os cheques de predicado (A-D)
// rodam sobre o bloco cru também: nenhum deles depende de distinguir comentário de código real aqui.
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };

const failures = [];
for (const rel of FILES) {
  const src = read(rel);
  if (src === null) { failures.push(`arquivo ausente: ${rel}`); continue; }

  const idx = src.indexOf(`'/unread-counts'`);
  if (idx < 0) { failures.push(`${rel}: handler /unread-counts não encontrado (renomeado/removido?).`); continue; }
  const handler = src.slice(idx);

  const fi = handler.indexOf('// Feed:');
  const gi = handler.indexOf('// Grupos:', fi + 1);
  const feedBlock = fi >= 0 ? handler.slice(fi, gi > fi ? gi : handler.length) : '';
  if (!feedBlock) { failures.push(`${rel}: bloco do contador 'feed' (// Feed: … // Grupos:) não localizado.`); continue; }

  // (A) coluna fantasma não pode reaparecer.
  if (/visibility\s*=\s*'PUBLIC'/.test(feedBlock)) {
    failures.push(`${rel}: reapareceu "visibility = 'PUBLIC'" no bloco feed — posts.visibility não existe no schema vivo (contador sempre quebraria).`);
  }
  // (B) predicado vivo presente.
  if (!/is_published\s*=\s*true/.test(feedBlock)) failures.push(`${rel}: bloco feed sem "is_published = true" (predicado vivo perdido).`);
  if (!/is_deleted\s*=\s*false/.test(feedBlock)) failures.push(`${rel}: bloco feed sem "is_deleted = false" (predicado vivo perdido).`);
  if (!/metadata->>'groupId'\s+IS\s+NULL/.test(feedBlock)) failures.push(`${rel}: bloco feed sem "metadata->>'groupId' IS NULL" (fronteira de grupo perdida).`);
  // (C) sem member-scoping — escopo é tenant-wide público, não mudar sem DECISION.
  if (/group_members/.test(feedBlock)) {
    failures.push(`${rel}: bloco feed ganhou member-scoping (group_members) — fora do escopo deste fix (mudaria o escopo já ratificado tenant-wide público).`);
  }
  // (D) countOrNull preservado (defesa em profundidade).
  if (!/countOrNull\s*\(/.test(handler)) {
    failures.push(`${rel}: countOrNull sumiu do handler — defesa em profundidade (erro estrutural -> null honesto) perdida.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [unread-counts-feed-visibility-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [unread-counts-feed-visibility-fix] — contador 'feed' de /feed/unread-counts e /social/unread-counts usa o predicado vivo (is_published+not deleted+fora de grupo), sem visibility fantasma, sem member-scoping indevido; countOrNull preservado. DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN blindada.");
