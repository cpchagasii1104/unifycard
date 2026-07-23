#!/usr/bin/env node
// Guard estrutural — F-PERFORMER-AUDIENCE-RANGE: FAIXA DE PÚBLICO preferida (audience_min/audience_max) da oferta
// do performer. É PREFERÊNCIA/CONFORTO que alimenta a DESCOBERTA — DISTINTA de conditions.audience_capacity
// (alcance do EQUIPAMENTO/som próprio). Colunas REAIS (SQL-filtráveis), CHECK-governed (não enum). Bank-free.
//
// MORDE (regressão) se:
//   (A) a migration sumir, ou perder as colunas REAIS audience_min/audience_max (>0), ou o CHECK físico
//       chk_service_offering_audience_range (min<=max), ou virar enum type (§4.9.7), ou ganhar token FINANCEIRO;
//   (B) o writer perder assertAudienceRange (both-or-neither + int>0 + min<=max) OU deixar de chamá-lo em
//       createOffering (validate-before-mutate §4.9.5);
//   (C) a DISTINÇÃO entre audience_capacity (equipamento) e audience_min/max (preferência) for perdida — i.e.
//       o writer parar de manter assertAudienceCapacity ao lado de assertAudienceRange (merge dos dois eixos §2);
//   (D) o predicado de descoberta (services.repository) parar de casar por CONTÉM-N nas COLUNAS
//       (audience_min <= N AND audience_max >= N);
//   (E) o guard não estiver registrado no runner (anti-drift).
// Estático, comment-stripped, region-anchored. Em regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

// ── (A) MIGRATION: colunas REAIS + CHECK-governed (min<=max) + >0 + não-enum + Bank-free ──
const migDir = join(ROOT, 'migrations');
let mig = null;
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (/ADD COLUMN IF NOT EXISTS audience_min\b/i.test(src) && /ADD COLUMN IF NOT EXISTS audience_max\b/i.test(src)) { mig = src; break; }
}
if (mig === null) {
  failures.push('(A) migration de audience_min/audience_max ausente — faixa de público sumiu (colunas REAIS).');
} else {
  if (!/audience_min INTEGER/i.test(mig)) failures.push('(A) audience_min não é INTEGER (coluna REAL — não JSONB).');
  if (!/audience_max INTEGER/i.test(mig)) failures.push('(A) audience_max não é INTEGER (coluna REAL — não JSONB).');
  if (!/audience_min IS NULL OR audience_min > 0/i.test(mig)) failures.push('(A) CHECK audience_min > 0 ausente.');
  if (!/audience_max IS NULL OR audience_max > 0/i.test(mig)) failures.push('(A) CHECK audience_max > 0 ausente.');
  if (!/chk_service_offering_audience_range/i.test(mig)) failures.push('(A) CHECK físico chk_service_offering_audience_range ausente.');
  if (!/audience_min IS NULL OR audience_max IS NULL OR audience_min <= audience_max/i.test(mig.replace(/\s+/g, ' ')))
    failures.push('(A) predicado do CHECK de faixa não confere (min<=max quando ambos presentes).');
  if (/CREATE TYPE|AS ENUM/i.test(mig)) failures.push('(A) vocabulário via enum type proibido — a faixa é coluna/CHECK, não enum (§4.9.7).');
  // Bank-free: nenhum token financeiro na migration (público = contagem de pessoas, nunca dinheiro).
  if (/\b(price|cents|amount|fee|_bps|tax|money|payout|ledger|wallet)\b/i.test(mig))
    failures.push('(A) token FINANCEIRO na migration — a fatia é Bank-free (público = pessoas, não dinheiro).');
}

