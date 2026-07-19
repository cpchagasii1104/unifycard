#!/usr/bin/env node
// audit-generic-reactions-containment.mjs — DECISION-0189C D4 GUARD
//
// A rota GENÉRICA polimórfica de reação (publication-engine POST|DELETE
// /:entityType/:entityId/reactions) está DESATIVADA com 410 GENERIC_REACTIONS_NOT_GOVERNED
// ANTES de qualquer efeito (não lê actor_id, não resolve entidade, não chama
// upsertReaction/removeReaction, não escreve em `reactions`). O único writer GOVERNADO de
// reactions/comments de post é social-2.0 (interact_feed). Este guard varre TODAS as rotas —
// não só social — atrás de writer de reação sem governança.

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (m) => { console.error(`❌ [audit-generic-reactions-containment] ${m}`); process.exit(1); };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const walk = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};

// ── 1. publication-engine: POST e DELETE reactions → 410 antes de efeito ─────
const pub = read('src/core/publication/publication-engine.routes.ts');
const reactionHandlers = pub.split('/:entityType/:entityId/reactions').slice(1); // trechos após cada rota
if (reactionHandlers.length < 2) fail('rotas POST/DELETE de reactions genéricas não encontradas no publication-engine.');
// cada handler de reação genérica deve responder 410 GENERIC_REACTIONS_NOT_GOVERNED
const post410 = /\bfastify\.post[\s\S]{0,400}?\/:entityType\/:entityId\/reactions[\s\S]{0,300}?410[\s\S]{0,120}?GENERIC_REACTIONS_NOT_GOVERNED/.test(pub);
const del410 = /\bfastify\.delete[\s\S]{0,400}?\/:entityType\/:entityId\/reactions[\s\S]{0,300}?410[\s\S]{0,120}?GENERIC_REACTIONS_NOT_GOVERNED/.test(pub);
if (!post410) fail('POST /:entityType/:entityId/reactions não retorna 410 GENERIC_REACTIONS_NOT_GOVERNED (D4).');
if (!del410) fail('DELETE /:entityType/:entityId/reactions não retorna 410 GENERIC_REACTIONS_NOT_GOVERNED (D4).');
// os handlers contidos NÃO podem chamar upsert/removeReaction (efeito antes do 410)
const postBlock = pub.slice(pub.indexOf('fastify.post'), pub.indexOf('fastify.delete'));
if (/upsertReaction\(/.test(postBlock)) fail('handler POST reactions ainda chama upsertReaction (efeito antes do 410 — D4).');
const delBlock = pub.slice(pub.indexOf('fastify.delete'));
if (/removeReaction\(/.test(delBlock.slice(0, 600))) fail('handler DELETE reactions ainda chama removeReaction (efeito antes do 410 — D4).');

// ── 2. varredura global: nenhuma OUTRA rota escreve reactions sem governança ─
// writers de reactions permitidos: social-2.0.routes (interact_feed) + social-2.0.service.
const REACTION_WRITE_ALLOW = new Set([
  'src/modules/social/social-2.0.routes.ts',
  'src/modules/social/social-2.0.service.ts',
  'src/core/publication/publication-engine.routes.ts', // contido (410); listado p/ transparência
  'src/core/publication/publication-engine.service.ts', // service inalcançável pela rota contida
]);
for (const f of walk('src')) {
  if (!f.endsWith('.routes.ts')) continue;
  if (REACTION_WRITE_ALLOW.has(f)) continue;
  const src = read(f);
  if (/upsertReaction\(|\.toggleReaction\(|INSERT\s+INTO\s+reactions|UPDATE\s+reactions|DELETE\s+FROM\s+reactions/i.test(src)) {
    fail(`${f}: rota escreve/aciona writer de reactions fora da governança canônica (DECISION-0189C D4)`);
  }
}

console.log('✅ audit-generic-reactions-containment: publication-engine reactions 410 antes de efeito; nenhum writer de reactions fora da governança canônica (social-2.0/interact_feed).');
