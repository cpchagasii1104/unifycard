#!/usr/bin/env node
/**
 * Valida o ledger JSONL de decisões de canonicidade (tax_id) e, se existir,
 * um manifest opcional que lista tax_ids "resolvidos" — cada um deve ter
 * entrada correspondente no ledger (CI gate).
 *
 * Caminhos (repo root = cwd):
 *   docs/03_execution_log/tax_id_canonicality_decisions.jsonl
 *   docs/03_execution_log/tax_id_resolution_manifest.json
 *
 * Overrides:
 *   TAX_ID_LEDGER_PATH, TAX_ID_RESOLUTION_MANIFEST_PATH
 *
 * Uso: node scripts/validate-tax-id-canonicality-ledger.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const DEFAULT_LEDGER = path.join(
  REPO_ROOT,
  'docs',
  '03_execution_log',
  'tax_id_canonicality_decisions.jsonl',
);
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  'docs',
  '03_execution_log',
  'tax_id_resolution_manifest.json',
);

const LEDGER_PATH = process.env.TAX_ID_LEDGER_PATH || DEFAULT_LEDGER;
const MANIFEST_PATH = process.env.TAX_ID_RESOLUTION_MANIFEST_PATH || DEFAULT_MANIFEST;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLICIES = new Set(['P1', 'P2', 'P3', 'P4']);
const ENV_OK = new Set(['dev', 'staging', 'prod']);

function isUuid(s) {
  return typeof s === 'string' && UUID_RE.test(s.trim());
}

function fail(msg) {
  console.error(`[tax-id-ledger] FAIL: ${msg}`);
  process.exit(1);
}

function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return { exists: false, rows: [] };
  }
  const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { exists: true, rows: [] };
  }

  const decisionIds = new Set();
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      fail(`${LEDGER_PATH}:${lineNo} — JSON inválido`);
    }

    const req = [
      'decision_id',
      'ts_utc',
      'environment',
      'tax_id',
      'policy',
      'canonical_global_user_id',
      'superseded_global_user_ids',
      'proposta_ref',
      'approved_by',
      'evidence_refs',
    ];
    for (const k of req) {
      if (!(k in obj) || obj[k] === null || obj[k] === '') {
        fail(`${LEDGER_PATH}:${lineNo} — campo obrigatório em falta ou vazio: "${k}"`);
      }
    }

    if (decisionIds.has(obj.decision_id)) {
      fail(`${LEDGER_PATH}:${lineNo} — decision_id duplicado: ${obj.decision_id}`);
    }
    decisionIds.add(obj.decision_id);

    if (!POLICIES.has(obj.policy)) {
      fail(`${LEDGER_PATH}:${lineNo} — policy inválida: ${obj.policy}`);
    }
    if (!ENV_OK.has(obj.environment)) {
      fail(
        `${LEDGER_PATH}:${lineNo} — environment deve ser dev|staging|prod: ${obj.environment}`,
      );
    }
    if (!isUuid(obj.canonical_global_user_id)) {
      fail(`${LEDGER_PATH}:${lineNo} — canonical_global_user_id não é UUID válido`);
    }
    if (!Array.isArray(obj.superseded_global_user_ids)) {
      fail(`${LEDGER_PATH}:${lineNo} — superseded_global_user_ids deve ser array`);
    }
    for (const sid of obj.superseded_global_user_ids) {
      if (!isUuid(sid)) {
        fail(`${LEDGER_PATH}:${lineNo} — superseded id não é UUID: ${sid}`);
      }
    }
    if (!Array.isArray(obj.evidence_refs) || obj.evidence_refs.length === 0) {
      fail(`${LEDGER_PATH}:${lineNo} — evidence_refs deve ser array não vazio`);
    }
    for (const ref of obj.evidence_refs) {
      if (typeof ref !== 'string' || ref.trim().length < 2) {
        fail(`${LEDGER_PATH}:${lineNo} — evidence_refs contém entrada inválida`);
      }
    }

    rows.push(obj);
  }

  return { exists: true, rows };
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    fail(`${MANIFEST_PATH} — JSON inválido: ${e.message}`);
  }
  if (data.version !== 1) {
    fail(`${MANIFEST_PATH} — version deve ser 1`);
  }
  if (!ENV_OK.has(data.environment)) {
    fail(`${MANIFEST_PATH} — environment deve ser dev|staging|prod`);
  }
  if (!Array.isArray(data.items)) {
    fail(`${MANIFEST_PATH} — items deve ser array`);
  }
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    if (!it || typeof it.tax_id !== 'string' || it.tax_id.trim() === '') {
      fail(`${MANIFEST_PATH} items[${i}] — tax_id obrigatório (string não vazia)`);
    }
    if (!isUuid(it.expected_canonical_global_user_id)) {
      fail(
        `${MANIFEST_PATH} items[${i}] — expected_canonical_global_user_id deve ser UUID`,
      );
    }
  }
  return data;
}

function manifestCoveredByLedger(manifest, ledgerRows) {
  for (let i = 0; i < manifest.items.length; i++) {
    const it = manifest.items[i];
    const tid = it.tax_id.trim();
    const exp = it.expected_canonical_global_user_id.trim().toLowerCase();
    const hit = ledgerRows.some(
      (r) =>
        String(r.tax_id).trim() === tid &&
        String(r.canonical_global_user_id).trim().toLowerCase() === exp,
    );
    if (!hit) {
      fail(
        `${MANIFEST_PATH} items[${i}] — tax_id "${tid}" com canonical esperado ${exp} ` +
          'sem linha correspondente no ledger (append obrigatório antes do merge deste manifest).',
      );
    }
  }
}

const ledger = readLedger();
const manifest = readManifest();

if (!manifest) {
  if (ledger.exists && ledger.rows.length > 0) {
    console.log(
      `[tax-id-ledger] PASS (${ledger.rows.length} linha(s) validada(s); sem manifest)`,
    );
  } else {
    console.log('[tax-id-ledger] SKIP (sem manifest e sem ledger preenchido)');
  }
  process.exit(0);
}

if (manifest.items.length === 0) {
  console.log('[tax-id-ledger] PASS (manifest vazio — sem itens a verificar)');
  process.exit(0);
}

if (!ledger.exists || ledger.rows.length === 0) {
  fail(
    `manifest tem ${manifest.items.length} item(ns) mas o ledger está ausente ou vazio — ` +
      `crie/actualize ${path.relative(REPO_ROOT, LEDGER_PATH)}`,
  );
}

manifestCoveredByLedger(manifest, ledger.rows);
console.log(
  `[tax-id-ledger] PASS (manifest: ${manifest.items.length} tax_id(s) coberto(s) pelo ledger)`,
);
process.exit(0);
