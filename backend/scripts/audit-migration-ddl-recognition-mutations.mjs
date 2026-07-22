#!/usr/bin/env node
// HARNESS de mutações — F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION.
//
// NÃO é um guard; NÃO entra no runner (run-regression-guards.mjs); NÃO ocupa posição no agregador.
// Papel: ONE_SHOT_HARNESS / NOT_CI_REQUIRED (declarado em guard-coverage-declarations.json).
//
// Prova que o reconhecimento estrutural de DDL/DML (via backend/scripts/lib/sql-shape.mjs), na
// composição EXATA usada pelos guards endurecidos, MORDE cada evasão fechada e NÃO reprova as
// formas legítimas (anti-over-broadening). Usa SOMENTE diretório/arquivos temporários; restaura/limpa
// em finally; falha se deixar resíduo. Determinístico: exit 0 só quando TODAS as mutações se comportam
// como esperado.
//
// 1ª TRANCHE (guards 1-3, selados): event-reservations-mislabeled-fk-containment, event-settlement-
// ghost-containment, fiscal-canonical-house.
// 2ª TRANCHE 2A (guards 4-6, extensão deste ato): category-input-audit-schema-ghost-fix (FK/colunas
// mortas), location-authority-classification (tabela nova com coluna de localidade-texto),
// vehicle-fields-governed (localização da migration de preço por CONTEÚDO + drift de tipo).

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  stripSqlComments, maskStringLiterals, splitStatements,
  createsTarget, referencesTarget, extractExecuteLiterals, tokenPresent,
} from './lib/sql-shape.mjs';

// ── stripTs igual ao dos guards (comentários fora, strings/templates preservados) ──
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── predicados que ESPELHAM a composição real de cada guard ──
function guard1Bites(raw) {
  if (!/event_reservations/i.test(raw) || !/global_user_id/i.test(raw)) return false;
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  for (const stmt of splitStatements(clean)) {
    const touches = /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?[a-zA-Z_][\w$]*"?\.)?"?event_reservations"?\b/i.test(stmt);
    if (touches && tokenPresent(stmt, 'global_user_id') && referencesTarget(stmt, 'actors', { mode: 'fk' }).hit) return true;
  }
  for (const u of extractExecuteLiterals(raw)) {
    const b = u.resolvableText;
    if (b && tokenPresent(b, 'global_user_id') && referencesTarget(b, 'actors', { mode: 'fk' }).hit) return true;
  }
  return false;
}
function ghostCreateBites(raw, target) {
  if (!tokenPresent(stripSqlComments(raw), target)) return { bite: false, dyn: false };
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  if (createsTarget(clean, target).hit) return { bite: true, dyn: false };
  let dyn = false;
  for (const u of extractExecuteLiterals(raw)) {
    const b = u.resolvableText;
    if (b && createsTarget(b, target).hit) return { bite: true, dyn: false };
    const verb = b && /\bCREATE\s+TABLE|\bRENAME\s+TO|\bSELECT\b[\s\S]*\bINTO\b/i.test(b);
    if (verb && tokenPresent(b, target)) return { bite: true, dyn: false };
    if (verb && u.hasDynamicArg) dyn = true;
  }
  return { bite: false, dyn };
}
function ghostReadBites(tsSrc, target) {
  const src = stripTs(tsSrc);
  if (!tokenPresent(src, target)) return false;
  return referencesTarget(src, target, { mode: 'read' }).hit;
}

// ── predicados que ESPELHAM a composição dos 3 guards ENDURECIDOS na 2ª TRANCHE (2A) ──
function touchesTableGeneric(stmt, name) {
  const t = `(?:"?[A-Za-z_][\\w$]*"?\\s*\\.\\s*)?"?${name}"?`;
  return new RegExp(`\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?${t}\\b`, 'i').test(stmt);
}
function touchesTargetDDL(stmt, target) {
  return createsTarget(stmt, target).hit || touchesTableGeneric(stmt, target);
}
function columnDefinedReal(text, col) {
  return new RegExp(`(?<![\\w$])"?${col}"?\\s+(?:UUID|VARCHAR|CHARACTER\\s+VARYING|NUMERIC|DECIMAL|TEXT|INTEGER|BIGINT|BOOLEAN)\\b`, 'i').test(text);
}

