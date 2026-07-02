#!/usr/bin/env node
// Guard estrutural — F-SERVICE-FEED-GETPOST-COLUMN-FIX (DT-SERVICE-FEED-BOOK-CTA-POST-ID-SCHEMA-MISMATCH).
//
// service-feed.plugin.ts::getPost consultava `posts WHERE post_id=$1`, mas `posts` usa PK `id`
// (migration 20260530300000) — a coluna `post_id` NUNCA existiu na tabela. O bug tornava
// renderFeedItem/getAvailableActions inalcançáveis (sempre null/[]). Corrigido para `WHERE id=$1`.
//
// ESCOPO CONTIDO (Opção 1, decisão soberana Clayton): só este arquivo/método foi tocado. O bug irmão
// em core/feed/feed-plugin.service.ts::getPostsBatch (mesma classe, WHERE post_id=$1, rota viva
// POST /feed/plugin/render-batch) foi DELIBERADAMENTE FORA de escopo — registrado como DT própria
// (DT-CORE-FEED-BATCH-POST-ID-SCHEMA-MISMATCH). Este guard NÃO cobre o core/feed — outra frente.
//
// MORDE (regressão real):
//   (A) getPost voltar a usar `WHERE post_id` (coluna inexistente);
//   (B) getPost perder o `WHERE id = $1` correto;
//   (C) o predicado A2c (`hasAvailability` fail-closed para serviço canônico-bound) for enfraquecido —
//       este fix NÃO pode reabrir o drift owner_type='service' selado em A2c (a correção do getPost é
//       ortogonal ao gate de disponibilidade legada).
// Heurística textual comment-stripped (não AST). Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/services/service-feed.plugin.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [service-feed-getpost-column-fix]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// Isola o método private getPost (até o próximo método privado/fechamento de classe conhecido).
const start = code.search(/private\s+async\s+getPost\s*\(/);
if (start < 0) {
  failures.push(`${REL}: método getPost não encontrado (renomeado/removido?).`);
} else {
  const nextMethod = code.slice(start + 10).search(/private\s+async\s+hasAvailability\s*\(/);
  const body = nextMethod >= 0 ? code.slice(start, start + 10 + nextMethod) : code.slice(start);

  // (A) sem WHERE post_id (coluna inexistente).
  if (/WHERE\s+post_id\s*=/.test(body)) {
    failures.push(`${REL} getPost: reapareceu "WHERE post_id=" — coluna inexistente em posts (PK é id).`);
  }
  // (B) com WHERE id=$1 correto.
  if (!/WHERE\s+id\s*=\s*\$1/.test(body)) {
    failures.push(`${REL} getPost: "WHERE id = $1" ausente — a correção do schema mismatch foi perdida.`);
  }
}

// (C) o gate A2c (fail-closed canônico) permanece intacto — não confundir/enfraquecer com este fix.
if (!/canonicalServiceId[\s\S]{0,40}return\s+false/.test(code)) {
  failures.push(`${REL}: predicado A2c (serviço canônico-bound → hasAvailability=false) não encontrado/enfraquecido.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-feed-getpost-column-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-feed-getpost-column-fix] — getPost usa WHERE id=$1 (posts PK real); WHERE post_id não reaparece; gate A2c (BOOK fail-closed p/ canônico) preservado. Bug irmão getPostsBatch (core/feed) fica FORA deste guard (DT própria).');
