#!/usr/bin/env node
/**
 * FASE 1 — radar rápido de padrões perigosos (backend + frontend).
 * Não pretende ser completo: afinar allowPath / regras após 2–3 corridas no CI local.
 *
 * Uso:
 *   node scripts/validate-architectural-patterns.mjs
 *     → relatório; exit 0 (warn). Com baseline: destaca apenas NOVAS vs baseline.
 *   node scripts/validate-architectural-patterns.mjs --strict
 *     → com baseline: exit 1 só em violações NOVAS cuja severidade está em ARCH_FAIL_ON (default: CRITICAL).
 *     → WARNING/INFO aparecem no relatório mas não bloqueiam por defeito.
 *     → sem baseline: mesma regra de severidade para o scan total.
 *   ARCH_FAIL_ON=CRITICAL,WARNING — também falhar em WARNING (INFO nunca, salvo listar explicitamente).
 *   node scripts/validate-architectural-patterns.mjs --update-baseline
 *     → grava baseline (ids: regra:ficheiro:hash16 do trecho; tolera refactor de linhas).
 *   node scripts/validate-architectural-patterns.mjs --experimental → regras ruidosas
 *   node scripts/validate-architectural-patterns.mjs --full-strict
 *     → ignora baseline; --strict falha em qualquer ocorrência (auditoria total).
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from 'fs';
import { createHash } from 'crypto';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'architectural-patterns-baseline.json');

const ARGS = new Set(process.argv.slice(2));
const STRICT = ARGS.has('--strict');
const EXPERIMENTAL = ARGS.has('--experimental');
const UPDATE_BASELINE = ARGS.has('--update-baseline');
const FULL_STRICT = ARGS.has('--full-strict');

/** Severidades que fazem `--strict` falhar (default: só CRITICAL). */
function parseFailSeverities() {
  const raw = process.env.ARCH_FAIL_ON?.trim();
  if (!raw) return new Set(['CRITICAL']);
  const parts = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const allowed = new Set(['CRITICAL', 'WARNING', 'INFO']);
  const out = new Set();
  for (const p of parts) {
    if (allowed.has(p)) out.add(p);
  }
  return out.size > 0 ? out : new Set(['CRITICAL']);
}

const FAIL_SEVERITIES = parseFailSeverities();

const ROOTS = [join(ROOT, 'backend', 'src'), join(ROOT, 'frontend', 'src')];

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'build',
  'coverage',
]);

/** Normaliza para comparação com regex (/ no Windows). */
function normPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * @typedef {{
 *   name: string;
 *   severity: 'CRITICAL' | 'WARNING' | 'INFO';
 *   description: string;
 *   pattern: RegExp;
 *   allowPath?: RegExp;
 *   onlyPath?: RegExp;
 *   denyLine?: RegExp;
 *   experimental?: boolean;
 * }} Rule
 */