// GUARD 4 — audit-category-input-audit-schema-ghost-fix.mjs (FK fantasma + colunas mortas)
function guard4Bites(raw) {
  const TARGET = 'category_input_audit', GHOST_FK = 'occupations_reference';
  const DEAD_COLS = ['canonical_id', 'cbo_match_code', 'embedding_similarity'];
  if (!tokenPresent(stripSqlComments(raw), TARGET)) return false;
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  for (const stmt of splitStatements(clean)) {
    if (!touchesTargetDDL(stmt, TARGET)) continue;
    if (referencesTarget(stmt, GHOST_FK, { mode: 'fk' }).hit) return true;
    for (const col of DEAD_COLS) { if (columnDefinedReal(stmt, col)) return true; }
  }
  for (const u of extractExecuteLiterals(raw)) {
    const body = u.resolvableText;
    if (!body || !tokenPresent(body, TARGET)) continue;
    for (const bstmt of splitStatements(body)) {
      if (!touchesTargetDDL(bstmt, TARGET)) continue;
      if (referencesTarget(bstmt, GHOST_FK, { mode: 'fk' }).hit) return true;
      for (const col of DEAD_COLS) { if (columnDefinedReal(bstmt, col)) return true; }
    }
  }
  return false;
}

// GUARD 5 — audit-location-authority-classification.mjs (tabela nova com coluna de localidade-texto)
function guard5Bites(raw, allowKeys) {
  const colAlt = ['city', 'country', 'city_name', 'state_name', 'country_name', 'location_text', 'address_text'].join('|');
  const colDefRe = new RegExp(
    `(?:(^|[,(])\\s*["']?(${colAlt})["']?\\s+(?:text|varchar|character varying|citext)\\b)` +
    `|(?:\\bADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?(${colAlt})["']?\\s+(?:text|varchar|character varying|citext)\\b)`,
    'i'
  );
  function stmtBites(stmt) {
    const isCreate = /\bCREATE\s+TABLE\b/i.test(stmt);
    const isAlterAdd = /\bALTER\s+TABLE\b/i.test(stmt) && /\bADD\s+COLUMN\b/i.test(stmt);
    if (!isCreate && !isAlterAdd) return false;
    for (const key of allowKeys) { if (createsTarget(stmt, key).hit || touchesTableGeneric(stmt, key)) return false; }
    return colDefRe.test(stmt);
  }
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  for (const stmt of splitStatements(clean)) { if (stmtBites(stmt)) return true; }
  for (const u of extractExecuteLiterals(raw)) {
    const body = u.resolvableText; if (!body) continue;
    for (const bstmt of splitStatements(body)) { if (stmtBites(bstmt)) return true; }
  }
  return false;
}

// GUARD 6 — audit-vehicle-fields-governed.mjs (localização por CONTEÚDO + drift de tipo em price_cents)
function pricingDriftBites(files, targetTable) {
  let creatorFile = null, creatorSql = '';
  for (const f of files) {
    const clean = maskStringLiterals(stripSqlComments(f.content), { maskDollarQuotes: false });
    if (createsTarget(clean, targetTable).hit) { creatorFile = f.name; creatorSql = f.content; break; }
  }
  if (!creatorFile) return { located: false, bigintOk: false, drift: false };
  const bigintOk = /price_cents\s+BIGINT/i.test(creatorSql) && !/price[_a-z]*\s+(NUMERIC|DECIMAL|FLOAT|REAL|DOUBLE)/i.test(creatorSql);
  let drift = false;
  for (const f of files) {
    if (f.name === creatorFile) continue;
    if (!tokenPresent(stripSqlComments(f.content), targetTable)) continue;
    const clean = maskStringLiterals(stripSqlComments(f.content), { maskDollarQuotes: false });
    for (const stmt of splitStatements(clean)) {
      if (!touchesTableGeneric(stmt, targetTable)) continue;
      if (/\bALTER\s+COLUMN\s+"?price_cents"?\s+TYPE\s+(?!BIGINT\b)/i.test(stmt)) { drift = true; break; }
    }
    if (drift) break;
  }
  return { located: true, creatorFile, bigintOk, drift };
}

// ── cenários (temp file + predicado + esperado) ──
const TMP = mkdtempSync(join(tmpdir(), 'ddl-recog-'));
let created = 0;
const writeTmp = (name, content) => { const p = join(TMP, name); writeFileSync(p, content); created++; return p; };
const readTmp = (p) => readFileSync(p, 'utf-8');

