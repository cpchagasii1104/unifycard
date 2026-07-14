#!/usr/bin/env node
// Guard dedicado — PORTA-TERRITORY-ALIASES (DECISION-0174 · N0-D).
// Pergunta própria: "a operação one-shot concede EXATAMENTE territory:manage_neighborhood_aliases ao
// Actor humano ratificado em Curitiba, via o writer governado fn_grant_territorial_capability (mecanismo),
// com dry-run default (ROLLBACK vivo), CONFIRMED derivado do token exato, COMMIT dominado por
// (APPLY&&CONFIRMED&&!failed), rerun fail-closed, advisory lock — SEM segunda capability, sem INSERT direto
// em grants/eventos, sem migration, sem abrir HOLD, sem writer/alias, sem Bank/Social, referenciando a
// DECISION-0174 como fonte institucional (platform_bootstrap)?"
// Comment-aware (strip JS preservando strings) + liveness. Parse fail = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
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

const SCRIPT = join(ROOT, 'scripts', 'grant-curitiba-neighborhood-alias-capability.mjs');
const CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';
const GRANTEE = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const CONFIRM_TOKEN = 'GRANT_CURITIBA_NEIGHBORHOOD_ALIAS_CAPABILITY';
const FORBIDDEN_CAPS = ['create_neighborhood', 'approve_neighborhood', 'correct_neighborhood', 'deactivate_neighborhood', 'register_neighborhood_succession'];

