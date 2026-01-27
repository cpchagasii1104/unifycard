#!/usr/bin/env ts-node
/**
 * VALIDADOR ARQUITETURAL AUTOMÁTICO - UNIFICARD
 * 
 * Bloqueia PRs que violam regras arquiteturais imutáveis.
 * 
 * CONTRATO IMUTÁVEL: docs/USER_PROFILE_CONTRACT.md
 * 
 * Regras validadas:
 * 1. Perfil do Usuário não pode ser consultado por write side
 * 2. Perfil do Usuário não pode ser usado em decisões/limites/permissões
 * 3. Categorias no perfil devem ter evento versionado
 * 4. Dados do perfil não podem influenciar comportamento do sistema
 * 
 * Uso no CI:
 *   pnpm run validate:architectural
 * 
 * Exit codes:
 *   0 = Sem violações
 *   1 = Violação detectada (falha CI)
 * 
 * Comportamento:
 * - NÃO sugere workaround
 * - NÃO propõe exceção
 * - Quando houver dúvida, REJEITA
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface Violation {
  file: string;
  line: number;
  rule: string;
  classification: 'BLOCKS_FREEZE' | 'CRITICAL_VIOLATION' | 'STRUCTURAL_VIOLATION';
  code: string;
}

const violations: Violation[] = [];

// Diretórios de write side (não podem importar perfil)
const WRITE_SIDE_PATTERNS = [
  /src\/core\/economy\//,
  /src\/core\/ledger\//,
  /src\/modules\/work\//,
  /src\/modules\/events\//,
  /src\/core\/reputation\//,
  /src\/core\/plan\//,
];

// Padrões que indicam decisão/limite/permissão
const DECISION_PATTERNS = [
  /validateFeatureAccess|validateAccess|checkPermission|checkLimit|canAccess|hasPermission|isAllowed|isBlocked|shouldAllow|shouldBlock|mustHave|requires/,
  /getPermissions|getLimits|checkPolicy|resolvePolicy|applyPolicy/,
  /if.*plan|if.*tier|if.*category|if.*level|if.*premium|if.*pro|if.*enterprise/,
  /switch.*plan|switch.*tier|switch.*category/,
];

// Padrões de importação de perfil
const PROFILE_IMPORT_PATTERNS = [
  /from.*profile.*service|import.*profile.*service/,
  /getCompleteProfile|getProfile|CompleteProfile/,
  /profileService|profileProfessionalService|profilePhysicalService|profileLearningService/,
  /coreService\.getCompleteProfile/,
];

// Padrões de categorias sem versionamento
const CATEGORY_WITHOUT_VERSION_PATTERNS = [
  /metadata\.(interests|learnings|skills|categories)/,
  /global_users\.metadata/,
  /user_skills_categories/,
];

// Padrões de influência de comportamento
const BEHAVIOR_INFLUENCE_PATTERNS = [
  /if.*profile|switch.*profile|profile.*\?/,
  /profile.*\.(plan|tier|category|level|premium|risk|trust)/,
  /getUserPlan|getPlanFeatures/,
];

/**
 * Verifica se arquivo é TypeScript/JavaScript
 */
function isCodeFile(filePath: string): boolean {
  const ext = extname(filePath);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
}

/**
 * Verifica se arquivo está em write side
 */
function isWriteSide(filePath: string): boolean {
  return WRITE_SIDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Analisa arquivo em busca de violações
 */
function analyzeFile(filePath: string, content: string): void {
  const lines = content.split('\n');
  
  // REGRA 1: Write side não pode importar perfil
  if (isWriteSide(filePath)) {
    lines.forEach((line, index) => {
      if (PROFILE_IMPORT_PATTERNS.some(pattern => pattern.test(line))) {
        violations.push({
          file: filePath,
          line: index + 1,
          rule: 'REGRA 1: Write side não pode consultar Perfil do Usuário',
          classification: 'BLOCKS_FREEZE',
          code: line.trim(),
        });
      }
    });
  }
  
  // REGRA 2: Perfil não pode ser usado em decisões
  lines.forEach((line, index) => {
    const hasProfileImport = PROFILE_IMPORT_PATTERNS.some(pattern => pattern.test(line));
    const hasDecisionPattern = DECISION_PATTERNS.some(pattern => pattern.test(line));
    
    if (hasProfileImport && hasDecisionPattern) {
      violations.push({
        file: filePath,
        line: index + 1,
        rule: 'REGRA 2: Perfil do Usuário não pode ser usado em decisões/limites/permissões',
        classification: 'CRITICAL_VIOLATION',
        code: line.trim(),
      });
    }
  });
  
  // REGRA 3: Categorias sem versionamento
  lines.forEach((line, index) => {
    if (CATEGORY_WITHOUT_VERSION_PATTERNS.some(pattern => pattern.test(line))) {
      // Verificar se há evento versionado associado (buscar por event, version, rule_id)
      const hasVersioning = /event|version|rule_id|rule_version/.test(line);
      if (!hasVersioning) {
        violations.push({
          file: filePath,
          line: index + 1,
          rule: 'REGRA 3: Categorias no perfil devem ter evento versionado associado',
          classification: 'CRITICAL_VIOLATION',
          code: line.trim(),
        });
      }
    }
  });
  
  // REGRA 4: Dados do perfil influenciando comportamento
  lines.forEach((line, index) => {
    const hasProfileData = PROFILE_IMPORT_PATTERNS.some(pattern => pattern.test(line));
    const influencesBehavior = BEHAVIOR_INFLUENCE_PATTERNS.some(pattern => pattern.test(line));
    
    if (hasProfileData && influencesBehavior) {
      violations.push({
        file: filePath,
        line: index + 1,
        rule: 'REGRA 4: Dados do perfil não podem influenciar comportamento do sistema',
        classification: 'STRUCTURAL_VIOLATION',
        code: line.trim(),
      });
    }
  });
}

/**
 * Percorre diretório recursivamente
 */
function scanDirectory(dir: string): void {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      // Ignorar node_modules, dist, .git
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry.startsWith('.')) {
        continue;
      }
      
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && isCodeFile(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          analyzeFile(fullPath, content);
        } catch (error) {
          // Ignorar erros de leitura
        }
      }
    }
  } catch (error) {
    // Ignorar erros de acesso
  }
}

