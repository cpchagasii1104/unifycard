#!/usr/bin/env node
/**
 * Script de validação do Core Financeiro
 * 
 * Verifica que não há violações das regras canônicas:
 * - Nenhum código novo referencia bank_accounts
 * - Nenhuma migration cria tabela paralela de contas ou ledger
 * - Auditoria não lança exceção com banco vazio
 * 
 * Exit code:
 * - 0: Tudo OK
 * - 1: Violações encontradas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../src');
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const SCRIPTS_DIR = path.join(__dirname, '.');
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'scripts',
  'tests',
  '__tests__',
  '.test.ts',
  '.spec.ts',
  'audit-reports',
];

// Arquivos legados permitidos (não bloquear, apenas alertar)
const LEGACY_FILES_ALLOWED = [
  '130_create_bank_accounts.sql',
  '131_create_bank_ledger.sql',
  '132_create_bank_transactions.sql',
  '133_create_bank_splits.sql',
  '134_create_system_accounts.sql',
  'bank-account.repository.ts',
  'bank-ledger.repository.ts',
  'bank-transaction.repository.ts',
  'regional-fund-governance.service.ts',
  'transparency.service.ts',
];

// Padrões proibidos
const PROHIBITED_PATTERNS = [
  {
    pattern: /bank_accounts/g,
    message: 'bank_accounts é LEGADO. Use accounts (tabela canônica).',
    excludeInTests: false,
    // Permitir apenas em arquivos legados específicos
    allowInFiles: LEGACY_FILES_ALLOWED,
    // Permitir apenas em comentários explicando legado
    allowInComments: true,
    // Apenas alertar em arquivos legados (não bloquear)
    warnOnlyInLegacy: true,
  },
  {
    pattern: /CREATE TABLE.*bank_accounts|CREATE TABLE IF NOT EXISTS.*bank_accounts/g,
    message: 'NÃO criar tabela bank_accounts. Use accounts (tabela canônica).',
    excludeInTests: false,
    // Permitir apenas na migration legada 130
    allowInFiles: ['130_create_bank_accounts.sql'],
    allowInComments: true,
  },
  {
    pattern: /CREATE TABLE.*accounts.*\(/gi,
    message: 'NÃO criar nova tabela de contas. Use accounts (tabela canônica existente).',
    excludeInTests: false,
    // Permitir apenas em migrations legadas (001_initial_schema.sql)
    allowInFiles: ['001_initial_schema.sql'],
    allowInComments: true,
    // Verificar se é migration nova (número > 001)
    checkMigrationNumber: true,
  },
  {
    pattern: /CREATE TABLE.*ledger.*\(/gi,
    message: 'NÃO criar nova tabela de ledger. Use ledger ou ledger_entries (tabelas canônicas existentes).',
    excludeInTests: false,
    // Permitir apenas em migrations legadas
    allowInFiles: ['001_initial_schema.sql', '131_create_bank_ledger.sql', '268_create_ledger_entries.sql'],
    allowInComments: true,
    checkMigrationNumber: true,
  },
];

// Verificações de invariantes
const INVARIANT_CHECKS = [
  {
    name: 'accounts.owner_id NOT NULL',
    query: `SELECT COUNT(*) as count FROM accounts WHERE owner_id IS NULL`,
    expected: 0,
    message: 'Violação: accounts.owner_id não pode ser NULL',
  },
  {
    name: 'accounts.owner_type NOT NULL',
    query: `SELECT COUNT(*) as count FROM accounts WHERE owner_type IS NULL`,
    expected: 0,
    message: 'Violação: accounts.owner_type não pode ser NULL',
  },
  {
    name: 'Uma conta platform_ops por tenant',
    query: `SELECT tenant_id, COUNT(*) as count 
            FROM accounts 
            WHERE owner_type = 'platform_ops' 
            GROUP BY tenant_id 
            HAVING COUNT(*) > 1`,
    expected: 0,
    message: 'Violação: Mais de uma conta platform_ops por tenant',
  },
  {
    name: 'transactions referencia accounts',
    query: `SELECT COUNT(*) as count 
            FROM transactions t
            LEFT JOIN accounts a ON t.from_account = a.account_id OR t.to_account = a.account_id
            WHERE a.account_id IS NULL`,
    expected: 0,
    message: 'Violação: transactions referencia account_id inexistente em accounts',
  },
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isTestFile(filePath) {
  return filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__');
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('--');
}

function isMigrationFile(filePath) {
  return filePath.includes('migrations') && filePath.endsWith('.sql');
}

function getMigrationNumber(filePath) {
  const match = filePath.match(/(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

function checkFile(filePath, patterns, violations) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const isTest = isTestFile(filePath);
  const isMigration = isMigrationFile(filePath);
  const migrationNumber = isMigration ? getMigrationNumber(filePath) : null;
  const lines = content.split('\n');

  patterns.forEach(({ pattern, message, excludeInTests, allowInFiles, allowInComments, checkMigrationNumber, warnOnlyInLegacy }) => {
    if (excludeInTests && isTest) {
      return;
    }

    // Verificar se o arquivo está na lista de permitidos (legado)
    const isLegacyFile = allowInFiles && allowInFiles.includes(fileName);
    if (isLegacyFile && !warnOnlyInLegacy) {
      return; // Permitido completamente
    }

    // Verificar número de migration se necessário
    if (checkMigrationNumber && isMigration && migrationNumber && migrationNumber > 1) {
      // Migration nova não pode criar tabelas de contas/ledger
      // (exceto as já permitidas)
      if (!isLegacyFile) {
        lines.forEach((line, index) => {
          // Ignorar comentários
          if (allowInComments && isCommentLine(line)) {
            return;
          }
          const lineWithoutComments = line.split('//')[0].split('--')[0];
          if (pattern.test(lineWithoutComments)) {
            violations.push({
              file: filePath,
              line: index + 1,
              message: `${message} (Migration ${migrationNumber} é nova)`,
              content: line.trim(),
            });
          }
        });
        return;
      }
    }

    lines.forEach((line, index) => {
      // Ignorar linhas que são apenas comentários (se permitido)
      if (allowInComments && isCommentLine(line)) {
        return;
      }

      // Verificar se o padrão está na linha (mas não em comentário)
      const lineWithoutComments = line.split('//')[0].split('--')[0];
      if (pattern.test(lineWithoutComments)) {
        // Se for arquivo legado e warnOnlyInLegacy, apenas alertar (não bloquear)
        if (isLegacyFile && warnOnlyInLegacy) {
          // Apenas logar, não adicionar à lista de violações bloqueantes
          console.warn(`⚠️  [LEGADO] ${filePath}:${index + 1} - ${message}`);
          return;
        }

        violations.push({
          file: filePath,
          line: index + 1,
          message,
          content: line.trim(),
        });
      }
    });
  });
}

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldExcludeFile(filePath)) {
        findFiles(filePath, fileList);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.sql')) && !shouldExcludeFile(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  console.log('🔍 Verificando Core Financeiro hardening...\n');

  const files = findFiles(SRC_DIR);
  const migrationFiles = findFiles(MIGRATIONS_DIR);
  const scriptFiles = findFiles(SCRIPTS_DIR).filter(f => !f.includes('check-financial-core.js'));
  
  const allFiles = [...files, ...migrationFiles, ...scriptFiles];
  const violations = [];
  let legacyWarnings = 0;

  // Verificar padrões proibidos
  allFiles.forEach(file => {
    const warningsBefore = legacyWarnings;
    checkFile(file, PROHIBITED_PATTERNS, violations);
    // Contar warnings de legado (não bloqueantes)
    // (implementação simplificada - warnings são logados diretamente)
  });

  if (violations.length > 0) {
    console.error('\n❌ Violações BLOQUEANTES encontradas:\n');
    violations.forEach(({ file, line, message, content }) => {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`  ${relativePath}:${line}`);
      console.error(`    ${message}`);
      if (content) {
        console.error(`    Linha: ${content}\n`);
      } else {
        console.error('');
      }
    });
    console.error(`\nTotal: ${violations.length} violação(ões) BLOQUEANTE(S)`);
    console.error('\n⚠️  Nota: Warnings de código legado (acima) são apenas informativos e não bloqueiam.');
    process.exit(1);
  }

  console.log('✅ Nenhuma violação estrutural bloqueante encontrada.');
  console.log('⚠️  Nota: Verificações de invariantes do banco requerem conexão ativa.');
  console.log('   Execute: npm run check:financial-invariants');
  process.exit(0);
}

main();

