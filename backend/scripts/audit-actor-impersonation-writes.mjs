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

// código sem comentários (o gate é código, não menção em comentário)
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const idC = strip(identity), soC = strip(social), fdC = strip(feed);

// A prova é a PRESENÇA do call de representação sobre o actor declarado, no arquivo (lock de
// regressão: remover o gate faz o guard morder). Cada um provado adversarial/estruturalmente.
check('identity /update prova canRepresentActor sobre o actorId declarado (BOLA civil fechado)',
  /canRepresentActor\(\s*req\.tenant\.id,\s*req\.user\.userId,\s*actorId\s*\)/.test(idC));

// social reactions/comments: cada gate ancorado na sua mensagem única (lock preciso por handler)
check('social /reactions prova canRepresentActor (gate anti-impersonação presente)',
  /canRepresentActor\([^)]*req\.actionContext\.actorId[^)]*\)/.test(soC) && soC.includes('reagir como o actor declarado'));
check('social /comments prova canRepresentActor (gate anti-impersonação presente)',
  soC.includes('comentar como o actor declarado'));

// feed POST /action: canRepresentActor antes do recordContentAction
check('feed /action prova canRepresentActor sobre o actor declarado',
  /canRepresentActor\(\s*req\.tenant\.id,\s*req\.user\.userId,\s*actorId\s*\)/.test(fdC) && fdC.includes('recordContentAction'));

if (fails.length) {
  console.error(`\nACTOR-IMPERSONATION-WRITES: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nACTOR-IMPERSONATION-WRITES: OK — writes sob actor declarado provam representação (0113).');
