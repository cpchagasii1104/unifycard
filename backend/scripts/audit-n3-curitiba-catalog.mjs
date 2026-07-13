#!/usr/bin/env node
// Guard — N3 · CATÁLOGO CANÔNICO DE BAIRROS DE CURITIBA (manifest + loader one-shot).
// Pergunta própria: "o manifest declara EXATAMENTE 75 bairros de Curitiba (city/tenant/actor fixos ratificados,
// source_kind government_official, nomes únicos sem whitespace de borda) e o loader os cria SÓ pelo writer canônico
// N2-E (fn_create_canonical_neighborhood, nome PARAMETRIZADO, sem INSERT direto), numa transação com advisory lock,
// estado-inicial-zero, dry-run default, apply gated por token, ROLLBACK no dry-run — sem ON CONFLICT/DELETE,
// sem alias/succession/mutação de address, sem rota/Bank/Social?"
// Comment-aware (strip JS) e liveness. Estado vivo = introspecção. Parse fail = FAIL.

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

// V1 — HASH CANÔNICO do conjunto ratificado dos 75 (projeção [ordinal, name], Unicode/acento-exato, ordem
// exata do manifest em a76abfe34). Calculado UMA vez do manifest intacto e FIXADO aqui (nunca derivado
// dinamicamente do próprio manifest): qualquer troca de nome/acento/caixa/whitespace/ordinal/posição/
// item-faltante/extra/substituição-com-count-75 muda o hash e FALHA.
const EXPECTED_ITEMS_SHA256 = '3ee1ed8382f764862da51548ff8d7dfdaecf01b932d6404593d997f4b9921bc3';

function stripJsComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    if (c === '\\') { out += c + (d || ''); i += 2; continue; }
    if (mode === 'sq' && c === "'") mode = 'code';
    else if (mode === 'dq' && c === '"') mode = 'code';
    else if (mode === 'tpl' && c === '`') mode = 'code';
    out += c; i++;
  }
  return out;
}

const CITY = '9d431002-1fd3-4b34-ae82-678f28f64288';
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const MANIFEST = join(ROOT, 'scripts', 'curitiba-neighborhoods-manifest.json');
const LOADER = join(ROOT, 'scripts', 'n3-load-curitiba-neighborhoods.mjs');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');

