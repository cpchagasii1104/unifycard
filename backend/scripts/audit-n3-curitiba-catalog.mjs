#!/usr/bin/env node
// Guard — N3 · CATÁLOGO CANÔNICO DE BAIRROS DE CURITIBA (manifest + loader one-shot).
// Pergunta própria: "o manifest declara EXATAMENTE 75 bairros de Curitiba (city/tenant/actor fixos ratificados,
// source_kind government_official, nomes únicos sem whitespace de borda) e o loader os cria SÓ pelo writer canônico
// N2-E (fn_create_canonical_neighborhood, nome PARAMETRIZADO, sem INSERT direto), numa transação com advisory lock,
// estado-inicial-zero, dry-run default, apply gated por token, ROLLBACK no dry-run — sem ON CONFLICT/DELETE,
// sem alias/succession/mutação de address, sem rota/Bank/Social?"
// Comment-aware (strip JS) e liveness. Estado vivo = introspecção. Parse fail = FAIL.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

function stripJsComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    if (c === '\\') { out += c + (d || ''); i += 2; continue; }
    if (mode === 'sq' && c === "'") mode = 'code';
    else if (mode === 'dq' && c === '"') mode = 'code';
    else if (mode === 'tpl' && c === '`') mode = 'code';
    out += c; i++;
  }
  return out;
}

const CITY = '9d431002-1fd3-4b34-ae82-678f28f64288';
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const MANIFEST = join(ROOT, 'scripts', 'curitiba-neighborhoods-manifest.json');
const LOADER = join(ROOT, 'scripts', 'n3-load-curitiba-neighborhoods.mjs');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');

