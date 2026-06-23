#!/usr/bin/env node
// Guard — F-CATEGORY-CONCEPT-ORPHANS-RECONCILIATION (semântica; pré-money).
//
// CONCEPT é o SSOT semântico (Lei 7 / 18_DOMAIN_ONTOLOGY §5). Categoria = navegação/organização; slug NÃO é
// identidade semântica. No caminho PRODUTO/MARKETPLACE o concept_ref deve vir de canonical_products.concept_id
// (READY), NUNCA de categoria/slug. Os guards existentes (audit-discovery-concept-rekey + audit-service-concept-
// mandatory-fk-restrict) cobrem SERVICES discovery; este fecha o flanco PRODUTO/MARKETPLACE.
//
// 70 categorias órfãs (sem concept_id) são NAVEGAÇÃO legítima (24 raízes N0 = âncoras de domínio; 45 folhas =
// filtro/navegação). Nenhuma é LIVE_BLOCKING — produto/oferta tiram identidade de canonical, não de categoria.
// MORDE se o resolver de concept do marketplace passar a derivar concept_ref de categoria/slug (fallback proibido).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
};
// remove comentários (evita falso-positivo em texto explicativo)
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// Resolver de concept do marketplace/produto.
const ADAPTER = 'src/modules/marketplace/adapters/concept-offer-refs.adapter.ts';
const raw = read(ADAPTER);
if (raw === null) {
  failures.push(`${ADAPTER}: arquivo ausente (resolver de concept do marketplace).`);
} else {
  const s = strip(raw);
  // (1) a fonte canônica precisa existir: concept_ref deriva de concept_id (canonical_products).
  if (!/concept_ref/.test(s) || !/concept_id/.test(s)) {
    failures.push(`${ADAPTER}: concept_ref deve derivar de canonical_products.concept_id (fonte canônica ausente).`);
  }
  // (2) PROIBIDO derivar concept_ref de categoria/slug (fallback semântico).
  const violations = [
    [/concept_ref\s*[:=][^;\n]*\bcategor/i, 'concept_ref derivado de categoria'],
    [/concept_ref\s*[:=][^;\n]*\bslug\b/i, 'concept_ref derivado de slug'],
    [/COALESCE\([^)]*concept[^)]*categor/i, 'COALESCE concept←categoria'],
    [/COALESCE\([^)]*categor[^)]*concept/i, 'COALESCE categoria→concept'],
    [/\bslug\b[^;\n]*concept_ref/i, 'slug usado p/ concept_ref'],
    [/categor\w*\.concept_id\s*[^;\n]*concept_ref/i, 'category.concept_id → concept_ref'],
  ];
  for (const [re, desc] of violations) {
    if (re.test(s)) {
      failures.push(`${ADAPTER}: FALLBACK semântico proibido — ${desc}. concept_ref vem SÓ de canonical_products.concept_id (categoria/slug = navegação, não identidade). Lei 7.`);
    }
  }
}

// product-visibility: categoria deve ser FILTRO/navegação opcional, não gate de identidade semântica.
const VIS = 'src/modules/marketplace/product-visibility.service.ts';
const vraw = read(VIS);
if (vraw) {
  const v = strip(vraw);
  if (/CATEGORY_REQUIRES|category[^;\n]*concept_ref|concept_ref[^;\n]*categor/i.test(v)) {
    failures.push(`${VIS}: categoria não pode virar gate de identidade/concept no produto (deve ser filtro/navegação opcional).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [marketplace-concept-no-category-fallback]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [marketplace-concept-no-category-fallback] — concept_ref de produto/marketplace vem só de canonical_products.concept_id; categoria/slug = navegação (nunca identidade semântica). 70 órfãs = nav legítima. Lei 7 / DECISION-0142 (services) + flanco produto fechado.');
