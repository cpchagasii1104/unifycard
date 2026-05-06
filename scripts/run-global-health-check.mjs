#!/usr/bin/env node
/**
 * Delega para o backend (resolve `pg` via workspace / pnpm).
 * Variáveis: DATABASE_URL, EXEC_HEALTH_STRICT, T_OUTBOX_MAX_MINUTES
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const r = spawnSync(npmCmd, ['run', 'execution-health:gate', '-w', 'unificard-backend'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: isWin,
});

process.exit(r.status === null ? 1 : r.status);
