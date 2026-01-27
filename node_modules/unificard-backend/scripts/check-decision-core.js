#!/usr/bin/env node
/**
 * Script de validação do Decision Core
 * 
 * Verifica que não há uso de serviços legacy como decisão final:
 * - businessAuthorizationService.requirePermission
 * - businessAuthorizationService.checkPermission
 * - reputationService.getPermissions (quando usado em fluxo mutável)
 * - penaltyService.canPerformAction (quando usado em fluxo mutável)
 * 
 * Verifica que não há casts "as PermissionKey" (exceto os necessários)
 * 
 * Exit code:
 * - 0: Tudo OK
 * - 1: Violações encontradas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../src');
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'scripts',
  'tests',
  '__tests__',
  '.test.ts',
  '.spec.ts',
];

// Padrões proibidos
const PROHIBITED_PATTERNS = [
  {
    pattern: /businessAuthorizationService\.requirePermission\(/g,
    message: 'businessAuthorizationService.requirePermission() não pode ser usado. Use authorizationService.canActAs()',
    excludeInTests: false,
  },
  {
    pattern: /businessAuthorizationService\.checkPermission\(/g,
    message: 'businessAuthorizationService.checkPermission() não pode ser usado. Use authorizationService.canActAs()',
    excludeInTests: false,
  },
  {
    pattern: /reputationService\.getPermissions\(/g,
    message: 'reputationService.getPermissions() não pode ser usado como decisão. Use authorizationService.canActAs()',
    excludeInTests: false,
    // Permitir apenas em READ-MODEL (actor.repository.ts, rotas GET)
    allowInFiles: ['actor.repository.ts', 'social-2.0.routes.ts'],
  },
  {
    pattern: /penaltyService\.canPerformAction\(/g,
    message: 'penaltyService.canPerformAction() não pode ser usado como decisão. Use authorizationService.canActAs()',
    excludeInTests: false,
  },
];

// Casts proibidos (exceto os necessários)
const PROHIBITED_CASTS = [
  {
    pattern: /as PermissionKey/g,
    message: 'Cast "as PermissionKey" não é permitido. Use PermissionKey tipado diretamente.',
    excludeInTests: false,
    // Permitir apenas em arquivos específicos onde é necessário
    allowInFiles: ['permission-keys.ts', 'validate-permissions.ts'],
  },
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isTestFile(filePath) {
  return filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__');
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
    } else if (file.endsWith('.ts') && !shouldExcludeFile(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkFile(filePath, patterns, violations) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const isTest = isTestFile(filePath);
  const lines = content.split('\n');

  patterns.forEach(({ pattern, message, excludeInTests, allowInFiles }) => {
    if (excludeInTests && isTest) {
      return; // Pular arquivos de teste se excludeInTests = true
    }

    // Verificar se o arquivo está na lista de permitidos
    if (allowInFiles && allowInFiles.includes(fileName)) {
      return; // Pular arquivos permitidos
    }

    lines.forEach((line, index) => {
      // Ignorar linhas que são apenas comentários
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Verificar se o padrão está na linha (mas não em comentário)
      const lineWithoutComments = line.split('//')[0]; // Remover comentários inline
      if (pattern.test(lineWithoutComments)) {
        violations.push({
          file: filePath,
          line: index + 1,
          message,
          content: trimmedLine,
        });
      }
    });
  });
}

function main() {
  console.log('🔍 Verificando Decision Core hardening...\n');

  const files = findFiles(SRC_DIR);
  const violations = [];

  // Verificar padrões proibidos
  files.forEach(file => {
    checkFile(file, PROHIBITED_PATTERNS, violations);
  });

  // Verificar casts proibidos
  files.forEach(file => {
    checkFile(file, PROHIBITED_CASTS, violations);
  });

  if (violations.length > 0) {
    console.error('❌ Violações encontradas:\n');
    violations.forEach(({ file, line, message, content }) => {
      const relativePath = path.relative(SRC_DIR, file);
      console.error(`  ${relativePath}:${line}`);
      console.error(`    ${message}`);
      if (content) {
        console.error(`    Linha: ${content}\n`);
      } else {
        console.error('');
      }
    });
    console.error(`\nTotal: ${violations.length} violação(ões)`);
    process.exit(1);
  }

  console.log('✅ Nenhuma violação encontrada. Decision Core está hardened.');
  process.exit(0);
}

main();

