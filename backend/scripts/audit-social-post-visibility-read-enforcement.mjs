#!/usr/bin/env node
// audit-social-post-visibility-read-enforcement.mjs
// Guard F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5 do acoplamento; fecha
// DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ). Congela os invariantes:
//   1 · posts.visibility é GOVERNADO por CHECK (public/connections/only_me) — vocabulário exato,
//       NÃO ressuscita 'group'/'private'/'friends' do PostVisibility fantasma legado;
//   2 · a plateia é REUSADA (postVisibilitySql), nunca duplicada, e aplicada nos 3 pontos de
//       leitura vivos (getFeed, getActorPosts, getActorCounts) — sem isso um vaza conteúdo, outro
//       vaza contagem;
//   3 · createPost valida o vocabulário fail-closed (rejeita valor fora do CHECK, não coage);
//   4 · 🔴 GET /social/feed: actor_id do querystring (agora LOAD-BEARING para a plateia) é
//       validado via canRepresentActor ANTES de virar currentActorId — sem isso, o próprio fix
//       desta fatia abriria um vetor de impersonação de leitura (ver achado do read-first);
//   5 · GET /social/actors/:id: viewerActorId é resolvido 100% server-side (req.user →
//       ensureUserActor), nunca de query/param client-declared;
//   6 · frontend: PostComposer/IntentComposer mandam visibility mapeada da escolha do usuário
//       (nunca hardcoded 'public'), zero localStorage.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
const stripComments = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');

const service = read('src/modules/social/social-2.0.service.ts');
const routes = read('src/modules/social/social-2.0.routes.ts');
const serviceCode = stripComments(service);
const routesCode = stripComments(routes);

// 1 · migration com o vocabulário GOVERNADO exato
const migrationFile = readdirSync(resolve(ROOT, 'migrations')).find((f) => f.includes('posts_visibility_governed'));
check('migration: posts_visibility_governed existe', !!migrationFile);
if (migrationFile) {
  const migration = read(`migrations/${migrationFile}`);
  check("migration: CHECK exato ('public','connections','only_me') — não ressuscita 'group'/'private'/'friends' legados",
    /CHECK \(visibility IN \('public', 'connections', 'only_me'\)\)/.test(migration));
  check("migration: DEFAULT 'public' (não-destrutivo — preserva comportamento de hoje)",
    /DEFAULT 'public'/.test(migration));
}

