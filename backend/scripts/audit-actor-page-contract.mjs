#!/usr/bin/env node
// audit-actor-page-contract.mjs
// Guard F-ACTOR-PAGE-SHELL-SLICE-3/4 (DESENHO_PAGINA_DO_ACTOR.md §2.4 SELADO).
// Congela os invariantes do contrato server-driven da página do actor:
//   1 · READ-MODEL puro — o módulo nunca escreve (zero INSERT/UPDATE/DELETE);
//   2 · autoridade — GET exige req.user; mode=operating exige canRepresentActor fail-closed
//       ANTES do service (DECISION-0113);
//   3 · anti-PII — repository nunca seleciona cpf/tax_id/kyc/global_user_id/birthdate nem o blob
//       metadata (só a extração explícita card.headline); zero bank_*;
//   4 · Comprar/Contratar nascem gated — enabled:false + gatedBy 'PORTA-1' (dinheiro soberano §6);
//   5 · blocos derivados de PROBES no substrato (registro §2.2b), nunca aba hardcoded por vertical;
//   6 · frontend = renderizador do contrato — abas do contrato, zero localStorage, convergência
//       /profile/:id + /company/:id → ActorPage (anti-página-paralela §2.3).
//   7 · FATIA 4 — conteúdo rico é COMPOSIÇÃO PURA: service.ts NUNCA escreve SQL novo (zero
//       SELECT/FROM), só reusa os readers dos módulos donos do pilar (services/marketplace/
//       availability/location); anti-PII também em service.ts; localização pública NUNCA expõe
//       rua/número/lat-lng (só cidade/estado/bairro).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
const stripComments = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');

const routes = read('src/modules/actor-page/actor-page.routes.ts');
const service = read('src/modules/actor-page/actor-page.service.ts');
const repo = read('src/modules/actor-page/actor-page.repository.ts');
const types = read('src/modules/actor-page/actor-page.types.ts');
const moduleCode = stripComments(routes + '\n' + service + '\n' + repo + '\n' + types);

// 1 · read-model puro
check('módulo: zero INSERT/UPDATE/DELETE (projeção pura de pilares vivos)',
  !/INSERT INTO|UPDATE \w+ SET|DELETE FROM/i.test(moduleCode));
check('módulo: zero bank_/ledger (nem leitura de dinheiro no contrato)',
  !/bank_|ledger/i.test(moduleCode));

// 2 · autoridade
check('routes: GET exige req.user (401 sem autenticação)',
  /if \(!userId\)/.test(routes) && /401/.test(routes));
check('routes: mode=operating exige canRepresentActor fail-closed ANTES do service',
  /operating/.test(routes) && /canRepresentActor/.test(routes) &&
  stripComments(routes).indexOf('canRepresentActor') < stripComments(routes).indexOf('getContract'));
check('routes: viewer actionContext é HINT (nunca decide autoridade — só personalização)',
  /viewerActorId/.test(routes) && !/canRepresentActor\([^)]*actionContext/.test(stripComments(routes)));

// 3 · anti-PII no repository
const repoCode = stripComments(repo);
check('repository: nenhum SELECT toca cpf/tax_id/kyc/global_user_id/birthdate',
  !/cpf|tax_id|kyc|global_user_id|birthdate/i.test(repoCode));
check('repository: o blob metadata só via extração explícita card.headline',
  !/SELECT[^;]*\bmetadata\b(?!->'card'->>'headline')/i.test(repoCode.replace(/metadata->'card'->>'headline'/g, 'CARD_HEADLINE_OK')));

// 4 · Comprar/Contratar gated PORTA-1
check("service: buy nasce enabled:false gatedBy 'PORTA-1'",
  /key: 'buy'[^}]*enabled: false[^}]*gatedBy: 'PORTA-1'/.test(service));
check("service: contract nasce enabled:false gatedBy 'PORTA-1'",
  /key: 'contract'[^}]*enabled: false[^}]*gatedBy: 'PORTA-1'/.test(service));
check('service: nenhuma ação de dinheiro enabled:true',
  !/key: '(buy|contract)'[^}]*enabled: true/.test(service));

// 5 · registro de blocos deriva de probes (nunca hardcoded por vertical)
check('service: BLOCK_REGISTRY existe e cada bloco declara probe no repository',
  /BLOCK_REGISTRY/.test(service) &&
  (service.match(/probe: \(t, a\) => actorPageRepository\.count/g) || []).length >= 5);
check('service: aba acende SÓ se probe > 0 (counts[i] > 0)',
  /counts\[i\] > 0/.test(service));
check('service: abas base = Tudo + Sobre (âncoras universais)',
  /key: 'all', label: 'Tudo'/.test(service) && /key: 'about', label: 'Sobre'/.test(service));
