#!/usr/bin/env node
// Guard estrutural — Trava 1: CLASSIFICAÇÃO/CONGELAMENTO DE AUTORIDADE DE SCHEMA (GO Clayton 2026-07-08).
//
// Consome scripts/schema-authority-classification.mjs (o manifesto) e MORDE se o código regredir para
// tratar cadáver / read-model / coluna-legada como fonte de verdade. NÃO altera runtime; heurística
// textual comment-stripped (não AST), no mesmo estilo dos demais guards de contenção.
//
// MORDE se:
//   1. surgir writer (INSERT/UPDATE) para tabela 'dead' (schedules/schedule_slots);
//   2. writer de tabela read_model/ssot com allowedWriters aparecer fora da allowlist;
//   3. tabela read_model for referenciada em resolver de identidade/autoridade (forbiddenInPaths);
//   4. UPDATE ... SET escrever coluna 'legacy' (rentable_resources.price_cents/pricing_unit) como autoridade;
//   5. writer de tabela bank_* (ssot financeiro) aparecer fora de allowedWriterDirs (modules/bank, core/bank).
//
// Escopo de varredura: src/ .ts de PRODUÇÃO. Exclui __tests__ e src/scripts (e2e/seed escrevem tabelas
// legitimamente em cenário de teste — não são runtime de produto).

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, sep, basename } from 'path';
import SCHEMA_AUTHORITY from './schema-authority-classification.mjs';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

// coleta arquivos .ts de produção (exclui testes e scripts e2e/seed)
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === '__tests__' || e === 'node_modules' || e === 'scripts') continue;
      walk(p, acc);
    } else if (e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.d.ts')) {
      acc.push({ rel: norm(p.slice(ROOT.length + 1)), src: stripTs(readFileSync(p, 'utf-8')) });
    }
  }
  return acc;
}

const files = existsSync(SRC) ? walk(SRC) : [];
const failures = [];
const writerRe = (t) => new RegExp(`INSERT\\s+INTO\\s+${t}\\b|UPDATE\\s+${t}\\s`, 'i');

for (const entry of SCHEMA_AUTHORITY) {
  const t = entry.table;

  // (4) coluna legada: proíbe UPDATE <table> SET ... price_cents/pricing_unit = ...
  if (entry.classification === 'legacy' && entry.columns) {
    const colAlt = entry.columns.join('|');
    const re = new RegExp(`UPDATE\\s+${t}\\s+SET[\\s\\S]{0,500}?(${colAlt})\\s*=`, 'i');
    for (const f of files) {
      if (re.test(f.src)) failures.push(`[legacy] ${f.rel}: escreve ${t}.{${entry.columns.join(',')}} como autoridade — use ${entry.replacement}.`);
    }
    continue;
  }

  const re = writerRe(t);

  // (5) SSOT financeiro: writer só em allowedWriterDirs
  if (entry.allowedWriterDirs) {
    for (const f of files) {
      if (re.test(f.src) && !entry.allowedWriterDirs.some((d) => f.rel.includes(d))) {
        failures.push(`[ssot-bank] ${f.rel}: escreve ${t} fora de {${entry.allowedWriterDirs.join(', ')}} — só o Bank escreve o SSOT financeiro.`);
      }
    }
  }

  // (1)(2) writer fora da allowlist (dead = allowlist vazia; read_model/ssot = allowlist nomeada)
  if (entry.allowedWriters) {
    for (const f of files) {
      if (re.test(f.src) && !entry.allowedWriters.includes(basename(f.rel))) {
        const tag = entry.classification === 'dead' ? 'dead-revival' : `${entry.classification}-writer`;
        failures.push(`[${tag}] ${f.rel}: escreve ${t} (classification=${entry.classification}) fora da allowlist [${entry.allowedWriters.join(', ') || 'VAZIA'}].`);
      }
    }
  }

  // (3) read_model referenciado em resolver de identidade/autoridade
  if (entry.forbiddenInPaths) {
    const refRe = new RegExp(`\\b${t}\\b`, 'i');
    for (const f of files) {
      if (entry.forbiddenInPaths.some((p) => f.rel.includes(p)) && refRe.test(f.src)) {
        failures.push(`[read-model-as-authority] ${f.rel}: referencia ${t} num resolver de identidade/autoridade — ${t} é ${entry.authority}, NÃO resolve identidade/actor/permissão.`);
      }
    }
  }
}

if (failures.length) {
  console.log('GATE FAIL [schema-authority-classification]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log('\n→ Verdade paralela / regressão de autoridade. Ajuste o writer, OU (se legítimo) atualize o manifesto scripts/schema-authority-classification.mjs com justificativa.');
  process.exit(1);
}
console.log(`GATE OK [schema-authority-classification] — ${SCHEMA_AUTHORITY.length} tabelas/colunas carimbadas (ssot/read_model/legacy/dead); nenhuma regressão: cadáveres sem writer, read-models fora de resolvers de identidade, Bank isolado, preço de locação só na SSOT.`);
