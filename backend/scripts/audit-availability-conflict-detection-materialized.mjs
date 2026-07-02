#!/usr/bin/env node
// Guard estrutural — F-AVAILABILITY-CONFLICT-DETECTION-STUB-FIX (DT-AVAILABILITY-CONFLICT-
// DETECTION-STUB).
//
// detect_availability_conflicts() era um STUB vazio (BEGIN RETURN; END) — sempre retornava zero
// linhas, então AVAILABILITY_CONFLICT_DETECTED nunca disparava e comentários afirmavam "trigger
// previne sobreposição" quando NENHUM trigger existia (falsa sensação de guarda). Materializada:
// overlap real de intervalo, escopo owner_type='user' + owner_id=actor (aviso pessoal, NÃO o guard
// de double-booking do prestador — esse é o advisory lock do confirm, já fechado em outra DT).
//
// MORDE:
//   (A) a migration que materializa a função sumir;
//   (B) a migration voltar a ser BEGIN RETURN; END (stub);
//   (C) os 3 comentários falsos "Trigger previne sobreposição" reaparecerem no repository sem a
//       correção honesta.
// Heurística textual comment-stripped + leitura de migration. Em validate:regression-guards.
// NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const failures = [];

// (A)/(B) migration existe e não é mais o stub.
const MIGRATION = join(ROOT, 'migrations', '20260702140000_materialize_availability_conflict_detection.sql');
if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — DT-AVAILABILITY-CONFLICT-DETECTION-STUB reaberta.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  if (!/CREATE OR REPLACE FUNCTION detect_availability_conflicts/.test(sql)) {
    failures.push(`${MIGRATION}: CREATE OR REPLACE FUNCTION detect_availability_conflicts ausente.`);
  }
  const bodyIdx = sql.indexOf('LANGUAGE plpgsql');
  const bodyBlock = bodyIdx >= 0 ? sql.slice(bodyIdx, bodyIdx + 1500) : '';
  if (/BEGIN\s+RETURN;\s+END;/.test(bodyBlock.replace(/\s+/g, ' '))) {
    failures.push(`${MIGRATION}: corpo da função voltou a ser o stub vazio (BEGIN RETURN; END).`);
  }
  if (!/RETURN QUERY/.test(bodyBlock)) {
    failures.push(`${MIGRATION}: função não tem RETURN QUERY — não parece materializada de verdade.`);
  }
  if (!/owner_type = 'user'/.test(bodyBlock)) {
    failures.push(`${MIGRATION}: função não restringe a owner_type='user' — escopo divergiu do único caller.`);
  }
}

// (C) comentários falsos corrigidos no repository.
const REPO = join(ROOT, 'src', 'core', 'availability', 'unified-availability.repository.ts');
if (!existsSync(REPO)) {
  failures.push(`arquivo ausente: ${REPO}`);
} else {
  const src = readFileSync(REPO, 'utf-8'); // NÃO stripado — o comentário é o próprio alvo.
  if (/Trigger previne sobreposição/.test(src)) {
    failures.push(`${REPO}: comentário falso "Trigger previne sobreposição" ainda presente — nenhum trigger existe.`);
  }
  if (!/DT-AVAILABILITY-CONFLICT-DETECTION-STUB/.test(src)) {
    failures.push(`${REPO}: nota de correção honesta (DT-AVAILABILITY-CONFLICT-DETECTION-STUB) ausente.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [availability-conflict-detection-materialized]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [availability-conflict-detection-materialized] — detect_availability_conflicts() materializada (overlap real, owner_type=user, aviso não-bloqueante); comentários falsos de "trigger" corrigidos. DT-AVAILABILITY-CONFLICT-DETECTION-STUB blindada.');