const results = [];
const scen = (id, expected, actual) => results.push({ id, expected, actual, ok: expected === actual });

// GUARD 1 — event_reservations.global_user_id -> actors (7)
{
  const T = (name, sql) => { const p = writeTmp(name, sql); return guard1Bites(readTmp(p)); };
  scen('g1-m1 ADD CONSTRAINT separado', true, T('g1m1.sql',
    'ALTER TABLE event_reservations ADD CONSTRAINT fk_er FOREIGN KEY (global_user_id) REFERENCES actors(id);'));
  scen('g1-m2 REFERENCES public.actors', true, T('g1m2.sql',
    'ALTER TABLE event_reservations ADD COLUMN global_user_id UUID REFERENCES public.actors(id);'));
  scen('g1-m3 quoted "actors"', true, T('g1m3.sql',
    'ALTER TABLE ONLY event_reservations ADD COLUMN global_user_id UUID REFERENCES "actors"("id");'));
  scen('g1-m4 dois statements', true, T('g1m4.sql',
    'ALTER TABLE event_reservations ADD COLUMN global_user_id UUID;\nALTER TABLE event_reservations ADD CONSTRAINT fk FOREIGN KEY (global_user_id) REFERENCES actors(id);'));
  scen('g1-m5 (LEGIT) actor_id -> actors', false, T('g1m5.sql',
    'ALTER TABLE event_reservations ADD COLUMN actor_id UUID NOT NULL REFERENCES actors(id);'));
  scen('g1-m6 (LEGIT) global_user_id -> global_users', false, T('g1m6.sql',
    'ALTER TABLE event_reservations ADD COLUMN global_user_id UUID REFERENCES global_users(global_user_id);'));
  scen('g1-m7 (OUT_OF_SCOPE) actor_ref_id -> actors', false, T('g1m7.sql',
    'ALTER TABLE event_reservations ADD COLUMN actor_ref_id UUID REFERENCES actors(id);'));
}

// GUARD 2 — event_settlements (9)
{
  const T = (name, sql) => { const p = writeTmp(name, sql); return ghostCreateBites(readTmp(p), 'event_settlements'); };
  scen('g2-m1 CREATE TABLE public.event_settlements', true, T('g2m1.sql', 'CREATE TABLE public.event_settlements (id uuid);').bite);
  scen('g2-m2 SELECT INTO', true, T('g2m2.sql', 'SELECT a, b INTO event_settlements FROM src;').bite);
  scen('g2-m3 CTAS', true, T('g2m3.sql', 'CREATE TABLE event_settlements AS SELECT 1;').bite);
  scen('g2-m4 EXECUTE literal', true, T('g2m4.sql', "DO $$ BEGIN EXECUTE 'CREATE TABLE event_settlements (id uuid)'; END $$;").bite);
  scen('g2-m5 format target literal', true, T('g2m5.sql', "DO $$ BEGIN EXECUTE format('CREATE TABLE %I (id uuid)', 'event_settlements'); END $$;").bite);
  scen('g2-m6 RENAME TO', true, T('g2m6.sql', 'ALTER TABLE old_settle RENAME TO event_settlements;').bite);
  // DYNAMIC_UNRESOLVED: alvo aparece no arquivo (DROP), mas o CREATE é por nome de tabela em variável.
  const dyn = T('g2m7.sql', "DROP TABLE IF EXISTS event_settlements;\nDO $$ BEGIN EXECUTE format('CREATE TABLE %I (id uuid)', v_name); END $$;");
  scen('g2-m7 (LEGIT) dynamic unresolved sem bite', false, dyn.bite);
  scen('g2-m7b diagnostico dynamic marcado', true, dyn.dyn);
  scen('g2-m8 (LEGIT) nome parecido event_settlement_audit', false, T('g2m8.sql', 'CREATE TABLE event_settlement_audit (id uuid);').bite);
  scen('g2-m9 (LEGIT) comentario', false, T('g2m9.sql', '-- CREATE TABLE event_settlements was a ghost\nSELECT 1;').bite);
}