// ── (B)/(C) WRITER: assertAudienceRange (both-or-neither + int>0 + min<=max), chamado em create; DISTINÇÃO mantida ──
const SVC = 'src/modules/services/service-offering.service.ts';
const wp = join(ROOT, SVC);
if (!existsSync(wp)) {
  failures.push(`writer ausente: ${SVC}`);
} else {
  const w = stripTs(readFileSync(wp, 'utf-8'));
  if (!/function assertAudienceRange\b/.test(w)) failures.push('(B) validador assertAudienceRange ausente.');
  // both-or-neither + faixa bem-formada codificados por CODE (não string solta).
  if (!/SERVICE_OFFERING_AUDIENCE_RANGE_INCOMPLETE/.test(w)) failures.push('(B) both-or-neither (SERVICE_OFFERING_AUDIENCE_RANGE_INCOMPLETE) ausente.');
  if (!/SERVICE_OFFERING_AUDIENCE_RANGE_INVALID/.test(w)) failures.push('(B) min<=max (SERVICE_OFFERING_AUDIENCE_RANGE_INVALID) ausente.');
  if (!/SERVICE_OFFERING_AUDIENCE_MIN_INVALID/.test(w) || !/SERVICE_OFFERING_AUDIENCE_MAX_INVALID/.test(w))
    failures.push('(B) validação int>0 dos extremos (AUDIENCE_MIN/MAX_INVALID) ausente.');
  // validate-before-mutate: createOffering chama assertAudienceRange antes do INSERT.
  if (!/assertAudienceRange\(input\)/.test(w)) failures.push('(B) createOffering não chama assertAudienceRange(input) — validate-before-mutate (§4.9.5).');
  // colunas REAIS carregadas no SELECT/INSERT (não some no shape).
  if (!/audience_min, audience_max/.test(w)) failures.push('(B) SO_SELECT/INSERT não carregam audience_min/audience_max (colunas REAIS somem do shape).');
  // (C) DISTINÇÃO §2: os DOIS eixos coexistem no writer — audience_capacity (equipamento) e audience_range (preferência).
  if (!/function assertAudienceCapacity\b/.test(w) || !/SERVICE_OFFERING_CAPACITY_INVALID/.test(w))
    failures.push('(C) assertAudienceCapacity (equipamento) sumiu — a distinção equipamento×preferência foi perdida (§2).');
  // guarda anti-merge: nenhum código pode ler audience_min/max de dentro de conditions (fundiria os eixos).
  if (/conditions[\s\S]{0,20}audience_min|conditions[\s\S]{0,20}audience_max/i.test(w))
    failures.push('(C) faixa de público lida de conditions — eixos equipamento×preferência fundidos (§2 verdade duplicada).');
}

// ── (D) DISCOVERY: predicado casa por CONTÉM-N nas COLUNAS REAIS ──
const REPO = 'src/modules/services/services.repository.ts';
const rp = join(ROOT, REPO);
if (!existsSync(rp)) {
  failures.push(`repository ausente: ${REPO}`);
} else {
  const r = stripTs(readFileSync(rp, 'utf-8'));
  if (!/audienceSize/.test(r)) failures.push('(D) filtro audienceSize ausente no discoverServices.');
  const norm = r.replace(/\s+/g, ' ');
  if (!/so_a\.audience_min <= \$\$\{paramIndex\} AND so_a\.audience_max >= \$\$\{paramIndex\}/.test(norm) &&
      !/audience_min <= \$[\s\S]{0,30}audience_max >= \$/i.test(norm))
    failures.push('(D) predicado CONTÉM-N (audience_min <= N AND audience_max >= N) nas colunas ausente.');
}

// ── (E) wiring: guard registrado no runner (anti-drift) ──
const runnerP = join(ROOT, 'scripts', 'run-regression-guards.mjs');
if (existsSync(runnerP)) {
  const runner = readFileSync(runnerP, 'utf-8');
  if (!/audit-offering-audience-range\.mjs/.test(runner)) failures.push('(E) run-regression-guards.mjs: guard não registrado em CMDS[] (anti-drift).');
}

// universo sanity (fail-closed se scripts dir sumir)
if (!existsSync(join(ROOT, 'scripts')) || readdirSync(join(ROOT, 'scripts')).length === 0) failures.push('scripts/ vazio/ausente — fail-closed.');

if (failures.length > 0) {
  console.error('GATE FAIL [offering-audience-range]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [offering-audience-range] — F-PERFORMER-AUDIENCE-RANGE: faixa de público preferida em colunas REAIS (audience_min/audience_max, CHECK-governed min<=max e >0, não enum); writer assertAudienceRange (both-or-neither + int>0 + min<=max, validate-before-mutate); DISTINTA de audience_capacity (equipamento) — eixos não fundidos (§2); descoberta casa por CONTÉM-N nas colunas; Bank-free.');
