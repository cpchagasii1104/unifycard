// audit-actor-impersonation-writes.mjs
// Guard da triagem de autoridade handler-level (2026-07-04, DT-AUTHORITY-REGUA-PELA-METADE).
// Fecha os writes que agiam SOB um actorId client-declared (actionContext) SEM provar representação
// — impersonação (a mesma classe de V1, achada varrendo a fila do measure-handler-authority-gap):
//   · identity POST /update  → editava a IDENTIDADE CIVIL de outra pessoa (HIGH, BOLA);
//   · social  POST /posts/:id/reactions e /comments → reagir/comentar COMO outro actor (MEDIUM);
//   · feed    POST /action → gravar ação de conteúdo sob o globalUserId de outro (LOW).
// Congela: cada handler prova canRepresentActor(req.tenant.id, req.user.userId|.id, <actorId>) antes do write.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

const identity = read('src/core/identity/identity.routes.ts');
const social = read('src/modules/social/social-2.0.routes.ts');
const feed = read('src/core/feed/feed.routes.ts');
const loc = read('src/core/location/me-active-location.routes.ts');
const inbox = read('src/modules/inbox/social-inbox.routes.ts');

// código sem comentários (o gate é código, não menção em comentário)
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const idC = strip(identity), soC = strip(social), fdC = strip(feed);

// A prova é a PRESENÇA do call de representação sobre o actor declarado, no arquivo (lock de
// regressão: remover o gate faz o guard morder). Cada um provado adversarial/estruturalmente.
check('identity /update prova canRepresentActor sobre o actorId declarado (BOLA civil fechado)',
  /canRepresentActor\(\s*req\.tenant\.id,\s*req\.user\.userId,\s*actorId\s*\)/.test(idC));

// social reactions/comments: DECISION-0189B D4/D5 SUBSTITUIU o gate de representação (que
// SOMBREAVA o grant fino — gestor impersonava, membro fino era barrado) pela CHAVE EXATA
// interact_feed sobre o actor que realmente age + post-alvo carregado server-side. Reintroduzir
// canRepresentActor como decisor MORDE em audit-event-feed-exact-permission. Aqui o lock é o
// padrão NOVO (mais forte): a volta do gate fraco quebra este guard.
{
  const interactGates = (soC.match(/canActAs\([^)]*'interact_feed'\)/g) || []).length;
  const serverSidePost = (soC.match(/getPostById\(req\.tenant\.id, req\.params\.id, null\)/g) || []).length;
  check('social /reactions+/comments provam canActAs(interact_feed) sobre o actor real (>=2)', interactGates >= 2);
  check('social /reactions+/comments carregam o post-alvo server-side (anti cross-tenant/spoof, >=2)', serverSidePost >= 2);
  check('social reactions/comments NÃO voltam ao gate fraco de representação (mensagens antigas ausentes)',
    !soC.includes('reagir como o actor declarado') && !soC.includes('comentar como o actor declarado'));
}

// feed POST /action: canRepresentActor antes do recordContentAction
check('feed /action prova canRepresentActor sobre o actor declarado',
  /canRepresentActor\(\s*req\.tenant\.id,\s*req\.user\.userId,\s*actorId\s*\)/.test(fdC) && fdC.includes('recordContentAction'));

// me-active-location POST/DELETE (YALA G1: o 5º handler achado na triagem) provam representação
check('me-active-location setActive/clearActive provam canRepresentActor (2 gates)',
  (loc.match(/canRepresentActor\([^)]*req\.actionContext\.actorId\)/g) || []).length >= 2 &&
  loc.includes('setActive') && loc.includes('clearActive'));

// social-inbox read/archive provam representação antes de mutar o inbox
check('social-inbox markAsRead/archive provam canRepresentActor (2 gates)',
  (inbox.match(/canRepresentActor\([^)]*req\.actionContext\.actorId\)/g) || []).length >= 2 &&
  inbox.includes('markAsRead') && inbox.includes('archive'));

if (fails.length) {
  console.error(`\nACTOR-IMPERSONATION-WRITES: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nACTOR-IMPERSONATION-WRITES: OK — writes sob actor declarado provam representação (0113).');
