#!/usr/bin/env node
/**
 * Lê o output do validate-architectural-patterns.mjs, extrai ARCH_PATTERNS_SUMMARY_JSON
 * e faz append de uma linha JSON em artifacts/architectural-metrics.jsonl (histórico fora do git).
 *
 * Uso:
 *   node scripts/validate-architectural-patterns.mjs --strict 2>&1 | tee arch.log
 *   node scripts/append-architectural-metrics.mjs arch.log
 *
 * Env (opcional, preenchido no GitHub Actions):
 *   GITHUB_SHA, GITHUB_REF, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_WORKFLOW
 *
 * Override do ficheiro de saída:
 *   ARCH_METRICS_JSONL=/caminho/custom.jsonl
 */
import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_OUT = join(ROOT, 'artifacts', 'architectural-metrics.jsonl');

const outPath = process.env.ARCH_METRICS_JSONL
  ? process.env.ARCH_METRICS_JSONL
  : DEFAULT_OUT;

const PREFIX = 'ARCH_PATTERNS_SUMMARY_JSON ';

function extractJsonFromLog(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(PREFIX)) {
      const jsonStr = t.slice(PREFIX.length).trim();
      return JSON.parse(jsonStr);
    }
  }
  return null;
}

function main() {
  const inputPath = process.argv[2];
  const text = inputPath
    ? readFileSync(inputPath, 'utf8')
    : readFileSync(0, 'utf8');

  let metrics;
  try {
    metrics = extractJsonFromLog(text);
  } catch (e) {
    console.error('append-architectural-metrics: JSON inválido após ARCH_PATTERNS_SUMMARY_JSON', e.message);
    process.exit(0);
  }

  if (!metrics) {
    console.error(
      'append-architectural-metrics: linha ARCH_PATTERNS_SUMMARY_JSON não encontrada — nada gravado.',
    );
    process.exit(0);
  }

  const dir = dirname(outPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const row = {
    recorded_at: new Date().toISOString(),
    git: {
      sha: process.env.GITHUB_SHA || process.env.GIT_COMMIT || null,
      ref: process.env.GITHUB_REF || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      workflow: process.env.GITHUB_WORKFLOW || null,
    },
    metrics,
  };

  appendFileSync(outPath, `${JSON.stringify(row)}\n`, 'utf8');
  console.error(`append-architectural-metrics: append OK → ${outPath}`);
}

main();
