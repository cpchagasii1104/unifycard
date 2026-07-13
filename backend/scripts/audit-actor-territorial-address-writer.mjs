#!/usr/bin/env node
// Guard consolidado — FASE C · CASA ÚNICA do writer canônico actor-territorial.
// ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING.
// Pergunta própria: "existe UMA única casa (service+repository privado) para mutar o endereço territorial
// actor-scoped; ela valida canRepresentActor SEM engolir o erro; tenant/operador vêm server-side (não do body);
// purpose→role derivado; transação atômica com advisory lock; idempotência obrigatória; evento na mesma tx;
// encerra+cria (nunca DELETE/UPDATE-in-place/reopen); sem CEP/provider/findOrCreate/fallback textual; sem
// addressId arbitrário; sem profile/company/actor_active_location; sem rota/frontend/Bank/Social; nenhum outro
// código do src cria actor-scoped; resolver/migration da Fase A e N3 intactos?"
// Integridade VERSIONADA (arquivos/src). Parse/ausência = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);
const rd = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

function stripJs(src) {
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
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = 'code';
    out += c; i++;
  }
  return out;
}

const LOC = join(ROOT, 'src', 'core', 'location');
const SERVICE = join(LOC, 'actor-territorial-address-writer.service.ts');
const REPO = join(LOC, 'actor-territorial-address.repository.ts');
const RESOLVER = join(LOC, 'actor-territorial-resolver.ts');
const MIG_A = join(ROOT, 'migrations', '20260713100000_actor_territorial_assignment_foundation.sql');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');

