#!/usr/bin/env node
// GATE handler-level da dívida de autoridade (baseline-ratchet). Nasceu como MEDIDOR (passo 1 do
// MAPA_DE_FECHAMENTO); promovido a GATE pela auditoria YALA #2 (fix G1): agora FALHA se surgir um
// handler de mutação novo (ou regressão de fix) com canal de ator client-declared e SEM binding no
// segmento, fora do baseline triado em 1ª pessoa. Fecha o falso-negativo estrutural (o "5º handler").
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
// chave estável por handler (arquivo + método + path) para baseline-ratchet do gate
const uncoveredKeys = suspects.filter((s) => !COVERED.has(s.rel)).map((s) => `${s.rel}::${s.method} ${s.path}`).sort();
if (process.env.DUMP_KEYS) { console.log(JSON.stringify(uncoveredKeys, null, 2)); process.exit(0); }

// 🔴 BASELINE-RATCHET (fix G1 da auditoria YALA #2, generaliza F5): os 39 handlers abaixo foram
// TRIADOS em 1ª pessoa (executora + YALA) como FALSO-POSITIVO da heurística de segmento — cada um
// tem binding cross-file / preHandler / guard dedicado / subject server-side que o medidor não vê
// (razões por arquivo no bloco de comentário abaixo). O gate FALHA se surgir um handler de mutação
// NOVO com canal client-declared e SEM binding no segmento fora deste baseline — OU se um fix
// existente regredir (perde o binding in-segment e reaparece aqui). Só DESCE: ao ligar binding num
// destes, remova a linha. Ver DT-AUTHORITY-HANDLER-FILA-TRIAGE.
// Razões da triagem por arquivo:
//   identity KYB admin (requireRole['admin']) + confirm/config (subject=req.user server-side);
//   groups (preHandler requireGroupOwnerOrPermission, F-AUTHORITY-Z2-R1 + guard dedicado);
//   social follow/unfollow (ensureUserActor=self) / switch (findAvailableActors) / vote
//     (resolveActiveActorFromRequest) / cta (req.user.globalUserId);
//   event-rfq (canRepresentActor + assertCanReadEventMoney + guards dedicados);
//   company-members (canManageCompany fail-closed); events-sprint76/purchase-order/services/
//   service-order/service-bundle (guards dedicados próprios); actor-capability-grant (canRepresentActor
//     sobre scopeActorId + guards); supplier link-actor (Fatia 7: loadAndAuthorizeSupplier — helper
//     NO MESMO ARQUIVO, chamado no início do handler, prova canRepresentActor sobre
//     supplier.ownerActorId resolvido do BANCO; body.actorId é DADO — qual actor o fornecedor
//     referencia — nunca autoridade/impersonação; a heurística de segmento só não vê o helper local).
const BASELINE_UNCOVERED = new Set([
  'core/companies/company-members.routes.ts::DELETE /:companyId/members/:memberId',
  'core/companies/company-members.routes.ts::POST /:companyId/members',
  'core/companies/company-members.routes.ts::PUT /:companyId/members/:memberId',
  'core/identity/identity.routes.ts::PATCH /pj/kyb/admin/requests/:requestId/review',
  'core/identity/identity.routes.ts::PATCH /pj/kyb/documents/:documentId/review',
  'core/identity/identity.routes.ts::POST /confirm-civil-data',
  'core/identity/identity.routes.ts::POST /confirm-first-access',
  'core/identity/identity.routes.ts::POST /pj/kyb/admin/fiscal-identities/:fiscalIdentityId/revoke',
  'core/identity/identity.routes.ts::POST /pj/kyb/documents',
  'core/identity/identity.routes.ts::POST /pj/kyb/documents/:documentId/supersede',
  'core/identity/identity.routes.ts::POST /pj/kyb/requests',
  'core/identity/identity.routes.ts::PUT /configurations',
  'modules/authority/actor-capability-grant.routes.ts::POST /grants',
  'modules/authority/actor-capability-grant.routes.ts::POST /grants/:grantId/revoke',
  'modules/events/event-rfq.routes.ts::POST /events/:eventId/rfqs/:rfqId/close',
  'modules/events/event-rfq.routes.ts::POST /events/:eventId/rfqs/:rfqId/dispatch',
  'modules/events/event-rfq.routes.ts::POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept',
  'modules/events/event-rfq.routes.ts::POST /events/:eventId/rfqs/from-spec/:specId',
  'modules/events/events-sprint76.routes.ts::POST /checkin/:ticketSaleId',
  'modules/events/events-sprint76.routes.ts::POST /checkout/:ticketSaleId',
  'modules/events/events-sprint76.routes.ts::POST /tickets/:id/cancel',
  'modules/groups/groups.routes.ts::DELETE /:id',
  'modules/groups/groups.routes.ts::DELETE /:id/members/:userId',
  'modules/groups/groups.routes.ts::PATCH /:id/members/:userId',
  'modules/groups/groups.routes.ts::POST /:groupId/media',
  'modules/groups/groups.routes.ts::PUT /:id',
  // Falso-positivo verificado 2026-07-07 (achado durante re-selo Yala/demands): as 3 abaixo JÁ
  // são gateadas via preHandler: groupsAuthGate('groups:create'|'groups:join'|'groups:leave')
  // → authorizationService.canRepresentActor fail-closed (groups.routes.ts:217-248,751,800).
  // O heurístico não reconhece binding via preHandler custom (mesma classe dos demais grupos acima).
  'modules/groups/groups.routes.ts::POST /',
  'modules/groups/groups.routes.ts::POST /:id/join',
  'modules/groups/groups.routes.ts::POST /:id/leave',
  'modules/marketplace/purchase-order.routes.ts::POST /purchase-orders/:id/cancel',
  'modules/marketplace/purchase-order.routes.ts::POST /purchase-orders/:id/items',
  'modules/marketplace/purchase-order.routes.ts::POST /purchase-orders/:id/submit',
  'modules/marketplace/supplier.routes.ts::PATCH /suppliers/:id/link-actor',
  'modules/services/service-bundle.routes.ts::POST /service-bundles/confirm',
  'modules/services/service-order.routes.ts::POST /service-orders/:id/confirm-financial-terms',
  'modules/services/service-order.routes.ts::POST /service-orders/confirm-booking',
  'modules/services/services.routes.ts::POST /:serviceId/availability',
  'modules/services/services.routes.ts::PUT /:serviceId/availability/:availabilityId',
  'modules/social/social-2.0.routes.ts::POST /actors/:id/follow',
  'modules/social/social-2.0.routes.ts::POST /actors/:id/unfollow',
  'modules/social/social-2.0.routes.ts::POST /actors/switch',
  'modules/social/social-2.0.routes.ts::POST /cta/:cta_id/confirm',
  'modules/social/social-2.0.routes.ts::POST /posts/:post_id/vote',
]);
const newDebt = uncoveredKeys.filter((k) => !BASELINE_UNCOVERED.has(k));

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
console.log(`GATE baseline-ratchet: baseline=${BASELINE_UNCOVERED.size} triados · atuais não-cobertos=${uncoveredKeys.length} · NOVOS=${newDebt.length}`);
if (newDebt.length > 0) {
  console.error('\n🔴 GATE FAIL [handler-authority-baseline]: handler de mutação NOVO com canal de ator');
  console.error('   client-declared e SEM binding no segmento, fora do baseline triado (possível');
  console.error('   impersonação/BOLA — irmão de V1). Vincule (canRepresentActor/canActAs) OU, se for');
  console.error('   falso-positivo verificado (binding cross-file/preHandler/guard), adicione ao');
  console.error('   BASELINE_UNCOVERED com a razão no bloco de triagem:');
  newDebt.forEach((k) => console.error(`     ❌ ${k}`));
  process.exit(1);
}
console.log('GATE OK [handler-authority-baseline] — nenhum handler novo fora do baseline triado.');
console.log('NOTA: heurística de segmento (teto superior); o baseline é a triagem 1ª-pessoa (DT-AUTHORITY-HANDLER-FILA-TRIAGE).');