/** @type {Rule[]} */
const RULES = [
  {
    name: 'NO_LEDGER_OUTSIDE_BANK',
    severity: 'CRITICAL',
    description: 'APIs de ledger / saldo fora do boundary financeiro',
    // Não incluir "LedgerEntry" (tipo TS); foco em chamadas / repositórios.
    pattern:
      /\b(createLedger|ledger_balance|LedgerRepository|appendLedger|postToLedger)\b/i,
    allowPath:
      /\/modules\/(bank|ledger|reconciliation|treasury|economy|payout|escrow|payments|gateway)\//i,
  },
  {
    name: 'NO_DIRECT_BANK_TABLE_ACCESS',
    severity: 'CRITICAL',
    description: 'Referência a tabelas SSOT bancárias fora do domínio autorizado',
    pattern: /\b(bank_ledger|bank_transactions|bank_accounts)\b/,
    // Bank vive em modules/bank mas também em core/unifybank, reconciliação e observabilidade.
    //
    // DT-RECONCILE-SCRIPTS-ALLOWPATH: scripts E2E/probes (validate-pipeline-e2e-*.ts
    // e e2e-*.ts) referenciam bank_* tabelas LEGITIMAMENTE para provar invariantes
    // materiais (Σ(débito)=Σ(crédito), atomicidade transacional, presença→ausência
    // em rollback). Padrão de nome restrito: apenas arquivos com esses prefixos sob
    // backend/src/scripts/. Outros scripts (seeds, validações, checadores)
    // permanecem sob vigilância — refs reais a bank_* viram CRITICAL new.
    allowPath:
      /\/(modules\/(bank|ledger|reconciliation|treasury|economy|observability|gateway|audit|payments|payout|escrow)|core\/(unifybank|reconciliation|observability|events\/event-economy)|workers\/|scripts\/(validate-pipeline-e2e-|e2e-)[^\/]+\.(ts|tsx|js|jsx)$)/i,
  },
  {
    name: 'NO_MANUAL_MONEY_CALCULATION',
    severity: 'WARNING',
    description: 'Operação aritmética em amount/balance no backend (rever fluxo financeiro)',
    // FASE 1: só backend — UI formata centavos com /100 (falso positivo massivo no frontend).
    onlyPath: /^backend\/src\//,
    // Evita falsos positivos tipo className="amount-cell".
    pattern: /\b(amount|balance)\s*(\+|\/|\*|\s-\s)/i,
    denyLine:
      /\/\/\s*arch:allow|eslint-disable|TODO\(arch\)|\bclassName\b|['"]amount-|['"]balance-|@param\s+(amount|balance)\b/i,
    allowPath:
      /\/modules\/(bank|payments|payout|escrow|reconciliation|treasury|economy|marketplace\/domain\/pricing)\//i,
  },
  {
    name: 'NO_CATEGORY_AS_IDENTITY',
    severity: 'WARNING',
    description: 'category_id / categoryId sem âncora semântica na mesma linha (heurística — muito ruidoso)',
    pattern: /\b(category_id|categoryId)\b/,
    denyLine: /\b(concept_id|Concept|CONCEPT|canonical_|identity_actor|actor_id)\b/i,
    allowPath:
      /\/modules\/(categor|catalog|navigation|gates|product|marketplace|search|feed|taxonomy)\//i,
    experimental: true,
  },
  {
    name: 'NO_CONCEPT_BYPASS',
    severity: 'CRITICAL',
    description: 'Atribuição de slug/nome como identificador sem concept na linha',
    pattern: /\b(slug|name)\s*[:=]\s*['"`]/,
    denyLine: /\bconcept_id\b/i,
    allowPath: /\/(tests?|__tests__|\.test\.|\.spec\.|mocks?)\//i,
    experimental: true,
  },
  {

    name: 'NO_EVENT_CONFUSION',
    severity: 'INFO',
    description: 'Palavra "event" em contexto potencialmente ambíguo (experimental)',
    pattern: /\bevent\b/i,
    denyLine:
      /\b(ChangeEvent|SyntheticEvent|EventEmitter|outbox|message[_-]?bus|audit|notification|domain[_-]?event|@\/|arch:allow)\b/i,
    allowPath:
      /\/(events\/|event-|payment-event|gateway\/.*event|\.test\.|\.spec\.|__tests__)\//i,
    experimental: true,
  },

  // ─── NOMENCLATURA CANÔNICA §07 — Fase 1: experimental + WARNING ──────────
  // Baseline gravado após primeira execução. Apenas ocorrências NOVAS falham.

  {
    name: 'NO_CAMELCASE_COLUMN_DDL',
    severity: 'WARNING',
    description: 'Coluna DDL com nome camelCase aspado — usar snake_case sem aspas (§07)',
    pattern: /"(?:[a-z]+[A-Z][a-zA-Z]*)"\s+(TIMESTAMPTZ|TIMESTAMP|BOOLEAN|TEXT|UUID|INTEGER|BIGINT|NUMERIC|JSONB|DATE|VARCHAR)\b/i,
    denyLine: /arch:allow|arch:legacy/i,
    allowPath: /(tests?|__tests__|\.test\.|\.spec\.|seeds?\/|fixtures?\/)/i,
    experimental: true,
  },

  {
    name: 'NO_BOOLEAN_WITHOUT_PREFIX',
    severity: 'WARNING',
    description: 'BOOLEAN sem prefixo is_/has_/can_ em DDL — padrão canônico obrigatório (§07)',
    pattern: /\b(?!is_|has_|can_)([a-z][a-z_]*)\s+BOOLEAN\b(?!\s*\))/i,
    denyLine: /arch:allow|arch:legacy|\bDECLARE\b|\bRETURNS\b/i,
    onlyPath: /migrations?[\/\\].*\.sql$/i,
    experimental: true,
  },

  {
    name: 'NO_NEW_STATUS_UPPERCASE',
    severity: 'WARNING',
    description: 'Status em UPPERCASE detectado — verificar se é legado ou novo (§07)',
    pattern: /\b(status|state)\b[^'\n]*'([A-Z]{3,})'/i,
    denyLine: /arch:allow|arch:legacy/i,
    onlyPath: /backend[\/\\]src[\/\\]/i,
    experimental: true,
  },
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return files;
  }
  for (const name of names) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function stripLineComment(line) {
  const i = line.indexOf('//');
  return i === -1 ? line : line.slice(0, i);
}

/** Normaliza espaços no trecho para hash estável. */
function normalizeSnippet(line) {
  return line.replace(/\s+/g, ' ').trim();
}

/**
 * FASE 1.5 — chave primária: regra + ficheiro + SHA-256 truncado (trecho completo, sem número de linha).
 * Edge-case raro: duas linhas idênticas no mesmo ficheiro com semântica diferente → mesma chave.
 * Evolução futura (só se aparecer no mundo real): incluir contexto leve no payload (ex. linha anterior
 * ou nome de função envolvente), nunca só por “opinião”.
 */
function issueKeyV2(issue) {
  const payload = `${issue.rule}\0${issue.file}\0${normalizeSnippet(issue.fullLine)}`;
  const h = createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return `${issue.rule}:${issue.file}:${h}`;
}

/** Baseline legado (v1): regra + ficheiro + linha — ainda aceite em comparação. */
function issueKeyV1(issue) {
  return `${issue.rule}:${issue.file}:${issue.line}`;
}

function allKeysForIssue(issue) {
  return [issueKeyV2(issue), issueKeyV1(issue)];
}

function isIssueKnown(issue, baselineSet) {
  return allKeysForIssue(issue).some((k) => baselineSet.has(k));
}

/** União de todas as chaves v1+v2 do scan (para contagem “removidas”). */
function currentKeyUnion(allIssues) {
  const s = new Set();
  for (const i of allIssues) {
    allKeysForIssue(i).forEach((k) => s.add(k));
  }
  return s;
}

function issueBlocksStrict(issue) {
  if (issue.severity === 'INFO') return false;
  return FAIL_SEVERITIES.has(issue.severity);
}

function sortIssuesBySeverity(issues) {
  return [...issues].sort((a, b) => {
    const da = SEVERITY_ORDER[a.severity] ?? 9;
    const db = SEVERITY_ORDER[b.severity] ?? 9;
    if (da !== db) return da - db;
    return `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`);
  });
}

function summarizeBySeverity(issues) {
  const m = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const i of issues) {
    const sev = i.severity;
    if (m[sev] !== undefined) m[sev]++;
  }
  return m;
}

