#!/usr/bin/env node
// Guard estrutural — EVENT-ENGINE-COMPLETION · C2a: event_staff (OperationalCommitment) reconciliado ao
// CONTRATO promulgado (docs/01_normative/operational_commitment_minimum_contract.md §3/§4/§5/§11).
// event_staff é O vínculo actor↔evento (materializar event_actors = realidade paralela, PROIBIDO §2).
//
// MORDE (regressão) se:
//   (A) event_staff perder as colunas de lifecycle (checked_in_at/checked_out_at/failure_reason, §3);
//   (B) o CHECK de status não cobrir o vocabulário canônico §4 (expected/checked_in/checked_out/failed);
//   (C) o aggregate perder as transições canônicas §5 (expected→checked_in|failed, checked_in→checked_out|failed;
//       checked_out/failed terminais);
//   (D) QUALQUER migration adicionar campo FINANCEIRO/avaliativo a event_staff (§3/§11: preço/valor/moeda/
//       pagamento/share/penalidade/reputação/score) — acoplamento econômico proibido.
// Estático (varre migrations + o aggregate, comment-stripped). NÃO altera runtime. Em regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const migDir = join(ROOT, 'migrations');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
const allSql = files.map((f) => ({ f, src: stripSql(readFileSync(join(migDir, f), 'utf-8')) }));

// (A) as 3 colunas de lifecycle são adicionadas a event_staff em ALGUMA migration.
const addsCol = (col) => allSql.some(({ src }) =>
  new RegExp(`ALTER TABLE event_staff[\\s\\S]*?ADD COLUMN[\\s\\S]*?\\b${col}\\b`, 'i').test(src) ||
  new RegExp(`CREATE TABLE[\\s\\S]{0,40}event_staff[\\s\\S]*?\\b${col}\\b[\\s\\S]*?\\);`, 'i').test(src));
for (const col of ['checked_in_at', 'checked_out_at', 'failure_reason']) {
  if (!addsCol(col)) failures.push(`(A) coluna de lifecycle '${col}' não é adicionada a event_staff (contrato §3).`);
}

// (B) o CHECK de status de event_staff MAIS RECENTE cobre o vocabulário §4.
let lastCheck = null;
for (const { src } of allSql) {
  const re = /ADD CONSTRAINT chk_event_staff_status\s*CHECK\s*\(status IN \(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(src)) !== null) lastCheck = m[1];
}
if (lastCheck === null) {
  failures.push('(B) CHECK chk_event_staff_status não encontrado.');
} else {
  for (const st of ['expected', 'checked_in', 'checked_out', 'failed']) {
    if (!new RegExp(`'${st}'`).test(lastCheck)) failures.push(`(B) CHECK de status não inclui o estado canônico '${st}' (contrato §4).`);
  }
}

// (C) aggregate com as transições canônicas §5.
const AGG = 'src/core/events/operational-commitments.aggregate.ts';
const ap = join(ROOT, AGG);
if (!existsSync(ap)) {
  failures.push(`aggregate ausente: ${AGG}`);
} else {
  const a = stripTs(readFileSync(ap, 'utf-8'));
  const m = a.match(/ALLOWED_TRANSITIONS[\s\S]*?\{([\s\S]*?)\}/);
  const body = m ? m[1] : '';
  if (!/expected\s*:\s*\[[^\]]*'checked_in'[^\]]*'failed'/.test(body) && !/expected\s*:\s*\[[^\]]*'failed'[^\]]*'checked_in'/.test(body))
    failures.push("(C) transição 'expected' → {checked_in, failed} ausente/alterada (§5).");
  if (!/checked_in\s*:\s*\[[^\]]*'checked_out'[^\]]*'failed'/.test(body) && !/checked_in\s*:\s*\[[^\]]*'failed'[^\]]*'checked_out'/.test(body))
    failures.push("(C) transição 'checked_in' → {checked_out, failed} ausente/alterada (§5).");
  if (!/checked_out\s*:\s*\[\s*\]/.test(body)) failures.push("(C) 'checked_out' deixou de ser terminal (§5).");
  if (!/failed\s*:\s*\[\s*\]/.test(body)) failures.push("(C) 'failed' deixou de ser terminal (§5).");
}

// (D) NENHUM campo financeiro/avaliativo em event_staff (§3/§11).
const FORBIDDEN = /(price|valor|amount|currency|moeda|payment|pagamento|share|split|penalty|penalidade|reputation|reputacao|score)/i;
for (const { f, src } of allSql) {
  const re = /ALTER TABLE event_staff[\s\S]*?ADD COLUMN[^;]*?(\w+)\s+(?:TEXT|INT|INTEGER|BIGINT|NUMERIC|DECIMAL|BOOLEAN|UUID|JSONB|TIMESTAMPTZ)/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (FORBIDDEN.test(m[1])) failures.push(`(D) ${f}: coluna financeira/avaliativa '${m[1]}' adicionada a event_staff — PROIBIDO (contrato §3/§11).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-staff-commitment-contract]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [event-staff-commitment-contract] — event_staff reconciliado ao contrato: colunas de lifecycle (checked_in_at/checked_out_at/failure_reason §3) presentes; CHECK de status cobre o vocabulário canônico §4 (expected/checked_in/checked_out/failed); aggregate mantém as transições §5 (checked_out/failed terminais); nenhum campo financeiro/avaliativo em event_staff (§3/§11). Vínculo puramente operacional (C2a).");
