import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const scriptsRoot = path.join(repoRoot, 'backend', 'src', 'scripts');

const markerPattern = /mapper exists but is not applied|avoid semantic drift/i;
const mapperDeclarationPattern = /function\s+(map[A-Za-z0-9_]*RowToDomain)\s*\(/g;

const findings = [];
let scannedFiles = 0;

function listTsFilesRecursively(dirAbsolutePath) {
  const entries = readdirSync(dirAbsolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dirAbsolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursively(absolute));
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

const scriptFiles = listTsFilesRecursively(scriptsRoot);

for (const absolutePath of scriptFiles) {
  const content = readFileSync(absolutePath, 'utf8');
  if (!markerPattern.test(content)) {
    continue;
  }

  scannedFiles++;
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  const mapperDeclarations = Array.from(content.matchAll(mapperDeclarationPattern));

  if (mapperDeclarations.length === 0) {
    findings.push(`${relativePath}:1 marker found but no mapXxxRowToDomain declaration present`);
    continue;
  }

  for (const declaration of mapperDeclarations) {
    const mapperName = declaration[1];
    if (!mapperName) {
      continue;
    }

    const callPattern = new RegExp(`${mapperName}\\s*\\(`, 'g');
    for (const match of content.matchAll(callPattern)) {
      const idx = match.index ?? 0;
      const prefix = content.slice(Math.max(0, idx - 24), idx);
      if (/function\s*$/.test(prefix)) {
        continue;
      }

      findings.push(
        `${relativePath}:${lineNumberFor(content, idx)} mapper invocation forbidden in critical flow: ${mapperName}`
      );
    }
  }
}

if (findings.length > 0) {
  console.error('FAIL Critical Runtime Mapper Guard');
  for (const finding of findings) {
    console.error(`FAIL :: ${finding}`);
  }
  process.exit(1);
}

console.log('PASS Critical Runtime Mapper Guard');
console.log(`Scanned files=${scannedFiles}`);
