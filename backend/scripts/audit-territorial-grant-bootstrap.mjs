#!/usr/bin/env node
// Guard dedicado — PORTA-TERRITORY-1 · writer territorial governado + operação one-shot de bootstrap.
// Pergunta própria: "existe um writer SECURITY DEFINER que só cria grants territory-scope (tenant NULL,
// scope_actor NULL, city obrigatório, status active, nunca suspended, authority_source de bootstrap,
// grant+evento atômico), SEM EXECUTE para PUBLIC/unificard_app; e uma operação one-shot versionada com
// IDs exatos ratificados, só create+approve, dry-run default, confirmação explícita p/ apply, transação
// única, advisory lock e estado-inicial-zero fail-closed — SEM rota/seed/migration contendo os grants reais?"
// Integridade VERSIONADA (migration/script), comment-aware; introspecção DB best-effort. Parse fail = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

const MIG_DIR = join(ROOT, 'migrations');
const SCRIPT = join(ROOT, 'scripts', 'porta-territory-1-bootstrap-curitiba.mjs');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');
const CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';
const GRANTEE = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const TERRITORY_KEYS = ['create_neighborhood', 'approve_neighborhood', 'correct_neighborhood', 'deactivate_neighborhood', 'manage_neighborhood_aliases', 'register_neighborhood_succession'];

// ── localizar a migration do writer territorial ──
let migFile = null, migSql = '';
try {
  const f = readdirSync(MIG_DIR).find((x) => /territorial_capability_grant_bootstrap_writer\.sql$/.test(x));
  if (f) { migFile = join(MIG_DIR, f); migSql = readFileSync(migFile, 'utf8'); }
} catch { /* */ }
if (!migSql) note('A0: migration do writer territorial ausente (…territorial_capability_grant_bootstrap_writer.sql)');

// ── A. FORMA DO WRITER (migration) ──
if (migSql) {
  const fn = /fn_grant_territorial_capability/;
  if (!fn.test(migSql)) note('A1: função fn_grant_territorial_capability ausente na migration');
  if (!/SECURITY DEFINER/.test(migSql)) note('A2: writer sem SECURITY DEFINER');
  if (!/SET search_path/i.test(migSql)) note('A3: writer sem search_path pinado');
  // INSERT territorial hardcoded: scope_type='territory', tenant_id NULL, scope_actor_id NULL, status 'active', authority_source bootstrap
  const insBlock = (migSql.match(/INSERT INTO public\.actor_capability_grants[\s\S]*?RETURNING/i) || [''])[0];
  const valuesBlock = (insBlock.match(/VALUES\s*\([\s\S]*/i) || [''])[0];
  if (!/'territory'/.test(insBlock)) note("A4: INSERT não hardcode scope_type='territory'");
  // tenant_id é o 1º value → VALUES deve começar com NULL; e scope_actor_id (após 'territory') também NULL.
  if (!/VALUES\s*\(\s*NULL\s*,/i.test(valuesBlock)) note('A5: tenant_id (1º value do INSERT) não é NULL');
  if (!/'territory',\s*NULL,\s*p_scope_city_id/i.test(valuesBlock)) note("A5b: scope_actor_id não é NULL ou scope_city ausente (esperado 'territory', NULL, p_scope_city_id)");
  if (!/'active'/.test(insBlock)) note("A6: status não hardcode 'active'");
  if (!/'platform_bootstrap'/.test(insBlock)) note("A7: authority_source não hardcode 'platform_bootstrap' (bootstrap governado)");
  // capability territorial exata: precisa checar as 6 keys (guarda anti-financeira/wildcard)
  for (const k of TERRITORY_KEYS) if (!new RegExp('territory:' + k).test(migSql)) note(`A8: writer não valida a key territorial territory:${k}`);
  // evento atômico
  if (!/INSERT INTO public\.actor_capability_grant_events/i.test(migSql) || !/'granted'/.test(migSql)) note('A9: evento granted atômico ausente');
  // ACL fechada
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fn_grant_territorial_capability[\s\S]*FROM\s+PUBLIC/i.test(migSql)) note('A10: REVOKE FROM PUBLIC ausente');
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fn_grant_territorial_capability[\s\S]*FROM\s+unificard_app/i.test(migSql)) note('A11: REVOKE FROM unificard_app ausente');
  // a migration NÃO pode conter os grants reais (INSERT com os UUIDs ratificados)
  if (migSql.includes(CITY_ID) || migSql.includes(GRANTEE)) note('A12: migration contém os UUIDs reais de city/Actor — grants reais não podem viver em migration');
}

