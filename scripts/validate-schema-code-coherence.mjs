#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let Client = null;

// ============================================================================
// CONFIG & UTILITIES
// ============================================================================

const CONFIG = {
  backendDir: path.resolve(__dirname, '../backend'),
  srcDir: path.resolve(__dirname, '../backend/src'),
  migrationsDir: path.resolve(__dirname, '../backend/migrations'),
  envPath: path.resolve(__dirname, '../backend/.env'),
  allowlistPath: path.resolve(__dirname, './schema-coherence-allowlist.json'),
  mode: 'both',
  dbTimeout: 5000,
};

// Parse CLI args
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--mode=')) {
    CONFIG.mode = arg.split('=')[1];
  }
});

if (!['strict', 'fallback', 'both'].includes(CONFIG.mode)) {
  CONFIG.mode = 'both';
}

// Parse .env
function loadEnv() {
  const env = {};
  if (fs.existsSync(CONFIG.envPath)) {
    const content = fs.readFileSync(CONFIG.envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    });
  }
  return env;
}

const ENV = loadEnv();

// Logger
function log(msg) {
  console.log(msg);
}

// ============================================================================
// VARREDURA DE ARQUIVOS TS
// ============================================================================

function getAllTsFiles() {
  const files = [];
  const walk = dir => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (['.spec', '.test', '__tests__', 'node_modules', 'dist'].some(skip => entry.name.includes(skip))) {
          continue;
        }
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(path.join(dir, entry.name));
      }
    }
  };
  walk(CONFIG.srcDir);
  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractSqlStrings(filePath, content) {
  const sqlStrings = [];
  const stats = {
    candidatesRaw: 0,
    valid: 0,
    rejected: {
      logger: 0,
      comments: 0,
      camelCase: 0,
      other: 0,
    },
  };

  const queryContextRegex = /\b(runQueryWithTenant|runQueriesWithTenant|pool\.query|client\.query|trx\.query|db\.query|connection\.query)\b/;
  const sqlKeywordRegex = /\b(SELECT|FROM|JOIN|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/i;
  const templateStartRegex = /^(SELECT|INSERT|UPDATE|DELETE|WITH|BEGIN|COMMIT|ROLLBACK|SET|CREATE|ALTER|DROP|DECLARE|DO)\b/i;

  const literalRegex = /`(?:\\`|[\s\S])*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
  let match;
  literalRegex.lastIndex = 0;

  while ((match = literalRegex.exec(content)) !== null) {
    const literal = match[0];
    const firstChar = literal[0];
    const start = match.index;
    const end = start + literal.length;
    const line = getLineNumber(content, start);

    const value = literal.slice(1, -1);
    if (!sqlKeywordRegex.test(value)) {
      continue;
    }

    stats.candidatesRaw += 1;

    const prev200 = content.slice(Math.max(0, start - 200), start);
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const linePrefix = content.slice(lineStart, start);

    // Reject literals inside line comments or block comments (conservative check).
    const inLineComment = /^\s*\/\//.test(linePrefix) || linePrefix.includes('//');
    const inBlockComment = content.lastIndexOf('/*', start) > content.lastIndexOf('*/', start);
    if (inLineComment || inBlockComment) {
      stats.rejected.comments += 1;
      continue;
    }

    // Reject logging and error-message contexts.
    if (/(console\.(log|error|warn|info)|logger\.|canonicalLogger\.|fastify\.log\.|throw\s+new\s+Error)/i.test(prev200)) {
      stats.rejected.logger += 1;
      continue;
    }

    // Reject metadata description/label/comment string payloads.
    if (/(metadata\.(description|label)|\bdescription\s*:|\blabel\s*:|\bcomment\s*:)/i.test(prev200)) {
      stats.rejected.other += 1;
      continue;
    }

    // Reject camelCase identifiers such as insertResult/deleteCount/selectItem.
    const compact = value.trim();
    if (!/\s/.test(compact) && /[a-z][A-Za-z0-9]*(insert|delete|update|select)[A-Za-z0-9]*/i.test(compact) && /[A-Z]/.test(compact)) {
      stats.rejected.camelCase += 1;
      continue;
    }

    const criterionA = queryContextRegex.test(prev200);
    const criterionB = firstChar === '`' && templateStartRegex.test(value.trim());
    if (!criterionA && !criterionB) {
      stats.rejected.other += 1;
      continue;
    }

    stats.valid += 1;
    sqlStrings.push({
      sql: value,
      line,
      start,
      end,
      quoteType: firstChar === '`' ? 'template' : 'string',
      file: filePath,
    });
  }

  return { sqlStrings, stats };
}

function extractReferencesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const references = [];
  const { sqlStrings, stats } = extractSqlStrings(filePath, content);

  // Pattern 1: Tables in SQL strings
  const tablePatterns = [
    { regex: /\bFROM\s+([a-z_][a-z0-9_]*)\b/gi, type: 'FROM' },
    { regex: /\bJOIN\s+([a-z_][a-z0-9_]*)\b/gi, type: 'JOIN' },
    { regex: /\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)\b/gi, type: 'INSERT' },
    { regex: /\bUPDATE\s+([a-z_][a-z0-9_]*)\s+SET\b/gi, type: 'UPDATE' },
    { regex: /\bDELETE\s+FROM\s+([a-z_][a-z0-9_]*)\b/gi, type: 'DELETE' },
  ];

  for (const sqlEntry of sqlStrings) {
    const line = sqlEntry.sql;
    const lineNum = sqlEntry.line - 1;

    tablePatterns.forEach(({ regex, type }) => {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        const tableName = match[1].toLowerCase();
        references.push({
          file: filePath,
          line: lineNum + 1,
          type: 'table',
          name: tableName,
          pattern: type,
          snippet: line.slice(Math.max(0, match.index - 30), match.index + 60),
        });
      }
    });

    // Pattern 2: Column references (alias.column)
    const colRegex = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi;
    let colMatch;
    colRegex.lastIndex = 0;
    while ((colMatch = colRegex.exec(line)) !== null) {
      references.push({
        file: filePath,
        line: lineNum + 1,
        type: 'column',
        table: colMatch[1].toLowerCase(),
        name: colMatch[2].toLowerCase(),
        snippet: line.slice(Math.max(0, colMatch.index - 30), colMatch.index + 60),
      });
    }

    // Pattern 3: Schema catches (error handling for missing schema)
    if (/catch\s*\([^)]*\)[^}]*?(?:error\??\.code\s*===\s*['"]42P01['"]|error\??\.message\??\.includes\(['"]does not exist['"]\))/s.test(line)) {
      references.push({
        file: filePath,
        line: lineNum + 1,
        type: 'schema_catch',
        pattern: 'C14',
        snippet: line.slice(0, 80),
      });
    }

    // Pattern 4: Metadata in WHERE/CASE
    const metadataRegex = /\bmetadata\s*(->|->>)\s*['"]([^'"]+)['"]/g;
    let metaMatch;
    metadataRegex.lastIndex = 0;
    while ((metaMatch = metadataRegex.exec(line)) !== null) {
      if (/WHERE|CASE|AND|OR/i.test(line)) {
        references.push({
          file: filePath,
          line: lineNum + 1,
          type: 'metadata_decision',
          pattern: 'C6',
          key: metaMatch[2],
          snippet: line.slice(Math.max(0, metaMatch.index - 30), metaMatch.index + 60),
        });
      }
    }
  }

  // Keep schema-catch detection across entire file (not only SQL literals).
  const schemaCatchRegex = /catch\s*\([^)]*\)[^}]*?(?:error\??\.code\s*===\s*['"]42P01['"]|error\??\.message\??\.includes\(['"]does not exist['"]\))/gis;
  let catchMatch;
  schemaCatchRegex.lastIndex = 0;
  while ((catchMatch = schemaCatchRegex.exec(content)) !== null) {
    references.push({
      file: filePath,
      line: getLineNumber(content, catchMatch.index),
      type: 'schema_catch',
      pattern: 'C14',
      snippet: catchMatch[0].slice(0, 80),
    });
  }

  return { references, extraction: stats };
}

// ============================================================================
// SCHEMA RETRIEVAL
// ============================================================================

async function fetchSchemaFromDb() {
  const dbUrl = ENV.DATABASE_URL;
  if (!dbUrl) return null;

  // Load pg only when needed
  if (!Client) {
    try {
      const pg = require('../backend/node_modules/pg');
      Client = pg.Client;
    } catch (err) {
      log(`[WARNING] Cannot load pg module: ${err.message}`);
      return null;
    }
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    const startTime = Date.now();
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), CONFIG.dbTimeout)),
    ]);

    const result = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name;
    `);

    const schema = new Map();
    for (const row of result.rows) {
      if (!schema.has(row.table_name)) {
        schema.set(row.table_name, new Set());
      }
      schema.get(row.table_name).add(row.column_name);
    }

    await client.end();
    return schema;
  } catch (err) {
    log(`[WARNING] Database unavailable: ${err.message}`);
    return null;
  }
}

function parseSchemaFromMigrations() {
  function stripSqlComments(sql) {
    return sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n\r]*/g, ' ');
  }

  function normalizeSqlWhitespace(sql) {
    return sql.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function findDoBlockRanges(sql) {
    const ranges = [];
    const doRegex = /DO\s+\$\$[\s\S]*?\$\$/gi;
    let match;
    doRegex.lastIndex = 0;
    while ((match = doRegex.exec(sql)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  }

  function isInsideRange(index, ranges) {
    return ranges.some(range => index >= range.start && index < range.end);
  }

  function extractCreateTables(sql, doRanges, stats) {
    const creates = [];
    const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(/gi;
    let match;
    createRegex.lastIndex = 0;

    while ((match = createRegex.exec(sql)) !== null) {
      const tableName = match[1].toLowerCase();
      const openParenIndex = createRegex.lastIndex - 1;

      let depth = 1;
      let i = openParenIndex + 1;
      while (i < sql.length && depth > 0) {
        const ch = sql[i];
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        i += 1;
      }

      if (depth !== 0) {
        continue;
      }

      const closeParenIndex = i - 1;
      const body = sql.slice(openParenIndex + 1, closeParenIndex);
      const insideDo = isInsideRange(match.index, doRanges);
      if (insideDo) {
        stats.createPatternB += 1;
      } else {
        stats.createPatternA += 1;
      }

      creates.push({ tableName, body });
      createRegex.lastIndex = i;
    }

    return creates;
  }

  const schema = new Map();
  const stats = {
    createPatternA: 0,
    createPatternB: 0,
    alterAddColumn: 0,
    alterRenameColumn: 0,
    alterDropColumn: 0,
  };
  const migrationFiles = fs.readdirSync(CONFIG.migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const content = fs.readFileSync(path.join(CONFIG.migrationsDir, file), 'utf-8');
    const noComments = stripSqlComments(content);
    const normalized = normalizeSqlWhitespace(noComments);
    const doRanges = findDoBlockRanges(normalized);

    const createStatements = extractCreateTables(normalized, doRanges, stats);
    for (const createStmt of createStatements) {
      const columns = new Set();
      const colRegex = /(?:^|,)\s*([a-z_][a-z0-9_]*)\s+/gi;
      let colMatch;
      colRegex.lastIndex = 0;
      while ((colMatch = colRegex.exec(createStmt.body)) !== null) {
        const colName = colMatch[1].toLowerCase();
        if (!['constraint', 'primary', 'foreign', 'unique', 'check', 'exclude'].includes(colName)) {
          columns.add(colName);
        }
      }
      schema.set(createStmt.tableName, columns);
    }

    // Parse ALTER TABLE ADD COLUMN
    const alterAddRegex = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
    let match;
    alterAddRegex.lastIndex = 0;
    while ((match = alterAddRegex.exec(normalized)) !== null) {
      const tableName = match[1].toLowerCase();
      const columnName = match[2].toLowerCase();
      stats.alterAddColumn += 1;
      if (!schema.has(tableName)) {
        schema.set(tableName, new Set());
      }
      schema.get(tableName).add(columnName);
    }

    // Parse ALTER TABLE RENAME COLUMN
    const alterRenameRegex = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+RENAME\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+TO\s+([a-z_][a-z0-9_]*)/gi;
    alterRenameRegex.lastIndex = 0;
    while ((match = alterRenameRegex.exec(normalized)) !== null) {
      const tableName = match[1].toLowerCase();
      const oldColumn = match[2].toLowerCase();
      const newColumn = match[3].toLowerCase();
      stats.alterRenameColumn += 1;
      if (!schema.has(tableName)) {
        schema.set(tableName, new Set());
      }
      if (schema.get(tableName).has(oldColumn)) {
        schema.get(tableName).delete(oldColumn);
      }
      schema.get(tableName).add(newColumn);
    }

    // Parse ALTER TABLE DROP COLUMN
    const alterDropRegex = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
    alterDropRegex.lastIndex = 0;
    while ((match = alterDropRegex.exec(normalized)) !== null) {
      const tableName = match[1].toLowerCase();
      const columnName = match[2].toLowerCase();
      stats.alterDropColumn += 1;
      if (schema.has(tableName)) {
        schema.get(tableName).delete(columnName);
      }
    }
  }

  return { schema, stats };
}

// ============================================================================
// VIOLATION CLASSIFICATION
// ============================================================================

const TRANSACTIONAL_TABLES = new Set([
  'bank_ledger', 'bank_transactions', 'bank_accounts', 'bank_splits',
  'orders', 'order_items', 'events', 'groups', 'bookings',
  'rides_rides', 'rides_ride_requests',
  'trust_events', 'trust_profiles', 'actor_reputation',
  'actor_debts', 'escrow_transactions',
  'payment_intents', 'payment_transactions',
  'order_sagas'
]);

const AUTHORIZED_BANK_WRITE = [
  'backend/src/modules/bank/',
  'backend/src/core/unifybank/',
];

const AUTHORIZED_BANK_READ = [
  ...AUTHORIZED_BANK_WRITE,
  'backend/src/modules/reconciliation/',
  'backend/src/core/reconciliation/',
  'backend/src/modules/reporting/',
  'backend/src/modules/audit/',
  'backend/src/modules/observability/',
  'backend/src/workers/financial-metrics-worker.ts',
  'backend/src/workers/payout-worker.ts',
  'backend/src/workers/ledger-snapshot-worker.ts',
  'backend/src/workers/governance-funding-commitment-worker.ts',
  'backend/src/workers/risk-analysis-worker.ts',
];

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase();
}

function isAllowedByPath(filePath, allowedList) {
  const n = normalizePath(filePath);
  return allowedList.some(item => n.includes(normalizePath(item)));
}

function hasDecisionClause(text) {
  return /\b(WHERE|CASE|HAVING|AND|OR)\b/i.test(text || '');
}

function detectViolationAndSeverity(ref, schema) {
  const snippet = String(ref.snippet || '');
  const pattern = String(ref.pattern || '').toUpperCase();
  const filePath = ref.file || '';

  // Condition 6: schema catch
  if (ref.type === 'schema_catch') {
    return { isViolation: true, severity: 'CORRUPTOR' };
  }

  // Condition 7: metadata-> decision on transactional table
  if (ref.type === 'metadata_decision') {
    const isDecision = hasDecisionClause(snippet);
    const hasTransactionalTable = Array.from(TRANSACTIONAL_TABLES).some(t => snippet.toLowerCase().includes(t));
    if (isDecision && hasTransactionalTable) {
      return { isViolation: true, severity: 'CORRUPTOR' };
    }
    return { isViolation: false, severity: null };
  }

  if (ref.type === 'table') {
    const tableName = String(ref.name || '').toLowerCase();
    const isBankTable = ['bank_ledger', 'bank_transactions', 'bank_accounts', 'bank_splits'].includes(tableName);
    const isWrite = ['INSERT', 'UPDATE', 'DELETE'].includes(pattern);
    const isRead = ['FROM', 'JOIN'].includes(pattern);

    // Condition 3: bank_* write outside authorized write modules
    if (isBankTable && isWrite && !isAllowedByPath(filePath, AUTHORIZED_BANK_WRITE)) {
      return { isViolation: true, severity: 'BLOCKER' };
    }

    // Condition 4: bank_* read outside authorized read modules
    if (tableName.startsWith('bank_') && isRead && !isAllowedByPath(filePath, AUTHORIZED_BANK_READ)) {
      return { isViolation: true, severity: 'CORRUPTOR' };
    }

    // Condition 5: INSERT INTO actors outside actor writer
    if (tableName === 'actors' && pattern === 'INSERT' && !isAllowedByPath(filePath, ['modules/identity/actor-writer.service.ts'])) {
      return { isViolation: true, severity: 'CORRUPTOR' };
    }

    // Condition 1: ghost table
    if (!schema.has(tableName)) {
      if (isWrite) {
        return { isViolation: true, severity: 'BLOCKER' };
      }
      if (isRead) {
        return { isViolation: true, severity: hasDecisionClause(snippet) ? 'CORRUPTOR' : 'DEBT' };
      }
      return { isViolation: true, severity: 'DEBT' };
    }

    return { isViolation: false, severity: null };
  }

  if (ref.type === 'column') {
    // Condition 2: ghost column (only when left-side token maps directly to a real table)
    if (schema.has(ref.table) && !schema.get(ref.table).has(ref.name)) {
      if (/\bINSERT\s+INTO\b|\bUPDATE\b.*\bSET\b|\bSET\s+[a-z_][a-z0-9_]*\s*=/i.test(snippet)) {
        return { isViolation: true, severity: 'BLOCKER' };
      }
      if (hasDecisionClause(snippet)) {
        return { isViolation: true, severity: 'CORRUPTOR' };
      }
      return { isViolation: true, severity: 'DEBT' };
    }
    return { isViolation: false, severity: null };
  }

  return { isViolation: false, severity: null };
}

// ============================================================================
// ALLOWLIST
// ============================================================================

function loadAllowlist() {
  const allowlist = { version: 1, entries: [] };
  if (fs.existsSync(CONFIG.allowlistPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(CONFIG.allowlistPath, 'utf-8'));
      if (content.entries) {
        allowlist.entries = content.entries;
      }
    } catch (err) {
      log(`[WARNING] Failed to parse allowlist: ${err.message}`);
    }
  }
  return allowlist;
}

function validateAllowlist(allowlist) {
  const errors = [];
  const expired = [];

  for (const entry of allowlist.entries) {
    const requiredFields = ['id', 'type', 'pattern', 'reason', 'owner', 'deadline', 'issue_id'];
    for (const field of requiredFields) {
      if (!entry[field]) {
        errors.push(`Allowlist entry ${entry.id || '?'} missing field: ${field}`);
      }
    }

    if (entry.deadline) {
      const deadline = new Date(entry.deadline);
      if (deadline < new Date()) {
        expired.push(`${entry.id} (deadline: ${entry.deadline})`);
      }
    }
  }

  return { errors, expired };
}

function isAllowlisted(ref, allowlist, filePath) {
  for (const entry of allowlist.entries) {
    const fileScope = entry.files_scope || [];
    const inScope = fileScope.some(scope => filePath.toLowerCase().includes(scope.toLowerCase()));
    if (!inScope) continue;

    if (entry.type === 'ghost_table' && ref.type === 'table' && entry.pattern.table === ref.name) {
      return entry.id;
    }
    if (entry.type === 'ghost_column' && ref.type === 'column' && entry.pattern.column === ref.name && entry.pattern.table === ref.table) {
      return entry.id;
    }
  }
  return null;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const startTime = new Date();
  log('\n=== SCHEMA-CODE COHERENCE GATE ===\n');
  log(`Timestamp: ${startTime.toISOString()}`);
  log(`Mode: ${CONFIG.mode.toUpperCase()}`);

  // Step 1: Scan files
  log('\nVARREDURA');
  const tsFiles = getAllTsFiles();
  log(`Arquivos .ts analisados: ${tsFiles.length}`);

  let allReferences = [];
  const extractionTotals = {
    candidatesRaw: 0,
    valid: 0,
    rejected: {
      logger: 0,
      comments: 0,
      camelCase: 0,
      other: 0,
    },
  };
  for (const file of tsFiles) {
    const { references, extraction } = extractReferencesFromFile(file);
    allReferences.push(...references);
    extractionTotals.candidatesRaw += extraction.candidatesRaw;
    extractionTotals.valid += extraction.valid;
    extractionTotals.rejected.logger += extraction.rejected.logger;
    extractionTotals.rejected.comments += extraction.rejected.comments;
    extractionTotals.rejected.camelCase += extraction.rejected.camelCase;
    extractionTotals.rejected.other += extraction.rejected.other;
  }

  const tableRefs = allReferences.filter(r => r.type === 'table');
  const colRefs = allReferences.filter(r => r.type === 'column');
  const uniqueTables = new Set(tableRefs.map(r => r.name));
  const uniqueColumns = new Set(colRefs.map(r => r.name));

  log(`Strings SQL candidatas (bruto): ${extractionTotals.candidatesRaw}`);
  log(`Strings SQL válidas (pós-filtro): ${extractionTotals.valid}`);
  log(`Rejeitadas: ${Math.max(0, extractionTotals.candidatesRaw - extractionTotals.valid)}`);
  log(`  - em log/logger: ${extractionTotals.rejected.logger}`);
  log(`  - em comentários: ${extractionTotals.rejected.comments}`);
  log(`  - camelCase: ${extractionTotals.rejected.camelCase}`);
  log(`  - outras: ${extractionTotals.rejected.other}`);
  log(`Queries SQL encontradas: ${extractionTotals.valid}`);
  log(`Tabelas referenciadas: ${uniqueTables.size}`);
  log(`Colunas referenciadas: ${uniqueColumns.size}`);

  // Step 2: Get schema
  log('\nSCHEMA');
  let schemaDb = null;
  let schemaMigrations = null;

  if (CONFIG.mode === 'strict' || CONFIG.mode === 'both') {
    log('Database: conectando...');
    schemaDb = await fetchSchemaFromDb();
    if (schemaDb) {
      log(`Database: OK (${schemaDb.size} tabelas)`);
    } else {
      log('Database: indisponível');
    }
  }

  if (CONFIG.mode === 'fallback' || CONFIG.mode === 'both') {
    log('Migrations: parseando...');
    const parsed = parseSchemaFromMigrations();
    schemaMigrations = parsed.schema;
    log(`CREATE TABLE padrão A detectados: ${parsed.stats.createPatternA}`);
    log(`CREATE TABLE padrão B (DO $$ block) detectados: ${parsed.stats.createPatternB}`);
    log(`ALTER TABLE ADD COLUMN detectados: ${parsed.stats.alterAddColumn}`);
    log(`ALTER TABLE RENAME COLUMN detectados: ${parsed.stats.alterRenameColumn}`);
    log(`ALTER TABLE DROP COLUMN detectados: ${parsed.stats.alterDropColumn}`);
    log(`Migrations: OK (${schemaMigrations.size} tabelas)`);
  }

  const schema = schemaDb || schemaMigrations;
  if (!schema) {
    log('ERRO: Schema não disponível. Impossível continuar.');
    process.exit(1);
  }

  log(`Tabelas no banco/migrations: ${schema.size}`);

  if (CONFIG.mode === 'both' && schemaDb && schemaMigrations) {
    const dbTables = new Set(schemaDb.keys());
    const migTables = new Set(schemaMigrations.keys());
    const onlyDb = [...dbTables].filter(t => !migTables.has(t));
    const onlyMig = [...migTables].filter(t => !dbTables.has(t));
    if (onlyDb.length > 0 || onlyMig.length > 0) {
      log(`DIFF banco↔migrations:`);
      if (onlyDb.length > 0) log(`  - Em banco mas não em migrations: ${onlyDb.slice(0, 5).join(', ')}${onlyDb.length > 5 ? ` (+${onlyDb.length - 5})` : ''}`);
      if (onlyMig.length > 0) log(`  - Em migrations mas não em banco: ${onlyMig.slice(0, 5).join(', ')}${onlyMig.length > 5 ? ` (+${onlyMig.length - 5})` : ''}`);
    }
  }

  // Step 3: Classify violations
  log('\nVIOLAÇÕES');
  const violations = { BLOCKER: [], CORRUPTOR: [], DEBT: [] };
  const allowlist = loadAllowlist();
  const { errors: allowlistErrors, expired: allowlistExpired } = validateAllowlist(allowlist);

  if (allowlistErrors.length > 0) {
    log('ERRO: Allowlist inválida:');
    allowlistErrors.forEach(e => log(`  - ${e}`));
    process.exit(1);
  }

  if (allowlistExpired.length > 0) {
    log('ERRO: Allowlist expirada:');
    allowlistExpired.forEach(e => log(`  - ${e}`));
    process.exit(1);
  }

  const allowlistedIds = new Set();
  for (const ref of allReferences) {
    const detected = detectViolationAndSeverity(ref, schema);
    if (!detected.isViolation || !detected.severity) {
      continue;
    }

    const allowlistId = isAllowlisted(ref, allowlist, ref.file);
    if (allowlistId) {
      allowlistedIds.add(allowlistId);
    } else {
      violations[detected.severity].push(ref);
    }
  }

  const blockersCount = violations.BLOCKER.length;
  const corruptorsCount = violations.CORRUPTOR.length;
  const debtCount = violations.DEBT.length;

  if (violations.BLOCKER.length > 0) {
    log(`\n[BLOCKER] ${blockersCount} violações:`);
    violations.BLOCKER.slice(0, 5).forEach(v => {
      log(`  - ${v.file}:${v.line}`);
      log(`    Tabela: ${v.name} (${v.pattern})`);
      log(`    Snippet: ${v.snippet.slice(0, 70)}`);
    });
    if (blockersCount > 5) log(`  ... e mais ${blockersCount - 5}`);
  }

  if (violations.CORRUPTOR.length > 0) {
    log(`\n[CORRUPTOR] ${corruptorsCount} violações:`);
    violations.CORRUPTOR.slice(0, 5).forEach(v => {
      log(`  - ${v.file}:${v.line}`);
      if (v.type === 'schema_catch') {
        log(`    Padrão: Schema catch (C14)`);
      } else if (v.type === 'metadata_decision') {
        log(`    Padrão: Metadata em decisão (${v.pattern})`);
      } else {
        log(`    Tabela: ${v.name}`);
      }
      log(`    Snippet: ${v.snippet.slice(0, 70)}`);
    });
    if (corruptorsCount > 5) log(`  ... e mais ${corruptorsCount - 5}`);
  }

  if (violations.DEBT.length > 0) {
    log(`\n[DEBT] ${debtCount} violações (não-bloqueantes)`);
  }

  // Step 4: Allowlist summary
  log('\nALLOWLIST APLICADO');
  if (allowlistedIds.size > 0) {
    log(`✓ ${allowlistedIds.size} entrada(s) de allowlist aplicada(s)`);
    [...allowlistedIds].forEach(id => {
      const entry = allowlist.entries.find(e => e.id === id);
      if (entry) {
        log(`  ✓ ${id}: ${entry.reason} (deadline ${entry.deadline}, owner ${entry.owner})`);
      }
    });
  } else {
    log('✓ Sem entradas de allowlist ativas');
  }

  // Step 5: Summary
  log('\nRESUMO');
  log(`Violações bloqueantes: ${blockersCount}`);
  log(`Violações corruptoras: ${corruptorsCount}`);
  log(`Violações como débito: ${debtCount}`);
  log(`Allowlist válida: ${allowlist.entries.length} entradas`);

  // Step 6: Result
  const totalBlockers = blockersCount + corruptorsCount;
  log('\nRESULTADO');
  if (totalBlockers === 0) {
    log('✓ PASS: Nenhuma violação bloqueante');
    process.exit(0);
  } else {
    log(`✗ FAIL: ${totalBlockers} violação(s) bloqueante(s)`);
    process.exit(1);
  }
}

main().catch(err => {
  log(`ERRO: ${err.message}`);
  process.exit(1);
});
