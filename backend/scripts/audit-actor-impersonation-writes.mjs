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
const services = read('src/modules/services/services.routes.ts');
const eventsSprint76 = read('src/modules/events/events-sprint76.routes.ts');
const eventTicketRepo = read('src/modules/events/event-ticket.repository.ts');

// código sem comentários (o gate é código, não menção em comentário)
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const idC = strip(identity), soC = strip(social), fdC = strip(feed);
const svcC = strip(services);
const es76C = strip(eventsSprint76);
const etrC = strip(eventTicketRepo);

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

// AUDIT-004 (C1/C2) — services availability POST/PUT NÃO podem repassar o hint client-declared
// cru ao writer; a autoridade é a REPRESENTAÇÃO do actor dono resolvido server-side (current.actorId).
// Regressão = voltar a passar req.actionContext.actorId aos writers OU perder o canRepresentActor.
check('services availability writers NÃO recebem req.actionContext.actorId cru (anti-personificação)',
  !/createServiceAvailability\(\s*req\.tenant\.id,\s*req\.actionContext\.actorId/.test(svcC) &&
  !/updateServiceAvailability\(\s*req\.tenant\.id,\s*req\.actionContext\.actorId/.test(svcC));
check('services availability POST/PUT provam canRepresentActor(req.user.userId, dono) e escrevem sob current.actorId',
  (svcC.match(/canRepresentActor\(\s*req\.tenant\.id,\s*userId,\s*current\.actorId\s*\)/g) || []).length >= 3 &&
  /createServiceAvailability\(\s*req\.tenant\.id,\s*current\.actorId/.test(svcC) &&
  /updateServiceAvailability\(\s*req\.tenant\.id,\s*current\.actorId/.test(svcC));

// F-EVENT-TICKETING-CONVERGENCE (Fatia 1) — criar/editar TIPO de ingresso é ato do DONO DO EVENTO
// (event.organizerActorId, server-resolved), não do actionContext.actorId (hint client-declared,
// DECISION-0113). Regressão = voltar a carimbar o hint cru como autoridade OU perder a chave exata
// (create_events/manage_events) sobre o dono do evento (DECISION-0189A §3).
// Escopado ao SINK (não ao arquivo inteiro — POST /events e /tickets/:id/reserve legitimamente
// seguem usando canRepresentActor(tenantId, userId, actionContext.actorId) para SEU PRÓPRIO
// escopo, fora desta fatia). O lock é: o sink de criar/editar TIPO recebe o dono do evento
// (event.organizerActorId), nunca o hint cru.
check('events-sprint76 createTicketType/updateTicketType NÃO recebem actionContext.actorId cru',
  !/createTicketType\(\s*tenantId,\s*req\.params\.id,\s*req\.body,\s*actionContext\.actorId/.test(es76C) &&
  /createTicketType\(\s*tenantId,\s*req\.params\.id,\s*req\.body,\s*event\.organizerActorId/.test(es76C));
check('events-sprint76 tipo de ingresso prova chave exata sobre o dono do evento (create_events + manage_events)',
  /userCanActOnEventOwner\(\s*tenantId,\s*userId,\s*event\.organizerActorId,\s*'create_events'\s*\)/.test(es76C) &&
  /userCanActOnEventOwner\(\s*tenantId,\s*userId,\s*event\.organizerActorId,\s*'manage_events'\s*\)/.test(es76C));

// event-ticket.repository.ts convergido ao schema vivo — nunca mais coluna-fantasma quantity_sold
// (a migration real tem quantity_available; toda query com quantity_sold estoura em runtime).
check('event-ticket.repository.ts NÃO referencia a coluna-fantasma quantity_sold em código (fora de comentário)',
  !/quantity_sold/.test(etrC));
check('event-ticket.repository.ts usa quantity_available (coluna real) no CREATE/SELECT/UPDATE',
  (etrC.match(/quantity_available/g) || []).length >= 4);

if (fails.length) {
  console.error(`\nACTOR-IMPERSONATION-WRITES: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nACTOR-IMPERSONATION-WRITES: OK — writes sob actor declarado provam representação (0113).');