// ── A. MANIFEST ──
if (!existsSync(MANIFEST)) {
  note('A0: manifest curitiba-neighborhoods-manifest.json ausente');
} else {
  let M;
  try { M = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch (e) { note('A1: manifest não é JSON válido: ' + e.message); }
  if (M) {
    const meta = M.meta || {}, items = M.items || [];
    if (meta.city_id !== CITY) note('A2: manifest.city_id não é Curitiba');
    if (meta.grantee_actor_id !== ACTOR) note('A3: manifest.grantee_actor_id não é o Actor ratificado');
    if (meta.source_kind !== 'government_official') note("A4: manifest.source_kind não é 'government_official'");
    if (meta.expected_count !== 75) note('A5: manifest.expected_count != 75');
    if (items.length !== 75) note(`A6: manifest tem ${items.length} itens (esperado 75)`);
    const names = items.map((i) => i && i.name);
    if (!names.every((n) => typeof n === 'string' && n.length > 0 && n === n.trim())) note('A7: nome vazio ou com whitespace de borda');
    if (new Set(names).size !== names.length) note('A8: nome duplicado exato no manifest');
    const ords = items.map((i) => i && i.ordinal);
    if (new Set(ords).size !== 75 || Math.min(...ords) !== 1 || Math.max(...ords) !== 75) note('A9: ordinais não são 1..75 únicos');
    // V1 — CONJUNTO CANÔNICO EXATO: hash determinístico da projeção parseada [ordinal, name] (não dos bytes
    // do arquivo → formatação JSON é benigna). Sem sort/trim/normalização: Unicode exato, ordem exata.
    const projection = JSON.stringify(items.map((i) => [i && i.ordinal, i && i.name]));
    const gotHash = createHash('sha256').update(projection, 'utf8').digest('hex');
    if (gotHash !== EXPECTED_ITEMS_SHA256) {
      note(`A12v1: conjunto dos 75 DIVERGE do ratificado — sha256 esperado=${EXPECTED_ITEMS_SHA256} obtido=${gotHash} (nome/acento/caixa/whitespace/ordinal/posição alterado, item faltante/extra ou substituído)`);
    }
    // V2 — SCHEMA EXATO por item: exatamente {ordinal, name}; qualquer chave extra (tenant_id, city_id,
    // CEP, lat/lng, metadata, name_normalized, …) FALHA mesmo que o loader não a leia.
    for (const it of items) {
      const keys = Object.keys(it || {}).sort();
      if (keys.length !== 2 || keys[0] !== 'name' || keys[1] !== 'ordinal') {
        note(`A13v2: item ordinal=${it && it.ordinal} tem chaves [${keys.join(',')}] — permitido EXATAMENTE {ordinal, name}`);
        break;
      }
    }
    if (!meta.source_reference || !/IPPUC/i.test(meta.source_reference)) note('A10: source_reference sem referência oficial (IPPUC)');
    // manifest NÃO pode conter neighborhood_id/tenant financeiro/CEP/lat-lng/alias
    const raw = readFileSync(MANIFEST, 'utf8');
    if (/"neighborhood_id"|"cep"|"lat"|"lng"|"alias"|"bank"|"category_id"|"concept_id"/i.test(raw)) note('A11: manifest contém campo proibido (neighborhood_id/cep/lat/lng/alias/bank/category/concept)');
  }
}

// ── B. LOADER ──
if (!existsSync(LOADER)) {
  note('B0: loader n3-load-curitiba-neighborhoods.mjs ausente');
} else {
  const raw = readFileSync(LOADER, 'utf8');
  const s = stripJsComments(raw);
  // writer canônico como ÚNICO criador; nome parametrizado ($5), NÃO inline
  if (!/fn_create_canonical_neighborhood\(\$1,\$2,\$3,\$4,\$5/.test(s)) note('B1: loader não cria via writer canônico com nome PARAMETRIZADO ($5)');
  if (/INSERT\s+INTO\s+(public\.)?neighborhoods\b/i.test(s)) note('B2: loader faz INSERT direto em neighborhoods (proibido — só via writer)');
  if (/DISABLE\s+TRIGGER|session_replication_role|set_config/i.test(s)) note('B3: loader desabilita trigger / usa session_replication_role (proibido)');
  // advisory lock + estado-zero + apply gated + rollback + refuse app
  if (!/pg_advisory_xact_lock/.test(s)) note('B4: loader sem advisory lock');
  if (!/neighborhoods'\)\)\.rows\[0\]\.n|n0\s*!==\s*0|NÃO-ZERO/.test(s)) note('B5: loader não exige estado inicial neighborhoods=0');
  if (!/N3-LOAD-CURITIBA/.test(s) || !/--apply/.test(s)) note('B6: loader sem apply gated por token de confirmação');
  // ═══ C1/C2/C3 — PROVA ESTRUTURAL DA TRANSAÇÃO (skeleton + brace-matching real) ═══
  // skeleton = mesmo texto com conteúdo de strings/templates BLANKED char-a-char (comprimento preservado
  // → posições no skeleton == posições em s). Braces dentro de logs/templates não confundem o matching;
  // as CHAMADAS reais são detectadas em s pelas mesmas posições.
  // M1 — o skeleton também TOKENIZA literal regex (blanka o corpo, mantém delimitadores/flags, offsets 1:1),
  // registrando em regexEnds o índice do ÚLTIMO char de cada regex (VALUE/receiver). Assim L1 governa qualquer
  // `[` após regex. A escolha regex-vs-divisão usa o último token significativo já emitido no skeleton.
  const regexEnds = new Set();
  const skel = (() => {
    let out = '', i = 0, mode = 'code'; const n = s.length;
    const lastSig = () => { let k = out.length - 1; while (k >= 0 && /\s/.test(out[k])) k--; return k >= 0 ? out[k] : ''; };
    while (i < n) {
      const c = s[i], d = s[i + 1];
      if (mode === 'code') {
        if (c === "'") { mode = 'sq'; out += c; i++; continue; }
        if (c === '"') { mode = 'dq'; out += c; i++; continue; }
        if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
        if (c === '/' && d !== '/' && d !== '*') {
          // regex vs divisão pelo último TOKEN (não só char): ) ] identificador/número → divisão; keyword de
          // expressão (return/throw/case/typeof/…) ou qualquer outro contexto (operador/(/,/;/=/etc.) → regex.
          const p = lastSig();
          let isDiv = /[)\]]/.test(p);
          if (/[A-Za-z0-9_$]/.test(p)) {
            let k = out.length - 1; while (k >= 0 && /\s/.test(out[k])) k--;
            let w = k; while (w >= 0 && /[A-Za-z0-9_$]/.test(out[w])) w--;
            const EXPR_KW = new Set(['return', 'throw', 'case', 'do', 'else', 'void', 'typeof', 'delete', 'in', 'of', 'instanceof', 'new', 'yield', 'await', 'default']);
            isDiv = !EXPR_KW.has(out.slice(w + 1, k + 1)); // identificador/número real → divisão; keyword → regex
          }
          if (!isDiv) {
            let j = i + 1, inClass = false, ok = false, body = '/';
            while (j < n) {
              const cj = s[j];
              if (cj === '\\') { body += 'xx'; j += 2; continue; }
              if (cj === '\n') break;                      // regex não-terminado
              if (cj === '[') { inClass = true; body += 'x'; j++; continue; }
              if (cj === ']') { inClass = false; body += 'x'; j++; continue; }
              if (cj === '/' && !inClass) { ok = true; break; }
              body += 'x'; j++;
            }
            if (ok) {
              body += '/'; j++;
              while (j < n && /[A-Za-z]/.test(s[j])) { body += s[j]; j++; } // flags
              out += body; regexEnds.add(out.length - 1); i = j; continue;
            }
            // regex não-terminado: emite o '/' e segue (member access posterior mordido por L1 mesmo assim)
          }
          out += c; i++; continue;
        }
        out += c; i++; continue;
      }
      if (c === '\\') { out += 'xx'; i += 2; continue; }
      if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) { mode = 'code'; out += c; i++; continue; }
      out += 'x'; i++;
    }
    return out;
  })();
  const braceEnd = (text, openIdx) => { // índice do '}' que fecha o '{' em openIdx (sobre o skeleton)
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
  };
  // ── INVENTÁRIO ESTRUTURAL ÚNICO (F2): toda .query( enumerada sobre o skeleton com posição + comando
  //    transacional classificado. C1/C2/C3 e a contagem BEGIN/COMMIT/ROLLBACK derivam SÓ deste inventário
  //    (sem regex textual paralela); texto em string/template/log/comentário está blankado no skeleton e
  //    o literal SQL é extraído da FONTE no offset exato do call-site. classifyTxLiteral: função hoisted (E3).
  const callSites = [];
  {
    const INVOKE = /(\w+)\s*\.\s*query\s*\(/g;
    let m2;
    while ((m2 = INVOKE.exec(skel))) {
      const site = { idx: m2.index, receiver: m2[1], command: null };
      callSites.push(site);
      if (m2[1] !== 'client') { note(`D1a: receiver de .query() não é client: '${m2[1]}'`); continue; }
      let p = m2.index + m2[0].length;
      while (p < s.length && /\s/.test(s[p])) p++;
      const q = s[p];
      if (q === "'" || q === '"') {
        let lit = '', i2 = p + 1;
        while (i2 < s.length) { if (s[i2] === '\\') { lit += s[i2 + 1]; i2 += 2; continue; } if (s[i2] === q) break; lit += s[i2]; i2++; }
        let after = i2 + 1;
        while (after < s.length && /\s/.test(s[after])) after++;
        if (s[after] !== ',' && s[after] !== ')') note(`D1d: 1º argumento de client.query não termina em ','/')' após o literal (concatenação/expressão) — SQL opaco proibido: "${lit.slice(0, 40)}${s[after]}…"`);
        const cls = classifyTxLiteral(lit);
        if (cls.commands.length > 0) {
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(cls.commands[0])) site.command = cls.commands[0];
          if (cls.stmtCount !== 1) note(`D2/E3: literal com comando transacional deve conter EXATAMENTE 1 statement — "${lit.slice(0, 60)}" tem ${cls.stmtCount} (composto proibido)`);
          else if (!['BEGIN', 'COMMIT', 'ROLLBACK'].includes(cls.commands[0])) note(`D2/E3: comando transacional não-canônico "${cls.commands[0]}" — permitidos apenas BEGIN | COMMIT | ROLLBACK (START TRANSACTION/SAVEPOINT/RELEASE/ABORT/END proibidos): "${lit.slice(0, 60)}"`);
        }
      } else if (q === '`') {
        const end = s.indexOf('`', p + 1);
        const tpl = end > 0 ? s.slice(p + 1, end) : '';
        if (end < 0 || tpl.includes('${')) note('D1b: 1º argumento de client.query é template com interpolação — SQL deve ser literal visível');
        else if (/\b(BEGIN|COMMIT|ROLLBACK|START|SAVEPOINT|RELEASE|ABORT|END)\b/i.test(tpl)) note('D1c: comando transacional em template — use literal canônico');
      } else {
        note(`D1: 1º argumento de client.query NÃO é literal (começa com '${q}') — variável/expressão/config-object/helper são SQL opaco proibido`);
      }
    }
  }
  // contagem transacional GLOBAL derivada EXCLUSIVAMENTE do inventário (F2)
  const txClass = { BEGIN: 0, COMMIT: 0, ROLLBACK: 0 };
  for (const cs of callSites) if (cs.command) txClass[cs.command]++;

  // gate ÚNICO por estrutura + C1/C2/C3 pelas POSIÇÕES do inventário
  const GATE_RE = /if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)\s*\{/g;
  const gates = [...skel.matchAll(GATE_RE)];
  if (gates.length !== 1) {
    note(`B7c3: esperado exatamente 1 gate (APPLY && CONFIRMED && !failed) — encontrados ${gates.length}`);
  } else {
    const gOpen = gates[0].index + gates[0][0].length - 1;
    const gClose = braceEnd(skel, gOpen);
    if (gClose < 0) { note('B7c3b: braces do gate não fecham'); }
    else {
      const afterGate = skel.slice(gClose + 1);
      const elseM2 = afterGate.match(/^\s*else\s*\{/);
      let eOpen = -1, eClose = -1;
      if (!elseM2) { note('B8c3: else PAR do gate ausente (dry-run/abort deve ser o else do próprio gate)'); }
      else { eOpen = gClose + 1 + elseM2[0].length - 1; eClose = braceEnd(skel, eOpen); if (eClose < 0) note('B8c3b: braces do else não fecham'); }

      // C1 — EXATAMENTE 1 call-site COMMIT (inventário), DENTRO do bloco do gate
      const commitSites = callSites.filter((cs) => cs.command === 'COMMIT');
      if (commitSites.length !== 1) note(`C1: esperado exatamente 1 COMMIT operacional (inventário estrutural) — encontrados ${commitSites.length} (BEGIN-antecipado/segundo-caminho/catch/finally/helper/opaco = evasão)`);
      else if (!(commitSites[0].idx > gOpen && commitSites[0].idx < gClose)) note('C1b: o único COMMIT está FORA do bloco do gate seguro');
      if (/\b(?:const|let|var)\s+\w+\s*=\s*client\s*[;\n,)]/.test(skel)) note('C1c: alias do client detectado — proibido nesta operação');

      // C2/C3 — do inventário: ROLLBACK alcançável no else PAR (blocos constante-falsos excisados); nenhum COMMIT no else
      if (eOpen >= 0 && eClose > 0) {
        const elseSkel = skel.slice(eOpen + 1, eClose);
        const dead = [];
        const FALSE_IF = /if\s*\(\s*(?:false|0|null|undefined|!\s*true|''|""|1\s*===\s*2|Boolean\(\s*false\s*\))\s*\)\s*\{/g;
        let fm;
        while ((fm = FALSE_IF.exec(elseSkel))) { const fOpen = fm.index + fm[0].length - 1; const fClose = braceEnd(elseSkel, fOpen); if (fClose > 0) dead.push([eOpen + 1 + fm.index, eOpen + 1 + fClose]); }
        const rbInElse = callSites.filter((cs) => cs.command === 'ROLLBACK' && cs.idx > eOpen && cs.idx < eClose && !dead.some(([a, b]) => cs.idx >= a && cs.idx <= b));
        if (rbInElse.length === 0) note("C2: nenhum call-site ROLLBACK alcançável no else do gate (if(false)/log/string/comentário não satisfazem)");
        else { const firstRb = Math.min(...rbInElse.map((cs) => cs.idx)); const termRel = elseSkel.search(/\breturn\b|process\.exit\(|\bthrow\b/); if (termRel >= 0 && (eOpen + 1 + termRel) < firstRb) note('C2b: ROLLBACK do dry-run só após return/exit/throw (inalcançável)'); }
        if (commitSites.some((cs) => cs.idx > eOpen && cs.idx < eClose)) note("C3: COMMIT no ramo dry-run — dry-run não pode persistir");
      }
    }
  }

  // ═══ E3 — LEXER SQL POR STATEMENT (dollar-quote/quoted-ident/comentário/CASE...END aware) ═══
  // Retorna { stmtCount, commands[] } onde commands = comandos transacionais (1º token do statement).
  function classifyTxLiteral(sql) {
    // 1) split em statements por ';' FORA de string ''/ident ""/comentário/dollar-quoted; blank do miolo
    const stmts = [];
    let cur = '', i = 0; const n = sql.length;
    while (i < n) {
      const c = sql[i], d = sql[i + 1];
      if (c === "'") { // string SQL (escape '')
        cur += ' '; i++;
        while (i < n) { if (sql[i] === "'" && sql[i + 1] === "'") { cur += '  '; i += 2; continue; } if (sql[i] === "'") { cur += ' '; i++; break; } cur += ' '; i++; }
        continue;
      }
      if (c === '"') { // quoted identifier ("COMMIT" é IDENT, não comando)
        cur += 'x'; i++;
        while (i < n) { if (sql[i] === '"' && sql[i + 1] === '"') { cur += 'xx'; i += 2; continue; } if (sql[i] === '"') { cur += 'x'; i++; break; } cur += 'x'; i++; }
        continue;
      }
      if (c === '-' && d === '-') { while (i < n && sql[i] !== '\n') { cur += ' '; i++; } continue; }
      if (c === '/' && d === '*') { cur += '  '; i += 2; while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) { cur += ' '; i++; } cur += '  '; i += 2; continue; }
      if (c === '$') { // dollar-quoted: $$...$$ ou $tag$...$tag$
        const tagM = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
        if (tagM) { const tag = tagM[0]; cur += ' '.repeat(tag.length); i += tag.length;
          const close = sql.indexOf(tag, i); const endp = close < 0 ? n : close;
          cur += ' '.repeat(endp - i); i = endp; if (close >= 0) { cur += ' '.repeat(tag.length); i += tag.length; } continue; }
      }
      if (c === ';') { stmts.push(cur); cur = ''; i++; continue; }
      cur += c; i++;
    }
    if (cur.trim() !== '') stmts.push(cur);
    const realStmts = stmts.filter((st) => st.trim() !== '');
    // 2) 1º token significativo de cada statement (sobre a visão blankada → CASE...END/'x'/idents não confundem)
    const TX = { BEGIN: 1, COMMIT: 1, ROLLBACK: 1, ABORT: 1, SAVEPOINT: 1, START: 1, RELEASE: 1, END: 1 };
    const commands = [];
    for (const st of realStmts) {
      const tok = (st.trim().match(/^[A-Za-z_][A-Za-z_0-9]*/) || [''])[0].toUpperCase();
      if (TX[tok]) commands.push(tok === 'START' ? 'START TRANSACTION' : tok === 'RELEASE' ? 'RELEASE SAVEPOINT' : tok);
    }
    return { stmtCount: realStmts.length, commands };
  }

  // ═══ E1 — ALLOWLIST EXATA DE IMPORTS (SQL não pode escapar por helper importado) ═══
  {
    const rawLoader = readFileSync(LOADER, 'utf8');
    const ALLOWED = {
      pg: { default: 'pg', named: [] },
      fs: { named: ['readFileSync'] }, 'node:fs': { named: ['readFileSync'] },
      url: { named: ['fileURLToPath'] }, 'node:url': { named: ['fileURLToPath'] },
      path: { named: ['dirname', 'join'] }, 'node:path': { named: ['dirname', 'join'] },
      crypto: { named: ['createHash'] }, 'node:crypto': { named: ['createHash'] },
    };
    const importRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    let im;
    while ((im = importRe.exec(rawLoader))) {
      const clause = im[1].trim(), mod = im[2];
      if (!ALLOWED[mod]) { note(`E1a: import de módulo fora da allowlist: '${mod}'`); continue; }
      if (/\*\s+as\s+/.test(clause)) note(`E1b: namespace import permissivo ('* as') de '${mod}' — proibido`);
      const defM = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
      const namedM = clause.match(/\{([^}]*)\}/);
      const named = namedM ? namedM[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
      const spec = ALLOWED[mod];
      if (defM && !spec.default) note(`E1c: import default inesperado de '${mod}'`);
      for (const nm of named) if (!(spec.named || []).includes(nm)) note(`E1d: símbolo '${nm}' fora da allowlist de '${mod}'`);
    }
    // proibir side-effect import e vias dinâmicas de módulo/SQL externo
    if (/import\s+['"][^'"]+['"]/.test(rawLoader)) note('E1e: side-effect import (import "x") — proibido');
    if (/\bimport\s*\(/.test(rawLoader)) note('E1f: import dinâmico import(...) — proibido');
    if (/\brequire\s*\(/.test(rawLoader)) note('E1g: require(...) — proibido');
    if (/createRequire|process\.mainModule/.test(rawLoader)) note('E1h: createRequire/process.mainModule — proibido');
  }

  // ═══ E2 — PROIBIÇÃO DE REFLEXÃO/PROTOTYPE (query não pode ser alcançada sem chamada direta inventariada) ═══
  {
    const REFLECT = [
      [/\.call\s*\(/, '.call('], [/\.apply\s*\(/, '.apply('], [/\.bind\s*\(/, '.bind('],
      [/\.prototype\b/, '.prototype'], [/__proto__/, '__proto__'], [/\.constructor\b/, '.constructor'],
      [/getPrototypeOf/, 'getPrototypeOf'], [/setPrototypeOf/, 'setPrototypeOf'],
      [/getOwnPropertyDescriptor/, 'getOwnPropertyDescriptor'], [/defineProperty/, 'defineProperty'],
      [/\bReflect\b/, 'Reflect'], [/\bProxy\b/, 'Proxy'], [/\bFunction\s*\(/, 'Function('], [/\beval\s*\(/, 'eval('],
    ];
    for (const [re, name] of REFLECT) if (re.test(skel)) note(`E2: mecanismo de reflexão/prototype proibido nesta one-shot: ${name}`);
  }

  // ═══ L1 — REFLEXÃO POR ACESSO-MEMBRO COMPUTADO (qualquer receiver) ═══
  // Um `[` é ACESSO-MEMBRO (não array-literal) quando precedido por um receiver: identificador (não-keyword),
  // `]`, `)`, fecho de string/template (`'` `"` `` ` ``) ou `?.` (optional computed). Fora de process.argv
  // (governado por K1), o conteúdo do bracket de acesso-membro só pode ser índice inteiro decimal canônico
  // (0|[1-9][0-9]*); propriedade-string (blankada no skeleton), template, expressão ou identificador dinâmico
  // → não classificado → MORDE. Fecha `[]['constructor']['constructor']('return process')()` em QUALQUER
  // receiver (a cadeia de brackets-string é rejeitada por-bracket). Complementa E2 (dotted) na lacuna computed.
  {
    const KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'case', 'do', 'else', 'yield', 'await',
      'void', 'delete', 'new', 'throw', 'const', 'let', 'var', 'if', 'while', 'for', 'switch', 'function',
      'class', 'extends', 'super', 'import', 'export', 'default', 'from', 'as']);
    for (let bi = 0; bi < skel.length; bi++) {
      if (skel[bi] !== '[') continue;
      let a = bi - 1;
      while (a >= 0 && /\s/.test(skel[a])) a--;
      if (a < 0) continue;
      const prev = skel[a];
      let isMember = false, optional = false, regexReceiver = false;
      if (regexEnds.has(a)) { // M1: receiver = literal regex fechado (com ou sem flags)
        isMember = true; regexReceiver = true;
      } else if (/[A-Za-z0-9_$]/.test(prev)) {
        let w = a; while (w >= 0 && /[A-Za-z0-9_$]/.test(skel[w])) w--;
        if (!KW.has(skel.slice(w + 1, a + 1))) isMember = true; // identificador real → receiver; keyword → array-literal
      } else if (prev === ']' || prev === ')' || prev === "'" || prev === '"' || prev === '`') {
        isMember = true;
      } else if (prev === '.') {
        let b = a - 1; while (b >= 0 && /\s/.test(skel[b])) b--;
        if (skel[b] === '?') { isMember = true; optional = true; }
      }
      if (!isMember) continue; // array-literal / início de expressão → benigno
      const pre = skel.slice(Math.max(0, bi - 12), bi).replace(/\s+$/, '');
      if (/process\.argv$/.test(pre)) continue; // K1 governa process.argv[...]
      let depth = 0, j = bi;
      for (; j < skel.length; j++) { if (skel[j] === '[') depth++; else if (skel[j] === ']') { depth--; if (depth === 0) break; } }
      if (depth !== 0) { note('L1: bracket de acesso-membro não fecha'); continue; }
      const inner = skel.slice(bi + 1, j).trim();
      const ctxL = skel.slice(Math.max(0, bi - 20), j + 12).replace(/\s+/g, ' ');
      // M1 — opção B (mais restritiva): NENHUM acesso-membro (nem numérico) é permitido após literal regex;
      // o loader não tem uso legítimo dessa forma. Fecha /re/['constructor'] e /re/[0] uniformemente.
      if (regexReceiver) { note(`M1: acesso-membro após literal regex — proibido (regex como receiver reabriria computed-member reflection): "…${ctxL}…"`); continue; }
      if (optional) { note(`L1: optional computed member access (x?.[...]) — proibido: "…${ctxL}…"`); continue; }
      if (!/^(0|[1-9][0-9]*)$/.test(inner)) {
        note(`L1: acesso-membro COMPUTADO não-numérico (propriedade-string/template/expressão pode alcançar constructor/__proto__/Function) — fora de process.argv só índice inteiro decimal: "…${ctxL}…"`);
        continue;
      }
      let after = j + 1; while (after < skel.length && /\s/.test(skel[after])) after++;
      if (skel[after] === '(' || skel[after] === '`') note(`L1: chamada/tagged-template imediatamente após índice numérico — proibido: "…${ctxL}…"`);
    }
  }

  // ═══ D1/D2/D3 — INVENTÁRIO EXAUSTIVO DE CONTROLE TRANSACIONAL ═══
  // Nenhum comando transacional pode escapar do inventário: toda query do loader é enumerada
  // (sobre o skeleton, posições == fonte), o 1º argumento deve ser LITERAL visível no call site,
  // SQL transacional composto é proibido, e aliases/desestruturação/bind/call/apply/computed/
  // optional-chaining do client/query são proibidos nesta one-shot.

  // D3 — proibições estruturais de alias/indireção (sobre o skeleton: strings não confundem)
  if (/\}\s*=\s*client\b/.test(skel)) note('D3a: desestruturação do client (const {query} = client) — proibida');
  if (/client\s*\?\./.test(skel)) note('D3b: optional chaining no client (client?.) — proibido');
  if (/client\s*\[/.test(skel)) note('D3c: acesso computado no client (client[...]) — proibido');
  if (/client\.query(?!\s*\()/.test(skel)) note('D3d: referência a client.query sem invocação direta (alias/bind/call/apply) — proibida');
  if (/(?<![\w.$])query\s*\(/.test(skel)) note('D3e: chamada bare query(...) (método desestruturado/aliased) — proibida');

  // D2b — contagem transacional GLOBAL derivada do inventário estrutural único (F2) — sem regex textual paralela
  if (txClass.BEGIN !== 1) note(`D2b: BEGIN esperado exatamente 1 — encontrados ${txClass.BEGIN}`);
  if (txClass.COMMIT !== 1) note(`D2c: COMMIT esperado exatamente 1 — encontrados ${txClass.COMMIT}`);
  if (txClass.ROLLBACK !== 2) note(`D2d: ROLLBACK esperado exatamente 2 (dry-run + catch) — encontrados ${txClass.ROLLBACK}`);

  // ═══ H1 — ALLOWLIST ESTRUTURAL DE PROCESS (autoridade POSITIVA, não denylist) ═══
  // No loader one-shot, o identificador global `process` só pode aparecer como ACESSO-PONTO DIRETO aos
  // membros da allowlist {argv, exit} (forma canônica exata `process.argv` / `process.exit`). Qualquer
  // outro membro — binding/_linkedBinding/dlopen/getBuiltinModule/mainModule/env/cwd/… e QUALQUER membro
  // futuro — morde, assim como acesso computado (process['x']), optional chaining (process?.x), acesso
  // separado por whitespace/comentário, alias (const p = process), alias de membro (const f = process.exit),
  // desestruturação ({argv} = process) e shadowing (function x(process) / const process = …).
  // globalThis/global proibidos integralmente. Sobre o skeleton (comment-stripped + strings blankadas)
  // → as mesmas palavras em string/template/log/comentário NÃO contam.
  {
    if (/\bglobalThis\b/.test(skel)) note('H1a: globalThis proibido nesta one-shot (via de carga/reflexão)');
    if (/\bglobal\s*[.\[?]/.test(skel)) note('H1b: global.* proibido nesta one-shot');
    if (/getBuiltinModule/.test(skel)) note('H1c: getBuiltinModule proibido (defesa em profundidade; allowlist H1 é a autoridade)');
    // J1/J2 — além do MEMBRO, o PAPEL SINTÁTICO é governado (fail-closed: sintaxe não classificada morde):
    //   process.argv  → SOMENTE LEITURA: .slice/.includes/.indexOf/.join(...), .length lido, [i] lido.
    //     Escrita/mutação (=, [i]=, .length=, ++/--, push/pop/shift/unshift/splice/sort/..., delete, spread,
    //     Object.assign/Reflect.set, passagem como valor — mutate(argv)/const a=argv/return argv) MORDE.
    //   process.exit  → SOMENTE chamada direta canônica colada `process.exit(<código do loader vivo>)`.
    //     Substituição (exit = fn), delete, alias, ?.(), (exit)(1), call/apply/bind, passagem como valor MORDE.
    const ARGV_READ_METHODS = /^\.(slice|includes|indexOf|join)\s*\(/;
    const WRITE_AFTER = /^\s*(=(?!=)|\+\+|--|\+=|-=|\*=|\/=)/;
    const PROC = /\bprocess\b/g;
    let pm;
    while ((pm = PROC.exec(skel))) {
      if (pm.index > 0 && skel[pm.index - 1] === '.') { // membro .process de outro objeto (x.process)
        note('H1d: acesso a membro "process" de outro objeto — proibido');
        continue;
      }
      const ctx = () => skel.slice(Math.max(0, pm.index - 24), pm.index + 40).replace(/\s+/g, ' ');
      // precedente hostil: delete / ++ / -- / spread antes de process
      const before = skel.slice(Math.max(0, pm.index - 12), pm.index);
      if (/(\bdelete\s*|\+\+\s*|--\s*|\.\.\.\s*)$/.test(before)) {
        note(`J: process precedido de delete/++/--/spread — proibido: "…${ctx()}…"`);
        continue;
      }
      const tail = skel.slice(pm.index);
      if (/^process\.argv\b/.test(tail)) {
        const rest = tail.slice('process.argv'.length);
        let endRel = -1; // posição em `rest` logo após a forma de leitura reconhecida (-1 = já mordeu / não-forma)
        if (ARGV_READ_METHODS.test(rest)) {
          // achar o ')' que fecha a chamada do método de leitura (slice/includes/indexOf/join)
          const pStart = rest.indexOf('(');
          let depth = 0, j = pStart;
          for (; j < rest.length; j++) { if (rest[j] === '(') depth++; else if (rest[j] === ')') { depth--; if (depth === 0) break; } }
          if (depth !== 0) note('J1: chamada de método de leitura de process.argv não fecha'); else endRel = j + 1;
        } else if (/^\.length\b/.test(rest)) {
          if (WRITE_AFTER.test(rest.slice('.length'.length))) note(`J1: escrita em process.argv.length — argv é somente-leitura: "…${ctx()}…"`);
          else endRel = '.length'.length;
        } else if (rest[0] === '[') {
          let depth = 0, i3 = 0;
          for (; i3 < rest.length; i3++) { if (rest[i3] === '[') depth++; else if (rest[i3] === ']') { depth--; if (depth === 0) break; } }
          if (depth !== 0) note('J1: bracket de process.argv não fecha');
          else {
            const inner = rest.slice(1, i3).trim();
            // K1 — ÍNDICE DE ARRAY ≠ PROPRIEDADE COMPUTADA: só inteiro decimal não-negativo (sem leading-zero
            // salvo "0"; sem +/-/./e/x/b/o/n) OU identificador simples. String (blankada no skeleton),
            // template, concat, chamada, member, aritmética, hex/bigint/etc. → não classificado → MORDE.
            const isInt = /^(0|[1-9][0-9]*)$/.test(inner);
            const isIdent = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(inner);
            if (!isInt && !isIdent) note(`K1: process.argv[...] com conteúdo NÃO-ÍNDICE (propriedade-string/computed/expressão) — só inteiro decimal ou identificador simples: "…${ctx()}…"`);
            else if (WRITE_AFTER.test(rest.slice(i3 + 1))) note(`J1: escrita em process.argv[i] — argv é somente-leitura: "…${ctx()}…"`);
            else endRel = i3 + 1;
          }
        } else {
          note(`J1: uso de process.argv fora das formas de LEITURA permitidas (slice/includes/indexOf/join/[i]/length lidos) — mutação/atribuição/alias/passagem-como-valor proibidos: "…${ctx()}…"`);
        }
        // K1 — a leitura de process.argv deve ser TERMINAL: nenhuma dereferência posterior (. / ?. / [ / ( / tagged-template),
        // que reabriria acesso reflexivo/execução (…[índice]['__proto__']['constructor']['constructor']('return 1')()).
        if (endRel >= 0) {
          const cont = rest.slice(endRel).replace(/^\s+/, '');
          if (/^(\.|\?\.|\[|\(|`)/.test(cont)) note(`K1: dereferência APÓS leitura de process.argv (cadeia .../[.../(... que pode alcançar constructor/__proto__/Function) — proibida: "…${ctx()}…"`);
        }
      } else if (/^process\.exit\b/.test(tail)) {
        const rest = tail.slice('process.exit'.length);
        if (!/^\(\s*(?:0|1|failed\s*\?\s*1\s*:\s*0)\s*\)/.test(rest)) {
          note(`J2: process.exit fora da chamada direta canônica process.exit(0|1|failed ? 1 : 0) — substituição/alias/optional/call-apply-bind/passagem-como-valor proibidos: "…${ctx()}…"`);
        }
      } else {
        note(`H1: uso de process fora da allowlist {process.argv, process.exit}: "…${ctx()}…"`);
      }
    }
  }
  if (/ON CONFLICT|UPSERT/i.test(s)) note('B9: loader usa ON CONFLICT/UPSERT (proibido)');
  if (/DELETE\s+FROM/i.test(s)) note('B10: loader usa DELETE (proibido)');
  if (!/unificard_app/.test(s) || !/current_user/.test(s)) note('B11: loader não recusa execução como unificard_app');
  // sem tocar alias/succession/address/Bank/Social/rota
  if (/INSERT\s+INTO\s+(public\.)?(neighborhood_aliases|neighborhood_succession)/i.test(s)) note('B12: loader cria alias/succession (fora da N3)');
  if (/UPDATE\s+(public\.)?addresses|INSERT\s+INTO\s+(public\.)?addresses/i.test(s)) note('B13: loader muta addresses (proibido)');
  if (/\bbank_\w+|regional_fund|treasury|bank_split|ledger|social_\w+/i.test(s)) note('B14: loader referencia Bank/Social (proibido)');
  if (/\.(get|post|put|delete)\(|router|route/i.test(s)) note('B15: loader expõe rota (proibido)');
  // conta exata 75 exigida nas assertions
  if (!/===\s*75|=== meta\.expected_count|tot === 75/.test(s)) note('B16: loader não exige exatamente 75');
}

// ── C. WIRING ──
if (existsSync(RUNNER) && !/audit-n3-curitiba-catalog\.mjs/.test(readFileSync(RUNNER, 'utf8'))) note('C1: guard fora do runner');

if (failures.length) {
  console.error('GATE FAIL [n3-curitiba-catalog]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [n3-curitiba-catalog] — manifest = CONJUNTO CANÔNICO EXATO dos 75 bairros de Curitiba (sha256 fixado da projeção [ordinal,name], Unicode/acento-exato, ordem exata — troca/acento/substituição-com-count-75 MORDE); cada item limitado a EXATAMENTE {ordinal,name} (chave extra morde, incl. tenant_id); city/actor ratificados, government_official, referência IPPUC; loader cria SÓ via writer canônico N2-E (nome parametrizado, sem INSERT direto/disable-trigger), advisory lock, estado-inicial-zero, apply gated por token, EXATAMENTE 1 client.query(COMMIT) no arquivo, DENTRO do bloco do gate estrutural (APPLY&&CONFIRMED&&!failed) localizado por brace-matching sobre skeleton (strings blanked — braces em logs/templates não confundem), alias do client proibido; ROLLBACK ALCANÇÁVEL no else PAR do mesmo gate (blocos if(false)/0/!true/1===2 excisados; após return/exit/throw = inalcançável; log/comentário/string NÃO satisfazem; COMMIT no dry-run morde); sem ON CONFLICT/DELETE/alias/succession/address/rota/Bank/Social; INVENTÁRIO TRANSACIONAL EXAUSTIVO: toda query enumerada, 1º argumento LITERAL obrigatório (variável/concat/template-interpolado/config-object/helper = SQL opaco morde), SQL transacional composto proibido (só BEGIN|COMMIT|ROLLBACK puros, strings SQL protegidas), desestruturação/bind/call/apply/computed/optional-chaining do client proibidos, contagem semântica global BEGIN=1/COMMIT=1/ROLLBACK=2; COMPLETUDE: imports do loader restritos a allowlist governada (E1 — sem helper/require/import-dinâmico/símbolo extra), reflexão/prototype/call/apply/bind/getPrototypeOf/Reflect/Proxy/Function/eval proibidos (E2), classificador SQL por STATEMENT com dollar-quote/quoted-ident/comentário/CASE...END aware (E3 — só o 1º token classifica; composto/START/SAVEPOINT/RELEASE/ABORT/END mordem; "COMMIT" ident e dado benignos); process sob ALLOWLIST POSITIVA {process.argv, process.exit} com PAPEL SINTÁTICO governado — argv SOMENTE LEITURA (slice/includes/indexOf/join/[i]-lido/length-lido; push/mutação/atribuição/alias/spread/passagem-como-valor mordem — J1) com ÍNDICE ESTRITO (só inteiro decimal ou identificador simples; propriedade-string/computed no bracket morde) e leitura TERMINAL (nenhuma dereferência posterior alcança constructor/__proto__/Function — K1) e exit SOMENTE chamada direta canônica process.exit(0|1|failed?1:0) (substituição/delete/alias/optional/call-apply-bind mordem — J2); qualquer outro membro (atual ou futuro), acesso computado/optional, alias, desestruturação, shadowing ou precedente delete/++/--/spread morde; globalThis/global proibidos integralmente (H1); ACESSO-MEMBRO COMPUTADO em qualquer receiver só com índice inteiro decimal (L1 — propriedade-string/template/expressão/identificador-dinâmico/optional mordem; fecha a cadeia array-bracket-constructor ate o Function constructor em qualquer receiver; array-literals e keywords excluídos); literal regex tokenizado (corpo/classes/escapes/flags) e reconhecido como receiver — nenhum acesso-membro permitido após regex (M1); divisão preservada; C1/C2/C3 e contagem BEGIN=1/COMMIT=1/ROLLBACK=2 derivam do INVENTÁRIO ESTRUTURAL ÚNICO de call-sites (F2 — sem regex textual paralela; texto benigno em string/template/log/comentário não conta). (Prova unificada no inventário.)');
