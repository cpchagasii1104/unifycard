#!/usr/bin/env node
// Guard estrutural — FASE A · FUNDAÇÃO DO PAPEL TERRITORIAL CANÔNICO DO ACTOR.
// ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING.
// Pergunta própria: "a jurisdição territorial do Actor tem âncora FK-backed na CASA CANÔNICA
// (address_assignments), com owner_type='actor'/actor_id, coerência de forma, vigência, unicidade
// actor+role, coerência PF/PJ↔role por trigger que LÊ actor_type (não copia), e imutabilidade histórica;
// o resolver é read-only/explícito/sem fallback; nenhuma 3ª casa; vocabulário DB↔TS alinhado; nenhum
// writer actor-scoped aberto (trava fail-closed até Fase C); nada de CEP/Social/Bank/rota?"
// Integridade VERSIONADA (migration/arquivos/src). Parse/ausência = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);
const rd = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const MIG_DIR = join(ROOT, 'migrations');
const MIG = join(MIG_DIR, '20260713100000_actor_territorial_assignment_foundation.sql');
const RESOLVER = join(ROOT, 'src', 'core', 'location', 'actor-territorial-resolver.ts');
const TYPES = join(ROOT, 'src', 'core', 'location', 'location.types.ts');
const REPO = join(ROOT, 'src', 'core', 'location', 'location.repository.ts');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');

// strip de comentários SQL (-- e /* */) e JS/TS, string-aware simplificado para varredura textual.
function stripComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '-' && d === '-') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
  }
  return out;
}

