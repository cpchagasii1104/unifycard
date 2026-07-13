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
  const skel = (() => {
    let out = '', i = 0, mode = 'code'; const n = s.length;
    while (i < n) {
      const c = s[i], d = s[i + 1];
      if (mode === 'code') {
        if (c === "'") { mode = 'sq'; out += c; i++; continue; }
        if (c === '"') { mode = 'dq'; out += c; i++; continue; }
        if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
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
  const CALL_COMMIT_G = /client\.query\(\s*['"]COMMIT['"]\s*\)/g;
  const CALL_ROLLBACK = /(?:await\s+)?client\.query\(\s*['"]ROLLBACK['"]\s*\)/;

  // gate ÚNICO por estrutura: if (APPLY && CONFIRMED && !failed) { … } else { … }
  const GATE_RE = /if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)\s*\{/g;
  const gates = [...skel.matchAll(GATE_RE)];
  if (gates.length !== 1) {
    note(`B7c3: esperado exatamente 1 gate (APPLY && CONFIRMED && !failed) — encontrados ${gates.length}`);
  } else {
    const gOpen = gates[0].index + gates[0][0].length - 1; // posição do '{'
    const gClose = braceEnd(skel, gOpen);
    if (gClose < 0) { note('B7c3b: braces do gate não fecham'); }
    else {
      // else PAR do MESMO if (imediatamente após o fechamento do bloco verdadeiro)
      const afterGate = skel.slice(gClose + 1);
      const elseM2 = afterGate.match(/^\s*else\s*\{/);
      let eOpen = -1, eClose = -1;
      if (!elseM2) { note('B8c3: else PAR do gate ausente (dry-run/abort deve ser o else do próprio gate)'); }
      else {
        eOpen = gClose + 1 + elseM2[0].length - 1;
        eClose = braceEnd(skel, eOpen);
        if (eClose < 0) note('B8c3b: braces do else não fecham');
      }

      // C1 — EXCLUSIVIDADE: exatamente 1 client.query('COMMIT') no arquivo INTEIRO, DENTRO do bloco do gate
      const commits = [...s.matchAll(CALL_COMMIT_G)];
      if (commits.length !== 1) {
        note(`C1: esperado exatamente 1 client.query('COMMIT') operacional — encontrados ${commits.length} (BEGIN-antecipado/segundo-caminho/catch/finally/helper = evasão)`);
      } else if (!(commits[0].index > gOpen && commits[0].index < gClose)) {
        note('C1b: o único COMMIT está FORA do bloco do gate seguro');
      }
      // aliasing do client proibido nesta one-shot (COMMIT/ROLLBACK só pelo receiver exato)
      if (/\b(?:const|let|var)\s+\w+\s*=\s*client\s*[;\n,)]/.test(skel)) note('C1c: alias do client detectado — proibido nesta operação (COMMIT/ROLLBACK só via client.query)');

      // C2 — ROLLBACK ALCANÇÁVEL no else: excisa blocos sob condição constante-falsa e exige a chamada no resto
      if (eOpen >= 0 && eClose > 0) {
        let elseSkel = skel.slice(eOpen + 1, eClose);
        let elseSrc = s.slice(eOpen + 1, eClose);
        const FALSE_IF = /if\s*\(\s*(?:false|0|null|undefined|!\s*true|''|""|1\s*===\s*2|Boolean\(\s*false\s*\))\s*\)\s*\{/g;
        let fm;
        while ((fm = FALSE_IF.exec(elseSkel))) {
          const fOpen = fm.index + fm[0].length - 1;
          const fClose = braceEnd(elseSkel, fOpen);
          if (fClose > 0) { // excisa o bloco morto das DUAS visões (mantendo comprimento p/ os índices do regex)
            const blank = ' '.repeat(fClose - fm.index + 1);
            elseSkel = elseSkel.slice(0, fm.index) + blank + elseSkel.slice(fClose + 1);
            elseSrc = elseSrc.slice(0, fm.index) + blank + elseSrc.slice(fClose + 1);
          }
        }
        if (!CALL_ROLLBACK.test(elseSrc)) {
          note("C2: chamada REAL client.query('ROLLBACK') ausente/inalcançável no else do gate (log/comentário/string/if(false) NÃO satisfazem)");
        } else {
          const callIdx = elseSrc.search(CALL_ROLLBACK);
          const termIdx = elseSkel.search(/\breturn\b|process\.exit\(|\bthrow\b/);
          if (termIdx >= 0 && termIdx < callIdx) note('C2b: ROLLBACK do dry-run só após return/exit/throw (inalcançável)');
        }
        // C3 — nenhum COMMIT no ramo dry-run (redundante com C1, mas explícito para o ramo)
        if (/client\.query\(\s*['"]COMMIT['"]\s*\)/.test(elseSrc)) note("C3: client.query('COMMIT') no ramo dry-run — dry-run não pode persistir");
      }
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

  // D1 — inventário: TODA invocação .query( deve ser client.query( com 1º argumento LITERAL
  const txClass = { BEGIN: 0, COMMIT: 0, ROLLBACK: 0 };
  {
    const INVOKE = /(\w+)\s*\.\s*query\s*\(/g;
    let m2;
    while ((m2 = INVOKE.exec(skel))) {
      if (m2[1] !== 'client') { note(`D1a: receiver de .query() não é client: '${m2[1]}'`); continue; }
      // 1º argumento no FONTE: pular whitespace após '('
      let p = m2.index + m2[0].length;
      while (p < s.length && /\s/.test(s[p])) p++;
      const q = s[p];
      if (q === "'" || q === '"') {
        // extrair o literal (com escapes)
        let lit = '', i2 = p + 1;
        while (i2 < s.length) {
          if (s[i2] === '\\') { lit += s[i2 + 1]; i2 += 2; continue; }
          if (s[i2] === q) break;
          lit += s[i2]; i2++;
        }
        // após o literal: SÓ ',' (params) ou ')' — concatenação/expressão ('COM' + 'MIT') é SQL opaco
        let after = i2 + 1;
        while (after < s.length && /\s/.test(s[after])) after++;
        if (s[after] !== ',' && s[after] !== ')') {
          note(`D1d: 1º argumento de client.query não termina em ','/')' após o literal (concatenação/expressão) — SQL opaco proibido: "${lit.slice(0, 40)}${s[after]}…"`);
        }
        // D2 — classificação transacional do literal: strip comentários SQL + strings SQL, normalizar
        const sqlBare = lit
          .replace(/'(?:[^']|'')*'/g, ' ')      // strings SQL (protege SELECT 'COMMIT' como dado)
          .replace(/--[^\n]*/g, ' ')
          .replace(/\/\*[\s\S]*?\*\//g, ' ');
        const norm = sqlBare.trim().replace(/;\s*$/, '').replace(/\s+/g, ' ').toUpperCase();
        const hasTx = /\b(BEGIN|COMMIT|ROLLBACK|START|SAVEPOINT|RELEASE|ABORT|END)\b/.test(norm);
        if (hasTx) {
          if (norm === 'BEGIN' || norm === 'COMMIT' || norm === 'ROLLBACK') txClass[norm]++;
          else note(`D2: SQL transacional COMPOSTO/não-canônico proibido: "${lit.slice(0, 60)}" (permitidos apenas BEGIN | COMMIT | ROLLBACK puros)`);
        }
      } else if (q === '`') {
        // template sem interpolação é tolerado; com ${ é opaco
        const end = s.indexOf('`', p + 1);
        const tpl = end > 0 ? s.slice(p + 1, end) : '';
        if (end < 0 || tpl.includes('${')) note('D1b: 1º argumento de client.query é template com interpolação — SQL deve ser literal visível');
        else if (/\b(BEGIN|COMMIT|ROLLBACK|START|SAVEPOINT|RELEASE|ABORT|END)\b/i.test(tpl)) note('D1c: comando transacional em template — use literal canônico');
      } else {
        note(`D1: 1º argumento de client.query NÃO é literal (começa com '${q}') — variável/expressão/config-object/helper são SQL opaco proibido`);
      }
    }
  }
  // D2b — contagem transacional GLOBAL sobre a classificação semântica (não igualdade textual)
  if (txClass.BEGIN !== 1) note(`D2b: BEGIN esperado exatamente 1 — encontrados ${txClass.BEGIN}`);
  if (txClass.COMMIT !== 1) note(`D2c: COMMIT esperado exatamente 1 — encontrados ${txClass.COMMIT}`);
  if (txClass.ROLLBACK !== 2) note(`D2d: ROLLBACK esperado exatamente 2 (dry-run + catch) — encontrados ${txClass.ROLLBACK}`);
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
console.log('GATE OK [n3-curitiba-catalog] — manifest = CONJUNTO CANÔNICO EXATO dos 75 bairros de Curitiba (sha256 fixado da projeção [ordinal,name], Unicode/acento-exato, ordem exata — troca/acento/substituição-com-count-75 MORDE); cada item limitado a EXATAMENTE {ordinal,name} (chave extra morde, incl. tenant_id); city/actor ratificados, government_official, referência IPPUC; loader cria SÓ via writer canônico N2-E (nome parametrizado, sem INSERT direto/disable-trigger), advisory lock, estado-inicial-zero, apply gated por token, EXATAMENTE 1 client.query(COMMIT) no arquivo, DENTRO do bloco do gate estrutural (APPLY&&CONFIRMED&&!failed) localizado por brace-matching sobre skeleton (strings blanked — braces em logs/templates não confundem), alias do client proibido; ROLLBACK ALCANÇÁVEL no else PAR do mesmo gate (blocos if(false)/0/!true/1===2 excisados; após return/exit/throw = inalcançável; log/comentário/string NÃO satisfazem; COMMIT no dry-run morde); sem ON CONFLICT/DELETE/alias/succession/address/rota/Bank/Social; INVENTÁRIO TRANSACIONAL EXAUSTIVO: toda query enumerada, 1º argumento LITERAL obrigatório (variável/concat/template-interpolado/config-object/helper = SQL opaco morde), SQL transacional composto proibido (só BEGIN|COMMIT|ROLLBACK puros, strings SQL protegidas), desestruturação/bind/call/apply/computed/optional-chaining do client proibidos, contagem semântica global BEGIN=1/COMMIT=1/ROLLBACK=2. (Prova estrutural C1/C2/C3 + D1/D2/D3.)');
