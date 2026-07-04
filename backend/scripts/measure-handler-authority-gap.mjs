#!/usr/bin/env node
// MEDIDOR handler-level da dívida de autoridade (passo 1 do MAPA_DE_FECHAMENTO).
//
// O guard file-level `audit-actor-authority-boundary.mjs` sela o CANAL (baseline zerado), mas é
// file-level: um arquivo que TEM o helper de binding em ALGUM lugar passa, mesmo que um handler
// específico NÃO o aplique. A auditoria forense (V1 events IDOR) provou esse ponto cego.
//
// Este script NÃO é gate — é RÉGUA. Varre cada handler de MUTAÇÃO (post/put/patch/delete) em
// *.routes.ts e mede, POR HANDLER, se ele:
//   · toca um canal de ator CLIENT-DECLARED (actionContext.actorId / params|body|query.actorId), E
//   · NÃO tem prova de binding NO PRÓPRIO SEGMENTO do handler
//     (canRepresentActor / canActAs / requirePermission / userRepresentsActor / assertRepresentsActor
//      / canManageCompany / canUserPerform*), E/OU
//   · usa um RESOLVEDOR FRACO de nome enganoso (getAuthenticated*Actor / resolve*Actor que só faz
//     findById) cujo resultado vira "autoridade".
// Saída = teto superior de handlers suspeitos p/ revisão humana (o "tamanho real da dívida").
// READ-ONLY, zero escrita, zero runtime.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(process.cwd(), 'src');

// Cruza com as allowlists do guard file-level existente: arquivos JÁ reconhecidos (baseline com DT,
// safe-subject readers, service-bound/self-bound writers, not-authority read-only) são "cobertos"
// (a prova vive cross-file/containment que a heurística de segmento não vê). O que NÃO está em
// nenhuma dessas = dívida REALMENTE não-endereçada.
let COVERED = new Set();
try {
  const g = await import('./audit-actor-authority-boundary.mjs');
  for (const k of Object.keys(g.BASELINE || {})) COVERED.add(k);
  for (const k of Object.keys(g.SAFE_SUBJECT_READERS || {})) COVERED.add(k);
  for (const k of Object.keys(g.SERVICE_BOUND_WRITERS || {})) COVERED.add(k);
  for (const k of Object.keys(g.SELF_BOUND_WRITERS || {})) COVERED.add(k);
  for (const k of Object.keys(g.NON_AUTHORITY_READONLY || {})) COVERED.add(k);
} catch (e) {
  console.warn('aviso: não consegui importar allowlists do guard existente:', e.message);
}

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const CLIENT_CHANNEL = /req\.actionContext\??\.\s*actorId\b|actionContext\??\.\s*actorId\b|req\.params\??\.actorId\b|req\.body\??\.(actorId|actor_id)\b|req\.query\??\.actorId\b/;
const BINDING = /\bcanRepresentActor\b|\bcanActAs\b|\brequirePermission\b|\buserRepresentsActor\b|\bassertRepresentsActor\b|\bresolveRepresentedActor\b|\bcanManageCompany\b|\bcanUserPerform\w+\b|\bcanPerformAction\b/;
// resolvedores de nome enganoso: sugerem autoridade mas (no helper) só fazem findById
const WEAK_RESOLVER = /\bgetAuthenticated\w*Actor\b|\bgetActorFromContext\b|\bresolveActorFromRequest\b/;
const MUTATION = /^(post|put|patch|delete)$/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (extname(full) === '.ts' && full.endsWith('.routes.ts')) {
      files.push(full);
    }
  }
  return files;
}