if (!existsSync(SCRIPT)) {
  note('C0: one-shot da PORTA-TERRITORY-ALIASES ausente');
} else {
  const raw = readFileSync(SCRIPT, 'utf8');
  const s = stripJsComments(raw);

  // 1-3 · key exata, city exata, grantee ratificado
  if (!/const\s+CAP\s*=\s*'territory:manage_neighborhood_aliases'/.test(s)) note('C1: CAP não é a key exata manage_neighborhood_aliases');
  if (!s.includes(CITY_ID)) note('C2: script sem o CITY_ID ratificado de Curitiba');
  if (!new RegExp(`const\\s+CITY_ID\\s*=\\s*'${CITY_ID}'`).test(s)) note('C2b: CITY_ID const não é Curitiba ratificada');
  if (!s.includes(GRANTEE)) note('C3: script sem o GRANTEE Actor ratificado');
  if (!new RegExp(`const\\s+GRANTEE_ACTOR_ID\\s*=\\s*'${GRANTEE}'`).test(s)) note('C3b: GRANTEE_ACTOR_ID const não é o Actor ratificado');

  // 4-5 · nenhuma segunda capability / wildcard / prefix (CAP é escalar; nenhuma outra key concedida)
  if (/const\s+CAPS\s*=/.test(s)) note('C4: script usa lista CAPS (deve conceder EXATAMENTE uma key escalar)');
  for (const k of FORBIDDEN_CAPS) {
    // a key proibida só pode aparecer em asserção NEGATIVA (OTHER_KEYS / byKey), nunca como CAP concedida
    if (new RegExp(`CAP\\s*=\\s*'territory:${k}'`).test(s)) note(`C4b: script concede capability proibida como CAP: ${k}`);
  }
  if (/territory:\*|manage_\*|:\*'|capability_key\s*LIKE/i.test(s)) note('C4c: wildcard/prefix de capability');

  // 6-7 · nenhum INSERT direto em grants/eventos (só a função canônica materializa)
  if (/INSERT\s+INTO\s+public\.actor_capability_grants\b/i.test(s)) note('C6: INSERT direto em actor_capability_grants (proibido)');
  if (/INSERT\s+INTO\s+public\.actor_capability_grant_events\b/i.test(s)) note('C7: INSERT direto em actor_capability_grant_events (proibido)');

  // 8 · função canônica chamada
  if (!/public\.fn_grant_territorial_capability\(/.test(s)) note('C8: fn_grant_territorial_capability não é chamada');

  // 9 · dry-run com ROLLBACK vivo no ramo else (distinto do catch)
  const elseM = s.match(/\}\s*else\s*\{([\s\S]*)$/);
  if (!elseM) note('C9: ramo else (dry-run/abort) do gate ausente');
  else {
    const afterElse = elseM[1];
    const catchPos = afterElse.search(/\bcatch\s*\(/);
    const elseRegion = catchPos >= 0 ? afterElse.slice(0, catchPos) : afterElse;
    if (!/client\.query\(\s*'ROLLBACK'\s*\)/.test(elseRegion)) note('C9b: ROLLBACK ausente no ramo dry-run (else) — o ROLLBACK do catch NÃO satisfaz');
  }
  if (!/catch\s*\([\s\S]{0,40}?\)\s*\{[\s\S]{0,120}?client\.query\(\s*'ROLLBACK'\s*\)/.test(s)) note('C9c: ROLLBACK ausente no catch');

  // 10 · apply exige confirmação literal exata (CONFIRMED derivado do token; sem =true/||=/??true)
  if (!new RegExp(`const\\s+CONFIRM_TOKEN\\s*=\\s*'${CONFIRM_TOKEN}'`).test(s)) note('C10: CONFIRM_TOKEN não é o token literal exato');
  if (!/const\s+CONFIRMED\s*=\s*argv\.includes\(\s*CONFIRM_TOKEN\s*\)/.test(s)) note('C10b: CONFIRMED não deriva de argv.includes(CONFIRM_TOKEN)');
  if (/CONFIRMED\s*=\s*true/.test(s) || /CONFIRMED\s*\|\|=/.test(s) || /CONFIRMED[\s\S]{0,12}\?\?\s*true/.test(s)) note('C10c: CONFIRMED forçado/permissivo');
  if ((s.match(/\bCONFIRMED\s*=/g) || []).length > 1) note('C10d: CONFIRMED reatribuído');
  if (!/const\s+APPLY\s*=\s*argv\.includes\(\s*'--apply'\s*\)/.test(s)) note('C10e: APPLY não deriva de argv.includes("--apply")');
  if (!/if\s*\(\s*APPLY\s*&&\s*!\s*CONFIRMED\s*\)\s*throw/.test(s)) note('C10f: --apply sem token não é recusado explicitamente');

  // COMMIT dominado por (APPLY && CONFIRMED && !failed), exatamente 1
  const commitCount = (s.match(/client\.query\(\s*'COMMIT'\s*\)/g) || []).length;
  if (commitCount !== 1) note(`C-commit: esperado exatamente 1 COMMIT (achou ${commitCount})`);
  if (!/if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)\s*\{[\s\S]{0,160}?client\.query\(\s*'COMMIT'\s*\)/.test(s)) note('C-commit2: COMMIT não dominado por (APPLY && CONFIRMED && !failed)');
  if (/if\s*\(\s*true\s*\)[\s\S]{0,160}?client\.query\(\s*'COMMIT'\s*\)/.test(s)) note('C-commit3: COMMIT sob if(true)');

  // 11 · rerun fail-closed (manage_aliases já existente → throw precondition/already_applied)
  if (!/nAliasBefore\s*!==\s*0[\s\S]{0,120}?throw/.test(s) || !/already_applied|precondition_failed/.test(s)) note('C11: rerun não é fail-closed (grant já existente não aborta)');

  // 12 · advisory lock
  if (!/pg_advisory_xact_lock/.test(s)) note('C12: advisory lock transacional ausente');

  // 13-16 · sem migration/HOLD/writer-alias/INSERT-alias
  if (/CREATE\s+TABLE|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|ALTER\s+TABLE|CREATE\s+TRIGGER/i.test(s)) note('C13: script contém DDL/migration');
  if (/enforce_neighborhood_aliases_writer_hold|ALTER\s+TABLE\s+public\.neighborhood_aliases|DISABLE\s+TRIGGER|ENABLE\s+TRIGGER/i.test(s)) note('C14: script toca o HOLD de aliases');
  if (/fn_create_canonical_alias|neighborhood_alias_writer_authorizations/.test(s)) note('C15: script referencia writer/token de alias (fora do escopo da PORTA)');
  if (/INSERT\s+INTO\s+public\.neighborhood_aliases\b/i.test(s)) note('C16: script insere alias (proibido)');

  // 17-19 · sem Bank/Social/financeiro
  if (/from\s+['"][^'"]*(bank|social|ledger|split|regional[-_]?fund)[^'"]*['"]/i.test(s)) note('C17: import de Bank/Social/ledger/split/fundos');
  if (/INSERT\s+INTO[^;]*(bank|split|ledger|regional_fund)|UPDATE[^;]*(bank|split|ledger|regional_fund)/i.test(s)) note('C18: DML financeiro');
  // leitura de contagem/soma de bank_accounts é permitida (prova Δbank=0)

  // 20 · DECISION-0174 como fonte institucional (platform_bootstrap)
  if (!/DECISION-0174/.test(raw)) note('C20: script não referencia a DECISION-0174 (fonte institucional)');
  if (!/platform_bootstrap/.test(s)) note('C20b: script não evidencia authority_source platform_bootstrap');

  // higiene: sem ON CONFLICT/UPSERT/DELETE
  if (/ON CONFLICT|UPSERT/i.test(s)) note('C-hyg: ON CONFLICT/UPSERT proibido');
  if (/DELETE\s+FROM/i.test(s)) note('C-hyg2: DELETE proibido (use ROLLBACK)');
  if (!/unificard_app/.test(s) || !/current_user/.test(s)) note('C-hyg3: não recusa execução como unificard_app');
}

// runtime containment: nenhum src runtime chama esta PORTA/one-shot
try {
  const walk = (dir, acc) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); } else if (/\.ts$/.test(e.name)) acc.push(p); } return acc; };
  for (const f of walk(join(ROOT, 'src'), [])) {
    if (/grant-curitiba-neighborhood-alias-capability/.test(readFileSync(f, 'utf8'))) note(`D1: referência runtime à one-shot da PORTA: ${f.replace(ROOT, '.')}`);
  }
} catch { /* */ }

// runner
{
  const runner = existsSync(join(ROOT, 'scripts', 'run-regression-guards.mjs')) ? readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf8') : '';
  if (!runner.includes('audit-porta-territory-aliases.mjs')) note('R1: guard fora do runner');
}

if (failures.length) {
  console.error('GATE FAIL [porta-territory-aliases]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [porta-territory-aliases] — one-shot governada concede EXATAMENTE territory:manage_neighborhood_aliases ao Actor ratificado em Curitiba via fn_grant_territorial_capability (mecanismo; DECISION-0174/platform_bootstrap = fonte institucional); dry-run default com ROLLBACK vivo (distinto do catch); CONFIRMED derivado do token literal; COMMIT dominado por (APPLY&&CONFIRMED&&!failed); rerun fail-closed (grant já existente aborta); advisory lock; sem segunda capability/wildcard, sem INSERT direto em grants/eventos, sem migration/DDL, sem tocar o HOLD, sem writer/alias, sem Bank/Social/financeiro. (Comment-aware + liveness.)');
