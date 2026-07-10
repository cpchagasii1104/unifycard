#!/usr/bin/env node
// Guard — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B (SERVICE_USE / uso operacional, substrato mínimo, adendo
// RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO). Blinda o desenho ratificado: junção N (NÃO 1:1) em
// actor_asset_service_usages; ativação = modo 'service_use'; concept do serviço via FK composta a
// concept_offer_kinds(offer_kind='service'); v1 = SOMENTE dono-operador (terceiro-operador/release = Fatia
// 4C, fora); habilitação do operador reusa o gate de service_offering (sem trilho paralelo); Δbank=0;
// sem booking/RFQ/viabilidade/localidade nesta fatia. MORDE por mutação.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const strip = (s) => (s || '').replace(/--[^\n]*/g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'));
const migText = (needle) => { const f = migs.find((m) => m.includes(needle)); return f ? readFileSync(join(ROOT, 'migrations', f), 'utf-8') : ''; };
const allMig = migs.map((m) => readFileSync(join(ROOT, 'migrations', m), 'utf-8')).join('\n');

const AASU_MIG = migText('asset_service_use_substrate');
const AASU_MIG_S = strip(AASU_MIG);
const ASSET_TYPES = strip(read('src/core/assets/asset.types.ts') || '');
const REPO = strip(read('src/modules/asset-service-use/asset-service-use.repository.ts') || '');
const SVC = strip(read('src/modules/asset-service-use/asset-service-use.service.ts') || '');
const ROUTES = strip(read('src/modules/asset-service-use/asset-service-use.routes.ts') || '');
const ACTORPAGE = strip(read('src/modules/actor-page/actor-page.repository.ts') || '');
const MODULE_TEXT = REPO + '\n' + SVC + '\n' + ROUTES;