// Segmenta um arquivo de rotas em handlers: cada segmento vai de um fastify.<method> até o próximo.
// Boundary robusto = só a posição de `fastify.<method>` (sem tentar casar o generic, que pode conter
// `<{ Params: {...}; Body: {...} }>` com `;{}` — foi o bug que escondia os handlers de eventos/V1).
function segments(code) {
  const re = /fastify\.(get|post|put|patch|delete)\b/g;
  const marks = [];
  let m;
  while ((m = re.exec(code)) !== null) marks.push({ method: m[1], idx: m.index });
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx;
    const end = i + 1 < marks.length ? marks[i + 1].idx : code.length;
    const body = code.slice(start, end);
    const pathM = body.match(/\(\s*['"`]([^'"`]+)['"`]/);
    out.push({ method: marks[i].method, path: pathM ? pathM[1] : '(?)', body });
  }
  return out;
}

const suspects = [];
let totalHandlers = 0;
let totalMutations = 0;
const weakResolverFiles = new Set();

for (const file of walk(SRC)) {
  const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
  const code = stripComments(readFileSync(file, 'utf-8'));
  if (WEAK_RESOLVER.test(code)) weakResolverFiles.add(rel);
  for (const seg of segments(code)) {
    totalHandlers++;
    if (!MUTATION.test(seg.method)) continue;
    totalMutations++;
    const touchesChannel = CLIENT_CHANNEL.test(seg.body);
    if (!touchesChannel) continue;
    const boundInSegment = BINDING.test(seg.body);
    const weak = WEAK_RESOLVER.test(seg.body);
    if (!boundInSegment || weak) {
      suspects.push({
        rel,
        method: seg.method.toUpperCase(),
        path: seg.path,
        reason: !boundInSegment
          ? (weak ? 'canal + resolvedor-fraco + SEM binding no handler' : 'canal client-declared + SEM binding no handler')
          : 'resolvedor-fraco (nome sugere autoridade, só findById) mesmo com binding presente',
      });
    }
  }
}

// agrupa por arquivo
const byFile = new Map();
for (const s of suspects) {
  if (!byFile.has(s.rel)) byFile.set(s.rel, []);
  byFile.get(s.rel).push(s);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('MEDIÇÃO handler-level da dívida de autoridade (READ-ONLY, não-gate)');
console.log('═══════════════════════════════════════════════════════════════');
const uncoveredFiles = [...byFile.entries()].filter(([rel]) => !COVERED.has(rel));
const coveredFiles = [...byFile.entries()].filter(([rel]) => COVERED.has(rel));
const uncoveredHandlers = uncoveredFiles.reduce((n, [, l]) => n + l.length, 0);
const coveredHandlers = coveredFiles.reduce((n, [, l]) => n + l.length, 0);

console.log(`handlers totais varridos: ${totalHandlers}  ·  mutações (post/put/patch/delete): ${totalMutations}`);
console.log(`suspeitos (teto superior): ${suspects.length} handlers em ${byFile.size} arquivos`);
console.log(`  ├─ JÁ COBERTOS por guard/baseline/allowlist (falso-positivo esperado): ${coveredHandlers} handlers / ${coveredFiles.length} arquivos`);
console.log(`  └─ 🔴 NÃO-COBERTOS (dívida real candidata a triagem): ${uncoveredHandlers} handlers / ${uncoveredFiles.length} arquivos`);
console.log(`arquivos com resolvedor de nome enganoso (getAuthenticated*Actor etc): ${weakResolverFiles.size}`);
console.log('');
if (weakResolverFiles.size > 0) {
  console.log('⚠️  RESOLVEDORES FRACOS (nome sugere autoridade, corpo só faz findById — o padrão de V1):');
  [...weakResolverFiles].sort().forEach((f) => console.log(`   · ${f}${COVERED.has(f) ? '  (coberto)' : '  🔴 NÃO-COBERTO'}`));
  console.log('');
}
console.log(`🔴 NÃO-COBERTOS por arquivo (${uncoveredFiles.length} arquivos — a fila real):`);
uncoveredFiles
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([rel, list]) => {
    console.log(`\n  ${rel}  (${list.length} handler${list.length > 1 ? 's' : ''})`);
    list.forEach((s) => console.log(`     ${s.method} ${s.path}  — ${s.reason}`));
  });
console.log(`\nℹ️  JÁ COBERTOS (${coveredFiles.length} arquivos — binding cross-file/containment/allowlist; heurística de segmento não vê):`);
coveredFiles
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([rel, list]) => console.log(`   · ${rel}  (${list.length})`));
console.log('\n───────────────────────────────────────────────────────────────');
console.log('NOTA: teto SUPERIOR (heurística de segmento; alguns podem ter binding cross-file');
console.log('em service, como os profile-c1 já reconhecidos). Revisão humana confirma cada um.');
console.log('É a base do passo 2 (corrigir V1) e do guard permanente que substituirá esta régua.');
