#!/usr/bin/env node
/**
 * Valida estado global declarado em STATUS_EXECUCAO_GLOBAL.md e (opcional)
 * confronta com A1–A4 na BD se DATABASE_URL + pg estiverem disponíveis.
 *
 * Uso:
 *   npm run validate:system-state
 *   npm run validate:system-state:strict
 *   node scripts/validate-system-state.mjs --strict
 *
 * Variáveis:
 *   SYSTEM_STATE_STRICT=1  — falha se §GLOBAL BLOCK ATIVO (dados pendentes OU STATUS
 *     desactualizado com A1–A4=0 na BD); sem DATABASE_URL falha sempre com ATIVO
 *   STATUS_EXECUCAO_GLOBAL_PATH — caminho alternativo ao MD
 *   DATABASE_URL — se definido, tenta A1–A4 (requer pg em backend/node_modules ou hoisted)
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATUS = path.join(REPO_ROOT, 'STATUS_EXECUCAO_GLOBAL.md');
const STATUS_PATH = process.env.STATUS_EXECUCAO_GLOBAL_PATH || DEFAULT_STATUS;

const strict =
  process.argv.includes('--strict') ||
  process.env.SYSTEM_STATE_STRICT === '1' ||
  process.env.SYSTEM_STATE_STRICT === 'true';

function fail(msg) {
  console.error(`[system-state] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[system-state] WARN: ${msg}`);
}

function readStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    fail(`Ficheiro em falta: ${STATUS_PATH}`);
  }
  return fs.readFileSync(STATUS_PATH, 'utf8');
}

/**
 * Extrai célula da tabela "Estado global" após o rótulo (primeira coluna com **...**).
 */
function extractTableCell(md, labelPattern) {
  const re = new RegExp(
    `^\\|\\s*${labelPattern}\\s*\\|\\s*([^|]*)\\|`,
    'im',
  );
  const m = md.match(re);
  if (!m) return null;
  return m[1].trim();
}

function parseGlobalBlock(md) {
  const raw = extractTableCell(md, '\\*\\*§GLOBAL BLOCK\\*\\*');
  return raw;
}

function parseContinuousMode(md) {
  return extractTableCell(
    md,
    '\\*\\*Execução contínua segura \\(§CONTINUOUS_EXECUTION_MODE\\)\\*\\*',
  );
}

/** INATIVO tem prioridade sobre substring "ATIVO" dentro da palavra. */
function isGlobalBlockInactive(cell) {
  if (!cell) return false;
  return /^\s*INATIVO\b/i.test(cell);
}

function isGlobalBlockActive(cell) {
  if (!cell) return false;
  if (isGlobalBlockInactive(cell)) return false;
  return /^\s*ATIVO\b/i.test(cell);
}

function tryLoadPg() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(REPO_ROOT, 'backend', 'node_modules', 'pg'),
    path.join(REPO_ROOT, 'node_modules', 'pg'),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* empty */
    }
  }
  try {
    return require('pg');
  } catch {
    return null;
  }
}

async function runIdentityCounts(pg) {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const Client = pg.Client;
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const a1 = await c.query(`
      SELECT COUNT(*)::text AS n FROM global_users g
      WHERE NOT EXISTS (
        SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id
      )`);
    const a2 = await c.query(`
      SELECT COUNT(*)::text AS n FROM actors
      WHERE actor_type IN ('user', 'person', 'actor_human')
        AND global_user_id IS NULL
        AND is_identity_required = true`);
    const a3 = await c.query(`
      SELECT COUNT(*)::text AS n FROM actors a
      WHERE a.global_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM identities i WHERE i.global_user_id = a.global_user_id
        )`);
    const a4 = await c.query(`
      SELECT COUNT(*)::text AS n FROM (
        SELECT 1 FROM identities GROUP BY tax_id HAVING COUNT(*) > 1
      ) t`);
    return {
      a1: BigInt(a1.rows[0].n),
      a2: BigInt(a2.rows[0].n),
      a3: BigInt(a3.rows[0].n),
      a4: BigInt(a4.rows[0].n),
    };
  } finally {
    await c.end();
  }
}

