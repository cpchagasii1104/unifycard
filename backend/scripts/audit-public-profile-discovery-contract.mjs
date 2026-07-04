// audit-public-profile-discovery-contract.mjs
// Guard F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md).
// Congela os invariantes do desenho selado:
//   1 · publish/mine exigem canRepresentActor e o actor NUNCA vem do body;
//   2 · a leitura global da vitrine filtra visibility='public' e NÃO seleciona PII;
//   3 · a pista global da busca existe e faz dedupe (local vence);
//   4 · o alinhamento ao CHECK da tabela não regride (nada de 'PUBLIC'/'ARTIST' maiúsculo);
//   5 · hardening de ownership (perfil pertence ao actor representado) não regride.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

const routes = read('src/modules/public-profiles/public-profile.routes.ts');
const repo = read('src/modules/public-profiles/public-profile.repository.ts');
const types = read('src/modules/public-profiles/public-profile.types.ts');
const omni = read('src/modules/search/search-omni.service.ts');
const service = read('src/modules/public-profiles/public-profile.service.ts');

// 1 · autoridade server-side no publish/mine
check('routes: /publish existe e usa assertRepresentsActor/canRepresentActor',
  routes.includes("'/public-profiles/publish'") && /assertRepresentsActor|canRepresentActor/.test(routes));
// mira o padrão PERIGOSO real (LER actorId do body em código), ignorando comentários explicativos
const routesCode = routes.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
check('routes: nenhum handler LÊ actorId do body (req.body.actorId / body?.actorId)',
  !/\breq\.body\.actorId\b|\bbody\?\.actorId\b|\bbody\.actorId\b/.test(routesCode));

// 1b · CARTÃO PÚBLICO: o usuário escolhe o que aparece; sujeito PROVADO server-side, só campos seguros
check('routes: PUT /public-profiles/mine/card exige assertRepresentsActor (sujeito provado, não body)',
  /'\/public-profiles\/mine\/card'[\s\S]{0,400}assertRepresentsActor/.test(routes));
const svcPP = read('src/modules/public-profiles/public-profile.service.ts');
check('service: normalizeCard só emite showAvatar/showBio/headline/link (anti-PII por construção)',
  /normalizeCard/.test(svcPP) && /showAvatar[\s\S]{0,200}showBio[\s\S]{0,200}headline[\s\S]{0,200}link/.test(svcPP) &&
  !/cpf|birthdate|nascimento|tax_id|kyc/i.test(svcPP.slice(svcPP.indexOf('normalizeCard'), svcPP.indexOf('normalizeCard') + 600)));

// 2 · leitura global: só plaquinha pública, zero PII
const globalFn = repo.slice(repo.indexOf('searchGlobalPublic'));
check("repository: searchGlobalPublic filtra visibility = 'public'", /visibility\s*=\s*'public'/.test(globalFn));
check('repository: searchGlobalPublic sem PII (user_id/global_user_id/external_id/kyc/metadata)',
  !/user_id|global_user_id|external_id|kyc|metadata/.test(globalFn.slice(0, globalFn.indexOf('LIMIT'))));

// 2b · leitura de perfil único (destino do clique global): cross-tenant público-only, anti-PII e
// SEM retornar tenant_id ao cliente (anti-leak de origem).
const singleFn = repo.slice(repo.indexOf('getGlobalPublicProfileByActor'));
const singleSelect = singleFn.slice(0, singleFn.indexOf('LIMIT'));
check("repository: getGlobalPublicProfileByActor filtra visibility = 'public' (cross-tenant público-only)",
  /visibility\s*=\s*'public'/.test(singleSelect));
// permite a EXTRAÇÃO explícita dos 2 campos seguros do cartão, mas NUNCA o blob metadata inteiro nem PII.
// (mira o SQL, não comentários — o comentário explicativo cita "metadata" legitimamente.)
const singleSelectSansCard = singleSelect
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  .replace(/metadata->'card'->>'headline'/g, '')
  .replace(/metadata->'card'->>'link'/g, '');