// ── A. MANIFEST ──
if (!existsSync(MANIFEST)) {
  note('A0: manifest curitiba-neighborhoods-manifest.json ausente');
} else {
  let M;
  try { M = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch (e) { note('A1: manifest não é JSON válido: ' + e.message); }
  if (M) {
    const meta = M.meta || {}, items = M.items || [];
    if (meta.city_id !== CITY) note('A2: manifest.city_id não é Curitiba');
    if (meta.grantee_actor_id !== ACTOR) note('A3: manifest.grantee_actor_id não é o Actor ratificado');
    if (meta.source_kind !== 'government_official') note("A4: manifest.source_kind não é 'government_official'");
    if (meta.expected_count !== 75) note('A5: manifest.expected_count != 75');
    if (items.length !== 75) note(`A6: manifest tem ${items.length} itens (esperado 75)`);
    const names = items.map((i) => i && i.name);
    if (!names.every((n) => typeof n === 'string' && n.length > 0 && n === n.trim())) note('A7: nome vazio ou com whitespace de borda');
    if (new Set(names).size !== names.length) note('A8: nome duplicado exato no manifest');
    const ords = items.map((i) => i && i.ordinal);
    if (new Set(ords).size !== 75 || Math.min(...ords) !== 1 || Math.max(...ords) !== 75) note('A9: ordinais não são 1..75 únicos');
    if (!meta.source_reference || !/IPPUC/i.test(meta.source_reference)) note('A10: source_reference sem referência oficial (IPPUC)');
    // manifest NÃO pode conter neighborhood_id/tenant financeiro/CEP/lat-lng/alias
    const raw = readFileSync(MANIFEST, 'utf8');
    if (/"neighborhood_id"|"cep"|"lat"|"lng"|"alias"|"bank"|"category_id"|"concept_id"/i.test(raw)) note('A11: manifest contém campo proibido (neighborhood_id/cep/lat/lng/alias/bank/category/concept)');
  }
}

// ── B. LOADER ──
if (!existsSync(LOADER)) {
  note('B0: loader n3-load-curitiba-neighborhoods.mjs ausente');
} else {
  const raw = readFileSync(LOADER, 'utf8');
  const s = stripJsComments(raw);
  // writer canônico como ÚNICO criador; nome parametrizado ($5), NÃO inline
  if (!/fn_create_canonical_neighborhood\(\$1,\$2,\$3,\$4,\$5/.test(s)) note('B1: loader não cria via writer canônico com nome PARAMETRIZADO ($5)');
  if (/INSERT\s+INTO\s+(public\.)?neighborhoods\b/i.test(s)) note('B2: loader faz INSERT direto em neighborhoods (proibido — só via writer)');
  if (/DISABLE\s+TRIGGER|session_replication_role|set_config/i.test(s)) note('B3: loader desabilita trigger / usa session_replication_role (proibido)');
  // advisory lock + estado-zero + apply gated + rollback + refuse app
  if (!/pg_advisory_xact_lock/.test(s)) note('B4: loader sem advisory lock');
  if (!/neighborhoods'\)\)\.rows\[0\]\.n|n0\s*!==\s*0|NÃO-ZERO/.test(s)) note('B5: loader não exige estado inicial neighborhoods=0');
  if (!/N3-LOAD-CURITIBA/.test(s) || !/--apply/.test(s)) note('B6: loader sem apply gated por token de confirmação');
  if (!/if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)[\s\S]{0,120}?COMMIT/.test(s)) note('B7: COMMIT não dominado por (APPLY && CONFIRMED && !failed)');
  const elseM = s.match(/\}\s*else\s*\{([\s\S]*)$/);
  if (!elseM || (elseM[1].split(/\bcatch\s*\(/)[0] || '').search(/ROLLBACK/) < 0) note('B8: ROLLBACK ausente no ramo dry-run/else (antes do catch)');
  if (/ON CONFLICT|UPSERT/i.test(s)) note('B9: loader usa ON CONFLICT/UPSERT (proibido)');
  if (/DELETE\s+FROM/i.test(s)) note('B10: loader usa DELETE (proibido)');
  if (!/unificard_app/.test(s) || !/current_user/.test(s)) note('B11: loader não recusa execução como unificard_app');
  // sem tocar alias/succession/address/Bank/Social/rota
  if (/INSERT\s+INTO\s+(public\.)?(neighborhood_aliases|neighborhood_succession)/i.test(s)) note('B12: loader cria alias/succession (fora da N3)');
  if (/UPDATE\s+(public\.)?addresses|INSERT\s+INTO\s+(public\.)?addresses/i.test(s)) note('B13: loader muta addresses (proibido)');
  if (/\bbank_\w+|regional_fund|treasury|bank_split|ledger|social_\w+/i.test(s)) note('B14: loader referencia Bank/Social (proibido)');
  if (/\.(get|post|put|delete)\(|router|route/i.test(s)) note('B15: loader expõe rota (proibido)');
  // conta exata 75 exigida nas assertions
  if (!/===\s*75|=== meta\.expected_count|tot === 75/.test(s)) note('B16: loader não exige exatamente 75');
}

// ── C. WIRING ──
if (existsSync(RUNNER) && !/audit-n3-curitiba-catalog\.mjs/.test(readFileSync(RUNNER, 'utf8'))) note('C1: guard fora do runner');

if (failures.length) {
  console.error('GATE FAIL [n3-curitiba-catalog]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [n3-curitiba-catalog] — manifest declara 75 bairros de Curitiba (city/tenant/actor ratificados, source_kind government_official, nomes únicos sem whitespace, ordinais 1..75, referência IPPUC, sem campos proibidos); loader cria SÓ via writer canônico N2-E (nome parametrizado, sem INSERT direto/disable-trigger), com advisory lock, estado-inicial-zero, dry-run default, apply gated por token, COMMIT dominado por (APPLY&&CONFIRMED&&!failed), ROLLBACK vivo no dry-run; sem ON CONFLICT/DELETE, sem alias/succession/mutação de address, sem rota/Bank/Social; exige exatamente 75. (Comment-aware + liveness.)');
