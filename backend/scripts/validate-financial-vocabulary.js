#!/usr/bin/env node
/**
 * FINANCIAL VOCABULARY LINT - ANTI-REGRESSION GUARD
 * 
 * Impede que código fora de src/core/bank/** use vocabulário financeiro.
 * 
 * Palavras proibidas (case-insensitive):
 * - balance, available, saldo
 * - paid, settled, refunded, refund, payout
 * - receivable, payable
 * - ledger, split, transaction
 * - amount, value_cents, total_cents
 * 
 * Autoridade: docs/01_normative/07_NOMENCLATURA_CANONICA.md
 *             docs/01_normative/01_SSOT.md
 *             CORE_FINANCIAL_CONTRACT.md
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

// Palavras proibidas (case-insensitive)
const PROHIBITED_WORDS = [
  'balance',
  'available',
  'saldo',
  'paid',
  'settled',
  'refunded',
  'refund',
  'payout',
  'receivable',
  'payable',
  'ledger',
  'split',
  'transaction',
  'amount',
  'value_cents',
  'total_cents',
];

// Diretório permitido (exceção)
const BANK_DIR = 'src/core/bank';

// Diretórios a ignorar
const IGNORE_DIRS = [
  'node_modules',
  'dist',
  '.git',
  'migrations', // SQL migrations são permitidas
];

// Extensões de arquivo a verificar
const CHECK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Extensões de arquivo a ignorar
const IGNORE_EXTENSIONS = ['.d.ts', '.test.ts', '.spec.ts'];

/**
 * Verifica se um arquivo está no diretório Bank permitido
 */
function isInBankDir(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes(`/${BANK_DIR}/`);
}

/**
 * Verifica se um arquivo deve ser ignorado
 */
function shouldIgnoreFile(filePath) {
  // Ignorar arquivos de teste (opcional: apenas warning)
  // Por enquanto, vamos bloquear também para ser mais rigoroso
  // if (filePath.includes('.test.') || filePath.includes('.spec.')) {
  //   return true;
  // }

  // Ignorar arquivos .d.ts
  if (filePath.endsWith('.d.ts')) {
    return true;
  }

  return false;
}

/**
 * Verifica se um diretório deve ser ignorado
 */
function shouldIgnoreDir(dirName) {
  return IGNORE_DIRS.some(ignore => dirName.includes(ignore));
}

/**
 * Verifica se uma linha é apenas um comentário
 */
function isCommentOnly(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

/**
 * Encontra todas as palavras proibidas em uma linha
 */
function findProhibitedWords(line, lineNumber) {
  const violations = [];
  
  // Ignorar linhas que são apenas comentários (mas ainda verificar comentários inline)
  // Comentários podem conter vocabulário financeiro em documentação, mas vamos ser rigorosos
  const lowerLine = line.toLowerCase();

  for (const word of PROHIBITED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerLine)) !== null) {
      violations.push({
        word: word,
        column: match.index + 1,
        lineNumber: lineNumber,
        line: line.trim(),
      });
    }
  }

  return violations;
}

/**
 * Verifica um arquivo por violações
 */
function checkFile(filePath) {
  if (shouldIgnoreFile(filePath)) {
    return [];
  }

  // Se está no diretório Bank, permitir
  if (isInBankDir(filePath)) {
    return [];
  }

  const violations = [];
  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error.message);
    return [];
  }

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineViolations = findProhibitedWords(line, index + 1);
    violations.push(...lineViolations.map(v => ({
      ...v,
      file: filePath,
    })));
  });

  return violations;
}

/**
 * Percorre recursivamente um diretório
 */
function walkDirectory(dirPath, baseDir) {
  const violations = [];
  let entries;

  try {
    entries = readdirSync(dirPath);
  } catch (error) {
    console.error(`Erro ao ler diretório ${dirPath}:`, error.message);
    return violations;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const relativePath = relative(baseDir, fullPath);

    // Ignorar diretórios específicos
    if (shouldIgnoreDir(relativePath)) {
      continue;
    }

    let stats;
    try {
      stats = statSync(fullPath);
    } catch (error) {
      continue;
    }

    if (stats.isDirectory()) {
      violations.push(...walkDirectory(fullPath, baseDir));
    } else if (stats.isFile()) {
      const ext = entry.substring(entry.lastIndexOf('.'));
      if (CHECK_EXTENSIONS.includes(ext) && !IGNORE_EXTENSIONS.some(ignore => entry.includes(ignore))) {
        violations.push(...checkFile(fullPath));
      }
    }
  }

  return violations;
}

/**
 * Função principal
 */
function main() {
  const srcDir = resolve(__dirname, '..', 'src');
  const violations = walkDirectory(srcDir, resolve(__dirname, '..'));

  if (violations.length === 0) {
    console.log('✅ FINANCIAL_VOCABULARY_LINT: Nenhuma violação encontrada.');
    process.exit(0);
  }

  console.error('❌ FINANCIAL_VOCABULARY_OUTSIDE_BANK_FORBIDDEN');
  console.error('');
  console.error(`Encontradas ${violations.length} violação(ões) de vocabulário financeiro fora de ${BANK_DIR}:`);
  console.error('');

  // Agrupar por arquivo
  const violationsByFile = {};
  violations.forEach(v => {
    if (!violationsByFile[v.file]) {
      violationsByFile[v.file] = [];
    }
    violationsByFile[v.file].push(v);
  });

  // Exibir violações
  for (const [file, fileViolations] of Object.entries(violationsByFile)) {
    const relativeFile = relative(resolve(__dirname, '..'), file);
    console.error(`📄 ${relativeFile}`);
    
    fileViolations.forEach(v => {
      console.error(`   Linha ${v.lineNumber}, coluna ${v.column}: "${v.word}"`);
      console.error(`   ${v.line}`);
      console.error('');
    });
  }

  console.error('');
  console.error('❌ BUILD FALHOU: Vocabulário financeiro fora do domínio Bank é proibido.');
  console.error(`   Exceção permitida: ${BANK_DIR}/**`);
  console.error('');
  console.error('   Referências:');
  console.error('   - docs/01_normative/07_NOMENCLATURA_CANONICA.md');
  console.error('   - docs/01_normative/01_SSOT.md');
  console.error('   - CORE_FINANCIAL_CONTRACT.md');
  console.error('');

  process.exit(1);
}

main();

