#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2-R2 · COERENCIA TENANT x ACTORS.
// Fecha a 2a ressalva da auditoria Yala da N2-D.2: FKs sao actors(id) SEM tenant → fn_grant/fn_revoke
// aceitavam Actor de outro tenant. Pergunta propria: "a barreira de coerencia tenant vive DENTRO das
// funcoes SECURITY DEFINER (nao so no service), com erro nao-vazante, lock deterministico, sem overload
// inseguro, e fn_expire/fn_regrant intocadas?"
//
// PROMESSA HONESTA: integridade VERSIONADA (migration/arquivos). Estado vivo = introspecao (ver provas DB).
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heuristica textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const R2_MIG = '20260711190000_actor_capability_grant_tenant_coherence.sql';

// extrai o corpo de uma funcao SQL (do CREATE ... FUNCTION nome(...) ate o $func$; final)
function fnBody(sql, name) {
  const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(([\\s\\S]*?)\\$func\\$;`, 'i');
  const m = sql.match(re);
  return m ? m[0] : '';
}

// N2-D.2-R2-R3: extracao NOMINAL fail-closed — retorna {body} ou {error}. Falha se: ausente, corpo
// inextraivel, ou MAIS DE UMA definicao da mesma funcao (overload inesperado). Nao usa busca global.
function extractSingleFn(sql, name) {
  const defs = [...sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(`, 'gi'))];
  if (defs.length === 0) return { error: `${name}: definicao ausente.` };
  if (defs.length > 1) return { error: `${name}: ${defs.length} definicoes (overload inesperado) — inspecao ambigua.` };
  const body = fnBody(sql, name);
  if (!body || !/\$func\$;/.test(body)) return { error: `${name}: corpo nao extraivel inequivocamente.` };
  return { body };
}

