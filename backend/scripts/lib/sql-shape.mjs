// backend/scripts/lib/sql-shape.mjs
// F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION — biblioteca LÉXICA/ESTRUTURAL de forma de SQL.
//
// NEUTRO por construcao: nao contem NENHUM nome de tabela/coluna/dominio de negocio; nao emite
// julgamento de dominio (so reconhece FORMA); nao faz I/O; sem estado global; ESM puro, zero dependencia.
// Os ALVOS (nomes de objeto protegidos) e toda a SEMANTICA vivem nas REGRAS LOCAIS de cada guard —
// aqui so ha reconhecimento de FORMA (comentarios, strings, dollar-quote, schema-qualification,
// identifiers quoted, statements, CREATE/SELECT-INTO/RENAME, REFERENCES, FROM/JOIN, EXECUTE).
//
// API:
//   stripSqlComments(sql)                         -> sql sem comentarios -- e /* */ (aninhados),
//                                                    preservando strings e dollar-quote.
//   maskStringLiterals(sql, opts)                 -> literais '...'/E'...' (e opcional $tag$...$tag$)
//                                                    esvaziados; identifiers "..." preservados.
//   normalizeName(token)                          -> { schema, name } sem aspas.
//   splitStatements(sql)                          -> statements por ';' fora de string/dollar/comentario.
//   createsTarget(text, targetName)               -> {hit, form} para CREATE TABLE / CTAS / SELECT INTO
//                                                    / RENAME TO do alvo (schema-qual + quoted + IF NOT EXISTS).
//   referencesTarget(text, targetName, opts)      -> {hit, form}; opts.mode 'fk' (REFERENCES alvo) |
//                                                    'read' (FROM/JOIN/comma/UPDATE/INTO alvo).
//   extractExecuteLiterals(sql)                   -> [{ resolvableText, hasDynamicArg }] por EXECUTE.
//   tokenPresent(text, targetName)                -> boolean: alvo como identificador isolado.
//
// Todas as funcoes sao puras (mesma entrada -> mesma saida).

// ── scanner interno: classifica cada trecho por estado lexico (uma passada) ──
// Retorna array de segmentos { type, text }. type ∈
//   'code' | 'lineComment' | 'blockComment' | 'sqStr' | 'dqIdent' | 'dollar'
// (E'...' e tratada como sqStr com escapes de backslash).
function scan(sql) {
  const segs = [];
  const n = sql.length;
  let i = 0;
  let code = '';
  const flushCode = () => { if (code) { segs.push({ type: 'code', text: code }); code = ''; } };
  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];
    // comentario de linha --
    if (c === '-' && c2 === '-') {
      flushCode();
      let j = i + 2;
      while (j < n && sql[j] !== '\n') j++;
      segs.push({ type: 'lineComment', text: sql.slice(i, j) });
      i = j;
      continue;
    }
    // comentario de bloco /* */ (aninhado)
    if (c === '/' && c2 === '*') {
      flushCode();
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') { depth++; j += 2; continue; }
        if (sql[j] === '*' && sql[j + 1] === '/') { depth--; j += 2; continue; }
        j++;
      }
      segs.push({ type: 'blockComment', text: sql.slice(i, j) });
      i = j;
      continue;
    }
    // string E'...' (escapes com backslash)
    if ((c === 'E' || c === 'e') && c2 === "'") {
      flushCode();
      let j = i + 2;
      while (j < n) {
        if (sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      segs.push({ type: 'sqStr', text: sql.slice(i, j) });
      i = j;
      continue;
    }
    // string '...' (aspas simples; '' = escape)
    if (c === "'") {
      flushCode();
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      segs.push({ type: 'sqStr', text: sql.slice(i, j) });
      i = j;
      continue;
    }
    // identifier "..." (aspas duplas; "" = escape)
    if (c === '"') {
      flushCode();
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"' && sql[j + 1] === '"') { j += 2; continue; }
        if (sql[j] === '"') { j++; break; }
        j++;
      }
      segs.push({ type: 'dqIdent', text: sql.slice(i, j) });
      i = j;
      continue;
    }
    // dollar-quote $$...$$ ou $tag$...$tag$
    if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        flushCode();
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end < 0 ? n : end + tag.length;
        segs.push({ type: 'dollar', text: sql.slice(i, stop), tag });
        i = stop;
        continue;
      }
    }
    code += c;
    i++;
  }
  flushCode();
  return segs;
}

export function stripSqlComments(sql) {
  return scan(sql)
    .map((s) => (s.type === 'lineComment' || s.type === 'blockComment') ? ' ' : s.text)
    .join('');
}

export function maskStringLiterals(sql, opts = {}) {
  const maskDollar = opts.maskDollarQuotes !== false; // default: mascara dollar-quote
  return scan(sql)
    .map((s) => {
      if (s.type === 'sqStr') return "''";
      if (s.type === 'dollar' && maskDollar) return (s.tag || '$$') + (s.tag || '$$');
      return s.text;
    })
    .join('');
}

