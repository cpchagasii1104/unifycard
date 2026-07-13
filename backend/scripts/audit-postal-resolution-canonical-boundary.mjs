#!/usr/bin/env node
// Guard estrutural — FASE B (RFC B1-D) · F-ADDRESS-CANONICAL-BINDING.
// Pergunta própria: "a resolução postal é UMA casa canônica READ-ONLY, com país explícito,
// identidade oficial de cidade ESCOPADA pela jurisdição, bairro alias/candidato/pending,
// providers só nos adapters governados, conflitos explícitos, sem PII em log e sem qualquer
// criação de território a partir de provider?"
//
// Famílias de checks (GO Fase B §21):
//   G1  provider não cria território (sem INSERT/UPDATE/DELETE territorial na família CEP);
//   G2  sem find/create (findOrCreateCity/State/Neighborhood, createCityFromExternal) em TODO o src;
//   G3  provider somente nos adapters governados (URLs fixas; allowlist por caminho exato);
//   G4  país explícito (sem default BR silencioso; normalização por país);
//   G5  city por identificador oficial ESCOPADO (state_id + external_code; índice vivo; sem nome);
//   G6  bairro nunca vira identidade por texto (alias governado na MESMA city; candidato ≠ id);
//   G7  conflitos/ausências explícitos (estados fail-closed vivos no resolver);
//   G8  stack ÚNICA (legados aposentados; facades delegam; rota writer morta);
//   G9  PII fora dos logs (sem console.* na família; sem payload bruto);
//   G10 fronteiras (Fase B não importa writer/repository da Fase C, Social, Bank, split, ledger).
//
// Heurística textual comment-stripped (não AST): falso positivo torna o gate MAIS restritivo.
// Em validate:regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const norm = (p) => p.split(sep).join('/');
const failures = [];
const note = (m) => failures.push(m);

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function read(rel) {
  const p = join(ROOT, ...rel.split('/'));
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

// ── Casas por CAMINHO RELATIVO EXATO ─────────────────────────────────────────────────────────────
const RESOLVER = 'src/core/location/postal-address-resolver.service.ts';
const EVIDENCE_REPO = 'src/core/location/postal-territorial-evidence.repository.ts';
const NORMALIZER = 'src/core/location/postal-code-normalizer.ts';
const TYPES = 'src/core/location/postal-resolution.types.ts';
const ADAPTER_HOUSE = 'src/core/location/cep-provider.ts';
const LEGACY_FACADE_ROUTE = 'src/services/location/cep.routes.ts';
const CORE_ROUTES = 'src/core/location/location.routes.ts';
const CORE_SERVICE = 'src/core/location/location.service.ts';
const GEO_ENRICHMENT = 'src/core/location/geo-enrichment.service.ts';
const MIGRATION = 'migrations/20260713120000_cities_official_code_scoped_unicity.sql';

const POSTAL_HOUSE = [TYPES, NORMALIZER, RESOLVER, EVIDENCE_REPO];
const CEP_FAMILY = [...POSTAL_HOUSE, ADAPTER_HOUSE, LEGACY_FACADE_ROUTE, CORE_ROUTES, CORE_SERVICE, GEO_ENRICHMENT];

// Arquivos APOSENTADOS: existir de novo = stack legada revivida.
const RETIRED = [
  'src/services/location/cep.service.ts',
  'src/core/location/location-enrichment.service.ts',
];

// Carrega as casas (ausência de arquivo obrigatório = FAIL imediato).
const sources = new Map();
for (const rel of CEP_FAMILY) {
  const raw = read(rel);
  if (raw === null) { note(`A0: arquivo obrigatório da família postal ausente: ${rel}`); continue; }
  sources.set(rel, stripTs(raw));
}
for (const rel of RETIRED) {
  if (read(rel) !== null) note(`G8-a: stack legada REVIVIDA — ${rel} voltou a existir (aposentado na Fase B).`);
}

const src = (rel) => sources.get(rel) ?? '';

// ── G1 · provider não cria território ────────────────────────────────────────────────────────────
// Na família CEP inteira, nenhum DML territorial vivo. A ÚNICA escrita permitida da Fase B é o
// cache derivado cep_resolution_cache — e mesmo essa não aparece como SQL aqui (delegada aos
// métodos vivos do location.repository, fora desta família de arquivos).
{
  const dml = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(countries|states|cities|neighborhoods|neighborhood_aliases|addresses|address_assignments)\b/i;
  for (const rel of CEP_FAMILY) {
    const m = dml.exec(src(rel));
    if (m) note(`G1: DML territorial vivo em ${rel} — "${m[0].slice(0, 60)}" (provider NUNCA cria/muda território).`);
  }
  // Writers de address não podem ser chamados pela família postal (criação fica nos fluxos legados
  // pré-existentes/Fase C; a Fase B só SUGERE). geo-enrichment usa updateAddressGeo (papel
  // pré-existente preservado) — mas nunca create/assign.
  const createCalls = /\b(createAddress|assignAddress|createAddressAndAssign)\s*\(/;
  for (const rel of [...POSTAL_HOUSE, ADAPTER_HOUSE, LEGACY_FACADE_ROUTE, GEO_ENRICHMENT]) {
    const m = createCalls.exec(src(rel));
    if (m) note(`G1-b: ${rel} chama writer de address ("${m[1]}") — Fase B não grava endereço.`);
  }
  // A facade legada e o postal house não tocam banco por conta própria (sem pool/query direto),
  // EXCETO o evidence repository (a casa de leitura).
  for (const rel of [TYPES, NORMALIZER, RESOLVER, ADAPTER_HOUSE, LEGACY_FACADE_ROUTE]) {
    if (/\bpool\s*\.\s*query|from\s+['"]@core\/database\/pool['"]/.test(src(rel)) && rel !== RESOLVER) {
      note(`G1-c: ${rel} acessa o banco diretamente — leituras territoriais só na casa ${EVIDENCE_REPO}.`);
    }
  }
}

// ── G2 · sem find/create em TODO o backend/src ───────────────────────────────────────────────────
{
  const SRC = join(ROOT, 'src');
  const walk = (dir, acc = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue;
        walk(p, acc);
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
        acc.push({ rel: norm(p.slice(ROOT.length + 1)), body: stripTs(readFileSync(p, 'utf8')) });
      }
    }
    return acc;
  };
  const all = existsSync(SRC) ? walk(SRC) : [];
  const forbidden = /\b(findOrCreateCity|findOrCreateState|findOrCreateNeighborhood|createCityFromExternal)\b/;
  for (const f of all) {
    const m = forbidden.exec(f.body);
    if (m) note(`G2: símbolo de criação territorial por provider/nome REVIVIDO em ${f.rel}: ${m[1]}.`);
  }

  // G3 (parte repo-wide): endpoints POSTAIS de provider só no adapter governado (caminho exato).
  const postalEndpoints = /viacep\.com\.br|brasilapi\.com\.br\/api\/cep/i;
  for (const f of all) {
    if (f.rel === ADAPTER_HOUSE) continue;
    if (postalEndpoints.test(f.body)) {
      note(`G3-a: endpoint postal de provider fora do adapter governado (${f.rel}) — fetch de CEP só em ${ADAPTER_HOUSE}.`);
    }
  }

  // G8 (parte repo-wide): rota writer e stack legada não podem ressuscitar em nenhum arquivo.
  for (const f of all) {
    if (/enrich-from-cep/.test(f.body)) note(`G8-b: referência viva a enrich-from-cep em ${f.rel} — rota writer territorial aposentada.`);
    if (/\bfetchCEP\b/.test(f.body)) note(`G8-c: símbolo fetchCEP (stack legada) vivo em ${f.rel}.`);
    if (/\benrichFromCEP\b/.test(f.body)) note(`G8-d: símbolo enrichFromCEP (writer legado) vivo em ${f.rel}.`);
  }

  // G5 (parte repo-wide): lookup de city por NOME normalizado com igualdade — proibido fora do
  // combobox governado (searchCities em location.repository, ILIKE de exibição).
  const cityByName = /FROM\s+cities\b[\s\S]{0,200}?WHERE[\s\S]{0,200}?LOWER\s*\(\s*TRIM\s*\(/i;
  for (const f of all) {
    if (cityByName.test(f.body)) note(`G5-a: resolução de city por LOWER(TRIM(name)) em ${f.rel} — identidade de cidade é código oficial escopado, nunca texto.`);
  }
}

// ── G3 · adapters governados ─────────────────────────────────────────────────────────────────────
{
  const adapter = src(ADAPTER_HOUSE);
  // Base URLs FIXAS: a interpolação usa somente o CEP normalizado.
  if (!adapter.includes('https://viacep.com.br/ws/${postalCodeNormalized}/json/')) {
    note('G3-b: URL do ViaCEP não é a base FIXA interpolando somente postalCodeNormalized.');
  }
  if (!adapter.includes('https://brasilapi.com.br/api/cep/v2/${postalCodeNormalized}')) {
    note('G3-c: URL da BrasilAPI não é a base FIXA interpolando somente postalCodeNormalized.');
  }
  // Nenhuma URL de provider vinda de input/request/env dinâmico.
  if (/fetch\s*\(\s*(?!`https:\/\/(viacep\.com\.br|brasilapi\.com\.br)\/)/.test(adapter.replace(/fetch\s*\(\s*url/g, 'FETCH_URL_HELPER('))) {
    // fetch(url) do helper governado é o único indireto permitido; qualquer outro fetch é suspeito.
  }
  const fetchCalls = [...adapter.matchAll(/\bfetch\s*\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  for (const arg of fetchCalls) {
    if (arg !== 'url' && !arg.startsWith('`https://viacep.com.br/') && !arg.startsWith('`https://brasilapi.com.br/')) {
      note(`G3-d: fetch com origem não governada no adapter: "${arg.slice(0, 50)}"`);
    }
  }
  if (/req\.|request\.|query\.|body\./.test(adapter)) note('G3-e: adapter lê request/input — provider não é selecionável por request.');
  // Timeout + abort + retry único governado vivos.
  if (!/AbortController/.test(adapter)) note('G3-f: adapter sem AbortController (timeout por tentativa).');
  if (!/MAX_ATTEMPTS\s*=\s*2/.test(adapter)) note('G3-g: retry governado ausente ou diferente de 1 repetição (MAX_ATTEMPTS=2).');
  if (!/status\s*!==\s*429\s*&&\s*res\.status\s*<\s*500/.test(adapter)) note('G3-h: classificação 429/5xx→retry ausente.');
  // Sanitização de campos externos viva.
  if (!/sanitizeExternalText/.test(adapter) || !/MAX_EXTERNAL_FIELD_LENGTH/.test(adapter)) {
    note('G3-i: sanitização/limite de comprimento de campos externos ausente no adapter.');
  }
  if (!/^\s*\.replace\(\/\[\\u0000-\\u001f\\u007f\]\/g/m.test(adapter) && !/\[\\u0000-\\u001f\\u007f\]/.test(adapter)) {
    note('G3-j: remoção de caracteres de controle ausente na sanitização.');
  }
  // Chain governada: sem opt-in → vazia (sem rede em gates); ViaCEP primário.
  if (!/getPostalProviderChain/.test(adapter)) note('G3-k: getPostalProviderChain ausente.');
  if (!/return\s*\[\s*new\s+ViaCepProvider\(\)\s*,\s*new\s+BrasilApiCepProvider\(\)\s*\]/.test(adapter)) {
    note('G3-l: chain governada não é [ViaCEP primário, BrasilAPI fallback].');
  }
  if (!/default:\s*return\s*\[\s*\]/.test(adapter)) note('G3-m: chain sem opt-in deveria ser VAZIA (gates/testes sem rede).');
}

// ── G4 · país explícito ──────────────────────────────────────────────────────────────────────────
{
  const resolver = src(RESOLVER);
  if (!/country_required/.test(resolver)) note('G4-a: estado country_required ausente do resolver.');
  if (!/if\s*\(!rawCountry\)\s*return\s*\{\s*status:\s*'country_required'/.test(resolver)) {
    note('G4-b: resolver não falha fail-closed quando o país não é informado.');
  }
  if (/(\?\?|\|\|)\s*['"]BR['"]/.test(resolver)) note('G4-c: default silencioso de BR no resolver — país deve ser explícito (D-B).');
  if (!/normalizePostalCodeForCountry/.test(resolver)) note('G4-d: resolver não usa o normalizador POR PAÍS.');
  if (/\bnormalizePostalCode\s*\(/.test(resolver)) note('G4-e: resolver usa o normalizador legado global de 8 dígitos.');
  const normalizer = src(NORMALIZER);
  if (!/POSTAL_NORMALIZERS_BY_COUNTRY/.test(normalizer)) note('G4-f: registro de normalizadores por país ausente.');
  if (!/BR:\s*normalizeBrazilPostalCode/.test(normalizer)) note('G4-g: normalizador BR não registrado por país.');
  if (!/\^\\d\{8\}\$/.test(normalizer)) note('G4-h: regra de 8 dígitos ausente do normalizador BR.');
  // A regra de 8 dígitos deve viver DENTRO do normalizador BR, não na função de despacho.
  const dispatch = normalizer.slice(normalizer.indexOf('export function normalizePostalCodeForCountry'));
  if (/\\d\{8\}/.test(dispatch)) note('G4-i: regra de 8 dígitos vazou para o despacho global (deve ser só do BR).');
  // Cache persistente gated a BR (a chave viva não tem país).
  if (!/isoAlpha2\s*===\s*'BR'/.test(resolver)) note('G4-j: uso do cache não está delimitado a BR (chave sem país).');
}

// ── G5 · city por identificador oficial ESCOPADO ─────────────────────────────────────────────────
{
  const repo = src(EVIDENCE_REPO);
  if (!/WHERE\s+state_id\s*=\s*\$1\s+AND\s+external_code\s*=\s*\$2/.test(repo)) {
    note('G5-b: lookup canônico de city não é pelo par ESCOPADO (state_id, external_code).');
  }
  if (!/LIMIT\s+2/.test(repo)) note('G5-c: detecção de ambiguidade (LIMIT 2) ausente — first-row silencioso proibido.');
  // Nenhuma query de external_code SEM escopo de jurisdição no repo de evidência.
  for (const m of repo.matchAll(/`([^`]*external_code[^`]*)`/g)) {
    const q = m[1] ?? '';
    if (!/state_id\s*=\s*\$/.test(q) && !/country_id\s*=\s*\$/.test(q)) {
      note(`G5-d: query com external_code sem escopo de jurisdição: "${q.replace(/\s+/g, ' ').slice(0, 80)}"`);
    }
  }
  const resolver = src(RESOLVER);
  if (/searchCities|findNearestCity/.test(resolver)) note('G5-e: resolver usa busca de city por texto/proximidade — identidade é código oficial.');
  if (!/findCitiesByStateAndOfficialCode/.test(resolver)) note('G5-f: resolver não resolve city pelo método escopado.');
  const coreService = src(CORE_SERVICE);
  const resolveCepBody = coreService.slice(coreService.indexOf('async resolveCep'), coreService.indexOf('async getCityById'));
  if (/searchCities|findCityByExternalCode|getDefaultCepProvider/.test(resolveCepBody)) {
    note('G5-g: resolveCep (facade) voltou a resolver city por nome/código nu/provider direto.');
  }
  if (!/postalAddressResolverService/.test(resolveCepBody)) note('G5-h: resolveCep não delega ao resolver canônico.');
  // Migration da unicidade escopada: presente, com o shape certo.
  const mig = read(MIGRATION);
  if (!mig) {
    note(`G5-i: migration da unicidade escopada ausente (${MIGRATION}).`);
  } else {
    if (!/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uidx_cities_state_external_code/i.test(mig)) {
      note('G5-j: índice uidx_cities_state_external_code ausente/renomeado na migration.');
    }
    if (!/ON\s+public\.cities\s*\(\s*state_id\s*,\s*external_code\s*\)/i.test(mig)) {
      note('G5-k: índice não é escopado por (state_id, external_code).');
    }
    if (!/WHERE\s+external_code\s+IS\s+NOT\s+NULL\s+AND\s+btrim\(external_code\)\s*<>\s*''/i.test(mig)) {
      note('G5-l: predicado parcial (external_code materializado) ausente.');
    }
    if (/INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i.test(mig)) note('G5-m: migration da fundação contém DML — deveria ser somente estrutural.');
  }
  // Nenhuma migration pode declarar external_code NU como identidade global de cities.
  const MIG_DIR = join(ROOT, 'migrations');
  if (existsSync(MIG_DIR)) {
    for (const f of readdirSync(MIG_DIR).filter((x) => x.endsWith('.sql'))) {
      const body = readFileSync(join(MIG_DIR, f), 'utf8');
      for (const m of body.matchAll(/CREATE\s+UNIQUE\s+INDEX[^;]*\bcities\b[^;]*;/gi)) {
        const stmt = m[0];
        if (/\(\s*external_code\s*\)/i.test(stmt) && !/state_id/i.test(stmt)) {
          note(`G5-n: ${f} declara UNIQUE global em external_code NU — identidade oficial deve ser escopada pela jurisdição.`);
        }
      }
      for (const m of body.matchAll(/ALTER\s+TABLE[^;]*\bcities\b[^;]*UNIQUE\s*\(\s*external_code\s*\)[^;]*;/gi)) {
        note(`G5-o: ${f} adiciona UNIQUE(external_code) nu em cities — proibido (D-C).`);
      }
    }
  }
}

// ── G6 · bairro nunca vira identidade por texto ──────────────────────────────────────────────────
{
  const repo = src(EVIDENCE_REPO);
  // Alias e candidato SEMPRE escopados à city.
  const aliasQ = repo.match(/`([^`]*neighborhood_aliases[^`]*)`/);
  if (!aliasQ || !/n\.city_id\s*=\s*\$1/.test(aliasQ[1] ?? '')) {
    note('G6-a: lookup de alias de bairro não é escopado à city (n.city_id = $1).');
  }
  const candQ = repo.match(/`([^`]*name_normalized\s*=\s*unaccent[^`]*)`/);
  if (!candQ || !/n\.city_id\s*=\s*\$1/.test(candQ[1] ?? '')) {
    note('G6-b: lookup de CANDIDATO de bairro não é escopado à city — "Centro" cross-city proibido.');
  }
  // Vigência viva nos dois lookups (fonte única N3-PRE).
  if ((repo.match(/NEIGHBORHOOD_CURRENT_SQL/g) ?? []).length < 3) {
    note('G6-c: predicado canônico de vigência (NEIGHBORHOOD_CURRENT_SQL) ausente dos lookups de bairro.');
  }
  const resolver = src(RESOLVER);
  // Candidato NUNCA alimenta neighborhoodId.
  if (/neighborhoodId\s*=\s*[^;\n]{0,60}candidates/.test(resolver)) {
    note('G6-d: candidato de bairro atribuído a neighborhoodId — candidato exige confirmação humana.');
  }
  // A ÚNICA fonte de neighborhoodId no resolver é o alias governado (1 match).
  const idAssigns = [...resolver.matchAll(/neighborhoodId\s*=\s*(?!null)([^;\n]+)/g)].map((m) => m[1].trim());
  for (const a of idAssigns) {
    if (!/^aliasMatches\[0\]/.test(a)) note(`G6-e: neighborhoodId alimentado por fonte não-governada: "${a.slice(0, 50)}"`);
  }
  if (!/aliasMatches\.length\s*===\s*1/.test(resolver)) note('G6-f: alias ambíguo não é rejeitado (exige exatamente 1 match).');
  if (!/candidates\.length\s*===\s*1/.test(resolver)) note('G6-g: candidato ambíguo não é rejeitado (exige exatamente 1 match).');
  if (!/candidate_requires_confirmation/.test(resolver)) note('G6-h: estado candidate_requires_confirmation ausente.');
  if (!/not_applicable/.test(resolver) || !/'pending'/.test(resolver)) note('G6-i: estados pending/not_applicable ausentes.');
  if (!/requiresUserConfirmation:\s*true/.test(resolver)) note('G6-j: requiresUserConfirmation deixou de ser sempre true.');
}

// ── G7 · conflitos e ausências explícitos ────────────────────────────────────────────────────────
{
  const resolver = src(RESOLVER);
  for (const st of [
    'canonical_city_missing', 'canonical_city_ambiguous', 'territorial_inconsistency',
    'provider_conflict', 'official_identifier_conflict', 'official_identifier_missing',
    'provider_unavailable', 'provider_not_found', 'malformed_provider_response',
  ]) {
    if (!resolver.includes(`'${st}'`)) note(`G7-a: estado explícito '${st}' ausente do resolver.`);
  }
  // not_found e malformado PARAM a chain (fallback não mascara).
  if (!/not_found'\)\s*return\s*\{\s*kind:\s*'failure',\s*status:\s*'provider_not_found'/.test(resolver)) {
    note('G7-b: not_found não interrompe a chain com estado explícito (fallback mascarando).');
  }
  if (!/malformed'\)\s*return\s*\{\s*kind:\s*'failure',\s*status:\s*'malformed_provider_response'/.test(resolver)) {
    note('G7-c: payload malformado não interrompe a chain com estado explícito.');
  }
  // Evidências comparáveis discordantes → conflito explícito (não escolha silenciosa).
  // LIVENESS: o comparador precisa existir, ser CHAMADO no fluxo e o conflito RETORNAR.
  if (!/export\s+function\s+detectPostalEvidenceConflict/.test(resolver)) {
    note('G7-d: comparador de evidências detectPostalEvidenceConflict ausente.');
  }
  if (!/const\s+conflict\s*=\s*detectPostalEvidenceConflict\s*\(\s*evidence\s*\)\s*;?\s*if\s*\(\s*conflict\s*\)\s*return\s*\{\s*status:\s*conflict/.test(resolver)) {
    note('G7-d2: conflito de evidências não é verificado/retornado no fluxo vivo (escolha silenciosa).');
  }
  if (!/codes\.size\s*>\s*1\)\s*return\s*'official_identifier_conflict'/.test(resolver)) {
    note('G7-d3: divergência de código oficial não produz official_identifier_conflict.');
  }
  if (!/ufs\.size\s*>\s*1\)\s*return\s*'provider_conflict'/.test(resolver)) {
    note('G7-d4: divergência de UF não produz provider_conflict.');
  }
  // Cidade ausente → estado, nunca criação: já coberto por G1/G2; aqui prova o retorno vivo.
  if (!/fail\('canonical_city_missing'\)/.test(resolver)) note('G7-e: canonical_city_missing não é retornado fail-closed.');
  if (!/existsCityWithOfficialCodeInCountry/.test(resolver)) {
    note('G7-f: classificação território-inconsistente × cidade-ausente (código em outra UF) ausente.');
  }
}

// ── G8 · stack única (facades delegam; nenhum bypass vivo) ───────────────────────────────────────
{
  const facade = src(LEGACY_FACADE_ROUTE);
  if (!/postalAddressResolverService\.resolve/.test(facade)) note('G8-e: facade legada /api/location/cep não delega ao resolver canônico.');
  if (/\bfetch\s*\(|pool\s*\.|\.query\s*\(/.test(facade)) note('G8-f: facade legada tem fetch/DB próprio — deveria ser fina.');
  if (!/countryCode:\s*'BR'/.test(facade)) note('G8-g: facade legada sem país explícito no call-site.');
  const geo = src(GEO_ENRICHMENT);
  if (/getDefaultCepProvider|findCepResolutionByPostalCode|upsertCepResolution|\bfetch\s*\(/.test(geo)) {
    note('G8-h: geo-enrichment voltou a orquestrar provider/cache próprio — 2ª stack proibida.');
  }
  if (!/this\.resolver\.resolve\(/.test(geo)) note('G8-i: geo-enrichment não delega ao resolver canônico.');
  if (!/canonical_city_missing|resolution\.status/.test(geo)) note('G8-j: geo-enrichment não propaga o estado explícito do resolver.');
  const routes = src(CORE_ROUTES);
  if (/locationEnrichmentService|enrichFromCEP/.test(routes)) note('G8-k: location.routes referencia o serviço de enriquecimento aposentado.');
  if (/fastify\.post/.test(routes)) note('G8-l: location.routes ganhou POST — nenhuma rota de escrita territorial aqui.');
}

// ── G9 · PII fora dos logs ───────────────────────────────────────────────────────────────────────
{
  for (const rel of [...POSTAL_HOUSE, ADAPTER_HOUSE, LEGACY_FACADE_ROUTE, GEO_ENRICHMENT]) {
    const m = /console\s*\.\s*(log|info|warn|error|debug)/.exec(src(rel));
    if (m) note(`G9-a: console.${m[1]} vivo em ${rel} — família postal não loga payload/PII.`);
    if (/JSON\.stringify\s*\(\s*(data|payload|res|response|cepData)/.test(src(rel))) {
      note(`G9-b: serialização de payload externo em ${rel}.`);
    }
  }
}

// ── G10 · fronteiras da Fase B ───────────────────────────────────────────────────────────────────
{
  const forbiddenImport = /from\s+['"][^'"]*(actor-territorial-address|bank|social|split|ledger|regional-fund|regional_fund)[^'"]*['"]/i;
  const forbiddenSymbol = /\b(canRepresentActor|setActorTerritorialAddress|retireActorTerritorialAddress|actorTerritorialAddressWriterService|actorTerritorialAddressRepository)\b/;
  for (const rel of [...POSTAL_HOUSE, ADAPTER_HOUSE, LEGACY_FACADE_ROUTE]) {
    if (forbiddenImport.test(src(rel))) note(`G10-a: ${rel} importa domínio proibido (Fase C/Social/Bank/split/ledger/fundos).`);
    if (forbiddenSymbol.test(src(rel))) note(`G10-b: ${rel} referencia autoridade/writer da Fase C.`);
    if (/address_assignments|actor_events|idempotency_keys/.test(src(rel))) {
      note(`G10-c: ${rel} toca tabela da Fase A/C — Fase B não lê nem escreve vínculo territorial.`);
    }
  }
}

// ── Runner: o guard precisa estar VIVO na suíte ──────────────────────────────────────────────────
{
  const runner = read('scripts/run-regression-guards.mjs') ?? '';
  if (!runner.includes('audit-postal-resolution-canonical-boundary.mjs')) {
    note('R1: guard fora do runner validate:regression-guards.');
  }
}

if (failures.length) {
  console.error('GATE FAIL [postal-resolution-canonical-boundary]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ FASE B (RFC B1-D): resolução postal é READ-ONLY, país explícito, identidade de cidade = código oficial ESCOPADO pela jurisdição, bairro alias/candidato/pending, providers só nos adapters governados, conflitos explícitos, sem PII em log, sem criação de território por provider.');
  process.exit(1);
}
console.log('GATE OK [postal-resolution-canonical-boundary] — casa postal canônica read-only íntegra: país explícito; normalização por país; adapters governados (URLs fixas, timeout+retry único, sanitização); city por (state_id, external_code) com índice escopado; cidade ausente/conflitos fail-closed explícitos; bairro alias-governado/candidato/pending (nunca identidade por texto); cache derivado BR-only; stacks legadas aposentadas (cep.service/location-enrichment/POST enrich-from-cep mortos); facades delegando; sem PII em log; fronteiras Fase C/Social/Bank intactas.');