// GUARD 3 — company_profiles / tax_profiles (11)
{
  const C = (name, sql, g) => { const p = writeTmp(name, sql); return ghostCreateBites(readTmp(p), g).bite; };
  const R = (name, ts, g) => { const p = writeTmp(name, ts); return ghostReadBites(readTmp(p), g); };
  scen('g3-m1 CREATE schema-qualified', true, C('g3m1.sql', 'CREATE TABLE public.company_profiles (id uuid);', 'company_profiles'));
  scen('g3-m2 SELECT INTO tax_profiles', true, C('g3m2.sql', 'SELECT id INTO tax_profiles FROM x;', 'tax_profiles'));
  scen('g3-m3 JOIN company_profiles (read)', true, R('g3m3.ts', 'const q = `SELECT * FROM x JOIN company_profiles cp ON cp.id = x.cid`;', 'company_profiles'));
  scen('g3-m4 comma-join (read)', true, R('g3m4.ts', 'const q = `SELECT * FROM x, company_profiles WHERE 1=1`;', 'company_profiles'));
  scen('g3-m5 quoted+qualified (read)', true, R('g3m5.ts', 'const q = `SELECT * FROM "public"."company_profiles"`;', 'company_profiles'));
  scen('g3-m6 CTE (read)', true, R('g3m6.ts', 'const q = `WITH cp AS (SELECT id FROM tax_profiles) SELECT * FROM cp`;', 'tax_profiles'));
  scen('g3-m7 EXECUTE literal create', true, C('g3m7.sql', "DO $$ BEGIN EXECUTE 'CREATE TABLE company_profiles (id uuid)'; END $$;", 'company_profiles'));
  scen('g3-m8 (LEGIT) comentario', false, C('g3m8.sql', '-- company_profiles aposentada; nao materializar\nSELECT 1;', 'company_profiles'));
  scen('g3-m9 (LEGIT) string documental', false, R('g3m9.ts', "const doc = 'company_profiles foi removida da arvore viva';", 'company_profiles'));
  scen('g3-m10 (LEGIT) migration de DROP', false, C('g3m10.sql', 'DROP TABLE IF EXISTS company_profiles;', 'company_profiles'));
  scen('g3-m11 (LEGIT) casa canonica actor_fiscal_profiles', false, R('g3m11.ts', 'const q = `SELECT * FROM actor_fiscal_profiles WHERE tenant_id = $1`;', 'company_profiles'));
}

// LÉXICOS do helper (9)
{
  scen('lex-1 -- dentro de string preservado', true,
    stripSqlComments("SELECT 'a -- nao-comentario b' FROM t").includes('-- nao-comentario'));
  scen('lex-2 /* */ dentro de string preservado', true,
    stripSqlComments("SELECT 'a /* nao */ b' FROM t").includes('/* nao */'));
  scen('lex-3 semicolon dentro de string nao quebra', true,
    splitStatements("SELECT 'a;b;c'; SELECT 2").length === 2);
  scen('lex-4 dollar-quote com tag e ; interno', true,
    splitStatements('DO $tag$ BEGIN PERFORM 1; PERFORM 2; END $tag$; SELECT 9').length === 2);
  scen('lex-5 escaped quote em string', true,
    maskStringLiterals("SELECT 'it''s ok'") === "SELECT ''");
  scen('lex-6 quoted identifier preservado (nao vira string)', true,
    (() => { const g = ghostCreateBites('CREATE TABLE "foo_x" (id uuid);', 'foo_x'); return g.bite === true; })());
  scen('lex-7 comentario contendo target nao morde', true,
    ghostCreateBites('-- CREATE TABLE foo_x (x int)\nSELECT 1;', 'foo_x').bite === false);
  scen('lex-8 EXECUTE contendo target resolvivel morde', true,
    ghostCreateBites("DO $$ BEGIN EXECUTE 'CREATE TABLE foo_x (x int)'; END $$;", 'foo_x').bite === true);
  scen('lex-9 target em string documental (SQL) nao morde', true,
    ghostCreateBites("SELECT 'CREATE TABLE foo_x doc' AS note;", 'foo_x').bite === false);
}

