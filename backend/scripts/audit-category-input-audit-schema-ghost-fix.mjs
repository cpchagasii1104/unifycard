#!/usr/bin/env node
// Guard estrutural — F-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST-FIX (DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST).
// category_input_audit NUNCA foi aplicada no schema vivo — categoryInputAuditService.log() sempre
// falhava em silêncio (try/catch próprio), para TODO context. Migration 20260702110000 aplica a
// tabela SEM canonical_id (FK para occupations_reference — tabela intencionalmente NÃO revivida,
// DT-CBO-MATCHER-DORMANT-LANDMINE Opção A) e SEM cbo_match_code/embedding_similarity (nenhum caller
// jamais os passava).
//
// MORDE:
//   (A) a migration de fix sumir ou deixar de criar a tabela;
//   (B) QUALQUER migration (a original ou uma NOVA) reintroduzir a FK para occupations_reference
//       (reativação da tabela que a Opção A decidiu não reviver);
//   (B2) QUALQUER migration (a original ou uma NOVA) reintroduzir canonical_id/cbo_match_code/
//        embedding_similarity como coluna REAL (CREATE TABLE ou ALTER TABLE ADD COLUMN);
//   (C) category-input-audit.service.ts voltar a referenciar canonicalId/cboMatchCode/
//       embeddingSimilarity (campos mortos reintroduzidos sem escritor real).
//
// ENDURECIDO (F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION, 2ª TRANCHE 2A): reconhecimento
// estrutural via sql-shape — antes o guard só lia o ÚNICO arquivo hardcoded da migration original
// (uma migration NOVA reintroduzindo a FK/colunas era 100% invisível) e usava regex sem flag
// case-insensitive nem schema-qualification/quoting (case/schema/aspas evadiam silenciosamente).
// Agora varre TODAS as migrations, reconhece CREATE/ALTER schema-qualified/quoted/case-insensitive
// via createsTarget/referencesTarget/tokenPresent, e cobre DDL dinâmico via extractExecuteLiterals.
// PRECISÃO (anti over-broadening): FK/coluna só mordem dentro de statements que CRIAM/ALTERAM a
// PRÓPRIA category_input_audit (createsTarget ou ALTER TABLE [ONLY] category_input_audit) — uma
// tabela DIFERENTE que apenas REFERENCIA category_input_audit (FK de saída) não dispara.
// Heurística textual comment-stripped/string-masked. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { stripSqlComments, maskStringLiterals, splitStatements, createsTarget, referencesTarget, extractExecuteLiterals, tokenPresent } from './lib/sql-shape.mjs';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const TARGET = 'category_input_audit';
const GHOST_FK = 'occupations_reference';
const DEAD_COLS = ['canonical_id', 'cbo_match_code', 'embedding_similarity'];

// estatuto "esta statement CRIA/ALTERA a própria TARGET" (não apenas a menciona/referencia).
function touchesTargetDDL(stmt, target) {
  if (createsTarget(stmt, target).hit) return true;
  const t = `(?:"?[A-Za-z_][\\w$]*"?\\s*\\.\\s*)?"?${target}"?`;
  return new RegExp(`\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?${t}\\b`, 'i').test(stmt);
}

// coluna definida como campo REAL (tipo SQL após o nome), quote-opcional, case-insensitive.
function columnDefined(text, col) {
  return new RegExp(`(?<![\\w$])"?${col}"?\\s+(?:UUID|VARCHAR|CHARACTER\\s+VARYING|NUMERIC|DECIMAL|TEXT|INTEGER|BIGINT|BOOLEAN)\\b`, 'i').test(text);
}

// varre statements (estáticos + EXECUTE resolvível) em busca de FK fantasma ou coluna morta.
function scanMigrationText(raw, fileLabel) {
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  for (const stmt of splitStatements(clean)) {
    if (!touchesTargetDDL(stmt, TARGET)) continue;
    if (referencesTarget(stmt, GHOST_FK, { mode: 'fk' }).hit) {
      failures.push(`${fileLabel}: RE-INTRODUZ FK ${TARGET} → ${GHOST_FK} (forma: FK inline/ADD CONSTRAINT, case/schema-qual/quoted) — DT-CBO-MATCHER-DORMANT-LANDMINE Opção A decidiu NÃO reviver.`);
    }
    for (const col of DEAD_COLS) {
      if (columnDefined(stmt, col)) {
        failures.push(`${fileLabel}: RE-INTRODUZ coluna morta ${col} em ${TARGET} (CREATE ou ALTER ADD COLUMN) — campo sem escritor real.`);
      }
    }
  }
  for (const u of extractExecuteLiterals(raw)) {
    const body = u.resolvableText;
    if (!body || !tokenPresent(body, TARGET)) continue;
    for (const bstmt of splitStatements(body)) {
      if (!touchesTargetDDL(bstmt, TARGET)) continue;
      if (referencesTarget(bstmt, GHOST_FK, { mode: 'fk' }).hit) {
        failures.push(`${fileLabel}: EXECUTE reintroduz FK ${TARGET} → ${GHOST_FK} em DDL dinâmico resolvível.`);
      }
      for (const col of DEAD_COLS) {
        if (columnDefined(bstmt, col)) {
          failures.push(`${fileLabel}: EXECUTE reintroduz coluna morta ${col} em ${TARGET} (DDL dinâmico resolvível).`);
        }
      }
    }
  }
}

// (A) migration original existe e cria a tabela — reconhecimento estrutural (case-insensitive,
// IF NOT EXISTS opcional, schema-qual/quoted) via createsTarget.
const MIGRATION_REL = join('migrations', '20260702110000_apply_category_input_audit.sql');
const MIGRATION = join(ROOT, MIGRATION_REL);
if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST reaberta.`);
} else {
  const raw = readFileSync(MIGRATION, 'utf-8');
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  if (!createsTarget(clean, TARGET).hit) {
    failures.push(`${MIGRATION_REL}: CREATE TABLE ${TARGET} não reconhecido (forma esperada: CREATE TABLE [IF NOT EXISTS] ${TARGET}).`);
  }
  scanMigrationText(raw, MIGRATION_REL);
}

// (B/B2) NENHUMA migration NOVA (qualquer outro arquivo) reintroduz a FK ou os campos mortos.
// ENDURECIDO: antes o guard NUNCA lia outro arquivo (blind spot total); agora varre migrations/.
const MIG_DIR = join(ROOT, 'migrations');
if (existsSync(MIG_DIR)) {
  for (const f of readdirSync(MIG_DIR).filter((e) => e.endsWith('.sql'))) {
    const rel = join('migrations', f);
    if (rel === MIGRATION_REL) continue; // já escaneada acima (histórico + original)
    const raw = readFileSync(join(MIG_DIR, f), 'utf-8');
    if (!tokenPresent(stripSqlComments(raw), TARGET)) continue; // fora do escopo (nem menciona a tabela)
    scanMigrationText(raw, rel);
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
console.log('GATE OK [category-input-audit-schema-ghost-fix] — category_input_audit aplicada sem reviver occupations_reference; campos mortos não reintroduzidos em NENHUMA migration (original ou nova, incl. DDL dinâmico); service sem os campos mortos. DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST blindada.');
