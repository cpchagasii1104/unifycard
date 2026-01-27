#!/usr/bin/env node
// backend/scripts/check-economy-imports.js
// CI Guardrail: Prevents @core/economy imports outside allowed directories

const fs = require('fs');
const path = require('path');

const ALLOWED_DIRECTORIES = [
  'backend/src/core/economy',
  'backend/src/modules/economy',
];

const FORBIDDEN_PATTERNS = [
  /from\s+['"]@core\/economy/,
  /from\s+['"]\.\.\/.*economy/,
  /import\s+.*from\s+['"]@core\/economy/,
  /require\(['"]@core\/economy/,
  /require\(['"]\.\.\/.*economy/,
];

function getAllowedPath(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return ALLOWED_DIRECTORIES.some((allowed) => normalizedPath.includes(allowed));
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach((pattern) => {
      if (pattern.test(line)) {
        violations.push({
          line: index + 1,
          content: line.trim(),
        });
      }
    });
  });

  return violations;
}

function findTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        findTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  const backendSrc = path.join(__dirname, '..', 'src');
  if (!fs.existsSync(backendSrc)) {
    console.error(`Error: ${backendSrc} does not exist`);
    process.exit(1);
  }
  const allFiles = findTypeScriptFiles(backendSrc);
  const errors = [];

  allFiles.forEach((file) => {
    // Skip files in allowed directories
    if (getAllowedPath(file)) {
      return;
    }

    const violations = checkFile(file);
    if (violations.length > 0) {
      violations.forEach((violation) => {
        errors.push({
          file: path.relative(backendSrc, file),
          line: violation.line,
          content: violation.content,
        });
      });
    }
  });

  if (errors.length > 0) {
    console.error('\n❌ ECONOMY IMPORT VIOLATIONS DETECTED:\n');
    console.error('Economy is deprecated. Use Unify Bank.\n');
    errors.forEach((error) => {
      console.error(`  ${error.file}:${error.line}`);
      console.error(`    ${error.content}\n`);
    });
    console.error(`\nTotal violations: ${errors.length}`);
    console.error('\nAllowed directories:');
    ALLOWED_DIRECTORIES.forEach((dir) => {
      console.error(`  - ${dir}`);
    });
    process.exit(1);
  } else {
    console.log('✅ No economy import violations found');
    process.exit(0);
  }
}

main();







