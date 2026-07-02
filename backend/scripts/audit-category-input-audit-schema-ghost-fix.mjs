#!/usr/bin/env node
// Guard estrutural — F-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST-FIX (DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST).
// category_input_audit NUNCA foi aplicada no schema vivo — categoryInputAuditService.log() sempre
// falhava em silêncio (try/catch próprio), para TODO context. Migration 20260702110000 aplica a
// tabela SEM canonical_id (FK para occupations_reference — tabela intencionalmente NÃO revivida,
// DT-CBO-MATCHER-DORMANT-LANDMINE Opção A) e SEM cbo_match_code/embedding_similarity (nenhum caller
// jamais os passava).
//
// MORDE:
//   (A) a migration de fix sumir;
//   (B) a migration reintroduzir a FK para occupations_reference (reativação da tabela que a Opção A
//       decidiu não reviver);
//   (C) category-input-audit.service.ts voltar a referenciar canonicalId/cboMatchCode/
//       embeddingSimilarity (campos mortos reintroduzidos sem escritor real).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const failures = [];

// (A) migration existe.
const MIGRATION = join(ROOT, 'migrations', '20260702110000_apply_category_input_audit.sql');
if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST reaberta.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  if (!/CREATE TABLE IF NOT EXISTS category_input_audit/.test(sql)) {
    failures.push(`${MIGRATION}: CREATE TABLE category_input_audit não encontrado.`);
  }
  // (B) sem FK para occupations_reference.
  if (/REFERENCES\s+occupations_reference/.test(sql)) {
    failures.push(`${MIGRATION}: reintroduziu FK para occupations_reference — reativaria a tabela que a Opção A (DT-CBO-MATCHER-DORMANT-LANDMINE) decidiu NÃO reviver.`);
  }
  // Checa só dentro do bloco CREATE TABLE (não no COMMENT ON TABLE, que MENCIONA os nomes em prosa
  // explicando por que foram excluídos — string literal real, não definição de coluna).
  const createIdx = sql.indexOf('CREATE TABLE IF NOT EXISTS category_input_audit');
  const closeParenIdx = sql.indexOf(');', createIdx);
  const createBlock = createIdx >= 0 && closeParenIdx > createIdx ? sql.slice(createIdx, closeParenIdx) : '';
  if (/canonical_id\s+UUID/.test(createBlock) || /cbo_match_code\s+VARCHAR/.test(createBlock) || /embedding_similarity\s+NUMERIC/.test(createBlock)) {
    failures.push(`${MIGRATION}: CREATE TABLE reintroduziu canonical_id/cbo_match_code/embedding_similarity como coluna real — campos mortos sem escritor.`);
  }
}

// (C) service não referencia os campos mortos.
const SERVICE = join(ROOT, 'src', 'core', 'categories', 'category-input-audit.service.ts');
if (!existsSync(SERVICE)) {
  failures.push(`arquivo ausente: ${SERVICE}`);
} else {
  const src = stripTs(readFileSync(SERVICE, 'utf-8'));
  if (/canonicalId|cboMatchCode|embeddingSimilarity/.test(src)) {
    failures.push(`${SERVICE}: voltou a referenciar canonicalId/cboMatchCode/embeddingSimilarity — campos mortos reintroduzidos.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [category-input-audit-schema-ghost-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [category-input-audit-schema-ghost-fix] — category_input_audit aplicada sem reviver occupations_reference; campos mortos não reintroduzidos. DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST blindada.');
