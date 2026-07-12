#!/usr/bin/env node
// Guard dedicado — PORTA-TERRITORY-1 · writer territorial governado + operação one-shot de bootstrap.
// Pergunta própria: "existe um writer SECURITY DEFINER (no CABEÇALHO VIVO) que só cria grants territory-scope
// (tenant NULL, scope_actor NULL, city obrigatório, active, nunca suspended, authority_source de bootstrap,
// grant+evento atômico), SEM EXECUTE para PUBLIC/unificard_app; e uma operação one-shot com IDs ratificados,
// só create+approve, dry-run default, CONFIRMED DERIVADO do token exato, COMMIT DOMINADO por (APPLY&&CONFIRMED&&!failed),
// e ROLLBACK VIVO no ramo dry-run (distinto do catch) — sem rota/seed/migration contendo os grants reais?"
// Comment-aware (strip léxico SQL+JS preservando strings) e prova LIVENESS, não presença de strings. Parse fail = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

// ── strippers léxicos (preservam strings; removem -- e /* */ em SQL, // e /* */ em JS) ──
function stripSqlComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '-' && d === '-') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'str'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    /* str */ if (c === "'" && d === "'") { out += "''"; i += 2; continue; } if (c === "'") mode = 'code'; out += c; i++;
  }
  return out;
}
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
    // dentro de string/template: respeita escape \
    if (c === '\\') { out += c + (d || ''); i += 2; continue; }
    if (mode === 'sq' && c === "'") mode = 'code';
    else if (mode === 'dq' && c === '"') mode = 'code';
    else if (mode === 'tpl' && c === '`') mode = 'code';
    out += c; i++;
  }
  return out;
}

const MIG_DIR = join(ROOT, 'migrations');
const SCRIPT = join(ROOT, 'scripts', 'porta-territory-1-bootstrap-curitiba.mjs');
const CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';
const GRANTEE = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const TERRITORY_KEYS = ['create_neighborhood', 'approve_neighborhood', 'correct_neighborhood', 'deactivate_neighborhood', 'manage_neighborhood_aliases', 'register_neighborhood_succession'];

// ── migration do writer ──
let migSql = '';
try {
  const f = readdirSync(MIG_DIR).find((x) => /territorial_capability_grant_bootstrap_writer\.sql$/.test(x));
  if (f) migSql = readFileSync(join(MIG_DIR, f), 'utf8');
} catch { /* */ }
if (!migSql) note('A0: migration do writer territorial ausente');
const migBare = stripSqlComments(migSql);

// ── A. FORMA DO WRITER (sobre migration SEM comentários) ──
if (migSql) {
  // uma única definição canônica
  const defs = (migBare.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.fn_grant_territorial_capability/gi) || []).length;
  if (defs === 0) note('A1: definição viva de fn_grant_territorial_capability ausente (SECURITY DEFINER em comentário não conta)');
  if (defs > 1) note(`A1b: ${defs} definições da função — deve haver uma canônica`);
  // cabeçalho vivo: do CREATE FUNCTION até o delimitador do corpo (AS $...$); SECURITY DEFINER tem de estar AQUI.
  const header = (migBare.match(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.fn_grant_territorial_capability[\s\S]*?AS\s*\$/i) || [''])[0];
  if (!/SECURITY DEFINER/.test(header)) note('A2: SECURITY DEFINER ausente no CABEÇALHO VIVO da função (não aceito em comentário/msg/corpo)');
  if (!/SET\s+search_path/i.test(header)) note('A3: search_path não pinado no cabeçalho vivo');
  // INSERT territorial: shape hardcoded
  const insBlock = (migBare.match(/INSERT INTO public\.actor_capability_grants[\s\S]*?RETURNING/i) || [''])[0];
  const valuesBlock = (insBlock.match(/VALUES\s*\([\s\S]*/i) || [''])[0];
  if (!/'territory'/.test(insBlock)) note("A4: INSERT não hardcode scope_type='territory'");
  if (!/VALUES\s*\(\s*NULL\s*,/i.test(valuesBlock)) note('A5: tenant_id (1º value) não é NULL');
  if (!/'territory',\s*NULL,\s*p_scope_city_id/i.test(valuesBlock)) note("A5b: scope_actor_id não é NULL ou scope_city ausente");
  if (!/'active'/.test(insBlock)) note("A6: status não hardcode 'active'");
  if (!/'platform_bootstrap'/.test(insBlock)) note("A7: authority_source não hardcode 'platform_bootstrap'");
  for (const k of TERRITORY_KEYS) if (!new RegExp('territory:' + k).test(migBare)) note(`A8: writer não valida a key territorial territory:${k}`);
  if (!/INSERT INTO public\.actor_capability_grant_events/i.test(migBare) || !/'granted'/.test(migBare)) note('A9: evento granted atômico ausente');
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fn_grant_territorial_capability[\s\S]*FROM\s+PUBLIC/i.test(migBare)) note('A10: REVOKE FROM PUBLIC ausente');
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fn_grant_territorial_capability[\s\S]*FROM\s+unificard_app/i.test(migBare)) note('A11: REVOKE FROM unificard_app ausente');
  if (migBare.includes(CITY_ID) || migBare.includes(GRANTEE)) note('A12: migration contém UUIDs reais de city/Actor — grants reais não vivem em migration');
}

