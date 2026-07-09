#!/usr/bin/env node
// Guard — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 (VENDA asset-first, adendo RFC_ASSET_SALE_TERMS_ADENDO).
// Blinda o desenho ratificado: item durável individual = actor_assets; ativação = modo 'sale'; termos =
// actor_asset_sale_terms (anúncio). NÃO products/product_offers como SSOT de item; NÃO Bank; PF e PJ via
// canRepresentActor (sem PRODUCT_PUBLISH_PJ_ONLY); status v1 = active/paused (sem 'sold'). MORDE por mutação.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const strip = (s) => (s || '').replace(/--[^\n]*/g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'));
const migText = (needle) => { const f = migs.find((m) => m.includes(needle)); return f ? readFileSync(join(ROOT, 'migrations', f), 'utf-8') : ''; };
const allMig = migs.map((m) => readFileSync(join(ROOT, 'migrations', m), 'utf-8')).join('\n');

const SALE_MIG = migText('asset_sale_terms');
const SALE_MIG_S = strip(SALE_MIG);
const ASSET_TYPES = strip(read('src/core/assets/asset.types.ts') || '');
const REPO = strip(read('src/modules/asset-sale/asset-sale.repository.ts') || '');
const SVC = strip(read('src/modules/asset-sale/asset-sale.service.ts') || '');
const ROUTES = strip(read('src/modules/asset-sale/asset-sale.routes.ts') || '');
const ACTORPAGE = strip(read('src/modules/actor-page/actor-page.repository.ts') || '');
const MODULE_TEXT = REPO + '\n' + SVC + '\n' + ROUTES;

