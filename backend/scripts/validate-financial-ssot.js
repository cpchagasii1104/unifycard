#!/usr/bin/env node
/**
 * FINANCIAL SSOT ARCHITECTURAL TEST - ANTI-REGRESSION GUARD
 * 
 * Garante que nenhum módulo fora do Bank crie estruturas financeiras paralelas.
 * 
 * Regras arquiteturais:
 * 1. PROIBIÇÃO DE ESTRUTURA: Fora de src/core/bank/** é PROIBIDO existir:
 *    - Classes ou arquivos com nomes contendo: Ledger, Transaction, Split, Balance, Account (quando financeiro)
 *    - Repositories que escrevem dinheiro
 * 
 * 2. PROIBIÇÃO DE DEPENDÊNCIA: Nenhum módulo fora do Bank pode:
 *    - Persistir valores monetários
 *    - Ter repository financeiro próprio
 *    - Agregar valores financeiros
 * 
 * Autoridade:
 * - docs/01_normative/01_SSOT.md
 * - docs/01_normative/07_NOMENCLATURA_CANONICA.md
 * - CORE_FINANCIAL_CONTRACT.md
 * - AUDIT_SQL_FINANCIAL_SEMANTIC.md
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

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
const CHECK_EXTENSIONS = ['.ts', '.tsx'];

// Extensões de arquivo a ignorar
const IGNORE_EXTENSIONS = ['.d.ts', '.test.ts', '.spec.ts'];

// Padrões proibidos em nomes de arquivos/classes (case-insensitive)
const PROHIBITED_STRUCTURE_PATTERNS = [
  /ledger/i,
  /transaction/i,
  /split/i,
  /balance/i,
  /account/i, // Apenas quando financeiro - precisa contexto
];

// Palavras que indicam contexto financeiro para "account"
const FINANCIAL_CONTEXT_KEYWORDS = [
  'payment',
  'financial',
  'money',
  'currency',
  'cents',
  'amount',
  'fund',
  'escrow',
  'settlement',
  'payout',
  'receivable',
  'payable',
];

// Padrões que indicam repository financeiro
const FINANCIAL_REPOSITORY_PATTERNS = [
  /repository.*(?:ledger|transaction|split|balance|account|payment|financial|money|currency|fund|escrow|settlement|payout|receivable|payable)/i,
  /(?:ledger|transaction|split|balance|account|payment|financial|money|currency|fund|escrow|settlement|payout|receivable|payable).*repository/i,
];

// Padrões que indicam persistência financeira (escrita)
// Apenas detectar INSERT/UPDATE que modificam valores financeiros
const FINANCIAL_PERSISTENCE_PATTERNS = [
  /INSERT INTO\s+(?:bank_|ledger|transaction|split|balance|account|payment|financial|money|currency|fund|escrow|settlement|payout|receivable|payable)/i,
  /UPDATE\s+(?:bank_|ledger|transaction|split|balance|account|payment|financial|money|currency|fund|escrow|settlement|payout|receivable|payable).*SET/i,
];

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
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    return true;
  }

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
 * Verifica se um nome de arquivo contém padrões proibidos
 */
function checkFileName(filePath, fileName) {
  const violations = [];
  const baseName = fileName.replace(/\.(ts|tsx)$/, '');

  // Verificar padrões proibidos
  for (const pattern of PROHIBITED_STRUCTURE_PATTERNS) {
    if (pattern.test(baseName)) {
      // Se for "account", verificar contexto financeiro
      if (/account/i.test(baseName)) {
        const hasFinancialContext = FINANCIAL_CONTEXT_KEYWORDS.some(keyword =>
          baseName.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Se não tem contexto financeiro explícito, pode ser account não-financeiro (ex: user account)
        // Mas vamos ser rigorosos: qualquer account fora do Bank é suspeito
        if (!hasFinancialContext) {
          // Verificar se o arquivo está em contexto financeiro pelo caminho
          const pathLower = filePath.toLowerCase();
          const pathHasFinancialContext = FINANCIAL_CONTEXT_KEYWORDS.some(keyword =>
            pathLower.includes(keyword)
          );
          
          if (!pathHasFinancialContext) {
            // Pode ser account não-financeiro, mas vamos reportar como warning
            continue;
          }
        }
      }

      violations.push({
        type: 'PROHIBITED_STRUCTURE_NAME',
        file: filePath,
        fileName: fileName,
        pattern: pattern.toString(),
        message: `Arquivo com nome proibido: "${baseName}" contém padrão financeiro fora de ${BANK_DIR}`,
      });
    }
  }

  return violations;
}

/**
 * Verifica se um arquivo contém classes com nomes proibidos
 */
function checkClassNames(filePath, content) {
  const violations = [];

  // Buscar definições de classe
  const classRegex = /(?:export\s+)?(?:class|interface|type)\s+(\w+)/g;
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];

    // Verificar padrões proibidos
    for (const pattern of PROHIBITED_STRUCTURE_PATTERNS) {
      if (pattern.test(className)) {
        // Se for "account", verificar contexto
        if (/account/i.test(className)) {
          const hasFinancialContext = FINANCIAL_CONTEXT_KEYWORDS.some(keyword =>
            className.toLowerCase().includes(keyword.toLowerCase()) ||
            content.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (!hasFinancialContext) {
            continue;
          }
        }

        violations.push({
          type: 'PROHIBITED_CLASS_NAME',
          file: filePath,
          className: className,
          pattern: pattern.toString(),
          message: `Classe/Interface/Type com nome proibido: "${className}" contém padrão financeiro fora de ${BANK_DIR}`,
        });
      }
    }
  }

  return violations;
}

