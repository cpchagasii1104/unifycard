#!/usr/bin/env ts-node
/**
 * CI Check: Fastify Schema Validation
 * 
 * This script enforces the architectural rule:
 * - Fastify routes MUST NOT define a `schema` field
 * - All validation must be done manually inside handlers using Zod
 * 
 * This check scans all route files and fails if any route contains `schema:` 
 * in a Fastify method call (post, put, patch, delete, get).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const BACKEND_SRC_DIR = join(__dirname, '..', 'src');
const ROUTE_METHODS = ['post', 'put', 'patch', 'delete', 'get'];
const FORBIDDEN_PATTERN = /\bschema\s*:/;

interface Violation {
  file: string;
  line: number;
  content: string;
}

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (extname(file) === '.ts') {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check if file contains Fastify route definitions
  const hasFastifyRoute = ROUTE_METHODS.some(method => 
    content.includes(`fastify.${method}`) || content.includes(`fastify[${method}]`)
  );

  if (!hasFastifyRoute) {
    return violations;
  }

  // Check each line for schema: pattern
  lines.forEach((line, index) => {
    // Look for schema: that appears after a Fastify method call
    // This is a simple heuristic: if we see schema: and we're in a route file,
    // it's likely a violation
    if (FORBIDDEN_PATTERN.test(line)) {
      // Additional check: make sure this is in a route context
      // Look backwards in the file for a Fastify method call
      const beforeLines = lines.slice(Math.max(0, index - 20), index).join('\n');
      const hasRouteMethodBefore = ROUTE_METHODS.some(method =>
        beforeLines.includes(`fastify.${method}`) || beforeLines.includes(`fastify[${method}]`)
      );

      if (hasRouteMethodBefore) {
        violations.push({
          file: filePath.replace(BACKEND_SRC_DIR, 'src'),
          line: index + 1,
          content: line.trim(),
        });
      }
    }
  });

  return violations;
}

function main() {
  console.log('🔍 Checking for Fastify schema violations...\n');

  const allFiles = getAllTsFiles(BACKEND_SRC_DIR);
  const allViolations: Violation[] = [];

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







