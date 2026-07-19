#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8A-SOCIAL-LEGACY-POST-CREATE-BIND-OR-CONTAIN (DECISION-0113 / DECISION-0131 §B7 / Z2).
// A rota LEGADA POST /social/posts/create (social.routes.ts, prefixo /social) era ungated-authority
// (req.actionContext.actorId direto como autor/globalUserId em socialService.createPost, sem canRepresentActor)
// E dead-at-db (SocialRepository.create INSERT em colunas-fantasma). Zero caller vivo → DECISÃO: CONTER
// fail-closed (501 nomeado), NÃO religar. Este gate trava a contenção e prova que a canônica POST /social/posts
// (social-2.0.routes.ts) segue intacta. MORDE se a rota voltar a escrever / usar actionContext / perder o 501.
// Heurística textual comment-stripped (não AST) — falso positivo torna o gate MAIS restritivo. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const readStripped = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); return null; }
  return stripTs(readFileSync(p, 'utf-8'));
};

const LEGACY = 'src/modules/social/social.routes.ts';
const CANONICAL = 'src/modules/social/social-2.0.routes.ts';

// ── social.routes.ts (legado contido) ────────────────────────────────────────────────────────
const lc = readStripped(LEGACY);
if (lc !== null) {
  // Segmenta o handler da rota POST /posts/create até o próximo fastify.<verbo>.
  const re = /fastify\.(post|get|put|delete|patch)\b/g;
  const marks = [];
  let m;
  while ((m = re.exec(lc)) !== null) marks.push(m.index);
  const createStart = lc.search(/fastify\.post[\s\S]*?['"]\/posts\/create['"]/);
  let createBody = '';
  if (createStart < 0) {
    failures.push(`${LEGACY}: rota POST /posts/create desapareceu — não pode ser removida silenciosamente (baseline canal-1).`);
  } else {
    const next = marks.find((idx) => idx > createStart);
    createBody = lc.slice(createStart, next ?? lc.length);

    // 1) Código de contenção nomeado presente + 501 fail-closed.
    if (!/SOCIAL_LEGACY_POST_CREATE_CONTAINED/.test(createBody)) {
      failures.push(`${LEGACY}: POST /posts/create perdeu o código de contenção SOCIAL_LEGACY_POST_CREATE_CONTAINED.`);
    }
    if (!/return\s+reply\.status\(\s*501\s*\)[\s\S]{0,200}SOCIAL_LEGACY_POST_CREATE_CONTAINED/.test(createBody)) {
      failures.push(`${LEGACY}: POST /posts/create DEVE retornar 501 fail-closed com code SOCIAL_LEGACY_POST_CREATE_CONTAINED.`);
    }
    // 2) PROIBIDO: a rota contida voltar a chamar o write sink socialService.createPost.
    if (/socialService\.createPost\s*\(/.test(createBody)) {
      failures.push(`${LEGACY}: POST /posts/create voltou a chamar socialService.createPost — religação exige frente própria com binding (a canônica POST /social/posts já é a superfície viva).`);
    }
    // 3) PROIBIDO: actionContext (client-declared) como autoridade na rota contida.
    if (/actionContext/.test(createBody)) {
      failures.push(`${LEGACY}: POST /posts/create voltou a referenciar actionContext (authority client-declared — proibido sem religação+binding).`);
    }
  }
}

// ── social-2.0.routes.ts (canônica INTACTA) ───────────────────────────────────────────────────
const cc = readStripped(CANONICAL);
if (cc !== null) {
  if (!/social2Service\.createPost\s*\(/.test(cc)) {
    failures.push(`${CANONICAL}: canônica POST /social/posts perdeu o sink social2Service.createPost — a contenção do legado NÃO pode degradar a rota viva.`);
  }
  // DECISION-0189A (Finding B): gate da canônica EVOLUIU para canActAs('publish_feed') EXATO
  // sobre o AUTOR (fortalecimento; sombra de representação morta). Cross-check espelha o novo.
  if (!/canActAs\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*,\s*'publish_feed'/.test(cc)) {
    failures.push(`${CANONICAL}: canônica POST /social/posts perdeu o gate exato canActAs(publish_feed) no AUTOR (DECISION-0189A).`);
  }
  if (!/SOCIAL_POST_PUBLISH_FEED_DENIED/.test(cc)) {
    failures.push(`${CANONICAL}: canônica POST /social/posts perdeu o 403 SOCIAL_POST_PUBLISH_FEED_DENIED (DECISION-0189A).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [social-legacy-post-create-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [social-legacy-post-create-containment] — POST /social/posts/create contido fail-closed (501 SOCIAL_LEGACY_POST_CREATE_CONTAINED); zero write sink / sem actionContext; canônica POST /social/posts intacta.');