// ── A. MIGRATION (versionada) ──
if (!existsSync(MIG)) {
  note('A0: migration da fundação actor-territorial ausente');
} else {
  const m = stripComments(rd(MIG));
  if (!/ALTER TABLE\s+public\.address_assignments\s+ADD COLUMN\s+actor_id\s+uuid[\s\S]*?REFERENCES\s+public\.actors\s*\(\s*id\s*\)/i.test(m)) note('A1: coluna actor_id FK-backed para actors(id) ausente');
  // A2 (N1) — 'actor' deve estar DENTRO do ARRAY do CHECK canônico address_assignments_owner_type_check,
  // não em ocorrência posterior (outro CHECK/trigger/string/comentário). Ancora ao constraint + extrai o ARRAY.
  {
    const ci = m.search(/ADD CONSTRAINT\s+address_assignments_owner_type_check\b/i);
    if (ci < 0) {
      note('A2: constraint address_assignments_owner_type_check ausente/renomeado');
    } else {
      const rest = m.slice(ci);
      const end = rest.indexOf(';');
      const stmt = end >= 0 ? rest.slice(0, end) : rest; // corpo do ALTER ... ADD CONSTRAINT (sem o ';' de outro bloco)
      const am = stmt.match(/owner_type\s*=\s*ANY\s*\(\s*ARRAY\s*\[([\s\S]*?)\]/i);
      if (!am) note('A2: CHECK canônico de owner_type não usa owner_type = ANY(ARRAY[...]) (contrato exige o ARRAY)');
      else if (!/'actor'/.test(am[1])) note("A2: literal 'actor' AUSENTE do ARRAY do CHECK canônico de owner_type (ocorrência externa ao ARRAY não conta)");
    }
  }
  if (!/ck_addr_assign_actor_shape[\s\S]*owner_type\s*=\s*'actor'\s+AND\s+actor_id\s+IS NOT NULL\s+AND\s+owner_id\s*=\s*actor_id/i.test(m)) note('A3: CHECK de forma actor-scoped (actor_id NOT NULL + owner_id=actor_id) ausente/fraca');
  if (!/ck_addr_assign_actor_shape[\s\S]*owner_type\s*<>\s*'actor'\s+AND\s+actor_id\s+IS NULL/i.test(m)) note('A3b: CHECK não proíbe actor_id em linha não-actor');
  if (!/ck_addr_assign_validity_order[\s\S]*valid_until_at\s+IS NULL\s+OR\s+valid_until_at\s*>\s*valid_from_at/i.test(m)) note('A4: CHECK de vigência (valid_until > valid_from) ausente');
  if (!/ck_addr_assign_actor_role[\s\S]*'RESIDENCE'[\s\S]*'OPERATIONAL'[\s\S]*'HQ'/i.test(m)) note('A5: CHECK de papéis territoriais actor-scoped (RESIDENCE/OPERATIONAL/HQ) ausente');
  if (!/CREATE UNIQUE INDEX\s+uidx_addr_assign_actor_primary[\s\S]*\(\s*actor_id\s*,\s*role\s*\)[\s\S]*WHERE\s+actor_id\s+IS NOT NULL\s+AND\s+is_primary\s*=\s*true\s+AND\s+valid_until_at\s+IS NULL/i.test(m)) note('A6: UNIQUE parcial de primary vigente por (actor_id, role) ausente');
  // coerência PF/PJ por trigger que LÊ actor_type e NÃO copia para a tabela
  if (!/fn_addr_assign_actor_role_coherence[\s\S]*SELECT\s+actor_type\s+INTO[\s\S]*FROM\s+public\.actors/i.test(m)) note('A7: trigger de coerência não lê actor_type de actors');
  if (!/RESIDENCE'\s+AND\s+v_type\s*<>\s*'user'/i.test(m)) note('A7b: coerência RESIDENCE⇒PF(user) ausente');
  if (!/OPERATIONAL','HQ'\)\s+AND\s+v_type\s*<>\s*'page'|role IN \('OPERATIONAL','HQ'\)\s+AND\s+v_type\s*<>\s*'page'/i.test(m)) note('A7c: coerência OPERATIONAL/HQ⇒PJ(page) ausente');
  if (/ADD COLUMN\s+actor_type/i.test(m)) note('A7d: migration copia actor_type para address_assignments (proibido — deve ler de actors)');
  // imutabilidade histórica actor-scoped
  if (!/fn_addr_assign_actor_immutability/i.test(m)) note('A8: trigger de imutabilidade ausente');
  if (!/TG_OP\s*=\s*'DELETE'[\s\S]*owner_type\s*=\s*'actor'[\s\S]*RAISE EXCEPTION/i.test(m)) note('A8b: DELETE de actor-scoped não bloqueado');
  if (!/valid_until_at\s+IS NOT NULL\s+AND\s+NEW\.valid_until_at\s+IS NULL[\s\S]*RAISE EXCEPTION/i.test(m)) note('A8c: reabertura (no-reopen) não bloqueada');
  if (!/NEW\.actor_id\s+IS DISTINCT FROM\s+OLD\.actor_id[\s\S]*RAISE EXCEPTION|IMMUTABLE/i.test(m)) note('A8d: imutabilidade de actor_id/address_id/role ausente');
  // NÃO cria 3ª casa; NÃO faz seed/assignment/address real; NÃO toca Bank/Social/split
  if (/CREATE TABLE[\s\S]*(actor_locations|actor_residences|actor_jurisdictions|actor_territor)/i.test(m)) note('A9: migration cria 3ª casa de jurisdição (proibido)');
  if (/INSERT INTO\s+public\.address_assignments/i.test(m)) note('A10: migration faz seed de assignment (proibido)');
  if (/INSERT INTO\s+public\.addresses|INSERT INTO\s+public\.(neighborhoods|cities|actors)\b/i.test(m)) note('A10b: migration faz seed de address/city/neighborhood/actor (proibido)');
  if (/bank_|regional_fund|treasury|ledger|split|social_/i.test(m)) note('A11: migration referencia Bank/Social/split (proibido)');
  if (/ALTER TABLE\s+public\.addresses\b/i.test(m)) note('A12: migration altera a tabela addresses (fora do escopo da Fase A)');
}

// só UMA migration nova nesta fatia
const migs = existsSync(MIG_DIR) ? readdirSync(MIG_DIR).filter((f) => /^2026071[3-9]\d{6}.*actor_territorial.*\.sql$/i.test(f)) : [];
if (migs.length > 1) note(`A13: mais de uma migration actor_territorial (${migs.length})`);

// ── B. RESOLVER (read-only, sem fallback) ──
if (!existsSync(RESOLVER)) {
  note('B0: resolver actor-territorial-resolver.ts ausente');
} else {
  const r = stripComments(rd(RESOLVER));
  if (!/resolveActorTerritory\s*\([\s\S]*?actorId\s*:\s*string/.test(r)) note('B1: resolver não recebe actorId explícito');
  // acesso a actors (RLS) deve ser via client tenant-scoped governado (não pool.query cru)
  if (/\bpool\.query\s*\(/.test(r)) note('B1b: resolver usa pool.query cru (tabela actors é RLS — use getClientWithTenant)');
  if (!/getClientWithTenant/.test(r)) note('B1c: resolver não usa client tenant-scoped governado');
  if (!/owner_type\s*=\s*'actor'/.test(r) || !/aa\.actor_id\s*=\s*\$1/.test(r)) note('B2: resolver não filtra owner_type=actor + actor_id explícito');
  if (!/is_primary\s*=\s*true/.test(r) || !/valid_until_at\s+IS NULL/.test(r)) note('B3: resolver não exige primary vigente');
  // sem WRITE
  if (/INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM/i.test(r)) note('B4: resolver contém escrita (deve ser read-only)');
  // sem fallback proibido
  if (/actor_active_location/i.test(r)) note('B5: resolver usa actor_active_location (proibido)');
  if (/\bprofiles?\b|\bcompanies?\b|company_id|profile_id|global_user_id|representante/i.test(r)) note('B6: resolver usa fallback profile/company/representante (proibido)');
  if (/cep|provider|display_text|enrich|bairro|geocod/i.test(r)) note('B7: resolver usa CEP/provider/texto (proibido)');
  if (/bank_|regional_fund|treasury|ledger|split|social_/i.test(r)) note('B8: resolver toca Bank/Social (proibido)');
  if (/router|\.(get|post|put|delete)\(|route/i.test(r)) note('B9: resolver expõe rota HTTP (proibido)');
  // estados honestos presentes
  for (const st of ['territorial_address_missing', 'canonical_city_missing', 'resolved_city_neighborhood_pending', 'resolved_city_and_neighborhood', 'actor_not_found']) {
    if (!r.includes(st)) note(`B10: estado honesto ausente: ${st}`);
  }
}

// ── C. VOCABULÁRIO DB↔TS (sem drift) ──
if (existsSync(TYPES)) {
  const t = rd(TYPES);
  const m = t.match(/AddressOwnerType\s*=\s*([^;]+);/);
  if (!m) note('C1: AddressOwnerType não encontrado');
  else { for (const v of ['actor', 'rentable_resource', 'actor_asset', 'company', 'profile', 'service_provider']) if (!m[1].includes(`'${v}'`)) note(`C1: AddressOwnerType não inclui '${v}' (drift DB↔TS)`); }
}

// ── D. TRAVA: actor-scoped só na CASA CANÔNICA (Fase C aberta = repository actor-territorial). ──
// O location.repository legado continua PROIBIDO de criar actor-scoped; a casa canônica da Fase C
// (actor-territorial-address.repository.ts) é a única exceção — a trava migra para o guard da Fase C.
const FASEC_REPO = join(ROOT, 'src', 'core', 'location', 'actor-territorial-address.repository.ts');
const FASEC_SVC = join(ROOT, 'src', 'core', 'location', 'actor-territorial-address-writer.service.ts');
// + ONBOARDING A1 (RFC A1-D): a prova DB do fluxo PF/residência ESPELHA a sequência actor-scoped da
//   Fase C dentro de uma transação com ROLLBACK (harness reversível, não writer de runtime). Exclusão
//   por CAMINHO EXATO — reconciliação nominal, sem afrouxar a varredura (idêntico ao precedente Fase C).
const ONB_DB_TEST = join(ROOT, 'src', 'scripts', 'test-actor-onboarding-address-db.ts');
if (existsSync(REPO)) {
  const repo = stripComments(rd(REPO));
  // o location.repository legado NÃO pode incluir a coluna actor_id nem owner_type='actor'
  const insBlocks = [...repo.matchAll(/INSERT INTO\s+address_assignments\s*\(([^)]*)\)/gi)];
  for (const b of insBlocks) if (/\bactor_id\b/i.test(b[1])) note('D1: location.repository legado INSERT em address_assignments inclui actor_id (só a casa canônica da Fase C pode)');
}
// varredura src: nenhuma ESCRITA actor-scoped fora do resolver (read) e da casa canônica da Fase C.
{
  const SRC = join(ROOT, 'src');
  const hits = [];
  const walk = (dir) => { for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.ts$/.test(f.name) && p !== RESOLVER && p !== FASEC_REPO && p !== FASEC_SVC && p !== ONB_DB_TEST) {
      const s = stripComments(rd(p));
      // escrita em address_assignments setando actor_id, ou passando owner_type literal 'actor' a um write
      if (/INSERT INTO\s+address_assignments[\s\S]{0,400}?actor_id/i.test(s)) hits.push(p + ' (INSERT actor_id)');
      if (/UPDATE\s+address_assignments[\s\S]{0,200}?SET[\s\S]{0,200}?actor_id/i.test(s)) hits.push(p + ' (UPDATE actor_id)');
    }
  } };
  if (existsSync(SRC)) walk(SRC);
  for (const h of hits) note(`D2: escrita actor-scoped em address_assignments fora do resolver — writer aberto antes da Fase C: ${h}`);
}

// ── E. WIRING ──
if (existsSync(RUNNER) && !/audit-actor-territorial-assignment-foundation\.mjs/.test(rd(RUNNER))) note('E1: guard fora do runner');

if (failures.length) {
  console.error('GATE FAIL [actor-territorial-assignment-foundation]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [actor-territorial-assignment-foundation] — Actor tem âncora territorial FK-backed na casa canônica (address_assignments.actor_id→actors, owner_type=actor com owner_id espelho), forma/vigência/papéis por CHECK, um primary vigente por (actor_id,role), coerência PF/PJ↔role por trigger que LÊ actor_type (não copia), imutabilidade histórica (sem update in-place/reopen/reprimary/delete). Resolver read-only, actor_id explícito, sem fallback (profile/company/actor_active_location/CEP/texto), sem write/rota/Bank/Social; estados honestos. Vocabulário DB↔TS alinhado. Nenhuma 3ª casa; nenhum seed; trava fail-closed (writers vivos não criam actor-scoped até a Fase C).');