check('repository: getGlobalPublicProfileByActor sem PII/tenant_id e sem o blob metadata (só card.headline/link extraídos)',
  !/user_id|global_user_id|external_id|kyc|metadata|tenant_id/.test(singleSelectSansCard));

// 3 · pista global na busca com dedupe
check('search-omni: pista global chama searchGlobalPublic', omni.includes('searchGlobalPublic'));
check('search-omni: dedupe por actorId (local vence)', /seen\.has\(/.test(omni));
check("search-omni: hits marcam origin 'local'/'global'", omni.includes("origin: 'local'") && omni.includes("origin: 'global'"));

// 4 · alinhamento ao CHECK da tabela (bugs dormentes não voltam)
check("types: visibility minúscula alinhada ao CHECK (sem 'PUBLIC')", !/'PUBLIC'|'PRIVATE'/.test(types));
check("types: profile_type alinhado ao CHECK (sem 'ARTIST'/'BAND')", !/'ARTIST'|'BAND'|'VENUE'/.test(types));
check("routes/service: sem visibility maiúscula viva", !/'PUBLIC'/.test(routes));

// 5 · hardening de ownership nas rotas por id
check('routes: PATCH/visibility verificam que o perfil pertence ao actor representado',
  (routes.match(/não pertence ao actor representado/g) || []).length >= 2);

// 7 · V2 confused-deputy fix: createProfile escreve sob o actor PROVADO, nunca body.actorId
check('service: createProfile força o actor provado (authorizedActorId), descarta input.actorId',
  service.includes('authorizedActorId') && service.includes('actorId: authorizedActorId'));

// 8 · F4 (YALA): resolução por slug (caminho público + venue /v/:slug) filtra visibility='public'
check("repo: getProfileBySlug filtra visibility='public' (não serve private/despublicado por slug)",
  /getProfileBySlug[\s\S]*?WHERE tenant_id = \$1 AND slug = \$2 AND visibility = 'public'/.test(repo));

// 6 · Slice B — wiring frontend protegido (toggle sem verdade local; hits globais sem navegação fantasma)
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
try {
  const card = readF('components/PublicProfileVisibilityCard.tsx');
  const apiPP = readF('api/public-profiles.ts');
  const dropdown = readF('components/layout/OmniSearchDropdown.tsx');
  const searchPage = readF('pages/SearchPage.tsx');
  const vitrinePage = readF('pages/VitrineProfilePage.tsx');
  check('frontend: toggle lê/grava via API (getMyPublicProfile/publishMyProfile), sem localStorage',
    card.includes('getMyPublicProfile') && card.includes('publishMyProfile') && !card.includes('localStorage'));
  check('frontend: body do publish é só { visibility } (actor NUNCA enviado — autoridade server-side)',
    apiPP.includes('JSON.stringify({ visibility })') && !/stringify\([^)]*actorId/.test(apiPP));
  // 6b · hit global de PESSOA navega para /vitrine/ (página da plaquinha cross-tenant), NUNCA para
  // /profile/ (rota interna = fantasma para actor de outro tenant).
  check("frontend: hits origin='global' navegam para /vitrine/ (dropdown + SearchPage)",
    /origin === 'global' \? `\/vitrine\/\$\{p\.actorId\}`/.test(dropdown) &&
    /origin === 'global' \? `\/vitrine\/\$\{p\.actorId\}`/.test(searchPage));
  // 6c · a página da vitrine é PROJEÇÃO pura (GET /global/:actorId) e não cria capability (ações "em breve")
  check('frontend: VitrineProfilePage projeta getGlobalPublicProfile e não cria capability (Seguir/Mensagem disabled)',
    vitrinePage.includes('getGlobalPublicProfile') && vitrinePage.includes('disabled') && !vitrinePage.includes('localStorage'));
} catch (e) {
  check(`frontend: arquivos da Slice B legíveis (${e.message})`, false);
}

if (fails.length) {
  console.error(`\nPUBLIC-PROFILE-DISCOVERY-CONTRACT: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nPUBLIC-PROFILE-DISCOVERY-CONTRACT: OK');
