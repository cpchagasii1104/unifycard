#!/usr/bin/env node
/**
 * validate-core-purity.mjs — GATE FASE 1 (modo log)
 *
 * Detecta sinais de contaminacao em backend/src/core/ conforme Hipotese #019:
 *   1. Imports de modules/ (inversao de dependencia)
 *   2. Uso de Fastify/HTTP (FastifyPluginAsync, FastifyRequest, FastifyReply, import.*fastify)
 *   3. SQL direto (pool.query, runQueryWithTenant, runQueriesWithTenant, db.query, INSERT INTO, UPDATE, DELETE FROM)
 *
 * Comportamento:
 *   - Modo log apenas: NAO falha o build, NAO bloqueia CI
 *   - Gera relatorio com: arquivo, linha, tipo de sinal detectado
 *   - Retorna exit code 0 sempre (modo log)
 *
 * Uso:
 *   node scripts/validate-core-purity.mjs
 *
 * Referencia normativa:
 *   - docs/decisions/HIPOTESES_DAS_36_HORAS_2026-05_v3.md (#019)
 *   - docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md (Lei de Soberania)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CORE_PATH = join(ROOT, 'backend', 'src', 'core');

const IGNORED_DIRS = new Set(['node_modules', 'dist', '__tests__', 'tests']);

/**
 * Normaliza path para comparacao (/ no Windows).
 */
function normPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Caminha recursivamente pelo diretorio coletando arquivos .ts
 */
function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return files;
  }
  for (const name of names) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.ts$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @typedef {{
 *   type: 'MODULES_IMPORT' | 'FASTIFY_HTTP' | 'SQL_DIRECT';
 *   file: string;
 *   line: number;
 *   code: string;
 *   description: string;
 * }} Violation
 */

/**
 * Regras de deteccao de contaminacao
 */
const RULES = [
  {
    type: 'MODULES_IMPORT',
    description: 'Import de modules/ em arquivo core/ (inversao de dependencia)',
    // Detecta: from '../modules/', from '../../modules/', from '@/modules/', etc.
    pattern: /from\s+['"][^'"]*modules\//,
  },
  {
    type: 'FASTIFY_HTTP',
    description: 'Uso de Fastify/HTTP em core/ (HTTP deve estar em routes/modules)',
    // Detecta: FastifyPluginAsync, FastifyRequest, FastifyReply, import.*fastify
    pattern: /\b(FastifyPluginAsync|FastifyRequest|FastifyReply|FastifyInstance)\b|from\s+['"]fastify['"]/,
  },
  {
    type: 'SQL_DIRECT',
    description: 'SQL direto em core/ (decisorio fora do dominio autorizado)',
    // Detecta: pool.query, runQueryWithTenant, runQueriesWithTenant, db.query
    // e tambem INSERT INTO, UPDATE (sem SET imediato pode ser falso positivo), DELETE FROM
    pattern: /\b(pool\.query|runQueryWithTenant|runQueriesWithTenant|db\.query)\b|\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i,
  },
];

/**
 * Excepcoes conhecidas (arquivos que tem razao legitima para o padrao)
 * Formato: { file: regex, types: ['TIPO1', 'TIPO2'] }
 */
const EXCEPTIONS = [
  // db.ts em core/ e o wrapper de conexao — nao e contaminacao
  { file: /core\/db\.ts$/, types: ['SQL_DIRECT'] },
  // migrate.ts e seed.ts sao ferramentas de infra
  { file: /core\/db\/migrate\.ts$/, types: ['SQL_DIRECT'] },
  { file: /core\/db\/seed\.ts$/, types: ['SQL_DIRECT'] },
  // schema-guard.ts valida schema
  { file: /core\/db\/schema-guard\.ts$/, types: ['SQL_DIRECT'] },
];

/**
 * Verifica se uma violacao esta em excecao conhecida
 */
function isException(file, type) {
  const normFile = normPath(file);
  for (const exc of EXCEPTIONS) {
    if (exc.file.test(normFile) && exc.types.includes(type)) {
      return true;
    }
  }
  return false;
}

/**
 * Analisa um arquivo e retorna lista de violacoes
 */
function analyzeFile(filePath) {
  const rel = normPath(relative(ROOT, filePath));
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  /** @type {Violation[]} */
  const violations = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Ignorar comentarios
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        // Verificar se esta em excecao
        if (isException(filePath, rule.type)) {
          continue;
        }

        violations.push({
          type: rule.type,
          file: rel,
          line: index + 1,
          code: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
          description: rule.description,
        });
      }
    }
  }

  return violations;
}

/**
 * Agrupa violacoes por tipo
 */
