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

// 1 · autoridade server-side no publish/mine
check('routes: /publish existe e usa assertRepresentsActor/canRepresentActor',
  routes.includes("'/public-profiles/publish'") && /assertRepresentsActor|canRepresentActor/.test(routes));
check('routes: actor NUNCA aceito do body (publish lê só actionContext.actorId)',
  !/body[^\n]*actorId/i.test(routes));

// 2 · leitura global: só plaquinha pública, zero PII
const globalFn = repo.slice(repo.indexOf('searchGlobalPublic'));
check("repository: searchGlobalPublic filtra visibility = 'public'", /visibility\s*=\s*'public'/.test(globalFn));
check('repository: searchGlobalPublic sem PII (user_id/global_user_id/external_id/kyc/metadata)',
  !/user_id|global_user_id|external_id|kyc|metadata/.test(globalFn.slice(0, globalFn.indexOf('LIMIT'))));

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

if (fails.length) {
  console.error(`\nPUBLIC-PROFILE-DISCOVERY-CONTRACT: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nPUBLIC-PROFILE-DISCOVERY-CONTRACT: OK');