// GUARD 4 — category_input_audit / occupations_reference + campos mortos (10)
{
  const T = (name, sql) => { const p = writeTmp(name, sql); return guard4Bites(readTmp(p)); };
  scen('g4-m1 ADD COLUMN + REFERENCES occupations_reference', true, T('g4m1.sql',
    'ALTER TABLE category_input_audit ADD COLUMN canonical_id UUID REFERENCES occupations_reference(id);'));
  scen('g4-m2 lowercase references', true, T('g4m2.sql',
    'ALTER TABLE category_input_audit ADD COLUMN canonical_id UUID references occupations_reference(id);'));
  scen('g4-m3 schema-qualified public.occupations_reference', true, T('g4m3.sql',
    'ALTER TABLE category_input_audit ADD COLUMN canonical_id UUID REFERENCES public.occupations_reference(id);'));
  scen('g4-m4 quoted "occupations_reference" + ALTER TABLE ONLY', true, T('g4m4.sql',
    'ALTER TABLE ONLY category_input_audit ADD COLUMN canonical_id UUID REFERENCES "occupations_reference"("id");'));
  scen('g4-m5 coluna morta sem FK (cbo_match_code)', true, T('g4m5.sql',
    'ALTER TABLE category_input_audit ADD COLUMN cbo_match_code VARCHAR(50);'));
  scen('g4-m6 EXECUTE literal reintroduz FK', true, T('g4m6.sql',
    "DO $$ BEGIN EXECUTE 'ALTER TABLE category_input_audit ADD COLUMN canonical_id UUID REFERENCES occupations_reference(id)'; END $$;"));
  scen('g4-m7 (LEGIT) coluna com nome parecido, nao-alvo', false, T('g4m7.sql',
    'ALTER TABLE category_input_audit ADD COLUMN canonical_reference_note TEXT;'));
  scen('g4-m8 (LEGIT) comentario mencionando o achado', false, T('g4m8.sql',
    '-- category_input_audit nao deve referenciar occupations_reference (Opcao A)\nSELECT 1;'));
  scen('g4-m9 (LEGIT) tabela com nome parecido por substring', false, T('g4m9.sql',
    'ALTER TABLE category_input_audit_log ADD COLUMN canonical_id UUID REFERENCES occupations_reference(id);'));
  scen('g4-m10 (LEGIT) outra tabela referencia category_input_audit + tem coluna canonical_id propria', false, T('g4m10.sql',
    'CREATE TABLE some_other_log (id uuid, ref_id uuid REFERENCES category_input_audit(id), canonical_id UUID);'));
}

// GUARD 5 — location-authority-classification: tabela nova com coluna de localidade-texto (9)
{
  const ALLOW = ['cep_resolution_cache', 'rides_cities', 'economic_policies', 'access_pass_products', 'regional_activation_events', 'regional_activation_rules', 'regional_funds', 'regional_impact_snapshots', 'suppliers'];
  const T = (name, sql) => { const p = writeTmp(name, sql); return guard5Bites(readTmp(p), ALLOW); };
  scen('g5-m1 CREATE TABLE schema-qualificada com city text', true, T('g5m1.sql',
    'CREATE TABLE public.evil_new_table (id uuid, city text);'));
  scen('g5-m2 ALTER TABLE ONLY novo com ADD COLUMN city_name text', true, T('g5m2.sql',
    'ALTER TABLE ONLY novo_leak ADD COLUMN city_name text;'));
  scen('g5-m3 EXECUTE literal cria tabela com city text', true, T('g5m3.sql',
    "DO $$ BEGIN EXECUTE 'CREATE TABLE leaky_new (id uuid, city text)'; END $$;"));
  scen('g5-m4 tipo citext', true, T('g5m4.sql',
    'CREATE TABLE another_new (id uuid, city citext);'));
  scen('g5-m5 (LEGIT) comentario mencionando CREATE TABLE ... city text', false, T('g5m5.sql',
    '-- CREATE TABLE staging_x (id uuid, city text);\nSELECT 1;'));
  scen('g5-m6 (LEGIT) tabela ja carimbada (regional_funds) com city text', false, T('g5m6.sql',
    'CREATE TABLE regional_funds (id uuid, city text);'));
  scen('g5-m7 (LEGIT) coluna canonica city_id, sem coluna textual', false, T('g5m7.sql',
    'CREATE TABLE new_table_ok (id uuid, city_id uuid REFERENCES cities(id));'));
  scen('g5-m8 (LEGIT) coluna fora do vocabulario LOC_COLS', false, T('g5m8.sql',
    'CREATE TABLE another_ok (id uuid, status text);'));
  scen('g5-m9 (LEGIT) ALTER TABLE ONLY em tabela ja carimbada (schema-qual)', false, T('g5m9.sql',
    'ALTER TABLE ONLY public.suppliers ADD COLUMN city_name text;'));
}

