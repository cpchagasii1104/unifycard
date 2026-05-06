import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXEC_ORDER, REGISTRY_SECTION_PREFIX } from './exec-order.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * @returns {{ rows: { task: string; state: string; evidence: string }[]; foundSection: boolean }}
 */
export function parseExecRegistry(statusPath = path.join(REPO_ROOT, 'STATUS_EXECUCAO.md')) {
  const text = fs.readFileSync(statusPath, 'utf8');
  const lines = text.split(/\r?\n/);
  let i = lines.findIndex((l) => l.startsWith(REGISTRY_SECTION_PREFIX));
  if (i === -1) {
    return { rows: [], foundSection: false };
  }
  const rows = [];
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    if (line.startsWith('## ')) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .split('|')
      .map((p) => p.trim())
      .filter((c) => c.length > 0);
    if (cells.length >= 2 && cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 4) continue;
    const task = parts[1];
    const state = parts[2];
    const evidence = parts[3];
    if (!task.startsWith('EXEC-')) continue;
    rows.push({ task, state, evidence });
  }
  return { rows, foundSection: true };
}

export function indexOfTask(task) {
  const idx = EXEC_ORDER.indexOf(task);
  return idx;
}