async function main() {
  const md = readStatus();

  if (!parseGlobalBlock(md)) {
    fail(
      'Tabela "Estado global" sem linha **§GLOBAL BLOCK** — actualize STATUS_EXECUCAO_GLOBAL.md',
    );
  }
  if (!parseContinuousMode(md)) {
    fail(
      'Tabela "Estado global" sem linha **Execução contínua segura (§CONTINUOUS_EXECUTION_MODE)**',
    );
  }

  const blockCell = parseGlobalBlock(md);
  const contCell = parseContinuousMode(md);

  const inactive = isGlobalBlockInactive(blockCell);
  const active = isGlobalBlockActive(blockCell);

  if (!inactive && !active) {
    fail(
      `Célula §GLOBAL BLOCK não reconhece ATIVO/INATIVO no início: "${blockCell.slice(0, 80)}…"`,
    );
  }

  if (inactive && /\bNÃO\s+permitida\b/i.test(contCell)) {
    fail(
      'Incoerência: §GLOBAL BLOCK = INATIVO mas execução contínua ainda declara "NÃO permitida" — actualize a segunda linha da tabela Estado global.',
    );
  }

  if (active && !/\bNÃO\s+permitida\b/i.test(contCell)) {
    warn(
      '§GLOBAL BLOCK = ATIVO mas a linha de execução contínua não contém "NÃO permitida" — confirme se o texto reflecte o bloqueio.',
    );
  }

  const pg = tryLoadPg();
  const dbUrl = process.env.DATABASE_URL;
  /** @type {{ a1: bigint, a2: bigint, a3: bigint, a4: bigint } | null} */
  let counts = null;
  if (dbUrl && pg) {
    try {
      counts = await runIdentityCounts(pg);
    } catch (e) {
      fail(`Consulta A1–A4 falhou: ${e.message}`);
    }
    if (counts) {
      const bad =
        counts.a1 > 0n ||
        counts.a2 > 0n ||
        counts.a3 > 0n ||
        counts.a4 > 0n;
      if (inactive && bad) {
        fail(
          `STATUS declara §GLOBAL BLOCK INATIVO mas a BD tem violações: A1=${counts.a1} A2=${counts.a2} A3=${counts.a3} A4(dup tax_id)=${counts.a4}`,
        );
      }
      if (inactive && !bad) {
        console.log(
          `[system-state] BD alinhada com INATIVO (A1–A4 = 0 / sem duplicados tax_id).`,
        );
      }
    }
  } else if (dbUrl && !pg) {
    warn('DATABASE_URL definido mas pacote `pg` não encontrado — skip A1–A4.');
  }

  if (active && counts) {
    const bad =
      counts.a1 > 0n ||
      counts.a2 > 0n ||
      counts.a3 > 0n ||
      counts.a4 > 0n;
    if (!bad) {
      const staleMsg =
        `A1–A4 na BD estão a zero (A1=${counts.a1} A2=${counts.a2} A3=${counts.a3} A4=${counts.a4}) mas §GLOBAL BLOCK ainda ATIVO — ` +
        'actualize STATUS_EXECUCAO_GLOBAL.md (INATIVO + linha §CONTINUOUS_EXECUTION_MODE coerente) após evidência §STATE_TRANSITION_RULES.';
      if (strict) {
        fail(staleMsg);
      }
      warn(staleMsg);
    }
  }

  if (active && strict && !counts) {
    fail(
      '§GLOBAL BLOCK ATIVO (modo strict) e A1–A4 não foram verificados nesta execução (defina DATABASE_URL + pg ou corra a partir de backend/). ' +
        'Conclua Identity (CP-1…CP-7) e alinhe o STATUS, ou forneça BD para validação.',
    );
  }

  if (active && strict && counts) {
    const bad =
      counts.a1 > 0n ||
      counts.a2 > 0n ||
      counts.a3 > 0n ||
      counts.a4 > 0n;
    if (bad) {
      fail(
        `§GLOBAL BLOCK ATIVO (modo strict) e ainda há violações na BD: A1=${counts.a1} A2=${counts.a2} A3=${counts.a3} A4(dup tax_id)=${counts.a4} — conclua reconciliação Identity.`,
      );
    }
  }

  if (active && !strict && (!counts || counts.a1 > 0n || counts.a2 > 0n || counts.a3 > 0n || counts.a4 > 0n)) {
    warn(
      '§GLOBAL BLOCK ATIVO — execução contínua bloqueada (GAP 1). CI: `SYSTEM_STATE_STRICT=1` ou `npm run validate:system-state:strict` quando quiser falhar o job.',
    );
  }

  console.log('[system-state] PASS');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