// 2 · predicado reusado (não duplicado) nos 3 pontos de leitura
check('service: postVisibilitySql existe (predicado único, reusado)',
  /function postVisibilitySql\(/.test(serviceCode));
const usages = (serviceCode.match(/postVisibilitySql\(/g) || []).length;
check('service: postVisibilitySql é CHAMADO em pelo menos 3 lugares (getFeed + getActorPosts + getActorCounts)',
  usages >= 4); // 1 definição + 3 chamadas
check('service: predicado usa actor_relationships com status=accepted (Fatia 1, não follows)',
  /actor_relationships/.test(serviceCode) && /ar\.status = 'accepted'/.test(serviceCode));
check('service: getActorPosts recebe viewerActorId (server-side) — sem isso não dá pra aplicar a plateia',
  /getActorPosts\(\s*tenantId: string,\s*actorId: string,\s*limit: number,[\s\S]{0,200}viewerActorId: string \| null/.test(serviceCode));
check('service: getActorCounts recebe viewerActorId (coerência com getActorPosts — sem vazar contagem)',
  /getActorCounts\(\s*tenantId: string,\s*actorId: string,[\s\S]{0,200}viewerActorId: string \| null/.test(serviceCode));

// 3 · createPost valida vocabulário fail-closed
check("service: POST_AUDIENCE_VISIBILITY_VALUES governa o vocabulário total (3 valores)",
  /POST_AUDIENCE_VISIBILITY_VALUES[\s\S]{0,40}=\s*\['public', 'connections', 'only_me'\]/.test(service));
check('service: createPost rejeita visibility fora do vocabulário (fail-closed, não coage silenciosamente)',
  /if \(visibility && !POST_AUDIENCE_VISIBILITY_VALUES\.includes\(visibility\)\)/.test(serviceCode) &&
  /HttpError\.badRequest/.test(serviceCode));
check('routes: createPostSchema usa z.enum governado (mesmo vocabulário do CHECK)',
  /visibility: z\.enum\(\['public', 'connections', 'only_me'\]\)\.optional\(\)/.test(routes));

// 4 · 🔴 GET /feed: actor_id do querystring validado via canRepresentActor ANTES de virar currentActorId
const feedBlock = routesCode.slice(routesCode.indexOf("'/feed'"), routesCode.indexOf("'/feed'") + 3000);
check('routes: GET /feed — actor_id (agora load-bearing p/ plateia) exige canRepresentActor antes de usar',
  /canRepresentActor\(req\.tenant\.id, req\.user\.userId, declaredActorId\)/.test(feedBlock));
check('routes: GET /feed — sem representação, actorId cai para undefined (fail-safe, nunca trusta o hint)',
  /actorId = declaredActorId/.test(feedBlock) && /let actorId: string \| undefined = undefined/.test(feedBlock));

// 5 · GET /actors/:id — viewerActorId 100% server-side
const actorsIdBlock = routesCode.slice(routesCode.indexOf("'/actors/:id'"), routesCode.indexOf("'/actors/:id'") + 2000);
check('routes: GET /actors/:id — viewerActorId vem de req.user.globalUserId → ensureUserActor (nunca client-declared)',
  /req\.user\?\.globalUserId/.test(actorsIdBlock) && /ensureUserActor\(req\.tenant\.id, localUid\)/.test(actorsIdBlock) &&
  /getActorPosts\(req\.tenant\.id, req\.params\.id, 20, viewerActorId\)/.test(actorsIdBlock));

// 6 · frontend — visibility mandada da escolha real do usuário, zero localStorage
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
try {
  const postComposer = readF('components/social/PostComposer.tsx');
  const intentComposer = readF('components/social/IntentComposer.tsx');
  const socialFeed2 = readF('components/social/SocialFeed2.tsx');
  check('frontend: PostComposer mapeia audience→visibility (getVisibilityFromAudience) e envia no onSubmit',
    /getVisibilityFromAudience/.test(postComposer) &&
    /onSubmit\(content, mediaIds, selectedActorId, intent, intentMetadata, targeting, cta, getVisibilityFromAudience\(audience\)\)/.test(postComposer));
  check("frontend: PostComposer oferece 'Só eu' (only_me) — plateia mínima do DESENHO §2.4c",
    /'only_me'/.test(postComposer) && /Só eu/.test(postComposer));
  check('frontend: IntentComposer também thread visibility (preview local + preview backend)',
    /previewData\.visibility/.test(intentComposer));
  // Fix 2026-07-07: regex antigo exigia 'visibility' como ÚLTIMA propriedade do objeto —
  // quebrou como falso-positivo quando audience_relationship_types (DECISION-0162) entrou
  // DEPOIS dele no mesmo createSocialPost(). Checa a propriedade em qualquer posição do objeto.
  check('frontend: SocialFeed2 encaminha visibility pro createSocialPost (não descarta)',
    /createSocialPost\(\{[\s\S]{0,600}?\bvisibility,/.test(socialFeed2));
  check('frontend: zero localStorage como fonte de plateia',
    !/localStorage[\s\S]{0,60}visibility/i.test(postComposer + intentComposer));
} catch (e) {
  check(`frontend: arquivos do composer legíveis (${e.message})`, false);
}

if (fails.length) {
  console.error(`\nSOCIAL-POST-VISIBILITY-READ-ENFORCEMENT: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nSOCIAL-POST-VISIBILITY-READ-ENFORCEMENT: OK');