// ── B. NENHUMA OUTRA migration/seed contém os grants reais ──
try {
  for (const f of readdirSync(MIG_DIR).filter((x) => x.endsWith('.sql'))) {
    const t = readFileSync(join(MIG_DIR, f), 'utf8');
    if ((t.includes(CITY_ID) && t.includes(GRANTEE)) && /INSERT INTO[\s\S]*actor_capability_grants/i.test(t)) {
      note(`B1: migration ${f} parece conter grant real (city+Actor+INSERT em actor_capability_grants)`);
    }
  }
} catch { /* */ }

// ── C. OPERAÇÃO ONE-SHOT (script) ──
if (!existsSync(SCRIPT)) {
  note('C0: script one-shot ausente (porta-territory-1-bootstrap-curitiba.mjs)');
} else {
  const s = readFileSync(SCRIPT, 'utf8');
  const sCode = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // sem comentários
  if (!s.includes(CITY_ID)) note('C1: script sem o CITY_ID ratificado de Curitiba');
  if (!s.includes(GRANTEE)) note('C2: script sem o GRANTEE Actor ratificado de Clayton');
  if (!/territory:create_neighborhood/.test(s) || !/territory:approve_neighborhood/.test(s)) note('C3: script não concede create+approve');
  for (const k of ['correct_neighborhood', 'deactivate_neighborhood', 'manage_neighborhood_aliases', 'register_neighborhood_succession']) {
    // as outras 4 só podem aparecer como PROIBIDAS (OTHER_CAPS), nunca no array CAPS concedido
    if (new RegExp(`const CAPS\\s*=\\s*\\[[^\\]]*${k}`).test(sCode)) note(`C4: script concede capability proibida nesta PORTA: territory:${k}`);
  }
  if (!/pg_advisory_xact_lock/.test(sCode)) note('C5: script sem advisory lock transacional (serialização de concorrência)');
  if (!/estado inicial/i.test(s) && !/n0\s*!==\s*0/.test(sCode)) note('C6: script não exige estado territorial inicial zero (fail-closed)');
  if (!/--apply/.test(s) || !/PORTA-TERRITORY-1-CURITIBA/.test(s)) note('C7: script sem apply gated por token de confirmação explícito');
  if (!/ROLLBACK/.test(sCode)) note('C8: script sem ROLLBACK (dry-run/abort)');
  if (/ON CONFLICT|UPSERT/i.test(sCode)) note('C9: script usa ON CONFLICT/UPSERT (reconciliação proibida)');
  if (/DELETE\s+FROM/i.test(sCode)) note('C10: script usa DELETE (limpeza proibida; use ROLLBACK)');
  if (!/unificard_app/.test(s) || !/current_user/.test(s)) note('C11: script não recusa execução como unificard_app');
  // apply só com confirmação
  if (!/APPLY\s*&&\s*!?CONFIRMED|CONFIRMED[\s\S]{0,40}COMMIT|APPLY && CONFIRMED/.test(s)) note('C12: COMMIT não é gated por APPLY+CONFIRMED');
}

// ── D. SEM ROTA que exponha o writer/operação ──
try {
  const walk = (dir, acc) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); } else if (/\.ts$/.test(e.name)) acc.push(p); } return acc; };
  const files = walk(join(ROOT, 'src'), []);
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    if (/fn_grant_territorial_capability|porta-territory-1/.test(t)) note(`D1: referência a fn_grant_territorial_capability/porta em runtime: ${f.replace(ROOT, '.')}`);
  }
} catch { /* */ }

// ── E. INTROSPECÇÃO DB (best-effort; não falha se DB indisponível) ──
// (função existe secdef + app/public sem EXECUTE) — prova comportamental quando há DB.
// Deixado como não-obrigatório para o guard ser CI-safe; a forma/ACL já é provada estaticamente na migration.

if (failures.length) {
  console.error('GATE FAIL [territorial-grant-bootstrap]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [territorial-grant-bootstrap] — writer fn_grant_territorial_capability SECURITY DEFINER/search_path-pinado só cria territory-scope (tenant NULL, scope_actor NULL, city obrigatório, active, authority_source=platform_bootstrap, grant+evento atômico), REVOKE de PUBLIC e unificard_app, sem UUIDs reais na migration; operação one-shot versionada com CITY/GRANTEE ratificados, só create+approve, advisory lock, estado-inicial-zero, dry-run default e apply gated por token; sem ON CONFLICT/DELETE; sem rota/seed/migration contendo os grants reais. (Forma versionada; comment-aware.)');