// ── B. nenhuma OUTRA migration/seed contém os grants reais ──
try {
  for (const f of readdirSync(MIG_DIR).filter((x) => x.endsWith('.sql'))) {
    const t = stripSqlComments(readFileSync(join(MIG_DIR, f), 'utf8'));
    if (t.includes(CITY_ID) && t.includes(GRANTEE) && /INSERT INTO[\s\S]*actor_capability_grants/i.test(t)) {
      note(`B1: migration ${f} parece conter grant real (city+Actor+INSERT)`);
    }
  }
} catch { /* */ }

// ── C. OPERAÇÃO ONE-SHOT (sobre script SEM comentários; strings preservadas) ──
if (!existsSync(SCRIPT)) {
  note('C0: script one-shot ausente');
} else {
  const raw = readFileSync(SCRIPT, 'utf8');
  const s = stripJsComments(raw);
  if (!s.includes(CITY_ID)) note('C1: script sem o CITY_ID ratificado de Curitiba');
  if (!s.includes(GRANTEE)) note('C2: script sem o GRANTEE Actor ratificado de Clayton');
  if (!/territory:create_neighborhood/.test(s) || !/territory:approve_neighborhood/.test(s)) note('C3: script não concede create+approve');
  for (const k of ['correct_neighborhood', 'deactivate_neighborhood', 'manage_neighborhood_aliases', 'register_neighborhood_succession']) {
    if (new RegExp(`const CAPS\\s*=\\s*\\[[^\\]]*${k}`).test(s)) note(`C4: script concede capability proibida: territory:${k}`);
  }
  if (!/pg_advisory_xact_lock/.test(s)) note('C5: script sem advisory lock transacional');
  if (!/estado inicial NÃO-ZERO|n0\s*!==\s*0/.test(s)) note('C6: script não exige estado territorial inicial zero (fail-closed)');
  if (!/unificard_app/.test(s) || !/current_user/.test(s)) note('C11: script não recusa execução como unificard_app');
  if (/ON CONFLICT|UPSERT/i.test(s)) note('C9: script usa ON CONFLICT/UPSERT (proibido)');
  if (/DELETE\s+FROM/i.test(s)) note('C10: script usa DELETE (proibido; use ROLLBACK)');

  // ── LIVENESS ──
  // token exato
  if (!/const\s+CONFIRM_TOKEN\s*=\s*'PORTA-TERRITORY-1-CURITIBA'/.test(s)) note('C7: CONFIRM_TOKEN não é o token exato ratificado');
  // CONFIRMED DERIVADO do token exato (via includes/=== dos args); nunca true/||=/??true
  if (!/const\s+CONFIRMED\s*=\s*argv\.includes\(\s*CONFIRM_TOKEN\s*\)/.test(s)
      && !/const\s+CONFIRMED\s*=\s*argv[\s\S]{0,40}===\s*CONFIRM_TOKEN/.test(s)) {
    note('R-3: CONFIRMED não deriva de comparação exata com CONFIRM_TOKEN sobre os args (argv.includes(CONFIRM_TOKEN))');
  }
  if (/CONFIRMED\s*=\s*true/.test(s) || /CONFIRMED\s*\|\|=/.test(s) || /CONFIRMED[\s\S]{0,12}\?\?\s*true/.test(s) || /CONFIRMED\s*=\s*!?[A-Za-z0-9_]*\s*\|\|\s*true/.test(s)) {
    note('R-3b: CONFIRMED forçado/permissivo (=true, ||=, ??true, ||true)');
  }
  // reatribuição de CONFIRMED depois da derivação (só pode haver 1 atribuição)
  if ((s.match(/\bCONFIRMED\s*=/g) || []).length > 1) note('R-3c: CONFIRMED reatribuído após a derivação');
  // APPLY derivado dos args
  if (!/const\s+APPLY\s*=\s*argv\.includes\(\s*'--apply'\s*\)/.test(s)) note('R-3d: APPLY não deriva de argv.includes("--apply")');

  // COMMIT DOMINADO pelo gate (APPLY && CONFIRMED && !failed); rejeita if(true)/só-APPLY/só-!failed
  const commitCount = (s.match(/client\.query\(\s*'COMMIT'\s*\)/g) || []).length;
  if (commitCount !== 1) note(`R-4: esperado exatamente 1 COMMIT operacional (achou ${commitCount})`);
  if (!/if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)\s*\{[\s\S]{0,160}?client\.query\(\s*'COMMIT'\s*\)/.test(s)) {
    note('R-4b: COMMIT não é dominado por (APPLY && CONFIRMED && !failed)');
  }
  if (/if\s*\(\s*true\s*\)[\s\S]{0,160}?client\.query\(\s*'COMMIT'\s*\)/.test(s)) note('R-4c: COMMIT sob condição incondicional if(true)');
  if ((s.match(/\bfailed\s*=\s*false\b/g) || []).length > 1) note('R-4d: failed forçado para false após a declaração inicial');

  // ROLLBACK VIVO no ramo DRY-RUN (else do gate), DISTINTO do catch: o ROLLBACK tem de estar no bloco else
  // ANTES do próximo `catch (` — assim o ROLLBACK do catch não pode mascarar a ausência no ramo dry-run.
  const elseM = s.match(/\}\s*else\s*\{([\s\S]*)$/);
  if (!elseM) {
    note('R-5: ramo else (dry-run/abort) do gate de COMMIT ausente');
  } else {
    const afterElse = elseM[1];
    const catchPos = afterElse.search(/\bcatch\s*\(/);
    const elseRegion = catchPos >= 0 ? afterElse.slice(0, catchPos) : afterElse;
    if (!/client\.query\(\s*'ROLLBACK'\s*\)/.test(elseRegion)) {
      note('R-5: ROLLBACK ausente no ramo dry-run/abort (else do gate, antes do catch) — o ROLLBACK do catch NÃO satisfaz');
    }
  }
  const catchRollback = /catch\s*\([\s\S]{0,40}?\)\s*\{[\s\S]{0,120}?client\.query\(\s*'ROLLBACK'\s*\)/.test(s);
  if (!catchRollback) note('R-5b: ROLLBACK ausente no catch (erro deve reverter também)');
}

// ── D. sem rota que exponha o writer/operação ──
try {
  const walk = (dir, acc) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); } else if (/\.ts$/.test(e.name)) acc.push(p); } return acc; };
  for (const f of walk(join(ROOT, 'src'), [])) {
    if (/fn_grant_territorial_capability|porta-territory-1/.test(readFileSync(f, 'utf8'))) note(`D1: referência a fn_grant_territorial_capability/porta em runtime: ${f.replace(ROOT, '.')}`);
  }
} catch { /* */ }

if (failures.length) {
  console.error('GATE FAIL [territorial-grant-bootstrap]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [territorial-grant-bootstrap] — writer fn_grant_territorial_capability com SECURITY DEFINER no CABEÇALHO VIVO (comment-stripped), search_path pinado, só territory-scope (tenant NULL, scope_actor NULL, city obrigatório, active, platform_bootstrap, grant+evento atômico), REVOKE de PUBLIC/unificard_app, sem UUIDs reais; operação one-shot com IDs ratificados, só create+approve, advisory lock, estado-inicial-zero, CONFIRMED DERIVADO do token exato (sem =true/||=/??true), COMMIT DOMINADO por (APPLY&&CONFIRMED&&!failed) (rejeita if(true)), ROLLBACK VIVO no ramo dry-run (distinto do catch); sem ON CONFLICT/DELETE/rota. (Comment-aware + liveness.)');
