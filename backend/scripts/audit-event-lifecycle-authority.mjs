// audit-event-lifecycle-authority.mjs
// Guard de regressão do V1 FIX (auditoria forense 2026-07-04, DT-AUTHORITY-REGUA-PELA-METADE).
// Congela o fechamento do BOLA/IDOR no lifecycle de eventos:
//   1 · o resolvedor FRACO getAuthenticatedUserActor NÃO pode voltar (só fazia findById);
//   2 · resolveRepresentedActor DEVE provar canRepresentActor e ser fail-closed (ForbiddenError);
//   3 · nenhum handler de mutação de evento pode threadar actionContext.actorId a um service SEM
//       passar por resolveRepresentedActor (a catraca única);
//   4 · o helper recebe o userId (server-side) — a prova exige o principal, não só o actorId declarado.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

const routes = read('src/core/events/event.routes.ts');
// código sem comentários (o nome antigo pode aparecer em comentário explicativo — não conta)
const routesCode = routes
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// 1 · resolvedor fraco morto (em CÓDIGO — menção em comentário explicativo é permitida)
check('event.routes: getAuthenticatedUserActor NÃO existe mais em código (resolvedor fraco morto)',
  !/getAuthenticatedUserActor/.test(routesCode));

// 2 · catraca honesta presente e fail-closed
const helperBlock = routes.slice(routes.indexOf('async function resolveRepresentedActor'));
check('event.routes: resolveRepresentedActor existe',
  /async function resolveRepresentedActor\s*\(/.test(routes));
check('event.routes: resolveRepresentedActor prova canRepresentActor',
  /canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*actorId\s*\)/.test(helperBlock.slice(0, 1200)));
check('event.routes: resolveRepresentedActor é fail-closed (ForbiddenError sem representação)',
  /if\s*\(\s*!represents\s*\)\s*\{[\s\S]{0,120}ForbiddenError/.test(helperBlock.slice(0, 1400)));
check('event.routes: resolveRepresentedActor exige userId (fail-closed se ausente)',
  /if\s*\(\s*!userId\s*\)\s*\{[\s\S]{0,120}ForbiddenError/.test(helperBlock.slice(0, 800)));

// 3 · todas as chamadas passam o userId server-side (req.user?.userId), nunca só o actorId declarado
const callCount = (routes.match(/resolveRepresentedActor\(/g) || []).length; // inclui a definição
const callWithUser = (routes.match(/resolveRepresentedActor\(\s*\n\s*req\.tenant\.id,\s*\n\s*req\.user\??\.userId,/g) || []).length;
check(`event.routes: chamadas passam req.user.userId (${callWithUser} de ${callCount - 1} chamadas)`,
  callWithUser > 0 && callWithUser === callCount - 1);

// 4 · o service não é chamado com actor não-provado: nenhum eventService.<mut> recebe actionContext.actorId cru
check('event.routes: nenhum service de mutação recebe req.actionContext.actorId direto (só userActor.actor_id provado)',
  !/eventService\.\w+\([^)]*req\.actionContext\.actorId/.test(routes.replace(/\s+/g, ' ')));

if (fails.length) {
  console.error(`\nEVENT-LIFECYCLE-AUTHORITY: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nEVENT-LIFECYCLE-AUTHORITY: OK — V1 BOLA/IDOR fechado; catraca resolveRepresentedActor íntegra.');