// ── A. SERVICE (casa única / autoridade / tx / idempotência) ──
if (!existsSync(SERVICE)) note('A0: service actor-territorial-address-writer.service.ts ausente');
else {
  const raw = rd(SERVICE); const s = stripJs(raw);
  if (!/export\s+async\s+function\s+setActorTerritorialAddress/.test(s)) note('A1: setActorTerritorialAddress ausente');
  if (!/export\s+async\s+function\s+retireActorTerritorialAddress/.test(s)) note('A2: retireActorTerritorialAddress ausente');
  // ── P1 — AUTORIDADE PROVADA POR FUNÇÃO (set e retire), por argumentos, ordem e sentido do deny ──
  const bodyOf = (name) => { // extrai o corpo { ... } da função por brace-matching sobre o skeleton
    const m = s.search(new RegExp('export\\s+async\\s+function\\s+' + name + '\\s*\\('));
    if (m < 0) return null;
    const open = s.indexOf('{', m); if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (depth === 0) return s.slice(open, i + 1); } }
    return null;
  };
  if (!/canRepresentActor\s*\(/.test(s)) note('A3: não valida canRepresentActor');
  // A3f — cada operação exportada prova autoridade com ARGUMENTOS EXATOS, ANTES de conexão/BEGIN.
  for (const fn of ['setActorTerritorialAddress', 'retireActorTerritorialAddress']) {
    const b = bodyOf(fn);
    if (!b) { note(`A3f: função ${fn} ausente/ilegível`); continue; }
    const AUTH = /(?:await\s+)?assertRepresentable\(\s*auth\.tenantId\s*,\s*auth\.operatorUserId\s*,\s*input\.actorId\s*\)/;
    const ai = b.search(AUTH);
    if (ai < 0) { note(`A3f: ${fn} não prova autoridade com (auth.tenantId, auth.operatorUserId, input.actorId)`); continue; }
    const conn = b.search(/getClientWithTenant\s*\(|client\.query\(\s*['"]BEGIN['"]/);
    if (conn >= 0 && conn < ai) note(`A3f: ${fn} valida autoridade DEPOIS de abrir conexão/BEGIN (address pode nascer antes da autoridade)`);
  }
  // A3h — helper assertRepresentable: usa canRepresentActor(tenantId, operatorUserId, actorId), lança em !representable,
  // sem swallow/fallback e sem inversão de sentido.
  const helper = (() => {
    const m = s.search(/function\s+assertRepresentable\s*\(/);
    if (m < 0) return null; const open = s.indexOf('{', m); if (open < 0) return null;
    let depth = 0; for (let i = open; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (depth === 0) return s.slice(open, i + 1); } } return null;
  })();
  if (!helper) note('A3h: helper assertRepresentable ausente/ilegível');
  else {
    if (!/canRepresentActor\(\s*tenantId\s*,\s*operatorUserId\s*,\s*actorId\s*\)/.test(helper)) note('A3h: helper não chama canRepresentActor(tenantId, operatorUserId, actorId)');
    if (!/if\s*\(\s*!\s*representable\s*\)[\s\S]{0,80}?throw\s+new\s+ActorTerritorialAuthorityError/.test(helper)) note('A3h: helper não lança quando !representable (deny efetivo ausente)');
    if (/if\s*\(\s*representable\s*\)[\s\S]{0,60}?throw\s+new\s+ActorTerritorialAuthorityError/.test(helper)) note('A3h-inv: helper lança quando representable=true (sentido do deny INVERTIDO)');
    if (/if\s*\(\s*!\s*representable\s*\)[\s\S]{0,60}?return\b/.test(helper)) note('A3h: helper retorna (em vez de lançar) em !representable');
    // anti-swallow no helper
    if (/\bcatch\b/.test(helper) || /\.catch\s*\(/.test(helper)) note('A3h: helper contém catch/.catch (não engolir erro de autoridade)');
    if (/canRepresentActor[\s\S]{0,20}?(\|\||\?\?)/.test(helper) || /\?\s*[\s\S]{0,40}?:\s*(true|false)\b/.test(helper)) note('A3h: helper reduz canRepresentActor por ||/??/ternário (fail-open)');
    if (/representable\s*=\s*(false|true)\b/.test(helper)) note('A3h: helper força representable a booleano constante');
  }
  // A3s — anti-swallow global sobre a chamada de autoridade (.catch e fallback ||/??)
  if (/(canRepresentActor|assertRepresentable)\([^;]*\)\s*\.catch\s*\(/.test(s)) note('A3s: .catch() sobre a chamada de autoridade (fail-open) — proibido');
  if (/(canRepresentActor|assertRepresentable)\([^;]*\)\s*(\|\||\?\?)/.test(s)) note('A3s: fallback ||/?? sobre a chamada de autoridade — proibido');

  // ── Q1 — canRepresentActor consumido por AWAIT DIRETO, sem QUALQUER encadeamento posterior ──
  // (a) toda chamada canRepresentActor( deve estar imediatamente sob `await` (com receiver opcional) —
  //     bloqueia wrapper (Promise.resolve/transform), alias intermediário e ternário.
  // (b) após o ')' de fechamento (parênteses balanceados sobre o skeleton), o próximo token vivo não pode
  //     ser . / ?. / [ / template — bloqueia .then/.catch/.finally/?.then/['then']/tagged.
  {
    const CALL = /canRepresentActor\s*\(/g;
    let cm; const calls = [];
    while ((cm = CALL.exec(s))) calls.push(cm.index);
    const AWAIT_DIRECT = /await\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)?$/;
    for (const idx of calls) {
      // (a) precedência: o texto antes de 'canRepresentActor' termina em `await [receiver.]`
      const before = s.slice(Math.max(0, idx - 60), idx);
      if (!AWAIT_DIRECT.test(before)) { note('Q1a: canRepresentActor não está imediatamente sob await direto (wrapper/alias/ternário) — proibido'); continue; }
      // (b) encontra o '(' da chamada e casa parênteses
      const paren = s.indexOf('(', idx);
      let depth = 0, j = paren, close = -1;
      for (; j < s.length; j++) { if (s[j] === '(') depth++; else if (s[j] === ')') { depth--; if (depth === 0) { close = j; break; } } }
      if (close < 0) { note('Q1: parênteses de canRepresentActor não fecham'); continue; }
      let k = close + 1; while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === '.' || s[k] === '?' || s[k] === '[' || s[k] === '`') note(`Q1b: encadeamento após canRepresentActor(...) ("${s[k]}") — exige await direto sem .then/.catch/.finally/?./[]/tagged`);
    }
  }
  if (/input\.(tenantId|operatorUserId|ownerType|owner_type|role|isPrimary|is_primary|actorType|actor_type|validFrom|validUntil)\b/.test(s)) note('A6: service lê tenant/operador/owner_type/role/is_primary/actor_type/vigência do input (proibido)');
  // purpose→role derivado internamente
  if (!/PURPOSE_ROLE\s*\[/.test(s) && !/PURPOSE_ROLE\s*=/.test(s)) note('A7: purpose→role não derivado por mapa governado');
  // transação atômica + advisory lock + release
  if (!/getClientWithTenant\s*\(\s*auth\.tenantId/.test(s)) note('A8: não usa client tenant-scoped governado');
  if (!/client\.query\(\s*['"]BEGIN['"]/.test(s) || !/client\.query\(\s*['"]COMMIT['"]/.test(s) || !/client\.query\(\s*['"]ROLLBACK['"]/.test(s)) note('A9: transação BEGIN/COMMIT/ROLLBACK ausente');
  if (!/pg_advisory_xact_lock/.test(s)) note('A10: sem advisory lock (concorrência actor+role)');
  if (!/client\.release\(\)/.test(s)) note('A11: client não é liberado (release)');
  // idempotência obrigatória
  if (!/idempotency_keys/.test(s)) note('A12: não usa a casa canônica de idempotência (idempotency_keys)');
  if (!/idempotencyKey/.test(s) || !/ACTOR_TERRITORIAL_IDEMPOTENCY_REQUIRED/.test(s)) note('A13: idempotency key não é obrigatória');
  if (!/requestHash/.test(s) || !/PAYLOAD_MISMATCH/.test(s)) note('A14: não detecta mesma key com payload diferente');
  // sem CEP/provider/findOrCreate/fallback textual/addressId arbitrário
  if (/cep|viacep|brasilapi|provider|geocod|findOrCreate|enrich|neighborhood_display_text\s*=|resolveCep/i.test(s)) note('A15: service integra CEP/provider/findOrCreate (proibido na Fase C)');
  if (/existingAddressId|input\.addressId|input\.address\.addressId/.test(s)) note('A16: aceita addressId arbitrário (proibido)');
  if (/\bprofiles?\b|\bcompanies?\b|actor_active_location|representante|profile_id|company_id/i.test(s)) note('A17: usa profile/company/actor_active_location como fallback (proibido)');
  // sem rota/frontend/Bank/Social
  if (/router|\.(get|post|put|delete)\(|fastify|route|controller/i.test(s)) note('A18: expõe rota/controller (proibido)');
  if (/\bbank_\w+|regional_fund|treasury|bank_split|ledger|social_\w+/i.test(s)) note('A19: toca Bank/Social/split (proibido)');
}

// ── B. REPOSITORY privado (exige client; não abre conexão; não valida autoridade; owner_type fixo 'actor') ──
if (!existsSync(REPO)) note('B0: repository privado ausente');
else {
  const s = stripJs(rd(REPO));
  if (/pool\.connect|new\s+Pool|getClientWithTenant|pool\.query/.test(s)) note('B1: repository abre conexão própria (deve receber client transacional)');
  if (!/client\s*:\s*PoolClient/.test(s)) note('B2: repository não exige PoolClient');
  if (/canRepresentActor|authoriz/i.test(s)) note('B3: repository valida autoridade (deve ficar no service)');
  if (!/owner_type,\s*owner_id,\s*address_id,\s*role,\s*is_primary,\s*actor_id/.test(s) || !/VALUES\s*\(\s*'actor'/.test(s)) note('B4: insertActorAssignment não fixa owner_type=actor com actor_id');
  if (/DELETE\s+FROM\s+address_assignments/i.test(s)) note('B5: repository usa DELETE (proibido)');
  if (/findOrCreate|cep|provider|neighborhood_display_text\s*=\s*\w|resolveCep/i.test(s)) note('B6: repository resolve território por texto/CEP (proibido)');
}

// ── C. TRAVA: nenhum OUTRO código do src cria/muta actor-scoped (só o repository canônico) ──
{
  const SRC = join(ROOT, 'src');
  const hits = [];
  const walk = (dir) => { for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.ts$/.test(f.name) && p !== REPO && p !== SERVICE) {
      const s = stripJs(rd(p));
      if (/INSERT\s+INTO\s+address_assignments[\s\S]{0,400}?(actor_id|'actor')/i.test(s)) hits.push(p + ' (INSERT actor-scoped)');
      if (/UPDATE\s+address_assignments[\s\S]{0,200}?SET[\s\S]{0,200}?actor_id/i.test(s)) hits.push(p + ' (UPDATE actor_id)');
    }
  } };
  if (existsSync(SRC)) walk(SRC);
  for (const h of hits) note(`C1: mutação actor-scoped fora da casa canônica: ${h}`);
}

// ── D. FASE A / N3 INTACTAS (o writer não altera fundação selada) ──
if (existsSync(RESOLVER)) { const r = rd(RESOLVER); if (!/resolveActorTerritory/.test(r) || !/getClientWithTenant/.test(r)) note('D1: resolver da Fase A alterado/ausente'); }
if (existsSync(MIG_A)) { const m = rd(MIG_A); if (!/ck_addr_assign_actor_shape/.test(m) || !/uidx_addr_assign_actor_primary/.test(m)) note('D2: migration da Fase A alterada/ausente'); }

// ── E. sem migration nova com dados (a Fase C não precisa de migration; se houver, sem seed) ──
{
  const migDir = join(ROOT, 'migrations');
  const cMigs = existsSync(migDir) ? readdirSync(migDir).filter((f) => /^2026071[3-9]\d{6}.*(actor_territorial_address|territorial_writer).*\.sql$/i.test(f)) : [];
  for (const f of cMigs) { const m = rd(join(migDir, f)); if (/INSERT INTO\s+public\.(address_assignments|addresses)\b/i.test(m)) note(`E1: migration ${f} faz seed de address/assignment (proibido)`); }
}

// ── F. WIRING ──
if (existsSync(RUNNER) && !/audit-actor-territorial-address-writer\.mjs/.test(rd(RUNNER))) note('F1: guard fora do runner');

if (failures.length) {
  console.error('GATE FAIL [actor-territorial-address-writer]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [actor-territorial-address-writer] — casa ÚNICA actor-territorial: service valida canRepresentActor(auth.tenant, auth.operator, actor) SEM engolir erro (tenant/operador server-side; input não traz tenant/owner_type/role/is_primary/actor_type/vigência); purpose→role derivado; transação atômica com advisory lock + release; idempotência obrigatória (idempotency_keys, requestHash/mismatch); evento na mesma tx; encerra+cria sem DELETE/reopen; repository privado exige PoolClient, não abre conexão, não valida autoridade, fixa owner_type=actor/actor_id; sem CEP/provider/findOrCreate/fallback/addressId-arbitrário/profile-company/actor_active_location; sem rota/frontend/Bank/Social; nenhum outro código do src cria actor-scoped; Fase A/N3 intactas.');