// GUARD 6 — vehicle-fields-governed: localizacao da migration por CONTEUDO + drift de tipo (7)
{
  const TABLE = 'actor_asset_rental_pricing_tiers';
  // decoy: nome de arquivo IDENTICO ao bug historico, mas cria a tabela ORFA (nao a viva).
  const decoy = { name: '20260708150000_rental_resource_pricing_tiers.sql', content: 'CREATE TABLE rental_resource_pricing (id uuid, price_cents BIGINT NOT NULL);' };
  const creator = {
    name: '20260708400000_asset_rental_terms_substrate.sql',
    content: `CREATE TABLE ${TABLE} (id uuid, unit TEXT NOT NULL, price_cents BIGINT NOT NULL, CONSTRAINT chk_u CHECK (unit IN ('por_hora')));`,
  };

  const r1 = pricingDriftBites([decoy, creator], TABLE);
  scen('g6-m1 localiza a tabela VIVA por conteudo (nao pelo nome do arquivo decoy)', true, r1.located && r1.creatorFile === creator.name);
  scen('g6-m2 BIGINT reconhecido na tabela viva (via conteudo, nao via decoy)', true, r1.bigintOk);
  scen('g6-m3 (LEGIT) sem drift quando nao ha ALTER posterior', false, r1.drift);

  const alterDrift = { name: '20260710000000_drift_price_cents.sql', content: `ALTER TABLE ${TABLE} ALTER COLUMN price_cents TYPE NUMERIC(12,2);` };
  const r2 = pricingDriftBites([decoy, creator, alterDrift], TABLE);
  scen('g6-m4 (HOSTIL) ALTER COLUMN price_cents TYPE NUMERIC morde (drift)', true, r2.drift);

  const alterBigintNoop = { name: '20260710000001_reassert_bigint.sql', content: `ALTER TABLE ${TABLE} ALTER COLUMN price_cents TYPE BIGINT;` };
  const r3 = pricingDriftBites([decoy, creator, alterBigintNoop], TABLE);
  scen('g6-m5 (LEGIT) ALTER COLUMN price_cents TYPE BIGINT (reassert) nao morde', false, r3.drift);

  const alterUnrelated = { name: '20260710000002_other_table_price_drift.sql', content: 'ALTER TABLE some_other_money_table ALTER COLUMN price_cents TYPE NUMERIC(12,2);' };
  const r4 = pricingDriftBites([decoy, creator, alterUnrelated], TABLE);
  scen('g6-m6 (LEGIT) drift em tabela NAO-alvo nao morde', false, r4.drift);

  const commentOnly = { name: '20260710000003_comment_only.sql', content: '-- considerar ALTER COLUMN price_cents TYPE NUMERIC algum dia\nSELECT 1;' };
  const r5 = pricingDriftBites([decoy, creator, commentOnly], TABLE);
  scen('g6-m7 (LEGIT) comentario nao morde', false, r5.drift);
}

// ── limpeza + verificação de resíduo ──
let residue = null;
try {
  rmSync(TMP, { recursive: true, force: true });
  if (existsSync(TMP)) residue = `diretório temp ${TMP} não removido`;
  else if (readdirSync(tmpdir()).some((d) => d.startsWith('ddl-recog-') && existsSync(join(tmpdir(), d)) && join(tmpdir(), d) === TMP)) residue = 'resíduo temp detectado';
} finally {
  // garantia extra
  try { if (existsSync(TMP)) { rmSync(TMP, { recursive: true, force: true }); } } catch { /* noop */ }
}

// ── relatório determinístico ──
const failed = results.filter((r) => !r.ok);
console.log('── HARNESS: migration-ddl-recognition — resultado por cenário ──');
for (const r of results) {
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} | ${r.id} (esperado bite=${r.expected}, obtido=${r.actual})`);
}
console.log(`\n  cenários: ${results.length} · OK: ${results.length - failed.length} · FAIL: ${failed.length} · arquivos temp criados: ${created}`);
if (residue) { console.error(`\nHARNESS FAIL — resíduo temporário: ${residue}`); process.exit(1); }
if (failed.length) { console.error(`\nHARNESS FAIL — ${failed.length} cenário(s) divergiram do esperado.`); process.exit(1); }
console.log('\nHARNESS OK — todas as mutações mordem as evasões fechadas e nenhuma reprova forma legítima; zero resíduo temporário.');