// (1) sale_terms 1:1 com asset (PK=asset_id FK actor_assets).
if (!/actor_asset_sale_terms\s*\(\s*asset_id\s+UUID\s+PRIMARY KEY\s+REFERENCES\s+actor_assets/i.test(SALE_MIG_S)) {
  failures.push('actor_asset_sale_terms: asset_id não é PK/FK obrigatória de actor_assets (perdeu o 1:1 / identidade).');
}
// (2) RLS ENABLE+FORCE (tenant-owned).
if (!/ALTER TABLE actor_asset_sale_terms\s+ENABLE ROW LEVEL SECURITY/i.test(allMig) || !/ALTER TABLE actor_asset_sale_terms\s+FORCE ROW LEVEL SECURITY/i.test(allMig)) {
  failures.push('actor_asset_sale_terms: RLS ENABLE/FORCE ausente (isolamento de tenant enfraquecido).');
}
// (3) D-ε status v1 = active/paused; SEM sold/completed/paid/transferred.
if (!/status\s+IN\s*\(\s*'active'\s*,\s*'paused'\s*\)/i.test(SALE_MIG_S)) failures.push("D-ε: CHECK de status ausente/errado (deve ser IN ('active','paused')).");
if (/(sold|completed|paid|transferred)/i.test(SALE_MIG_S)) failures.push('D-ε: status de execução (sold/completed/paid/transferred) entrou na v1 — proibido (execução/transferência = frente própria).');
if (!/ASSET_SALE_STATUSES\s*=\s*\[\s*'active'\s*,\s*'paused'\s*\]/.test(ASSET_TYPES)) failures.push('D-ε: ASSET_SALE_STATUSES governado ausente/errado em asset.types.ts.');
// (4) D1: condition NÃO vive nos termos de venda (é do item).
if (/CREATE TABLE[^;]*actor_asset_sale_terms[\s\S]*?\bcondition\b[\s\S]*?\)/i.test(SALE_MIG_S)) failures.push('D1: actor_asset_sale_terms ganhou coluna condition — condição é do ITEM (actor_assets), não da oferta.');
// (5) D-δ: price = anúncio (nunca negativo); sale_terms sem bank/ledger/payment.
if (!/price_cents\s+IS NULL\s+OR\s+price_cents\s*>=\s*0/i.test(SALE_MIG_S)) failures.push('D-δ: falta CHECK price_cents >= 0 (anúncio não-negativo).');
if (/(bank_|ledger|payout|payment_intent|checkout|split)/i.test(SALE_MIG_S)) failures.push('D-γ/δ: migration de venda tocou vocabulário financeiro/execução — proibido (Δbank=0).');
// (6) create ativa modo 'sale' e grava termos; modo NÃO carrega preço.
if (!/INSERT\s+INTO\s+actor_asset_modes[\s\S]{0,120}'sale'/i.test(REPO)) failures.push('repository.create: não ativa actor_asset_modes.activation_mode=sale.');
if (!/INSERT\s+INTO\s+actor_asset_sale_terms/i.test(REPO)) failures.push('repository.create: não grava actor_asset_sale_terms.');
const modesInsert = (REPO.match(/INSERT INTO actor_asset_modes[\s\S]*?\)/) || [''])[0];
if (/price/i.test(modesInsert)) failures.push('modo sale carrega preço — proibido (preço é termo, não modo).');
const assetInsert = (REPO.match(/INSERT INTO actor_assets[\s\S]*?\)\s*RETURNING id/) || [''])[0];
if (/price/i.test(assetInsert)) failures.push('actor_assets recebe preço de venda no create — proibido (preço é termo, não item).');
// (7) NÃO reaproveita products/product_offers/inventory como fluxo vivo de venda-asset.
for (const forbidden of ['product_offers', 'products', 'inventory_movements', 'inventory_balances', 'canonical_products', 'product_variants']) {
  if (new RegExp(`(INSERT INTO|UPDATE|FROM|JOIN)\\s+${forbidden}\\b`, 'i').test(MODULE_TEXT)) failures.push(`módulo asset-sale toca ${forbidden} — venda asset-first NÃO usa o trilho de produto/estoque.`);
}
// (8) Δbank=0 / execução fora: módulo sem Bank/orders/checkout/payment_intents/split.
if (/(bank_|ledger|payout|payment_intent|checkout|split|FROM\s+orders|INSERT\s+INTO\s+orders)/i.test(MODULE_TEXT)) failures.push('módulo asset-sale toca Bank/orders/checkout/payment_intents/split — proibido nesta fatia (execução = frente própria).');
// (9) D-α: autoridade = canRepresentActor sobre owner; SEM PRODUCT_PUBLISH_PJ_ONLY; SEM merchant_id.
if (!/canRepresentActor/.test(SVC)) failures.push('D-α: service de venda não prova autoridade por canRepresentActor.');
if (/PRODUCT_PUBLISH_PJ_ONLY/.test(MODULE_TEXT)) failures.push('D-α: venda asset-first herdou PRODUCT_PUBLISH_PJ_ONLY — item individual permite PF (não é produto/estoque PJ).');
if (/merchant_id/.test(MODULE_TEXT)) failures.push('D-α: venda asset-first usa merchant_id como autoridade — deve ser owner_actor_id via canRepresentActor.');
// (10) gate de durabilidade = concept_asset_eligibilities; category NÃO decide.
if (!/conceptIsAssetEligible/.test(SVC) || !/concept_asset_eligibilities/.test(REPO)) failures.push('gate de durabilidade (concept_asset_eligibilities) ausente no fluxo de venda.');
if (/category_id/i.test(MODULE_TEXT)) failures.push('venda asset-first usa category_id — categoria NÃO decide elegibilidade/vendável.');
// (11) D-β: read-model dedicado lê o SSOT asset (não product_offers).
const countSaleFn = (ACTORPAGE.match(/countActiveAssetSales[\s\S]*?\n  \}/) || [''])[0];
if (!countSaleFn) failures.push('D-β: actor-page sem read-model dedicado countActiveAssetSales.');
if (/product_offers/i.test(countSaleFn)) failures.push('D-β: countActiveAssetSales conta em product_offers — deve ler actor_assets + modes(sale) + actor_asset_sale_terms.');
if (countSaleFn && !(/actor_asset_sale_terms/.test(countSaleFn) && /'sale'/.test(countSaleFn))) failures.push('D-β: countActiveAssetSales não lê o SSOT asset-sale (actor_asset_sale_terms + modo sale).');
// (12) fora de escopo: venda NÃO toca rides/service_use/RFQ/service_demands.
for (const forbidden of ['rides_vehicles', 'service_offerings', 'actor_professional_concepts', 'service_demands', 'event_rfq']) {
  if (new RegExp(`(INSERT INTO|UPDATE|FROM|JOIN)\\s+${forbidden}\\b`, 'i').test(MODULE_TEXT)) failures.push(`módulo asset-sale toca ${forbidden} — fora do escopo da Fatia 3.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [asset-sale-convergence]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [asset-sale-convergence] — venda asset-first: identidade=actor_assets, modo=sale, termos=actor_asset_sale_terms (anúncio), RLS FORCE, status active/paused (sem sold), condição no item, PF+PJ via canRepresentActor (sem PJ-only), gate concept_asset_eligibilities (sem category), read-model dedicado (não product_offers), sem Bank/orders/checkout, sem tocar produto/estoque/rides/serviço.');
process.exit(0);