/** Uma linha `key=value` + JSON — fácil de grep / jq nos logs do CI. */
function printArchPatternsSummary(sevTotal, sevNew) {
  const line = [
    'ARCH_PATTERNS_SUMMARY',
    `critical_new=${sevNew.CRITICAL}`,
    `warning_new=${sevNew.WARNING}`,
    `info_new=${sevNew.INFO}`,
    `critical_total=${sevTotal.CRITICAL}`,
    `warning_total=${sevTotal.WARNING}`,
    `info_total=${sevTotal.INFO}`,
  ].join(' ');
  console.error(line);
  console.error(
    `ARCH_PATTERNS_SUMMARY_JSON ${JSON.stringify({
      critical_new: sevNew.CRITICAL,
      warning_new: sevNew.WARNING,
      info_new: sevNew.INFO,
      critical_total: sevTotal.CRITICAL,
      warning_total: sevTotal.WARNING,
      info_total: sevTotal.INFO,
    })}`,
  );
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    const raw = readFileSync(BASELINE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const ids = Array.isArray(data.ids) ? data.ids : [];
    return new Set(ids);
  } catch {
    return null;
  }
}

function saveBaseline(ids, meta = {}) {
  const payload = {
    version: 2,
    keySchema: 'rule:file:sha256-16(normalized-line)',
    generatedAt: new Date().toISOString(),
    description:
      'Snapshot de violações aceites. Chaves v2 = hash do trecho (refactor de linhas não invalida). v1 (regra:ficheiro:linha) ainda é reconhecida se existir no ficheiro. Atualizar: node scripts/validate-architectural-patterns.mjs --update-baseline',
    ...meta,
    ids: [...ids].sort(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function analyzeFile(filePath, rules) {
  const rel = normPath(relative(ROOT, filePath));
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const cleanLine = stripLineComment(raw).trim();
    if (!cleanLine) continue;

    for (const rule of rules) {
      if (rule.experimental && !EXPERIMENTAL) continue;

      if (rule.onlyPath && !rule.onlyPath.test(rel)) continue;
      if (rule.allowPath?.test(rel)) continue;
      if (!rule.pattern.test(cleanLine)) continue;
      if (rule.denyLine?.test(cleanLine)) continue;

      issues.push({
        rule: rule.name,
        severity: rule.severity,
        description: rule.description,
        file: rel,
        line: index + 1,
        fullLine: cleanLine,
        code: cleanLine.length > 160 ? `${cleanLine.slice(0, 157)}…` : cleanLine,
      });
    }
  }

  return issues;
}

function collectIssues() {
  const activeRules = RULES.filter((r) => !r.experimental || EXPERIMENTAL);
  const allFiles = [];
  for (const root of ROOTS) {
    walk(root, allFiles);
  }

  const allIssues = [];
  for (const file of allFiles) {
    allIssues.push(...analyzeFile(file, activeRules));
  }
  return { allIssues, activeRules };
}

function main() {
  const { allIssues, activeRules } = collectIssues();

  const currentKeys = new Set(allIssues.map(issueKeyV2));
  const keysUnion = currentKeyUnion(allIssues);
  const baselineSet = FULL_STRICT ? null : loadBaseline();
  const useBaseline = Boolean(baselineSet) && !FULL_STRICT;

  if (UPDATE_BASELINE) {
    saveBaseline(currentKeys, {
      rulesActive: activeRules.length,
      experimental: EXPERIMENTAL,
      occurrenceCount: allIssues.length,
    });
    const uniq = currentKeys.size;
    const occ = allIssues.length;
    console.log(
      `validate-architectural-patterns: baseline gravado em scripts/architectural-patterns-baseline.json (${uniq} chaves únicas v2${occ !== uniq ? `, ${occ} ocorrências no scan` : ''}).`,
    );
    process.exit(0);
  }

  if (allIssues.length === 0) {
    const z = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    printArchPatternsSummary(z, z);
    console.log(
      `validate-architectural-patterns: OK (${activeRules.length} regras ativas${EXPERIMENTAL ? ', experimental' : ''}).`,
    );
    if (useBaseline && baselineSet && baselineSet.size > 0) {
      console.log(
        `Baseline: ${baselineSet.size} chaves registadas — todas limpas no scan atual (refactor ou regras mais estritas).`,
      );
    }
    process.exit(0);
  }

  let newIssues = allIssues;
  let removedFromBaseline = 0;
  if (useBaseline && baselineSet) {
    newIssues = allIssues.filter((i) => !isIssueKnown(i, baselineSet));
    for (const id of baselineSet) {
      if (!keysUnion.has(id)) removedFromBaseline++;
    }
  }

  const sevTotal = summarizeBySeverity(allIssues);
  const sevNew = summarizeBySeverity(newIssues);

  const byRule = {};
  for (const issue of allIssues) {
    byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
  }
  console.error('\nvalidate-architectural-patterns: resumo por regra:');
  for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${k}: ${v}`);
  }

  console.error(
    `\nPor severidade (scan total): CRITICAL=${sevTotal.CRITICAL} | WARNING=${sevTotal.WARNING} | INFO=${sevTotal.INFO}`,
  );
  if (useBaseline && newIssues.length > 0) {
    console.error(
      `Por severidade (novas vs baseline): CRITICAL=${sevNew.CRITICAL} | WARNING=${sevNew.WARNING} | INFO=${sevNew.INFO}`,
    );
  }

  if (useBaseline && baselineSet) {
    console.error(
      `\nBaseline: ${baselineSet.size} chaves | Scan atual: ${allIssues.length} | Novas vs baseline: ${newIssues.length} | Removidas (corrigidas/refactor): ${removedFromBaseline}`,
    );
  }

  const detailList = !useBaseline ? allIssues : newIssues;

  if (detailList.length > 0) {
    const tagNew = useBaseline && newIssues.length > 0;
    console.error(
      `\nDetalhe${tagNew ? ' (só ocorrências NOVAS vs baseline)' : ' (revisar allowPath / código)'} — por severidade:\n`,
    );
    const grouped = ['CRITICAL', 'WARNING', 'INFO'];
    const sorted = sortIssuesBySeverity(detailList);
    for (const sev of grouped) {
      const slice = sorted.filter((i) => i.severity === sev);
      if (slice.length === 0) continue;
      console.error(`--- ${sev} (${slice.length}) ---`);
      for (const issue of slice) {
        const isNew = useBaseline && baselineSet && !isIssueKnown(issue, baselineSet);
        const prefix = useBaseline && baselineSet ? (isNew ? '[NOVO] ' : '') : '';
        console.error(`${prefix}[${issue.severity}] [${issue.rule}] ${issue.description}`);
        console.error(`  ${issue.file}:${issue.line}`);
        console.error(`  ${issue.code}\n`);
      }
    }
  }

  if (useBaseline && newIssues.length === 0 && allIssues.length > 0) {
    console.error(
      '\n(Nenhuma ocorrência nova — todas já estavam no baseline; use --full-strict para exigir zero ocorrências totais.)\n',
    );
  }

  const blockingNew = newIssues.filter(issueBlocksStrict);
  const blockingAll = allIssues.filter(issueBlocksStrict);

  let exitCode = 0;
  if (STRICT) {
    if (FULL_STRICT) {
      exitCode = allIssues.length > 0 ? 1 : 0;
    } else if (!useBaseline) {
      exitCode = blockingAll.length > 0 ? 1 : 0;
    } else {
      exitCode = blockingNew.length > 0 ? 1 : 0;
    }
  }

  const failList = [...FAIL_SEVERITIES].sort().join(',');
  console.error(
    `Total scan: ${allIssues.length}. ` +
      (useBaseline
        ? `Novas: ${newIssues.length} (bloqueantes em strict: ${blockingNew.length}). `
        : `Bloqueantes (--strict): ${blockingAll.length}. `) +
      `Modo: ${STRICT ? `strict (${exitCode ? 'exit 1' : 'exit 0'})` : 'warn (exit 0)'}. ` +
      `${useBaseline ? 'Baseline ativo — só novas contam; só severidades em ARCH_FAIL_ON bloqueiam. ' : ''}` +
      `ARCH_FAIL_ON=${failList}. ` +
      `Flags: --full-strict, --update-baseline, --experimental.\n`,
  );

  printArchPatternsSummary(sevTotal, sevNew);

  process.exit(exitCode);
}

main();