export function normalizeName(token) {
  const raw = String(token).trim();
  const parts = raw.split('.').map((p) => p.trim().replace(/^"(.*)"$/, '$1'));
  if (parts.length >= 2) return { schema: parts[parts.length - 2], name: parts[parts.length - 1] };
  return { schema: null, name: parts[0] };
}

export function splitStatements(sql) {
  const out = [];
  let cur = '';
  for (const s of scan(sql)) {
    if (s.type === 'code') {
      for (const ch of s.text) {
        if (ch === ';') { out.push(cur); cur = ''; } else cur += ch;
      }
    } else {
      cur += s.text;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// escape de metacaracteres regex
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// fragmento que casa o alvo com schema-qualification opcional + aspas opcionais, bounded, case-insensitive.
function targetFrag(name) {
  const n = esc(name);
  const ident = '(?:"[^"]+"|[A-Za-z_][\\w$]*)';
  // (?<![\w$]) evita casar sufixo de identificador maior; schema. opcional; aspas opcionais no alvo.
  return `(?<![\\w$])(?:${ident}\\s*\\.\\s*)?"?${n}"?(?![\\w$])`;
}

export function tokenPresent(text, targetName) {
  return new RegExp(targetFrag(targetName), 'i').test(text);
}

export function createsTarget(text, targetName) {
  const t = targetFrag(targetName);
  const checks = [
    { form: 'CREATE_TABLE', re: new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${t}`, 'i') },
    { form: 'RENAME_TO', re: new RegExp(`\\bRENAME\\s+TO\\s+${t}`, 'i') },
  ];
  for (const c of checks) if (c.re.test(text)) return { hit: true, form: c.form };
  // SELECT ... INTO alvo  (materializa) — excluindo INSERT INTO alvo (escrita, nao criacao)
  const selInto = new RegExp(`\\bSELECT\\b[\\s\\S]*?\\bINTO\\s+(?:TEMP(?:ORARY)?\\s+)?${t}`, 'i');
  const insInto = new RegExp(`\\bINSERT\\s+INTO\\s+${t}`, 'i');
  if (selInto.test(text) && !insInto.test(text)) return { hit: true, form: 'SELECT_INTO' };
  return { hit: false, form: null };
}

export function referencesTarget(text, targetName, opts = {}) {
  const mode = opts.mode || 'read';
  const t = targetFrag(targetName);
  if (mode === 'fk') {
    const re = new RegExp(`\\bREFERENCES\\s+${t}`, 'i');
    return re.test(text) ? { hit: true, form: 'REFERENCES' } : { hit: false, form: null };
  }
  // mode 'read': FROM / <qualquer> JOIN / comma-join / UPDATE / INTO (escrita/leitura do objeto)
  const forms = [
    { form: 'FROM', re: new RegExp(`\\bFROM\\s+${t}`, 'i') },
    { form: 'JOIN', re: new RegExp(`\\bJOIN\\s+${t}`, 'i') },
    { form: 'UPDATE', re: new RegExp(`\\bUPDATE\\s+${t}`, 'i') },
    { form: 'INTO', re: new RegExp(`\\bINTO\\s+${t}`, 'i') },
    { form: 'COMMA_JOIN', re: new RegExp(`,\\s*${t}`, 'i') },
  ];
  for (const f of forms) if (f.re.test(text)) return { hit: true, form: f.form };
  return { hit: false, form: null };
}

export function extractExecuteLiterals(sql) {
  // Expõe corpos plpgsql (DO $tag$ ... $tag$ / corpo de função) para achar EXECUTE lá dentro:
  // substitui cada dollar-quote pelo seu conteúdo interno (o SQL dinâmico vive nesse corpo).
  const flat = scan(sql)
    .map((s) => (s.type === 'dollar' && s.tag) ? s.text.slice(s.tag.length, s.text.length - s.tag.length) : s.text)
    .join('');
  const units = [];
  for (const stmt of splitStatements(flat)) {
    if (!/\bEXECUTE\b/i.test(stmt)) continue;
    // corpo textual dos literais (strings) deste statement EXECUTE
    const literals = [];
    for (const s of scan(stmt)) {
      if (s.type === 'sqStr') {
        // remove aspas externas + desescapa '' ; E'...' remove o E
        let body = s.text.replace(/^E/i, '');
        body = body.replace(/^'|'$/g, '').replace(/''/g, "'");
        literals.push(body);
      }
    }
    // arg dinamico: format(...) com argumento que NAO e literal (identificador/variavel apos virgula)
    const codeOnly = scan(stmt).filter((s) => s.type === 'code').map((s) => s.text).join(' ');
    const hasDynamicArg = /\bformat\s*\([\s\S]*?,\s*[A-Za-z_]/i.test(stmt) || /\bEXECUTE\s+[A-Za-z_]\w*\s*(?:;|$)/i.test(codeOnly);
    units.push({ resolvableText: literals.join('\n'), hasDynamicArg });
  }
  return units;
}