// (1) junção N (asset_id NÃO é PK — diferente de sale_terms/rental_terms 1:1).
if (/CREATE TABLE[^;]*actor_asset_service_usages\s*\(\s*asset_id\s+UUID\s+PRIMARY KEY/i.test(AASU_MIG_S)) {
  failures.push('actor_asset_service_usages: asset_id virou PK — D-A exige JUNÇÃO N, não 1:1 como sale/rental terms.');
}
if (!/id\s+UUID\s+PRIMARY KEY/i.test(AASU_MIG_S)) failures.push('actor_asset_service_usages: falta PK própria (id) — junção N precisa de identidade própria.');
if (!/asset_id\s+UUID\s+NOT NULL\s+REFERENCES\s+actor_assets/i.test(AASU_MIG_S)) failures.push('actor_asset_service_usages: asset_id não referencia actor_assets — perdeu a identidade única do item.');

// (2) RLS ENABLE+FORCE (tenant-owned, derivada via actor_assets).
if (!/ALTER TABLE actor_asset_service_usages\s+ENABLE ROW LEVEL SECURITY/i.test(allMig) || !/ALTER TABLE actor_asset_service_usages\s+FORCE ROW LEVEL SECURITY/i.test(allMig)) {
  failures.push('actor_asset_service_usages: RLS ENABLE/FORCE ausente (isolamento de tenant enfraquecido).');
}

// (3) D-B/invariantes 8-9: service_concept_id DEVE ter offer_kind='service' — enforcement MATERIAL via FK composta.
if (!/FOREIGN KEY\s*\(\s*service_concept_id\s*,\s*service_offer_kind\s*\)\s*REFERENCES\s+concept_offer_kinds\s*\(\s*concept_id\s*,\s*offer_kind\s*\)/i.test(AASU_MIG_S)) {
  failures.push("D-B: falta FK composta (service_concept_id, service_offer_kind) → concept_offer_kinds(concept_id, offer_kind) — enforcement de offer_kind='service' virou opinião de app, não fato de banco.");
}
if (!/service_offer_kind\s+IN\s*\(\s*'service'\s*\)/i.test(AASU_MIG_S)) failures.push("D-B: CHECK de service_offer_kind ausente/errado (deve fixar 'service').");

// (4) D-F: vocabulário v1 de arranjo operacional — anúncio, sem cobrança/ledger.
const ARR_VALUES = ['daily_fee', 'shift_fee', 'fixed_fee', 'commission', 'revenue_share'];
for (const v of ARR_VALUES) if (!new RegExp(`'${v}'`).test(AASU_MIG_S)) failures.push(`D-F: arrangement_type sem '${v}' no CHECK físico.`);
if (!new RegExp(`OPERATIONAL_ARRANGEMENTS\\s*=\\s*\\[\\s*'daily_fee'`).test(ASSET_TYPES)) failures.push('D-F: OPERATIONAL_ARRANGEMENTS governado ausente/errado em asset.types.ts.');

// (5) D-E: status v1 = active/paused apenas — sem execução/booking/pagamento.
if (!/status\s+IN\s*\(\s*'active'\s*,\s*'paused'\s*\)/i.test(AASU_MIG_S)) failures.push("D-E: CHECK de status ausente/errado (deve ser IN ('active','paused')).");
if (/(completed|executed|fulfilled|paid|settled)/i.test(AASU_MIG_S)) failures.push('D-E: status de execução entrou na v1 — proibido (v1 é declarativa).');
if (!/ASSET_SERVICE_USE_STATUSES\s*=\s*\[\s*'active'\s*,\s*'paused'\s*\]/.test(ASSET_TYPES)) failures.push('D-E: ASSET_SERVICE_USE_STATUSES governado ausente/errado em asset.types.ts.');

// (6) D-A: idempotência por combinação — UNIQUE(asset_id, service_concept_id, operator_actor_id), sem duplicar linha.
if (!/UNIQUE\s*\(\s*asset_id\s*,\s*service_concept_id\s*,\s*operator_actor_id\s*\)/i.test(AASU_MIG_S)) {
  failures.push('D-A: falta UNIQUE(asset_id, service_concept_id, operator_actor_id) — reativar viraria linha duplicada em vez de update.');
}

// (7) activate() ativa o modo 'service_use' e faz upsert da junção; NÃO cria actor_asset novo.
if (!/INSERT\s+INTO\s+actor_asset_modes[\s\S]{0,140}'service_use'/i.test(REPO)) failures.push("repository.activate: não ativa actor_asset_modes.activation_mode='service_use'.");
if (/INSERT\s+INTO\s+actor_assets\b/i.test(REPO)) failures.push('Fatia 4B ativa uso operacional só sobre asset EXISTENTE — repository não pode fazer INSERT em actor_assets (identidade paralela).');
if (!/ON CONFLICT\s*\(\s*asset_id\s*,\s*service_concept_id\s*,\s*operator_actor_id\s*\)/i.test(REPO)) failures.push('repository.activate: falta upsert idempotente (ON CONFLICT asset_id,service_concept_id,operator_actor_id).');

// (8) D-C/D-D: v1 = SOMENTE dono-operador. operatorActorId NUNCA vem do body/client — é derivado do owner do asset.
if (/operatorActorId\s*[:=][^=]*?(req\.body|parsed\.data\.operatorActorId|input\.operatorActorId)/i.test(MODULE_TEXT)) {
  failures.push('D-C/D-D: operatorActorId foi aceito do caller/body — v1 exige dono-operador SEMPRE derivado server-side (terceiro-operador é Fatia 4C, fora).');
}
if (!/operatorActorId\s*=\s*asset\.ownerActorId/.test(SVC)) failures.push('D-C/D-D: service não deriva operatorActorId = asset.ownerActorId (dono-operador obrigatório na v1).');
if (/operatorActorId/.test(ROUTES) && /z\.object[\s\S]*operatorActorId/.test(ROUTES)) failures.push('D-D: rota aceita operatorActorId no schema de entrada — terceiro-operador deve ficar FORA do endpoint vivo até a Fatia 4C.');

// (9) invariantes 10-12: habilitação do operador reusa o MESMO gate de service_offering — sem trilho paralelo.
if (!/evaluateOfferingActivationEligibility/.test(SVC)) failures.push('Invariante 10-12: service não reusa evaluateOfferingActivationEligibility (services-offering-activation-gate) — risco de trilho paralelo de habilitação PF/PJ.');

// (10) D-α equivalente: autoridade = canRepresentActor sobre o owner JÁ REGISTRADO do asset.
if (!/canRepresentActor/.test(SVC)) failures.push('service de uso operacional não prova autoridade por canRepresentActor.');

// (11) escopo proibido nesta fatia: Bank/orders/checkout/payment/split/booking/RFQ/asset:operate/capability_grants.
if (/(bank_|ledger|payout|payment_intent|checkout|split|FROM\s+orders|INSERT\s+INTO\s+orders|actor_capability_grants|asset:operate|booking|RFQ|service_demands)/i.test(MODULE_TEXT)) {
  failures.push('módulo asset-service-use toca Bank/orders/checkout/booking/RFQ/capability_grants — fora do escopo da Fatia 4B (isso é 4C/4D/4E/4F).');
}
for (const forbidden of ['product_offers', 'products', 'inventory_movements', 'actor_asset_sale_terms', 'actor_asset_rental_terms']) {
  if (new RegExp(`(INSERT INTO|UPDATE|FROM|JOIN)\\s+${forbidden}\\b`, 'i').test(MODULE_TEXT)) failures.push(`módulo asset-service-use toca ${forbidden} — fora do escopo (não mistura com sale/rental/produto).`);
}
if (/'sale'|'rental'/.test(REPO.match(/activation_mode/g) ? REPO : '') && /activation_mode\s*=\s*'sale'|activation_mode\s*=\s*'rental'/i.test(REPO)) {
  failures.push('repository de service_use ativa/desativa modo sale ou rental — não pode mexer nos OUTROS modos do asset.');
}

// (12) D-G: read-model dedicado countActiveServiceUses lê o SSOT (actor_assets + modes(service_use) + usages).
const countFn = (ACTORPAGE.match(/countActiveServiceUses[\s\S]*?\n  \}/) || [''])[0];
if (!countFn) failures.push('D-G: actor-page sem read-model dedicado countActiveServiceUses.');
if (/service_offerings/i.test(countFn)) failures.push('D-G: countActiveServiceUses conta em service_offerings — deve ler actor_assets + modes(service_use) + actor_asset_service_usages (não é a SSOT do uso operacional do asset).');
if (countFn && !(/actor_asset_service_usages/.test(countFn) && /'service_use'/.test(countFn))) failures.push('D-G: countActiveServiceUses não lê o SSOT service_use (actor_asset_service_usages + modo service_use).');

if (failures.length > 0) {
  console.error('GATE FAIL [asset-service-use-convergence]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [asset-service-use-convergence] — uso operacional Fatia 4B: junção N em actor_asset_service_usages, modo=service_use, FK composta offer_kind=service, RLS FORCE, status active/paused, v1 dono-operador (sem terceiro/capability_grants), habilitação reusa gate de service_offering, sem Bank/orders/booking/RFQ, read-model dedicado (não service_offerings).');
process.exit(0);