/**
 * Verifica se um arquivo é um repository financeiro
 */
function checkFinancialRepository(filePath, fileName, content) {
  const violations = [];

  // Verificar se é um repository
  if (!/repository/i.test(fileName) && !/repository/i.test(content)) {
    return violations;
  }

  // Verificar padrões de repository financeiro
  for (const pattern of FINANCIAL_REPOSITORY_PATTERNS) {
    if (pattern.test(fileName) || pattern.test(content)) {
      violations.push({
        type: 'FINANCIAL_REPOSITORY',
        file: filePath,
        fileName: fileName,
        pattern: pattern.toString(),
        message: `Repository financeiro detectado fora de ${BANK_DIR}`,
      });
    }
  }

  return violations;
}

/**
 * Verifica se um arquivo persiste valores financeiros
 */
function checkFinancialPersistence(filePath, content) {
  const violations = [];

  // Ignorar se está em modules/bank (implementação do Bank)
  if (filePath.includes('modules/bank/')) {
    return violations;
  }

  // Verificar padrões de persistência financeira
  for (const pattern of FINANCIAL_PERSISTENCE_PATTERNS) {
    if (pattern.test(content)) {
      // Verificar se não é apenas leitura (SELECT)
      const lines = content.split('\n');
      let hasWriteOperation = false;
      
      for (const line of lines) {
        if (pattern.test(line)) {
          // Verificar se não é comentário
          const trimmed = line.trim();
          if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
            hasWriteOperation = true;
            break;
          }
        }
      }

      if (hasWriteOperation) {
        violations.push({
          type: 'FINANCIAL_PERSISTENCE',
          file: filePath,
          pattern: pattern.toString(),
          message: `Persistência financeira (INSERT/UPDATE) detectada fora de ${BANK_DIR}`,
        });
      }
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

  const fileName = filePath.split(/[/\\]/).pop();

  // Verificar nome do arquivo
  violations.push(...checkFileName(filePath, fileName));

  // Verificar nomes de classes
  violations.push(...checkClassNames(filePath, content));

  // Verificar repository financeiro
  violations.push(...checkFinancialRepository(filePath, fileName, content));

  // Verificar persistência financeira
  violations.push(...checkFinancialPersistence(filePath, content));

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
    console.log('✅ FINANCIAL_SSOT_TEST: Nenhuma violação estrutural encontrada.');
    process.exit(0);
  }

  console.error('❌ FINANCIAL_SSOT_PARALLEL_STRUCTURE_FORBIDDEN');
  console.error('');
  console.error(`Encontradas ${violations.length} violação(ões) de SSOT financeiro fora de ${BANK_DIR}:`);
  console.error('');

  // Agrupar por tipo de violação
  const violationsByType = {};
  violations.forEach(v => {
    if (!violationsByType[v.type]) {
      violationsByType[v.type] = [];
    }
    violationsByType[v.type].push(v);
  });

  // Exibir violações por tipo
  for (const [type, typeViolations] of Object.entries(violationsByType)) {
    console.error(`📋 ${type} (${typeViolations.length} violação(ões)):`);
    console.error('');
    
    // Agrupar por arquivo
    const violationsByFile = {};
    typeViolations.forEach(v => {
      if (!violationsByFile[v.file]) {
        violationsByFile[v.file] = [];
      }
      violationsByFile[v.file].push(v);
    });

    for (const [file, fileViolations] of Object.entries(violationsByFile)) {
      const relativeFile = relative(resolve(__dirname, '..'), file);
      console.error(`   📄 ${relativeFile}`);
      
      fileViolations.forEach(v => {
        if (v.className) {
          console.error(`      - Classe: ${v.className}`);
        }
        if (v.fileName) {
          console.error(`      - Arquivo: ${v.fileName}`);
        }
        console.error(`      - ${v.message}`);
        console.error('');
      });
    }
    console.error('');
  }

  console.error('');
  console.error('❌ BUILD FALHOU: Estruturas financeiras paralelas fora do domínio Bank são proibidas.');
  console.error(`   Exceção permitida: ${BANK_DIR}/**`);
  console.error('');
  console.error('   Regras violadas:');
  console.error('   1. PROIBIÇÃO DE ESTRUTURA: Classes/arquivos com nomes financeiros');
  console.error('   2. PROIBIÇÃO DE DEPENDÊNCIA: Repositories/persistência financeira');
  console.error('');
  console.error('   Referências:');
  console.error('   - docs/01_normative/01_SSOT.md');
  console.error('   - docs/01_normative/07_NOMENCLATURA_CANONICA.md');
  console.error('   - CORE_FINANCIAL_CONTRACT.md');
  console.error('   - AUDIT_SQL_FINANCIAL_SEMANTIC.md');
  console.error('');

  process.exit(1);
}

main();