/**
 * Função principal
 */
function main(): void {
  console.log('🔍 VALIDADOR ARQUITETURAL - UNIFICARD');
  console.log('=====================================');
  console.log('📋 CONTRATO: docs/USER_PROFILE_CONTRACT.md');
  console.log('🔒 REGRAS IMUTÁVEIS - BLOQUEIO AUTOMÁTICO\n');
  
  const srcDir = join(process.cwd(), 'src');
  console.log(`📂 Escaneando: ${srcDir}\n`);
  
  scanDirectory(srcDir);
  
  if (violations.length === 0) {
    console.log('✅ Nenhuma violação arquitetural detectada\n');
    process.exit(0);
  }
  
  // Agrupar por classificação
  const blocksFreeze = violations.filter(v => v.classification === 'BLOCKS_FREEZE');
  const critical = violations.filter(v => v.classification === 'CRITICAL_VIOLATION');
  const structural = violations.filter(v => v.classification === 'STRUCTURAL_VIOLATION');
  
  console.log('❌ VIOLAÇÕES ARQUITETURAIS DETECTADAS\n');
  console.log(`🚫 Bloqueia Freeze: ${blocksFreeze.length}`);
  console.log(`🔴 Crítica: ${critical.length}`);
  console.log(`⚠️  Estrutural: ${structural.length}`);
  console.log(`📊 Total: ${violations.length}\n`);
  
  // Exibir violações
  violations.forEach((violation, index) => {
    const icon = violation.classification === 'BLOCKS_FREEZE' ? '🚫' :
                 violation.classification === 'CRITICAL_VIOLATION' ? '🔴' : '⚠️';
    
    console.log(`${icon} [${violation.classification}] ${violation.rule}`);
    console.log(`   Arquivo: ${violation.file}:${violation.line}`);
    console.log(`   Código: ${violation.code}`);
    console.log('');
  });
  
  // Gerar comentário para PR
  console.log('\n📝 COMENTÁRIO PARA PR:\n');
  console.log('---');
  console.log('## ❌ Violações Arquiteturais Detectadas\n');
  console.log('Este PR viola regras arquiteturais imutáveis do UnifiCard.\n');
  
  if (blocksFreeze.length > 0) {
    console.log('### 🚫 Bloqueia Freeze\n');
    blocksFreeze.forEach(v => {
      console.log(`- **${v.file}:${v.line}**: ${v.rule}`);
    });
    console.log('');
  }
  
  if (critical.length > 0) {
    console.log('### 🔴 Violação Crítica\n');
    critical.forEach(v => {
      console.log(`- **${v.file}:${v.line}**: ${v.rule}`);
    });
    console.log('');
  }
  
  if (structural.length > 0) {
    console.log('### ⚠️ Violação Estrutural\n');
    structural.forEach(v => {
      console.log(`- **${v.file}:${v.line}**: ${v.rule}`);
    });
    console.log('');
  }
  
  console.log('**Contrato Imutável:** `docs/USER_PROFILE_CONTRACT.md`');
  console.log('');
  console.log('**Regras Violadas:**');
  console.log('1. Perfil do Usuário é read model exclusivo');
  console.log('2. Write side não pode consultar perfil');
  console.log('3. Perfil não pode ser usado em decisões/limites/permissões');
  console.log('4. Categorias devem ter evento versionado');
  console.log('5. Dados do perfil não podem influenciar comportamento');
  console.log('');
  console.log('**Enforcement:**');
  console.log('- ❌ NÃO sugere workaround');
  console.log('- ❌ NÃO propõe exceção');
  console.log('- ✅ Quando houver dúvida, REJEITA\n');
  console.log('---\n');
  
  console.log('❌ CI FALHOU: Violações arquiteturais bloqueiam este PR\n');
  process.exit(1);
}

main();

