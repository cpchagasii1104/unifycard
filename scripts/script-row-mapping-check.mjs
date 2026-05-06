import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const enforcedFiles = [
  'backend/src/scripts/validate-financial-flow-real.ts',
  'backend/src/scripts/backfill-payment-splits-to-bank.ts',
  'backend/src/scripts/check-profile-records.ts',
  'backend/src/scripts/create-dev-user.ts',
  'backend/src/scripts/test-dev-login.ts',
  'backend/src/scripts/check-profile-address.ts',
  'backend/src/scripts/verify-dev-user.ts',
];

const directFirstRowPropertyPattern = /\.rows\[0\][!?]?\.([a-z0-9_]+)/g;
const rawFirstRowAssignmentPattern = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*\.rows\[0\][^;\n]*);/g;
const rawRowsIterationPattern = /\.rows\.(forEach|map)\s*\(\s*\((row|item)\b/g;
const mapperPattern = /function\s+map[A-Za-z0-9]+RowToDomain\s*\(/;
const usesSqlRowPattern = /\brow\.|\brows\[0\]/;

function listScriptFilesRecursively(dirAbsolutePath) {
  const entries = readdirSync(dirAbsolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dirAbsolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listScriptFilesRecursively(absolute));
      continue;
    }
    if (entry.isFile() && absolute.endsWith('.ts')) {
      files.push(absolute);
    }
  }

  return files;
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split('\n').length;
}

function formatFinding(file, line, message) {
  return `${file}:${line} ${message}`;
}

const findings = [];

for (const relativePath of enforcedFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = readFileSync(absolutePath, 'utf8');

  if (!mapperPattern.test(content)) {
    findings.push(formatFinding(relativePath, 1, 'missing mapXxxRowToDomain boundary mapper'));
  }

  for (const match of content.matchAll(directFirstRowPropertyPattern)) {
    findings.push(
      formatFinding(
        relativePath,
        lineNumberFor(content, match.index ?? 0),
        `direct rows[0] property access detected: ${match[1]}`
      )
    );
  }

  for (const match of content.matchAll(rawFirstRowAssignmentPattern)) {
    const assignmentSource = match[2] ?? '';
    if (/map[A-Za-z0-9]+RowToDomain\s*\(/.test(assignmentSource)) {
      continue;
    }
    findings.push(
      formatFinding(
        relativePath,
        lineNumberFor(content, match.index ?? 0),
        `raw rows[0] assigned without mapper: ${match[1]}`
      )
    );
  }

  for (const match of content.matchAll(rawRowsIterationPattern)) {
    findings.push(
      formatFinding(
        relativePath,
        lineNumberFor(content, match.index ?? 0),
        'iterate over query rows directly; map result rows before script logic'
      )
    );
  }
}

const scriptsDir = path.join(repoRoot, 'backend', 'src', 'scripts');
const allScriptFiles = listScriptFilesRecursively(scriptsDir);

let coverageTotal = 0;
let coverageCovered = 0;

for (const absolutePath of allScriptFiles) {
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  const content = readFileSync(absolutePath, 'utf8');
  const usesSqlRow = usesSqlRowPattern.test(content);

  if (!usesSqlRow) {
    continue;
  }

  coverageTotal++;
  if (mapperPattern.test(content)) {
    coverageCovered++;
  }
}

const coveragePercent = coverageTotal === 0 ? 100 : Math.round((coverageCovered / coverageTotal) * 100);

if (findings.length > 0) {
  console.error('FAIL Script Row Mapping Guard');
  for (const finding of findings) {
    console.error(`FAIL :: ${finding}`);
  }
  console.log('');
  console.log('SCRIPT BOUNDARY COVERAGE');
  console.log(`covered=${coverageCovered}/${coverageTotal}`);
  console.log(`percent=${coveragePercent}%`);
  process.exit(1);
}

console.log('PASS Script Row Mapping Guard');
console.log(`Scanned files=${enforcedFiles.length}`);
console.log('');
console.log('SCRIPT BOUNDARY COVERAGE');
console.log(`covered=${coverageCovered}/${coverageTotal}`);
console.log(`percent=${coveragePercent}%`);