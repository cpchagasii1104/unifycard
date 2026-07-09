#!/usr/bin/env node
// Guard final — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 2b-5. Blinda a CONVERGÊNCIA VIVA da locação para
// asset-first: identidade = actor_assets; modo = actor_asset_modes('rental'); termos = actor_asset_rental_terms;
// tiers = actor_asset_rental_pricing_tiers; availability/address/bookings = owner_type='actor_asset'. Nenhum
// caminho vivo pode tratar rentable_resources como IDENTIDADE do item, nem colocar dinheiro/Bank nas camadas.
// concept_asset_eligibilities segue GLOBAL. MORDE por mutação (ver 2b-5). Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FE = join(ROOT, '..', 'frontend', 'src');
const failures = [];
const strip = (s) => (s || '').replace(/--[^\n]*/g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel, base = ROOT) => { const p = join(base, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'));
const migText = (needle) => { const f = migs.find((m) => m.includes(needle)); return f ? readFileSync(join(ROOT, 'migrations', f), 'utf-8') : ''; };
const allMig = migs.map((m) => readFileSync(join(ROOT, 'migrations', m), 'utf-8')).join('\n');

const REPO = strip(read('src/modules/rentals/rentable-resource.repository.ts'));
const SVC = strip(read('src/modules/rentals/rentable-resource.service.ts'));
const AUTH = strip(read('src/core/availability/availability-owner-authority.ts'));
const AVAIL_SVC = strip(read('src/core/availability/unified-availability.service.ts'));
const FE_DETAIL = read('components/../pages/RentalResourceDetailPage.tsx', FE) || read('pages/RentalResourceDetailPage.tsx', FE);
const FE_AVAIL = read('api/availability.ts', FE);
const SUBSTRATE = migText('asset_rental_terms_substrate');
const FOUNDATION = migText('asset_multi_offer_foundation');

// (1)(2) rental_terms tem asset_id PK (1:1 com actor_assets).
if (!/actor_asset_rental_terms\s*\(\s*asset_id\s+UUID\s+PRIMARY KEY\s+REFERENCES\s+actor_assets/i.test(SUBSTRATE)) {
  failures.push('actor_asset_rental_terms: asset_id não é PK/FK obrigatória para actor_assets (perdeu o 1:1 / identidade).');
}
// (3)(4) fluxo vivo do repository NÃO usa rentable_resources como identidade (create/reads/bookings).
for (const re of [/INSERT\s+INTO\s+rentable_resources/i, /FROM\s+rentable_resources/i, /JOIN\s+rentable_resources/i, /UPDATE\s+rentable_resources/i]) {
  if (re.test(REPO)) failures.push(`rentable-resource.repository: usa rentable_resources como fonte viva (${re}) — deve ser actor_assets + actor_asset_rental_terms.`);
}
// (5) tiers = actor_asset_rental_pricing_tiers; NÃO rental_resource_pricing como SSOT vivo.
if (!/actor_asset_rental_pricing_tiers/.test(REPO)) failures.push('repository: tiers não usam actor_asset_rental_pricing_tiers.');
if (/rental_resource_pricing/.test(REPO)) failures.push('repository: ainda usa rental_resource_pricing como SSOT vivo de tiers.');
// (6) create grava actor_asset_modes activation_mode='rental'.
if (!/INSERT\s+INTO\s+actor_asset_modes[\s\S]{0,120}'rental'/i.test(REPO)) failures.push('create(): não ativa actor_asset_modes.activation_mode=rental.');
// (7)(8) service valida elegibilidade + offer_kind=rentable.
if (!/conceptIsAssetEligible/.test(SVC)) failures.push('service: create não valida concept_asset_eligibilities.');
if (!/conceptHasOfferKind\([^)]*'rentable'/.test(SVC)) failures.push("service: create não valida offer_kind='rentable'.");
// (9) category_id não decide elegibilidade/rental/resource_type (os gates usam eligibility/offer_kind/rentable_types, não category).
if (/conceptHasOfferKind|conceptIsAssetEligible|conceptRentableTypes/.test(SVC) === false) failures.push('service: gates governados de locação ausentes.');
// (10)(11) actor_assets e actor_asset_modes SEM coluna financeira/econômica. Strip de comentário: a checagem
// vale sobre DDL, não sobre o comentário "SEM preço/booking/agenda..." da própria migration.
const finCols = /(price_cents|amount_cents|bank_|ledger|payment|booking|agenda|rfq|service_demand)/i;
const FOUND_S = strip(FOUNDATION), SUB_S = strip(SUBSTRATE);
const assetsBlock = FOUND_S.slice(FOUND_S.indexOf('CREATE TABLE IF NOT EXISTS actor_assets'), FOUND_S.indexOf('CREATE TABLE IF NOT EXISTS actor_asset_modes'));
const modesBlock = FOUND_S.slice(FOUND_S.indexOf('CREATE TABLE IF NOT EXISTS actor_asset_modes'));
if (finCols.test(assetsBlock)) failures.push('actor_assets: ganhou coluna financeira/booking/agenda — proibido (identidade do item).');
if (finCols.test(modesBlock)) failures.push('actor_asset_modes: ganhou coluna financeira/booking/agenda — proibido (só ativação).');
// (12) rental_terms sem bank_/ledger/payment (price_cents é anúncio, PERMITIDO; bank/ledger/payment não).
const termsBlock = SUB_S.slice(SUB_S.indexOf('CREATE TABLE IF NOT EXISTS actor_asset_rental_terms'));
if (/(bank_|ledger|payment|payout)/i.test(termsBlock)) failures.push('actor_asset_rental_terms: contém bank_/ledger/payment — termo é anúncio, nunca movimento financeiro.');
// (13)(14) availability/address do fluxo vivo NÃO usam owner_type='rentable_resource'.
if (/owner_type\s*=?\s*'rentable_resource'/.test(REPO)) failures.push("repository: availability/address ainda usa owner_type='rentable_resource' — deve ser 'actor_asset'.");
// (15)(16) frontend: sem ownerType='rentable_resource' na locação; type aceita actor_asset.
if (FE_DETAIL && /ownerType:\s*'rentable_resource'/.test(FE_DETAIL)) failures.push("RentalResourceDetailPage: voltou a usar ownerType='rentable_resource'.");
if (FE_AVAIL && !/'actor_asset'/.test(FE_AVAIL)) failures.push("frontend api/availability.ts: type AvailabilityOwnerType não aceita 'actor_asset'.");
// (17) resolver ACTOR_ASSET via actor_assets.owner_actor_id.
if (!/\[AvailabilityOwnerType\.ACTOR_ASSET\]/.test(AUTH) || !/FROM actor_assets/.test(AUTH)) failures.push('availability-owner-authority: sem resolver ACTOR_ASSET (owner_actor_id de actor_assets).');
// (18) service confirm dispatcha ACTOR_ASSET p/ o resource-lock.
if (AVAIL_SVC && (!/ACTOR_ASSET/.test(AVAIL_SVC) || !/confirmBookingWithResourceLock/.test(AVAIL_SVC))) failures.push('unified-availability.service: confirm de locação não dispara resource-lock por ACTOR_ASSET.');
// (19) RLS ENABLE+FORCE nas 4 tabelas asset (hardening 2b-1b).
for (const t of ['actor_assets', 'actor_asset_modes', 'actor_asset_rental_terms', 'actor_asset_rental_pricing_tiers']) {
  if (!new RegExp(`ALTER TABLE ${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i').test(allMig) || !new RegExp(`ALTER TABLE ${t}\\s+FORCE ROW LEVEL SECURITY`, 'i').test(allMig)) {
    failures.push(`${t}: RLS ENABLE/FORCE ausente (isolamento de tenant enfraquecido).`);
  }
}
// (20)(21) concept_asset_eligibilities segue GLOBAL (sem RLS tenant, sem tenant_id, sem category_id).
if (/ALTER TABLE concept_asset_eligibilities[^;]*(ENABLE|FORCE) ROW LEVEL SECURITY/i.test(allMig)) failures.push('concept_asset_eligibilities: virou tenant-scoped (viola SSOT global).');
if (/ALTER TABLE concept_asset_eligibilities[^;]*ADD COLUMN[^;]*(tenant_id|category_id)/i.test(allMig) || /CREATE TABLE[^;]*concept_asset_eligibilities[^;]*(tenant_id|category_id)/is.test(allMig)) {
  failures.push('concept_asset_eligibilities: ganhou tenant_id/category_id (elegibilidade é por CONCEPT global).');
}
// (22)-(26) o módulo de locação NÃO toca venda/rides/service_offerings/actor_professional_concepts/service_use.
for (const forbidden of ['product_offers', 'rides_vehicles', 'service_offerings', 'actor_professional_concepts']) {
  if (new RegExp(`(INSERT INTO|UPDATE|FROM|JOIN)\\s+${forbidden}`, 'i').test(REPO)) failures.push(`rentals repository: toca ${forbidden} — fora do escopo da locação.`);
}
// (27)(28) DISPLAY/CONTAGEM DE LOCAÇÃO fora do módulo — o probe do pilar rental (actor-page) não pode contar
// em rentable_resources (probe morto): novas locações asset-first não apareceriam no badge (ressalva Yala 2b).
// O contador vivo lê o SSOT convergido. Referências LEGADAS aceitas pela Yala (branch RENTABLE_RESOURCE do
// owner-authority, support-ticket owner reader, enum de transição, manifest name) NÃO são fluxo de display de
// locação e ficam FORA desta trava — por isso a checagem é escopada à função countActiveRentals de actor-page.
const ACTORPAGE = strip(read('src/modules/actor-page/actor-page.repository.ts'));
const countRentalFn = (ACTORPAGE.match(/countActiveRentals[\s\S]*?\n  \}/) || [''])[0];
if (/FROM\s+rentable_resources/i.test(countRentalFn)) failures.push('actor-page.countActiveRentals: conta locação em rentable_resources (probe morto) — deve contar actor_assets + actor_asset_modes(rental) + actor_asset_rental_terms.');
if (countRentalFn && !(/FROM\s+actor_assets/i.test(countRentalFn) && /actor_asset_modes/.test(countRentalFn) && /actor_asset_rental_terms/.test(countRentalFn))) failures.push('actor-page.countActiveRentals: não lê o SSOT asset-first da locação (actor_assets + actor_asset_modes + actor_asset_rental_terms).');

// ============================================================================================
// F-ASSET-CONDITION-AND-RENTAL-MINIMUMS (D1-D7). CONDIÇÃO=do ITEM (actor_assets.condition);
// MÍNIMO=dos TERMOS (actor_asset_rental_terms.min_rental_*). Governado, com CHECK, sem re-home errado.
// ============================================================================================
const COND_MIG = strip(migText('asset_condition_and_rental_minimums'));
const ASSET_TYPES = strip(read('src/core/assets/asset.types.ts'));
const FE_LIST = read('pages/RentalResourceListPage.tsx', FE) || '';

// (29) D1 — condição no ITEM: migration adiciona actor_assets.condition + CHECK new/used.
if (!/ALTER TABLE actor_assets\s+ADD COLUMN[^;]*\bcondition\b/i.test(COND_MIG)) failures.push('D1: actor_assets.condition não foi criada na migration (condição é do ITEM).');
if (!/condition\s+IN\s*\(\s*'new'\s*,\s*'used'\s*\)/i.test(COND_MIG)) failures.push("D1: CHECK de condition ausente/errado (deve ser IN ('new','used') — sem texto livre).");
// (30) condição fora da v1 não pode ter entrado no CHECK (refurbished/reconditioned/damaged/open_box/other).
if (/(refurbished|reconditioned|damaged|open_box)/i.test(COND_MIG)) failures.push('D1: condition ganhou valor fora da v1 (refurbished/etc) sem decisão própria.');
// (31) D1 — condição NÃO pode morar em modes nem em rental_terms (é do item).
if (/ALTER TABLE actor_asset_modes\s+ADD COLUMN[^;]*condition/i.test(COND_MIG)) failures.push('D1: condition foi para actor_asset_modes — condição não é modo.');
if (/ALTER TABLE actor_asset_rental_terms\s+ADD COLUMN[^;]*\bcondition\b/i.test(COND_MIG)) failures.push('D1: condition foi para actor_asset_rental_terms — condição é do item, não da oferta.');
// (32) D1 — vocab governado ASSET_CONDITIONS=['new','used'] (fonte única); routes usam o enum, não string livre.
if (!/ASSET_CONDITIONS\s*=\s*\[\s*'new'\s*,\s*'used'\s*\]/.test(ASSET_TYPES)) failures.push('D1: ASSET_CONDITIONS governado ausente/errado em asset.types.ts.');
if (!/z\.enum\(ASSET_CONDITIONS\)/.test(strip(read('src/modules/rentals/rentable-resource.routes.ts')))) failures.push('D1: rota de locação não valida condition pelo vocab governado (z.enum(ASSET_CONDITIONS)).');
// (33) D2/D3 — mínimo nos TERMOS (não no item): migration adiciona min_rental_* a rental_terms, NUNCA a actor_assets.
if (!/ALTER TABLE actor_asset_rental_terms\s+ADD COLUMN[^;]*min_rental_quantity/i.test(COND_MIG) || !/ALTER TABLE actor_asset_rental_terms\s+ADD COLUMN[^;]*min_rental_unit/i.test(COND_MIG)) failures.push('D2: min_rental_quantity/min_rental_unit não foram criados em actor_asset_rental_terms.');
if (/ALTER TABLE actor_assets\s+ADD COLUMN[^;]*min_rental/i.test(COND_MIG)) failures.push('D2: mínimo foi para actor_assets — mínimo é TERMO da locação, não atributo do item.');
// (34) D3 — CHECKs do mínimo: qty>=1, unit no vocab, par completo; 'event' NÃO é unidade (D5).
if (!/min_rental_quantity\s+IS NULL\s+OR\s+min_rental_quantity\s*>=\s*1/i.test(COND_MIG)) failures.push('D3: falta CHECK min_rental_quantity >= 1 (mínimo não pode ser 0/negativo).');
if (!/min_rental_unit\s+IS NULL\s+OR\s+min_rental_unit\s+IN\s*\(/i.test(COND_MIG)) failures.push('D3: falta CHECK de min_rental_unit contra o vocab governado.');
if (!/\(min_rental_quantity IS NULL\)\s*=\s*\(min_rental_unit IS NULL\)/i.test(COND_MIG)) failures.push('D3: falta CHECK de PAR (quantidade e unidade juntas ou ambas ausentes).');
if (/min_rental_unit[^;]*\bevent\b/i.test(COND_MIG) || /MIN_RENTAL_UNITS[\s\S]{0,80}\bevent\b/.test(strip(read('src/modules/rentals/rentable-resource.types.ts')))) failures.push("D5: 'event' entrou como unidade de tempo sem RFC próprio.");
// (35) D2 — RE-HOME provado: o mínimo NÃO volta para actor_assets.metadata. A linha que monta o metadata do
// item (const metadata = {...}) NÃO pode conter minRental; o INSERT de actor_assets não carrega minRental;
// minRentalOf lê das COLUNAS (resource.minRentalQty), não do metadata.
const metaLine = (SVC.match(/const metadata\s*=\s*\{[^\n]*/) || [''])[0];
if (/minRental/i.test(metaLine)) failures.push('D2: service injeta o mínimo em metadata do item (re-home incompleto — mínimo é TERMO).');
const assetInsert = (REPO.match(/INSERT INTO actor_assets[\s\S]*?\)\s*RETURNING id/) || [''])[0];
if (/minRental/i.test(assetInsert)) failures.push('D2: INSERT de actor_assets carrega minRental — mínimo não pertence ao item.');
if (/resource\.metadata[\s\S]{0,60}minRental|m\.minRentalQty/.test(SVC)) failures.push('D2: minRentalOf ainda lê o mínimo do metadata do item (deveria ler das colunas dos termos).');
// (36) D6 — frontend SEM hardcode: renderiza unidades/condições do vocab governado (backend), não de lista local.
if (FE_LIST) {
  if (!/getRentalVocabularies\(/.test(FE_LIST)) failures.push('D6: RentalResourceListPage não busca o vocab governado (getRentalVocabularies).');
  if (!/minUnitOptions\.map/.test(FE_LIST) || !/conditionOptions\.map/.test(FE_LIST)) failures.push('D6: opções de unidade/condição não são renderizadas do vocab do backend.');
  if (/<option value="(hour|day|week|month|semester|year)"/.test(FE_LIST)) failures.push('D6: lista de unidades do tempo mínimo hardcodada no frontend (deve vir do backend).');
  if (/useState<'hour'\s*\|\s*'day'/.test(FE_LIST)) failures.push('D6: estado de unidade com union hardcodado (lista local) no frontend.');
}
// (37) condição/mínimo NÃO tocam Bank/ledger/payment na migration (Δbank=0).
if (/(bank_|ledger|payout|payment_intent|amount_cents)/i.test(COND_MIG)) failures.push('D2/D1: migration de condição/mínimo tocou vocabulário financeiro — proibido (Δbank=0).');

if (failures.length > 0) {
  console.error('GATE FAIL [asset-rental-convergence]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [asset-rental-convergence] — locação convergida: identidade=actor_assets, modo=rental, termos+tiers próprios, availability/address/bookings=actor_asset, resolver ACTOR_ASSET, RLS íntegro, eligibility GLOBAL, sem rentable_resources vivo, sem Bank nas camadas, sem tocar venda/rides/serviço.');
process.exit(0);
