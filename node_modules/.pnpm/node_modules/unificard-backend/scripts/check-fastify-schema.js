#!/usr/bin/env node
/**
 * CI Check: Fastify Schema Validation
 * 
 * This script enforces the architectural rule:
 * - Fastify routes MUST NOT define a `schema` field
 * - All validation must be done manually inside handlers using Zod
 * 
 * This is a fast, grep-based check that scans route files.
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join, extname, relative } = require('path');

const BACKEND_DIR = join(__dirname, '..');
const SRC_DIR = join(BACKEND_DIR, 'src');
const FORBIDDEN_PATTERN = /\bschema\s*:/;
const FASTIFY_METHOD_PATTERN = /fastify\.(post|put|patch|delete|get)\s*\(/;

function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (extname(file) === '.ts') {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function checkFile(filePath) {
  const violations = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Only check files that contain Fastify route definitions
  if (!FASTIFY_METHOD_PATTERN.test(content)) {
    return violations;
  }

  // More precise check: look for fastify.method(..., { schema: pattern
  // This regex looks for fastify.method followed by schema: within reasonable distance
  const routeWithSchemaPattern = /fastify\.(post|put|patch|delete|get)\s*\([^)]*\{[^}]*schema\s*:/s;
  
  if (routeWithSchemaPattern.test(content)) {
    // Find the specific lines
    lines.forEach((line, index) => {
      if (FORBIDDEN_PATTERN.test(line)) {
        // Check if this schema: is part of a route definition
        // Look backwards for fastify.method and forwards/backwards for route structure
        const contextStart = Math.max(0, index - 30);
        const contextEnd = Math.min(lines.length, index + 10);
        const context = lines.slice(contextStart, contextEnd).join('\n');
        
        // Check if there's a fastify method before and this looks like a route config object
        const hasFastifyMethod = FASTIFY_METHOD_PATTERN.test(context);
        const looksLikeRouteConfig = /fastify\.(post|put|patch|delete|get)\s*\([^)]*\{[\s\S]{0,500}schema\s*:/s.test(
          lines.slice(Math.max(0, index - 30), Math.min(lines.length, index + 10)).join('\n')
        );
        
        // Exclude false positives: schema as a property name (not route config)
        const isPropertyName = /:\s*(dbInfo\.|currentSchema|\.schema\s*[,}])/.test(line);
        
        if (hasFastifyMethod && looksLikeRouteConfig && !isPropertyName) {
          violations.push({
            file: relative(BACKEND_DIR, filePath),
            line: index + 1,
            content: line.trim(),
          });
        }
      }
    });
  }

  return violations;
}

function main() {
  console.log('🔍 Checking for Fastify schema violations...\n');

  const allFiles = getAllTsFiles(SRC_DIR);
  const allViolations = [];

  for (const file of allFiles) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error('❌ FASTIFY SCHEMA VALIDATION VIOLATIONS FOUND\n');
    console.error('Fastify schema is forbidden. Use Zod validation inside handlers.\n');
    console.error('Violations:\n');

    allViolations.forEach((violation, index) => {
      console.error(`${index + 1}. ${violation.file}:${violation.line}`);
      console.error(`   ${violation.content}\n`);
    });

    console.error(`\nTotal violations: ${allViolations.length}`);
    console.error('\nRule: Fastify routes MUST NOT define a `schema` field.');
    console.error('Solution: Remove the schema field and use Zod validation inside handlers.');
    console.error('Example:');
    console.error('  // ❌ WRONG:');
    console.error('  fastify.post(\'/route\', { schema: { body: mySchema } }, handler);');
    console.error('');
    console.error('  // ✅ CORRECT:');
    console.error('  fastify.post(\'/route\', async (req, reply) => {');
    console.error('    const parsed = mySchema.safeParse(req.body);');
    console.error('    if (!parsed.success) {');
    console.error('      return reply.status(400).send({ error: parsed.error.errors });');
    console.error('    }');
    console.error('    // Use parsed.data instead of req.body');
    console.error('  });\n');

    process.exit(1);
  }

  console.log('✅ No Fastify schema violations found.');
  console.log('✅ All routes use manual Zod validation in handlers.\n');
  process.exit(0);
}

main();







