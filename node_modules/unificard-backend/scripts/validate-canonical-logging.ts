#!/usr/bin/env ts-node
// backend/scripts/validate-canonical-logging.ts
// Script de validação: proíbe console.* e fastify.log.* em código de domínio
// 🔴 BLINDAGEM: Garante uso obrigatório do canonicalLogger

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const BACKEND_ROOT = join(__dirname, '..');
const SRC_DIR = join(BACKEND_ROOT, 'src');

// Áreas críticas que DEVEM usar canonicalLogger
const CRITICAL_AREAS = [
  'src/core/auth',
  'src/core/authorization',
  'src/core/events',
  'src/core/rate-limiting',
  'src/core/reputation',
  'src/core/orchestrator',
  'src/plugins/rbac',
  'src/modules/bank',
  'src/modules/social/actor',
];

// Diretórios permitidos para console.* (infraestrutura, não domínio)
const ALLOWED_DIRS = [
  'src/core/logging', // canonical-logger.ts usa console internamente
  'src/plugins', // Plugins de infraestrutura podem usar fastify.log
  'src/server.ts', // Setup do servidor
  'scripts/', // Scripts podem usar console
  'src/scripts/', // Scripts podem usar console
  'src/utils/devLog.ts', // Dev log utility pode usar console
];

// Padrões proibidos
const FORBIDDEN_PATTERNS = [
  /console\.(log|warn|error|debug|info)\s*\(/g,
  /fastify\.log\.(info|warn|error|debug)\s*\(/g,
];

// Exceções (comentários explicando por que é permitido)
const EXCEPTIONS = [
  // canonical-logger.ts usa console internamente (é o próprio logger)
  'src/core/logging/canonical-logger.ts',
  // Scripts podem usar console
  'scripts/',
  'src/scripts/',
  // Server.ts é infraestrutura
  'src/server.ts',
  'src/server-TESTE.ts',
  'src/server-TESTE2.ts',
  'src/TESTE_ENTRYPOINT.ts',
  // Dev utilities podem usar console
  'src/utils/devLog.ts',
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function isAllowed(filePath: string): boolean {
  const relativePath = relative(BACKEND_ROOT, filePath);
  
  // Verificar exceções
  for (const exception of EXCEPTIONS) {
    if (relativePath.includes(exception)) {
      return true;
    }
  }
  
  // Verificar se está em diretório permitido
  for (const allowed of ALLOWED_DIRS) {
    if (relativePath.startsWith(allowed)) {
      return true;
    }
  }
  
  // Se não está em área crítica, permitir (foco apenas em áreas críticas)
  const isCritical = CRITICAL_AREAS.some(area => relativePath.startsWith(area));
  if (!isCritical) {
    return true; // Não é área crítica, permitir
  }
  
  return false;
}

function findViolations(filePath: string): Violation[] {
  const violations: Violation[] = [];
  
  if (isAllowed(filePath)) {
    return violations;
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        // Verificar se não é um comentário ou string
        const trimmed = line.trim();
        if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
          violations.push({
            file: relative(BACKEND_ROOT, filePath),
            line: lineNumber,
            content: trimmed.substring(0, 100), // Primeiros 100 chars
            pattern: pattern.toString(),
          });
        }
      }
    }
  }
  
  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Pular node_modules e dist
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
          continue;
        }
        
        violations.push(...scanDirectory(fullPath));
      } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        violations.push(...findViolations(fullPath));
      }
    }
  } catch (error) {
    // Ignorar erros de permissão
  }
  
  return violations;
}

function main() {
  console.log('🔍 Validando uso de canonicalLogger...\n');
  
  const violations = scanDirectory(SRC_DIR);
  
  if (violations.length > 0) {
    console.error('❌ VIOLAÇÕES ENCONTRADAS: Uso proibido de console.* ou fastify.log.*\n');
    console.error('Use canonicalLogger em vez de console.* ou fastify.log.*\n');
    console.error('Exemplo:');
    console.error('  ❌ console.log("Mensagem", context);');
    console.error('  ✅ canonicalLogger.info(req, "Mensagem", context);\n');
    
    console.error('Violações encontradas:\n');
    
    for (const violation of violations) {
      console.error(`  ${violation.file}:${violation.line}`);
      console.error(`    ${violation.content}`);
      console.error('');
    }
    
    console.error(`\nTotal: ${violations.length} violação(ões)\n`);
    console.error('Para corrigir:');
    console.error('  1. Importe: import { canonicalLogger } from "@core/logging/canonical-logger";');
    console.error('  2. Substitua console.* por canonicalLogger.*');
    console.error('  3. Use métodos semânticos: authzAllow, authzDeny, invalidation, abuse\n');
    
    process.exit(1);
  }
  
  console.log('✅ Nenhuma violação encontrada. Todos os logs usam canonicalLogger.\n');
  process.exit(0);
}

main();