function groupByType(violations) {
  const groups = {
    MODULES_IMPORT: [],
    FASTIFY_HTTP: [],
    SQL_DIRECT: [],
  };
  for (const v of violations) {
    if (groups[v.type]) {
      groups[v.type].push(v);
    }
  }
  return groups;
}

/**
 * Agrupa violacoes por arquivo
 */
function groupByFile(violations) {
  const groups = {};
  for (const v of violations) {
    if (!groups[v.file]) {
      groups[v.file] = [];
    }
    groups[v.file].push(v);
  }
  return groups;
}

function main() {
  console.log('='.repeat(70));
  console.log('validate-core-purity.mjs — GATE FASE 1 (modo log)');
  console.log('Hipotese #019: Repurificacao da fronteira core/modules');
  console.log('='.repeat(70));
  console.log();

  // Verificar se diretorio core/ existe
  if (!existsSync(CORE_PATH)) {
    console.log(`[INFO] Diretorio core/ nao encontrado: ${CORE_PATH}`);
    console.log('[OK] Nenhuma violacao detectada (diretorio inexistente).');
    process.exit(0);
  }

  // Coletar todos os arquivos .ts em core/
  const files = walk(CORE_PATH);
  console.log(`[SCAN] ${files.length} arquivos .ts encontrados em backend/src/core/`);
  console.log();

  // Analisar cada arquivo
  /** @type {Violation[]} */
  const allViolations = [];
  for (const file of files) {
    const violations = analyzeFile(file);
    allViolations.push(...violations);
  }

  // Se nenhuma violacao
  if (allViolations.length === 0) {
    console.log('[OK] Nenhuma violacao de pureza detectada em core/.');
    console.log();
    console.log('CORE_PURITY_SUMMARY total=0 modules_import=0 fastify_http=0 sql_direct=0');
    process.exit(0);
  }

  // Agrupar e reportar
  const byType = groupByType(allViolations);
  const byFile = groupByFile(allViolations);

  console.log('[RELATORIO] Violacoes de pureza detectadas em core/');
  console.log('-'.repeat(70));
  console.log();

  // Resumo por tipo
  console.log('RESUMO POR TIPO DE SINAL:');
  console.log(`  MODULES_IMPORT (inversao de dependencia): ${byType.MODULES_IMPORT.length}`);
  console.log(`  FASTIFY_HTTP (HTTP em core/):             ${byType.FASTIFY_HTTP.length}`);
  console.log(`  SQL_DIRECT (SQL decisorio em core/):      ${byType.SQL_DIRECT.length}`);
  console.log();

  // Resumo por arquivo (top 10)
  const filesSorted = Object.entries(byFile)
    .map(([file, violations]) => ({ file, count: violations.length }))
    .sort((a, b) => b.count - a.count);

  console.log(`ARQUIVOS MAIS AFETADOS (${filesSorted.length} total):`);
  const top10 = filesSorted.slice(0, 10);
  for (const { file, count } of top10) {
    console.log(`  ${count.toString().padStart(3)} | ${file}`);
  }
  if (filesSorted.length > 10) {
    console.log(`  ... e mais ${filesSorted.length - 10} arquivos`);
  }
  console.log();

  // Detalhe por tipo
  console.log('-'.repeat(70));
  console.log('DETALHE POR TIPO:');
  console.log();

  for (const [type, violations] of Object.entries(byType)) {
    if (violations.length === 0) continue;

    const desc = RULES.find((r) => r.type === type)?.description || type;
    console.log(`--- ${type} (${violations.length}) ---`);
    console.log(`    ${desc}`);
    console.log();

    // Mostrar ate 20 por tipo para nao sobrecarregar
    const toShow = violations.slice(0, 20);
    for (const v of toShow) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.code}`);
      console.log();
    }
    if (violations.length > 20) {
      console.log(`  ... e mais ${violations.length - 20} ocorrencias`);
      console.log();
    }
  }

  // Linha de sumario para grep/CI
  console.log('-'.repeat(70));
  console.log('CORE_PURITY_SUMMARY ' +
    `total=${allViolations.length} ` +
    `modules_import=${byType.MODULES_IMPORT.length} ` +
    `fastify_http=${byType.FASTIFY_HTTP.length} ` +
    `sql_direct=${byType.SQL_DIRECT.length}`
  );
  console.log();

  // Modo log: sempre exit 0
  console.log('[MODO LOG] Este gate NAO bloqueia o build. Retornando exit code 0.');
  console.log('[NOTA] Para bloquear, adicionar flag --strict em versao futura.');
  process.exit(0);
}

main();