// Extrai o conteudo balanceado da chamada fn_assert_actors_in_tenant(...) dentro de um corpo (do '(' ao
// ')' correspondente, ignorando strings). Retorna {args, callStart} ou null.
function extractHelperCall(body) {
  const i = body.search(/fn_assert_actors_in_tenant\s*\(/i);
  if (i < 0) return null;
  const open = body.indexOf('(', i);
  let depth = 0, j = open;
  while (j < body.length) {
    const c = body[j];
    if (c === "'") { j++; while (j < body.length && body[j] !== "'") { if (body[j] === '\\') j++; j++; } j++; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return { args: body.slice(open + 1, j), callStart: i }; }
    j++;
  }
  return null;
}

// Tokens de codigo-morto/short-circuit que anulam ou forcam uma condicao (proibidos no corpo das funcoes
// canonicas — nenhuma logica legitima os usa). Comment-stripped antes.
const DEAD_LOGIC = /\b(false\s+AND|FALSE\s+AND|true\s+OR|TRUE\s+OR|IF\s+(?:false|FALSE)\s+THEN|0\s*=\s*1\s+AND|1\s*=\s*0\s+AND|IF\s+0\s*=\s*1\s+THEN|IF\s+1\s*=\s*0\s+THEN)\b/;

// N2-D.2-R2-R3.2: SCANNER SQL — distingue literais (nao-executaveis) de identificadores (executaveis),
// parametros posicionais e comentarios. Retorna {skeleton, positionals[], error?}. No skeleton: literais
// (single/E/dollar-quote) viram '' (sem chars de identificador); comentarios viram espaco; IDENTIFICADORES
// entre aspas duplas sao DESASPADOS (viram token real → allowlist os pega); posicionais $n sao PRESERVADOS
// e coletados. Falha conservadora em literal inacabado. NAO usa regex global (aspas duplas != string).
function sqlScan(code) {
  let out = ''; const positionals = []; let i = 0; const n = code.length;
  while (i < n) {
    const c = code[i], c2 = code[i + 1];
    if (c === '-' && c2 === '-') { while (i < n && code[i] !== '\n') i++; out += ' '; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    if ((c === 'E' || c === 'e') && c2 === "'") { // E-string (escapes com backslash)
      i += 2; while (i < n) { if (code[i] === '\\') { i += 2; continue; } if (code[i] === "'") { if (code[i + 1] === "'") { i += 2; continue; } i++; break; } i++; }
      out += "''"; continue;
    }
    if (c === "'") { i++; while (i < n) { if (code[i] === "'") { if (code[i + 1] === "'") { i += 2; continue; } i++; break; } i++; } out += "''"; continue; }
    if (c === '"') { i++; let id = ''; while (i < n) { if (code[i] === '"') { if (code[i + 1] === '"') { id += '"'; i += 2; continue; } i++; break; } id += code[i]; i++; } out += id; continue; }
    if (c === '$') {
      if (c2 && /[0-9]/.test(c2)) { let j = i + 1; while (j < n && /[0-9]/.test(code[j])) j++; const tok = code.slice(i, j); positionals.push(tok); out += ' ' + tok + ' '; i = j; continue; }
      const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(code.slice(i));
      if (m) { const tag = m[0]; const end = code.indexOf(tag, i + tag.length); if (end < 0) return { skeleton: out + ' __UNTERMINATED__ ', positionals, error: 'literal dollar-quote inacabado' }; out += "''"; i = end + tag.length; continue; }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return { skeleton: out, positionals };
}

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (!migFiles.includes(R2_MIG)) throw new Error(`migration R2 ausente: ${R2_MIG}`);
  const sql = stripSql(readFileSync(join(MIG, R2_MIG), 'utf-8'));

  // ── 1. HELPER interno de coerencia tenant ────────────────────────────────────────────────────
  const helper = fnBody(sql, 'fn_assert_actors_in_tenant');
  if (!helper) {
    failures.push(`${R2_MIG}: fn_assert_actors_in_tenant ausente.`);
  } else {
    if (!/SECURITY DEFINER/i.test(helper)) failures.push('helper: nao SECURITY DEFINER.');
    if (!/SET search_path = pg_catalog, pg_temp/i.test(helper)) failures.push('helper: search_path nao pinado.');
    if (!/public\.actors/i.test(helper)) failures.push('helper: nao qualifica public.actors.');
    // compara por tenant EXATO (sem OR NULL / institucional / textual)
    if (!/a\.tenant_id\s*=\s*p_tenant_id/i.test(helper)) failures.push('helper: nao compara a.tenant_id = p_tenant_id.');
    if (/tenant_id\s*=\s*p_tenant_id\s+OR\s+.*IS\s+NULL/i.test(helper) || /OR\s+a\.tenant_id\s+IS\s+NULL/i.test(helper)) {
      failures.push('helper: usa `OR tenant_id IS NULL` — proibido.');
    }
    if (/COALESCE\s*\(\s*[^,]*tenant/i.test(helper)) failures.push('helper: usa COALESCE de tenant — proibido.');
    // dedup + ordem deterministica + lock FOR SHARE
    if (!/DISTINCT/i.test(helper)) failures.push('helper: sem DISTINCT (dedup de ids).');
    if (!/FOR\s+SHARE/i.test(helper)) failures.push('helper: sem lock FOR SHARE.');
    // o LOCK deve ser adquirido em ORDEM DETERMINISTICA de id (ORDER BY a.id imediatamente antes de FOR SHARE)
    if (!/ORDER\s+BY\s+a\.id\s+FOR\s+SHARE/i.test(helper)) failures.push('helper: lock FOR SHARE sem ORDER BY a.id deterministico (risco de deadlock).');
    // cardinalidade encontrada == esperada, e erro NAO-vazante
    if (!/v_found\s*<>\s*v_expected/i.test(helper)) failures.push('helper: nao compara cardinalidade encontrada vs esperada.');
    if (!/ACTOR_TENANT_MISMATCH/.test(helper)) failures.push('helper: sem erro estavel ACTOR_TENANT_MISMATCH.');
    // nao pode revelar id/tenant especifico no erro (nao-vazante): a msg nao interpola % de id
    const raiseLine = (helper.match(/RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH[^']*'/g) || []).join(' ');
    if (/%/.test(raiseLine)) failures.push('helper: mensagem de mismatch interpola valor — risco de vazamento.');
  }

  // ── 2. FN_GRANT valida os CINCO actors via helper ANTES do INSERT (R3-B, prova nominal) ────────
  const grantX = extractSingleFn(sql, 'fn_grant_actor_capability');
  if (grantX.error) {
    failures.push(`fn_grant: ${grantX.error}`);
  } else {
    const grant = grantX.body;
    if (!/SECURITY DEFINER/i.test(grant)) failures.push('fn_grant: nao SECURITY DEFINER.');
    if (DEAD_LOGIC.test(grant)) failures.push('fn_grant: contem logica-morta/short-circuit (false AND / IF false / true OR) — proibido.');
    const call = extractHelperCall(grant);
    if (!call) {
      failures.push('fn_grant: nao chama fn_assert_actors_in_tenant.');
    } else {
      // a chamada do helper deve vir ANTES do INSERT no grant
      const iInsert = grant.search(/INSERT\s+INTO\s+public\.actor_capability_grants/i);
      if (iInsert < 0 || call.callStart > iInsert) failures.push('fn_grant: validacao de coerencia NAO ocorre antes do INSERT.');
      // 1o argumento do helper = p_tenant_id
      if (!/^\s*p_tenant_id\s*,/i.test(call.args)) failures.push('fn_grant: 1o arg do helper nao e p_tenant_id.');
      // ARRAY[...] com os CINCO papeis nominais (nao basta contar 5 UUIDs)
      const arrInner = (call.args.match(/ARRAY\s*\[([\s\S]*?)\]/i) || [])[1] || '';
      if (!arrInner) failures.push('fn_grant: helper nao recebe ARRAY[...] de actors.');
      const arr = `[${arrInner}]`; // restaura delimitadores p/ ancorar 1o/ultimo elemento
      for (const a of ['p_grantee_actor_id', 'p_scope_actor_id', 'p_granted_by_actor_id', 'p_executed_by_actor_id', 'p_responsible_human_actor_id']) {
        // token exato como ELEMENTO do array (delimitado por [ , ou ])
        if (!new RegExp(`(?:\\[|,)\\s*${a}\\s*(?:,|\\])`).test(arr)) {
          failures.push(`fn_grant: ${a} nao e elemento do ARRAY validado pelo helper (R3-B).`);
        }
      }
    }
    if (!/p_tenant_id\s+IS\s+NULL/i.test(grant)) failures.push('fn_grant: nao rejeita p_tenant_id nulo.');
  }

  // ── 3. FN_REVOKE nova (com tenant esperado); assinatura antiga DROPADA; LIVENESS do tenant check ─
  if (!/DROP\s+FUNCTION\s+fn_revoke_actor_capability_grant\(UUID,UUID,UUID,UUID,TEXT\)/i.test(sql)) {
    failures.push(`${R2_MIG}: assinatura ANTIGA de fn_revoke (sem tenant) nao foi DROPADA.`);
  }
  const revokeX = extractSingleFn(sql, 'fn_revoke_actor_capability_grant');
  if (revokeX.error) {
    failures.push(`fn_revoke: ${revokeX.error}`);
  } else {
    const revoke = revokeX.body;
    if (!/p_expected_tenant_id\s+UUID/i.test(revoke)) failures.push('fn_revoke: nova assinatura sem p_expected_tenant_id.');

    // ── R3-A: LIVENESS do tenant check (nao basta a string estar presente) ──
    // (a) nenhuma logica-morta/short-circuit no corpo inteiro (fecha false AND / IF false / true OR / 0=1)
    if (DEAD_LOGIC.test(revoke)) {
      failures.push('fn_revoke: contem logica-morta/short-circuit (false AND / IF false / true OR / 0=1) — tenant check inalcancavel.');
    }
    // (b) a comparacao usa IS DISTINCT FROM (mismatch), NAO IS NOT DISTINCT FROM
    if (/tenant_id\s+IS\s+NOT\s+DISTINCT\s+FROM\s+p_expected_tenant_id/i.test(revoke)) {
      failures.push('fn_revoke: usa IS NOT DISTINCT FROM (semantica invertida).');
    }
    // (c) branch estrutural: IF v_grant.tenant_id IS DISTINCT FROM p_expected_tenant_id THEN ... NOT_FOUND
    //     (tolera parenteses simples ao redor de cada lado — refactor benigno, GO §10).
    const TENANT_COND = `\\(?\\s*v_grant\\.tenant_id\\s*\\)?\\s+IS\\s+DISTINCT\\s+FROM\\s+\\(?\\s*p_expected_tenant_id\\s*\\)?`;
    const tenantBranch = revoke.match(new RegExp(`IF\\s+${TENANT_COND}\\s+THEN([\\s\\S]*?)END\\s+IF;`, 'i'));
    if (!tenantBranch) {
      failures.push('fn_revoke: branch de tenant check (IF v_grant.tenant_id IS DISTINCT FROM p_expected_tenant_id THEN) ausente/estrutura divergente.');
    } else {
      // classe NOT_FOUND — aceita a forma direta OU USING MESSAGE=/format( (payload checado pela allowlist).
      if (!/RAISE\s+EXCEPTION\s+(?:USING\s+MESSAGE\s*=\s*)?(?:format\s*\(\s*)?'ACTOR_CAPABILITY_GRANT_NOT_FOUND/i.test(tenantBranch[1])) {
        failures.push('fn_revoke: branch de tenant nao levanta ACTOR_CAPABILITY_GRANT_NOT_FOUND (nao-vazante).');
      }
      if (/ACTOR_TENANT_MISMATCH|RAISE\s+(NOTICE|WARNING|LOG|INFO)|RETURN\b/i.test(tenantBranch[1])) {
        failures.push('fn_revoke: branch de tenant vaza (MISMATCH) ou usa log/return em vez de NOT_FOUND.');
      }
      // (d) o tenant check aparece DEPOIS de obter o grant e ANTES do UPDATE/evento/RETURN de sucesso
      const iSelect = revoke.search(/SELECT\s+\*\s+INTO\s+v_grant/i);
      const iTenant = revoke.search(new RegExp(`IF\\s+${TENANT_COND}`, 'i'));
      const iUpdate = revoke.search(/UPDATE\s+public\.actor_capability_grants/i);
      const iReturn = revoke.search(/RETURN\s+v_grant\s*;/i);
      if (iSelect < 0 || iTenant < iSelect) failures.push('fn_revoke: tenant check nao ocorre apos obter o grant.');
      if (iUpdate < 0 || iTenant > iUpdate) failures.push('fn_revoke: tenant check ocorre DEPOIS do UPDATE (inalcancavel/tarde demais).');
      if (iReturn >= 0 && iTenant > iReturn) failures.push('fn_revoke: tenant check ocorre DEPOIS do RETURN de sucesso.');

      // ── R3.1: PAYLOAD NAO-VAZANTE do branch tenant-mismatch (shape fechado + allowlist positiva) ──
      const branch = tenantBranch[1]; // corpo entre THEN e END IF
      // (e) SHAPE FECHADO: exatamente 1 RAISE, nenhum statement executavel anterior/posterior/auxiliar.
      const raiseCount = (branch.match(/\bRAISE\b/gi) || []).length;
      if (raiseCount !== 1) failures.push(`fn_revoke: branch de tenant tem ${raiseCount} RAISE (esperado 1 — shape fechado, sem log/segunda excecao anterior).`);
      if (/:=|\b(SELECT|PERFORM|UPDATE|INSERT|DELETE)\b/i.test(branch)) {
        failures.push('fn_revoke: branch de tenant contem statement executavel/atribuicao (SELECT/PERFORM/UPDATE/INSERT/:=) — pode copiar dado sensivel antes do RAISE.');
      }
      if (/\bRAISE\s+(NOTICE|WARNING|LOG|INFO|DEBUG)\b/i.test(branch)) {
        failures.push('fn_revoke: branch de tenant usa RAISE NOTICE/WARNING/LOG/INFO/DEBUG (log de dado antes do erro).');
      }
      // (f) ALLOWLIST POSITIVA (R3.1) via SCANNER (R3.2): literais/dollar-quotes → ''; comentarios → espaco;
      //     identificadores entre aspas DESASPADOS (viram token real); posicionais coletados. Os UNICOS
      //     tokens de dado permitidos sao palavras-chave do RAISE, `format` e `p_grant_id`.
      const raiseStmt = (branch.match(/\bRAISE\b[\s\S]*?;/i) || [''])[0];
      const scan = sqlScan(raiseStmt);
      if (scan.error) failures.push(`fn_revoke: RAISE do branch tenant com ${scan.error}.`);
      // (g) PARAMETROS POSICIONAIS proibidos no payload — exige o nome explicito p_grant_id.
      if (scan.positionals.length > 0) {
        failures.push(`fn_revoke: payload do branch tenant usa parametro posicional [${scan.positionals.join(', ')}] — proibido; use p_grant_id nomeado (R3.2).`);
      }
      const ALLOWED = new Set(['raise', 'exception', 'using', 'message', 'detail', 'hint', 'errcode', 'column', 'constraint', 'datatype', 'table', 'schema', 'format', 'p_grant_id']);
      const idents = scan.skeleton.match(/[A-Za-z_][A-Za-z_0-9.]*/g) || [];
      const leaked = [...new Set(idents.map((t) => t.toLowerCase()).filter((t) => !ALLOWED.has(t)))];
      if (leaked.length > 0) {
        failures.push(`fn_revoke: mensagem/payload do branch tenant-mismatch referencia token(s) proibido(s) [${leaked.join(', ')}] — so literais + p_grant_id sao permitidos (allowlist R3.1/R3.2).`);
      }
      // reforco explicito das serializacoes (mesmo que a allowlist ja pegue) — mensagem nominal clara.
      if (/row_to_json|to_json\b|to_jsonb|::\s*(text|json|jsonb)|v_grant/i.test(sqlScan(raiseStmt).skeleton)) {
        failures.push('fn_revoke: RAISE do branch tenant serializa/expoe v_grant (row_to_json/to_jsonb/::text/campo) — vazamento.');
      }

      // ── R3.2-A: JANELA PRE-TENANT — nenhum EGRESS/efeito observavel entre obter o grant e o tenant check.
      // A janela vai do FIM do SELECT INTO v_grant ate o INICIO do branch tenant. So control-flow + RAISE
      // EXCEPTION dos checks estruturais ja auditados (NOT_FOUND/scope) sao aceitos; O3 (scope antes de
      // tenant) NAO e alterado. Log/notify/side-effect/atribuicao/execucao dinamica sao proibidos.
      const iSelEnd = (() => { const m = /SELECT\s+\*\s+INTO\s+v_grant[\s\S]*?;/i.exec(revoke); return m ? m.index + m[0].length : -1; })();
      const iTenantIf = revoke.search(new RegExp(`IF\\s+${TENANT_COND}`, 'i'));
      if (iSelEnd < 0 || iTenantIf < 0 || iTenantIf <= iSelEnd) {
        failures.push('fn_revoke: janela pre-tenant ambigua/invertida (SELECT INTO v_grant ou tenant check nao localizados na ordem esperada).');
      } else {
        const preWindow = sqlScan(revoke.slice(iSelEnd, iTenantIf)).skeleton;
        const EGRESS = [
          [/\bRAISE\s+(NOTICE|WARNING|LOG|INFO|DEBUG)\b/i, 'RAISE NOTICE/WARNING/LOG/INFO/DEBUG'],
          [/\bpg_notify\b|\bNOTIFY\b/i, 'NOTIFY/pg_notify'],
          [/\bPERFORM\b/i, 'PERFORM'],
          [/\bCALL\b/i, 'CALL'],
          [/\bEXECUTE\b/i, 'EXECUTE dinamico'],
          [/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i, 'INSERT/UPDATE/DELETE'],
          [/\bASSERT\b/i, 'ASSERT'],
          [/:=/, 'atribuicao (:=)'],
          [/\bSELECT\b[\s\S]*?\bINTO\b/i, 'SELECT ... INTO (copia de dado)'],
        ];
        for (const [re, why] of EGRESS) {
          if (re.test(preWindow)) failures.push(`fn_revoke: EGRESS pre-tenant proibido (${why}) entre obter o grant e o tenant check — pode expor v_grant antes do NOT_FOUND.`);
        }
      }
    }

    // territory → scope mismatch (preservado)
    if (!/scope_type\s*<>\s*'actor'[\s\S]{0,120}ACTOR_CAPABILITY_GRANT_REVOKE_SCOPE_MISMATCH/i.test(revoke)) {
      failures.push('fn_revoke: territory nao rejeitado por scope mismatch.');
    }

    // coerencia dos actors armazenados/executores via helper, ANTES do UPDATE
    const call = extractHelperCall(revoke);
    if (!call) {
      failures.push('fn_revoke: nao valida coerencia dos actors armazenados/executores.');
    } else {
      const iUpdate = revoke.search(/UPDATE\s+public\.actor_capability_grants/i);
      if (iUpdate < 0 || call.callStart > iUpdate) failures.push('fn_revoke: validacao de actors ocorre depois do UPDATE.');
      if (!/^\s*p_expected_tenant_id\s*,/i.test(call.args)) failures.push('fn_revoke: 1o arg do helper nao e p_expected_tenant_id.');
      const arrInner = (call.args.match(/ARRAY\s*\[([\s\S]*?)\]/i) || [])[1] || '';
      const arr = `[${arrInner}]`;
      for (const a of ['v_grant\\.grantee_actor_id', 'v_grant\\.scope_actor_id', 'p_executed_by_actor_id', 'p_responsible_human_actor_id']) {
        if (!new RegExp(`(?:\\[|,)\\s*${a}\\s*(?:,|\\])`).test(arr)) {
          failures.push(`fn_revoke: ${a.replace(/\\\\/g,'')} nao e elemento do ARRAY validado.`);
        }
      }
    }
  }

  // ── 4. ACL / EXECUTE por assinatura ──────────────────────────────────────────────────────────
  if (!/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+fn_assert_actors_in_tenant\(UUID,\s*UUID\[\]\)\s+FROM\s+unificard_app/i.test(sql)) {
    failures.push(`${R2_MIG}: helper sem REVOKE EXECUTE de unificard_app.`);
  }
  if (!/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+fn_assert_actors_in_tenant\(UUID,\s*UUID\[\]\)\s+FROM\s+PUBLIC/i.test(sql)) {
    failures.push(`${R2_MIG}: helper sem REVOKE EXECUTE de PUBLIC.`);
  }
  if (!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_revoke_actor_capability_grant\(UUID,UUID,UUID,UUID,UUID,TEXT\)\s+TO\s+unificard_app/i.test(sql)) {
    failures.push(`${R2_MIG}: nova fn_revoke sem GRANT EXECUTE a unificard_app.`);
  }
  // R2 NAO pode conceder EXECUTE de expire/regrant a app/PUBLIC nem tocar essas funcoes
  if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_(expire|regrant)_actor_capability/i.test(sql)) {
    failures.push(`${R2_MIG}: concede EXECUTE de fn_expire/fn_regrant — proibido.`);
  }
  if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+fn_(expire|regrant)_actor_capability/i.test(sql)) {
    failures.push(`${R2_MIG}: recria fn_expire/fn_regrant — intocadas nesta fatia.`);
  }
  // R2 NAO toca tabelas/keys/matriz/lifecycle
  if (/CREATE\s+TABLE|DROP\s+TABLE|ALTER\s+TABLE\s+actor_capability_grant/i.test(sql)) {
    failures.push(`${R2_MIG}: altera tabelas de grants/eventos — fora do escopo R2.`);
  }
  if (/'territory:[a-z_]+'/i.test(sql)) failures.push(`${R2_MIG}: menciona key territory:* — fora do escopo R2.`);
  if (/\bbank_\w+|\bsocial_\w+/i.test(sql)) failures.push(`${R2_MIG}: toca Bank/Social — fora do escopo.`);
  if (/INSERT\s+INTO\s+actor_capability_grants/i.test(sql) && !/RETURNING\s+\*\s+INTO\s+v_grant/i.test(sql)) {
    // o unico INSERT permitido e dentro das funcoes canonicas (com RETURNING INTO); seed proibido
    failures.push(`${R2_MIG}: INSERT em grants fora das funcoes canonicas (seed proibido).`);
  }

  // ── 5. Migrations POSTERIORES nao reabrem overload inseguro nem tocam expire/regrant ─────────
  for (const f of migFiles.filter((f) => f > R2_MIG)) {
    const s = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    // qualquer recriacao de fn_revoke que NAO contenha p_expected_tenant_id = overload/versao insegura.
    for (const m of s.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_revoke_actor_capability_grant\s*\(([\s\S]*?)\)\s*RETURNS/gi)) {
      if (!/p_expected_tenant_id/i.test(m[1])) {
        failures.push(`[pos-R2] ${f}: recria fn_revoke SEM p_expected_tenant_id (overload inseguro).`);
      }
    }
    if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_(expire|regrant|assert_actors_in_tenant)[\s\S]{0,100}TO\s+(unificard_app|PUBLIC)/i.test(s)) {
      failures.push(`[pos-R2] ${f}: concede EXECUTE de funcao interna a app/PUBLIC.`);
    }
  }

  // ── 6. RUNTIME: repository passa o tenant no revoke; service prevalida grantee tenant-scoped ──
  const repoP = join(SRC, 'modules/authority/actor-capability-grant.repository.ts');
  const repo = existsSync(repoP) ? stripTs(readFileSync(repoP, 'utf-8')) : '';
  if (!repo) failures.push('repository ausente.');
  // a chamada de revoke deve passar 6 argumentos (o 1o = tenant)
  if (!/fn_revoke_actor_capability_grant\(\$1::uuid,\$2::uuid,\$3::uuid,\$4::uuid,\$5::uuid,\$6\)/.test(repo)) {
    failures.push('repository: revoke nao passa 6 args (tenant esperado como 1o) para fn_revoke.');
  }
  if (/tenant_id\s*=\s*\$\w+\s+OR\s+tenant_id\s+IS\s+NULL/i.test(repo)) failures.push('repository: usa `tenant=$ OR tenant IS NULL`.');
  const svcP = join(SRC, 'modules/authority/actor-capability-grant.service.ts');
  const svc = existsSync(svcP) ? stripTs(readFileSync(svcP, 'utf-8')) : '';
  if (!svc) failures.push('service ausente.');
  // exige a INVOCACAO (await assertActorInTenant(...granteeActorId...)), nao apenas a definicao do helper.
  if (!/await\s+assertActorInTenant\s*\(\s*tenantId\s*,\s*input\.granteeActorId/.test(svc)) {
    failures.push('service: sem INVOCACAO da validacao antecipada tenant-scoped do grantee (assertActorInTenant).');
  }
  if (!/WHERE\s+tenant_id\s*=\s*\$1::uuid\s+AND\s+id\s*=\s*\$2::uuid/.test(svc)) {
    failures.push('service: prevalidacao do grantee nao e tenant-scoped exata.');
  }

  // ── 7. rotas continuam actor-only (sem territorio) ──────────────────────────────────────────
  const routesP = join(SRC, 'modules/authority/actor-capability-grant.routes.ts');
  const routes = existsSync(routesP) ? stripTs(readFileSync(routesP, 'utf-8')) : '';
  if (routes && /scopeType|scopeCityId|scope_city_id/i.test(routes)) failures.push('routes: expoe scopeType/scopeCityId.');

  // ── 8. wiring no runner ─────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-actor-capability-grant-tenant-coherence.mjs')) {
    failures.push('runner: audit-actor-capability-grant-tenant-coherence.mjs fora do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [actor-capability-grant-tenant-coherence]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Coerencia tenant x Actors (N2-D.2-R2) ausente/enfraquecida. A barreira vive DENTRO das funcoes SECURITY DEFINER (helper + validacao pre-INSERT/UPDATE, lock FOR SHARE, erro nao-vazante); fn_revoke exige tenant esperado (sem overload inseguro); fn_expire/fn_regrant intocadas.');
  process.exit(1);
}
console.log('GATE OK [actor-capability-grant-tenant-coherence] — integridade VERSIONADA da N2-D.2-R2: helper fn_assert_actors_in_tenant (SECURITY DEFINER, tenant EXATO, dedup+ordem deterministica+FOR SHARE, ACTOR_TENANT_MISMATCH nao-vazante, sem EXECUTE app/PUBLIC); fn_grant valida grantee/scope/granted_by/executed_by/responsible_human ANTES do INSERT; fn_revoke exige p_expected_tenant_id (cross-tenant->NOT_FOUND nao-vazante; territory->scope mismatch) e valida os actors armazenados/executores, com a assinatura antiga DROPADA (sem overload inseguro); fn_expire/fn_regrant intocadas; repository passa o tenant no revoke; service prevalida grantee tenant-scoped; rotas actor-only. (Estado vivo = introspecao.)');
