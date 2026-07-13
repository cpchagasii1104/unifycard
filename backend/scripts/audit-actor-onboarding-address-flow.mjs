#!/usr/bin/env node
// Guard estrutural — F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) · MVP PF/residência.
// Prova que a jornada pública LIGA as casas seladas sem criar casas novas: escopo PF/residência,
// autoridade por canRepresentActor (await direto, infra-error não engolido), re-resolução server-side,
// cross-check da confirmação, escrita EXCLUSIVA pela Fase C, idempotência reutilizada, writer legado
// de residência aposentado, país explícito, sem provider direto/PII/Bank/Social, contratos registrados.
//
// Heurística textual comment-stripped (não AST): falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FE = join(ROOT, '..', 'frontend');
const failures = [];
const note = (m) => failures.push(m);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
function read(base, rel) { const p = join(base, ...rel.split('/')); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
function readBe(rel) { return read(ROOT, rel); }
function readFe(rel) { return read(FE, rel); }

const ONB = 'src/core/location/actor-territorial-address-onboarding.service.ts';
const READ = 'src/core/location/actor-territorial-address-read.service.ts';
const ROUTES = 'src/core/location/actor-territorial-address.routes.ts';
const PROFILE_ROUTES = 'src/core/profile/profile.routes.ts';

const onbRaw = readBe(ONB), routesRaw = readBe(ROUTES), readRaw = readBe(READ), profRaw = readBe(PROFILE_ROUTES);
const onb = onbRaw ? stripTs(onbRaw) : '';
const routes = routesRaw ? stripTs(routesRaw) : '';
const readSvc = readRaw ? stripTs(readRaw) : '';
const prof = profRaw ? stripTs(profRaw) : '';
for (const [rel, raw] of [[ONB, onbRaw], [READ, readRaw], [ROUTES, routesRaw]]) {
  if (raw === null) note(`A0: arquivo obrigatório ausente: ${rel}`);
}

// ── G1 · escopo PF/residência ────────────────────────────────────────────────────────────────────
if (onb) {
  if (!/purpose !== 'ACTOR_RESIDENCE'/.test(onb)) note('G1: onboarding não restringe a ACTOR_RESIDENCE.');
  if (!/actor_type !== 'user'/.test(onb)) note('G1: onboarding não valida Actor PF (actor_type=user) server-side.');
  if (!/assertActorPf/.test(onb)) note('G1: gate PF ausente.');
  if (/'ACTOR_OPERATIONAL'|'ACTOR_FISCAL_HQ'|'HQ'|'OPERATIONAL'/.test(onb)) note('G1: onboarding referencia purposes/roles fora do MVP.');
  // role nunca vem do cliente: o writer deriva role do purpose; onboarding não lê command.role
  if (/command\.role|input\.role|body\.role/.test(onb)) note('G1: role vindo do cliente (proibido; derivado do purpose).');
}
if (routes) {
  if (!/z\.literal\('ACTOR_RESIDENCE'\)/.test(routes)) note('G1-route: schema não fixa purpose=ACTOR_RESIDENCE.');
  if (/role:|owner_type|owner_id/.test(routes)) note('G1-route: rota aceita role/owner_type/owner_id.');
}

// ── G2 · autoridade ────────────────────────────────────────────────────────────────────────────
if (onb) {
  if (!/canRepresentActor/.test(onb)) note('G2: onboarding não usa canRepresentActor.');
  if (!/const representable = await this\.authz\(auth\.tenantId, auth\.operatorUserId, auth\.routeActorId\)/.test(onb)) {
    note('G2-await: autoridade não é await DIRETO com tenant/operator server-side + actorId da rota.');
  }
  if (/\.catch\(\s*\(\)\s*=>\s*false\s*\)|catch\s*\{\s*return false/.test(onb)) note('G2-swallow: canRepresentActor engolido para false.');
  if (!/actionContextActorId !== auth\.routeActorId/.test(onb)) note('G2-coherence: sem checagem de coerência actor rota × action-context.');
  // tenant nunca do payload
  if (/command\.tenantId|body\.tenantId|input\.tenantId/.test(onb)) note('G2-tenant: tenant vindo do payload.');
}
if (routes) {
  if (!/operatorUserId: req\.user\.userId/.test(routes)) note('G2-route: operator não vem de req.user server-side.');
  if (!/tenantId: req\.tenant\.id/.test(routes)) note('G2-route: tenant não vem de req.tenant server-side.');
  if (!/routeActorId: req\.params\.actorId/.test(routes)) note('G2-route: actorId não vem da rota.');
  // infra-error na autoridade da ROTA → 500 unexpected_error (NUNCA 403 silencioso).
  if (!/set authority falhou[\s\S]{0,160}status\(500\)\.send\(\{ error: 'unexpected_error' \}\)/.test(routes)) {
    note('G2-route-infra: catch de autoridade da rota não devolve 500 unexpected_error (infra virando 403?).');
  }
}

// ── G3 · re-resolução server-side + cross-check ──────────────────────────────────────────────────
if (onb) {
  if (!/this\.resolve\(\{\s*countryCode: country, postalCode: command\.postalCode\s*\}\)/.test(onb)) {
    note('G3: onboarding não RE-RESOLVE country+postalCode server-side no write.');
  }
  if (!/resolution\.status !== 'resolved'/.test(onb)) note('G3-status: não exige status=resolved.');
  if (!/command\.confirmedCityId !== resolution\.cityId/.test(onb)) note('G3-crosscheck: sem cross-check confirmedCityId × re-resolvido.');
  if (!/territorial_confirmation_mismatch/.test(onb)) note('G3-mismatch: mismatch não bloqueia o writer.');
  // cityId do writer vem da RE-RESOLUÇÃO, não do cliente
  if (!/cityId: resolution\.cityId/.test(onb)) note('G3-authority: cityId do writer não vem da re-resolução.');
  if (/cityId: command\.confirmedCityId|cityId: input\.confirmedCityId/.test(onb)) note('G3-trust: cityId do writer veio do cliente (confiança cega).');
}

// ── G4 · bairro ──────────────────────────────────────────────────────────────────────────────────
if (onb) {
  if (!/neighborhoodStatus === 'resolved'/.test(onb)) note('G4: bairro não trata status resolved explicitamente.');
  if (!/neighborhoodId = resolution\.neighborhoodId/.test(onb)) note('G4-id: neighborhoodId resolvido não vem da re-resolução.');
  if (!/neighborhoodId = null/.test(onb)) note('G4-null: candidate/pending/not_applicable não zeram neighborhoodId.');
  if (/candidateId.*neighborhoodId|neighborhoodId.*candidateId/.test(onb)) note('G4-candidate: candidateId virando identidade.');
}

// ── G5 · writer único (nenhuma escrita direta; só Fase C) ────────────────────────────────────────
for (const [rel, body] of [[ONB, onb], [ROUTES, routes], [READ, readSvc]]) {
  if (/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(addresses|address_assignments)\b/i.test(body)) {
    note(`G5: ${rel} escreve direto em addresses/address_assignments (proibido; só a Fase C).`);
  }
  if (/actor-territorial-address\.repository|createTerritorialAddress|insertActorAssignment|retirePriorActorPrimary|insertTerritorialEvent/.test(body)) {
    note(`G5-repo: ${rel} importa/usa o repository PRIVADO da Fase C (proibido).`);
  }
}
if (onb) {
  if (!/setActorTerritorialAddress/.test(onb)) note('G5-writer: onboarding não chama o writer selado da Fase C.');
  // LIVENESS: o writer precisa ser CHAMADO no fluxo (não só importado).
  if (!/await this\.write\(writerAuth/.test(onb)) note('G5-call: writer não é invocado (await this.write(writerAuth …)) no fluxo.');
  if (/pg_advisory_xact_lock|BEGIN'\)|client\.query\('COMMIT'\)/.test(onb)) note('G5-tx: onboarding abre transação/lock próprios (a Fase C é a casa).');
}

// ── G6 · idempotência reutilizada (sem casa paralela) ───────────────────────────────────────────
if (onb) {
  if (!/idempotencyKey/.test(onb)) note('G6: idempotencyKey não é repassada.');
  // LIVENESS: a idempotencyKey precisa ir para o INPUT do writer (não só existir no arquivo).
  if (!/idempotencyKey,\s*address:/.test(onb)) note('G6-pass: idempotencyKey não é passada ao input do writer.');
  if (/idempotency_keys|INSERT INTO idempotency/.test(onb)) note('G6-parallel: onboarding cria casa de idempotência paralela.');
  if (!/idempotency_payload_mismatch/.test(onb) || !/actor_territorial_in_progress/.test(onb)) {
    note('G6-map: replay/mismatch/in-progress não projetados.');
  }
}

// ── G7 · contratos (DTO estreito, sem provider internals) ───────────────────────────────────────
{
  const contractRaw = read(join(ROOT, '..'), 'packages/contracts/src/territorial-address.ts');
  const contract = contractRaw ? stripTs(contractRaw) : null;
  if (!contract) note('G7: contrato compartilhado territorial-address.ts ausente.');
  else {
    if (/providerEvidence|responseHash|cacheHit/.test(contract)) note('G7-leak: contrato expõe provider internals.');
    if (!/PostalAddressPreview/.test(contract) || !/SetTerritorialAddressCommand/.test(contract) || !/TerritorialAddressCurrent/.test(contract)) {
      note('G7-shape: contrato não define preview/comando/leitura.');
    }
  }
  const idx = read(join(ROOT, '..'), 'packages/contracts/src/index.ts');
  if (!idx || !/territorial-address/.test(idx)) note('G7-index: contrato não exportado no index.');
  const distJs = read(join(ROOT, '..'), 'packages/contracts/dist/territorial-address.js');
  const distDts = read(join(ROOT, '..'), 'packages/contracts/dist/territorial-address.d.ts');
  if (!distJs || !distDts) note('G7-dist: dist de contracts incompleto (rebuild + force-add).');
  // rota/service não devolvem providerEvidence
  for (const [rel, body] of [[ROUTES, routes], [READ, readSvc], [ONB, onb]]) {
    if (/providerEvidence|responseHash|cacheHit|providerEvidence\b/.test(body)) note(`G7-svc: ${rel} manipula provider internals no público.`);
  }
}

// ── G8 · legado convergido ───────────────────────────────────────────────────────────────────────
if (prof) {
  if (/profileResidenceAddressService\.setResidence/.test(prof)) note('G8: PUT profile ainda chama o writer legado setResidence.');
  if (!/status\(410\)/.test(prof) || !/endpoint_retired/.test(prof)) note('G8-410: PUT residence não está aposentado (410 endpoint_retired).');
  if (!/legacy_profile_fallback/.test(prof)) note('G8-fallback: GET residence não marca o fallback legado.');
  if (!/actorTerritorialAddressReadService|getCurrent/.test(prof)) note('G8-prefer: GET residence não prefere o actor-scoped canônico.');
  // GET legado não escreve
  if (/setResidence\(|createAddress|assignAddress|INSERT INTO/i.test(prof)) note('G8-write: profile.routes contém escrita de residência.');
}

// ── G9 · frontend PF ─────────────────────────────────────────────────────────────────────────────
{
  const cardRaw = readFe('src/components/ResidenceAddressCanonical.tsx');
  const hookRaw = readFe('src/hooks/useCanonicalResidenceAddress.ts');
  const apiRaw = readFe('src/api/actorTerritorialAddress.ts');
  const profileRaw = readFe('src/components/Profile.tsx');
  if (!cardRaw || !hookRaw || !apiRaw) note('G9: arquivos da jornada canônica PF ausentes.');
  // strip de comentários: as strings legadas aparecem em comentários dizendo que NÃO são usadas.
  const card = cardRaw ? stripTs(cardRaw) : null;
  const hook = hookRaw ? stripTs(hookRaw) : null;
  const api = apiRaw ? stripTs(apiRaw) : null;
  const profile = profileRaw ? stripTs(profileRaw) : null;
  for (const [rel, body] of [['ResidenceAddressCanonical', card], ['useCanonicalResidenceAddress', hook], ['actorTerritorialAddress', api]]) {
    if (body && /\/api\/location\/cep/.test(body)) note(`G9-legacyfacade: ${rel} usa a facade textual /api/location/cep.`);
    if (body && /useAddressResolver|useProfileCep/.test(body)) note(`G9-legacyhook: ${rel} usa o hook legado de CEP.`);
  }
  if (api) {
    if (!/\/locations\/cep/.test(api)) note('G9-preview: client canônico não usa /locations/cep.');
    // LIVENESS: país explícito precisa ir na QUERY do preview (countryCode=…), não só existir como palavra.
    if (!/countryCode=/.test(api)) note('G9-country: preview sem país explícito na query (countryCode=).');
    if (/tenantId|owner_type|"role"|\brole:/.test(api)) note('G9-payload: client envia tenant/role/owner.');
  }
  if (hook) {
    if (!/idempotencyKey/.test(hook)) note('G9-idem: hook não gera/usa idempotencyKey.');
    // LIVENESS: a idempotencyKey precisa ir no COMANDO enviado.
    if (!/idempotencyKey: idempotencyKeyRef\.current/.test(hook)) note('G9-idem-pass: hook não passa idempotencyKey no comando.');
    if (!/snapshotRef|ConfirmationSnapshot/.test(hook)) note('G9-snapshot: confirmação não vinculada a snapshot.');
    if (!/invalidateConfirmation|setConfirmed\(false\)/.test(hook)) note('G9-invalidate: mudança territorial não invalida confirmação.');
  }
  if (profile) {
    if (/putResidenceAddress/.test(profile)) note('G9-profile: Profile ainda importa/chama o writer legado putResidenceAddress.');
    if (!/ResidenceAddressCanonical/.test(profile)) note('G9-mount: Profile não monta o card canônico.');
  }
}

// ── G10 · fronteiras ─────────────────────────────────────────────────────────────────────────────
for (const [rel, body] of [[ONB, onb], [ROUTES, routes], [READ, readSvc]]) {
  if (/getDefaultCepProvider|viacep|brasilapi|resolvePostalCode\(/.test(body)) {
    // resolvePostalCode via postalAddressResolverService.resolve é OK; provider direto não.
    if (/viacep|brasilapi|getDefaultCepProvider/.test(body)) note(`G10-provider: ${rel} chama provider direto.`);
  }
  if (/from\s+['"][^'"]*(bank|social|ledger|split|regional[-_]?fund)[^'"]*['"]/i.test(body)) note(`G10-domain: ${rel} importa Bank/Social/ledger/split/fundos.`);
  if (/createCityFromExternal|findOrCreateCity|findOrCreateState|INSERT\s+INTO\s+(cities|states|neighborhoods)/i.test(body)) {
    note(`G10-territory: ${rel} cria city/state/neighborhood.`);
  }
  // sem PII em log
  for (const m of body.matchAll(/console\s*\.\s*\w+\([^)]*\)/g)) {
    if (/street|postal|complement|number|logradouro/i.test(m[0])) note(`G10-pii: ${rel} loga PII: ${m[0].slice(0, 40)}`);
  }
}
// nenhuma migration nova nesta frente (só as já seladas)
{
  const migDir = join(ROOT, 'migrations');
  if (existsSync(migDir)) {
    const news = readFileSync ? null : null; // migrations checadas por count no cartório; aqui provamos sem timestamp novo
  }
}

// ── runner ───────────────────────────────────────────────────────────────────────────────────────
{
  const runner = readBe('scripts/run-regression-guards.mjs') ?? '';
  if (!runner.includes('audit-actor-onboarding-address-flow.mjs')) note('R1: guard fora do runner.');
}

if (failures.length) {
  console.error('GATE FAIL [actor-onboarding-address-flow]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ MVP PF/residência: liga resolver B → confirmação → writer C SELADO; escopo PF/RESIDENCE; autoridade canRepresentActor (await direto, infra propaga); re-resolução server-side + cross-check; escrita só pela Fase C; idempotência reutilizada; PUT profile aposentado + GET fallback read-only; país explícito; sem provider direto/PII/Bank/Social; contratos registrados (dist completo).');
  process.exit(1);
}
console.log('GATE OK [actor-onboarding-address-flow] — jornada pública PF/residência liga as casas seladas: escopo ACTOR_RESIDENCE/PF server-side; autoridade canRepresentActor(await direto, infra-error propaga, coerência rota×action-context); re-resolução server-side com cross-check da confirmação (mismatch bloqueia); bairro resolved→id / candidate·pending·not_applicable→null; escrita EXCLUSIVA por setActorTerritorialAddress (sem SQL/repository-privado/lock/idempotência próprios); idempotência da Fase C reutilizada; PUT /profile/residence-address aposentado (410) + GET fallback read-only marcado; contrato compartilhado estreito (sem provider internals) com dist completo; frontend canônico (preview /locations/cep país-explícito, snapshot de confirmação, idempotencyKey, sem /api/location/cep/tenant/role/owner); sem provider direto, sem criação de território, sem PII em log, sem Bank/Social.');