check('service: labels do Conectar vêm do vocabulário governado (PAIR_ALLOWED_LABELS da Fatia 1)',
  /PAIR_ALLOWED_LABELS/.test(service) && /allowedLabels/.test(service));

// 7 · FATIA 4 — conteúdo rico é composição pura (nunca SQL novo em service.ts)
const serviceCode = stripComments(service);
check('service.ts: ZERO acesso a DB primitivo (composição pura — nunca runQueryWithTenant/pool.query aqui)',
  !/runQueryWithTenant|runQueriesWithTenant|pool\.query|getClientWithTenant/.test(serviceCode));
check('service.ts: reusa os readers dos módulos donos do pilar (services/marketplace/availability/location)',
  /servicesRepository\.findByActor/.test(service) &&
  /listVisibleProducts\(/.test(service) &&
  /unifiedAvailabilityService\.listAvailabilities/.test(service) &&
  /operationalAddressHelper\.getOperationalAddressForActor/.test(service));
check('service.ts: anti-PII (zero cpf/tax_id/kyc/global_user_id/birthdate no conteúdo rico)',
  !/cpf|tax_id|kyc|global_user_id|birthdate/i.test(serviceCode));
check('service.ts: localização pública NUNCA expõe rua/número/lat/lng/CEP (só cidade/estado/bairro)',
  !/\.street\b|\.number\b|\.lat\b|\.lng\b|postalCode/.test(serviceCode));
check('types: header.location tipado só com cityName/stateCode/neighborhoodName (sem rua/lat/lng)',
  /location: \{ cityName: string \| null; stateCode: string \| null; neighborhoodName: string \| null \}/.test(types));
check("service.ts: agenda usa ownerType resolvido (USER/PAGE) — não mistura owners de tipos diferentes",
  /AvailabilityOwnerType\.PAGE : AvailabilityOwnerType\.USER/.test(service));
check('repository: countFutureAvailability exige ownerType explícito (fix do achado read-first — não mistura owners)',
  /countFutureAvailability\(tenantId: string, actorId: string, ownerType: 'user' \| 'page'\)/.test(repo) &&
  /AND owner_type = \$3/.test(repo));

// 6 · frontend renderizador do contrato
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
try {
  const page = readF('pages/ActorPage.tsx');
  const app = readF('App.tsx');
  const apiAP = readF('api/actor-page.ts');
  const apiRel = readF('api/relationships.ts');
  check('frontend: ActorPage sem localStorage (zero verdade local)',
    !page.includes('localStorage'));
  check('frontend: abas renderizadas DO CONTRATO (tabs.map), nunca lista hardcoded por vertical',
    /tabs\.map\(/.test(page) && /getActorPage/.test(page));
  check('frontend: ação gated renderiza DESABILITADA (não habilita o que o contrato negou)',
    /disabled: true/.test(page) && /gatedBy/.test(page));
  check('frontend: /profile/:id e /company/:id convergem na casca (ActorPage)',
    /path="profile\/:id" element=\{<ActorPage \/>\}/.test(app) &&
    /path="company\/:id" element=\{<ActorPage \/>\}/.test(app) &&
    !/SocialProfilePage|SocialCompanyPage/.test(app));
  check('frontend: api actor-page consome GET /actor-page/ (contrato único)',
    apiAP.includes('/actor-page/'));
  check('frontend: connect envia só toActorId+requesterLabel (actor de origem NUNCA no body)',
    /JSON\.stringify\(\{ toActorId, requesterLabel \}\)/.test(apiRel) &&
    !/stringify\([^)]*fromActorId/.test(apiRel));
  // Fatia 4 — blocos ricos renderizados a partir de block.data.items (projeção pura do contrato)
  check('frontend: bloco services renderiza items do contrato (sem "em breve" hardcoded)',
    /case 'services':[\s\S]{0,200}block\.data\.items/.test(page));
  check('frontend: bloco products renderiza items do contrato',
    /case 'products':[\s\S]{0,200}block\.data\.items/.test(page));
  check('frontend: bloco agenda renderiza items do contrato',
    /case 'agenda':[\s\S]{0,200}block\.data\.items/.test(page));
  check('frontend: bloco location renderiza cityName/stateCode do contrato, NUNCA rua/lat/lng',
    /case 'location':/.test(page) && /cityName, stateCode, neighborhoodName/.test(page) &&
    !/\.street\b|\.lat\b|\.lng\b/.test(page));
} catch (e) {
  check(`frontend: arquivos da casca legíveis (${e.message})`, false);
}

if (fails.length) {
  console.error(`\nACTOR-PAGE-CONTRACT: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nACTOR-PAGE-CONTRACT: OK');
