#!/usr/bin/env node
// Guard — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 1 (2026-07-08). Protege a fundação asset-first:
// item real (actor_assets) só de concept ELEGÍVEL (durável, via FK a concept_asset_eligibilities, nunca
// category); MODOS governados sale/rental/service_use (MODO≠ESTADO: sem internal/maintenance/reserved);
// modos NÃO tocam preço/Bank/booking/agenda/RFQ/service_demands; service_use não é serviço autônomo.
// MORDE (mutation): remover a FK de elegibilidade · pôr internal no vocab · category_id na elegibilidade ·
// coluna de Bank/preço nos modos. Em validate:regression-guards (runner).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };

// (1) Vocab governado: sale/rental/service_use; NÃO internal/maintenance/reserved.
const types = read('src/core/assets/asset.types.ts');
if (!types) failures.push('asset.types.ts ausente.');
else {
  const m = types.match(/ASSET_ACTIVATION_MODES\s*=\s*\[([^\]]+)\]/);
  const vals = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  const expected = ['sale', 'rental', 'service_use'];
  if (JSON.stringify(vals) !== JSON.stringify(expected)) failures.push(`ASSET_ACTIVATION_MODES = [${vals}] ≠ esperado [${expected}].`);
  for (const bad of ['internal', 'maintenance', 'reserved']) {
    if (vals.includes(bad)) failures.push(`ASSET_ACTIVATION_MODES contém '${bad}' — é ESTADO, não modo.`);
  }
}

// (2) Manifest aponta o mesmo símbolo/valores.
const man = read('src/core/governance/governed-vocabularies.manifest.ts');
if (man && !/symbol:\s*'ASSET_ACTIVATION_MODES'/.test(man)) failures.push('manifest sem entrada ASSET_ACTIVATION_MODES.');

// (3) Migration da fundação.
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.includes('asset_multi_offer_foundation'));
if (!migs.length) failures.push('migration asset_multi_offer_foundation ausente.');
else {
  const mig = readFileSync(join(ROOT, 'migrations', migs[0]), 'utf-8');
  // 3a) enforcement de elegibilidade: actor_assets.concept_id REFERENCES concept_asset_eligibilities.
  if (!/concept_id\s+UUID\s+NOT NULL\s+REFERENCES\s+concept_asset_eligibilities\s*\(\s*concept_id\s*\)/.test(mig)) {
    failures.push(`${migs[0]}: actor_assets.concept_id NÃO referencia concept_asset_eligibilities — perde o gate de elegibilidade (concept não-durável entraria).`);
  }
  // 3b) elegibilidade não usa category_id.
  const elBlock = mig.slice(mig.indexOf('concept_asset_eligibilities'), mig.indexOf('actor_assets'));
  if (/category_id/.test(elBlock)) failures.push(`${migs[0]}: concept_asset_eligibilities usa category_id — elegibilidade é por CONCEPT, nunca category.`);
  // 3c) CHECK dos modos compõe do vocab.
  if (!/activation_mode\s+IN\s*\(\s*'sale'\s*,\s*'rental'\s*,\s*'service_use'\s*\)/.test(mig)) {
    failures.push(`${migs[0]}: CHECK de activation_mode ausente/divergente do vocab.`);
  }
  // 3d) modos NÃO tocam economia/execução.
  const modBlock = mig.slice(mig.indexOf('actor_asset_modes'));
  for (const bad of ['price', 'amount', 'bank_', 'booking', 'service_demand', 'rfq', 'agenda', 'schedule', 'payment', 'cents']) {
    if (modBlock.includes(bad)) failures.push(`${migs[0]}: actor_asset_modes toca '${bad}' — modo é só ATIVAÇÃO (sem preço/Bank/booking/agenda/RFQ/demanda).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [asset-foundation]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [asset-foundation] — actor_assets só de concept elegível (FK, não category); modos sale/rental/service_use governados (sem internal/maintenance/reserved); modos sem preço/Bank/booking/agenda/RFQ/demanda.');
process.exit(0);
