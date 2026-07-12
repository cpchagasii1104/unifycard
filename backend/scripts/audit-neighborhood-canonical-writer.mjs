#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-E · PRIMEIRO WRITER CANÔNICO DE NEIGHBORHOOD.
// Pergunta própria: "o writer cria UM bairro canônico atomicamente, com ownership-direto material + duas
// capabilities territoriais explícitas + token transacional de uso único abrindo o HOLD só para o INSERT +
// dois eventos de auditoria própria, sem rota/grant/writer alternativo, sem bypass do HOLD por GUC/role?"
// Integridade VERSIONADA (migration/arquivos). Estado vivo = introspecção. Parse fail = FAIL.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, ' ');
const MIG_FILE = '20260711210000_neighborhood_canonical_create_writer.sql';
const WRITER = 'fn_create_canonical_neighborhood';

function fnBody(sql, name) {
  const m = sql.match(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(([\\s\\S]*?)\\$func\\$;`, 'i'));
  return m ? m[0] : '';
}
// corpo executável (entre o primeiro BEGIN e o último END) de um texto de função já comment-stripped.
function execBody(fnText) {
  const m = /\bBEGIN\b([\s\S]*)\bEND\b\s*;?\s*\$func\$/i.exec(fnText) || /\bBEGIN\b([\s\S]*)\bEND\b/i.exec(fnText);
  return m ? m[1] : '';
}
// remove literais (single-quote e dollar-quote) → placeholder, p/ contagem de palavras-chave reais.
function stripStrings(s) {
  let out = '', i = 0, n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === "'") { i++; while (i < n) { if (s[i] === "'") { if (s[i + 1] === "'") { i += 2; continue; } i++; break; } i++; } out += "''"; continue; }
    if (c === '$') { const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(s.slice(i)); if (m) { const tag = m[0]; const end = s.indexOf(tag, i + tag.length); if (end < 0) { out += ' '; i = n; } else { out += "''"; i = end + tag.length; } continue; } }
    out += c; i++;
  }
  return out;
}
// remove SÓ literais single-quote (preserva dollar-quotes/DO-blocks — p/ R-3 varrer DML em DO-blocks).
function stripSingleQuotes(s) {
  let out = '', i = 0, n = s.length;
  while (i < n) { const c = s[i]; if (c === "'") { i++; while (i < n) { if (s[i] === "'") { if (s[i + 1] === "'") { i += 2; continue; } i++; break; } i++; } out += "''"; continue; } out += c; i++; }
  return out;
}
// remove o corpo $func$...$func$ de uma função NOMINAL do SQL (deixa header/DDL/DO-blocks intactos).
function removeNamedFnBody(sql, name) {
  return sql.replace(new RegExp(`(CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\([\\s\\S]*?AS\\s+)\\$func\\$[\\s\\S]*?\\$func\\$(\\s*;)`, 'i'), '$1 __FN_BODY__ $2');
}

try {
  const MIG = join(ROOT, 'migrations');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (!migFiles.includes(MIG_FILE)) throw new Error(`migration N2-E ausente: ${MIG_FILE}`);
  const rawSql = readFileSync(join(MIG, MIG_FILE), 'utf-8');
  const sql = stripSql(rawSql);

  // ── 1. INTEGRIDADE DO NOME (D-C) ──────────────────────────────────────────────────────────────
  if (!/ADD\s+CONSTRAINT\s+chk_neighborhoods_name_trimmed_nonempty\s+CHECK/i.test(sql)) {
    failures.push('CHECK forward-only de neighborhoods.name ausente.');
  }
  if (!/name\s*~\s*'\[\^\[:space:\]\]'/i.test(sql) || !/name\s*!~\s*'\^\[\[:space:\]\]'/i.test(sql) || !/name\s*!~\s*'\[\[:space:\]\]\$'/i.test(sql)) {
    failures.push('CHECK do nome não cobre não-vazio + sem-whitespace-de-borda (forma esperada).');
  }
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+normalize_name/i.test(sql)) {
    failures.push('migration altera normalize_name — helper compartilhado deve ficar intocado.');
  }

  // ── 2. WRITER: assinatura/segurança ───────────────────────────────────────────────────────────
  const defs = [...sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${WRITER}\\s*\\(`, 'gi'))];
  if (defs.length !== 1) failures.push(`${WRITER}: esperado 1 definição (achado ${defs.length}) — sem overload.`);
  const body = fnBody(sql, WRITER);
  if (!body) failures.push(`${WRITER}: corpo não extraível.`);
  else {
    if (!/SECURITY DEFINER/i.test(body)) failures.push(`${WRITER}: não SECURITY DEFINER.`);
    if (!/SET\s+search_path\s*=\s*pg_catalog,\s*public,\s*pg_temp/i.test(body)) failures.push(`${WRITER}: search_path não pinado (pg_catalog, public, pg_temp — public só p/ normalize_name/unaccent).`);
    if (!/RETURNS\s+UUID/i.test(body)) failures.push(`${WRITER}: não RETURNS UUID.`);
    // assinatura EXATA: 9 params nomeados; NÃO recebe capability/grant/token/executor/approved/status/is_active/timestamp
    for (const p of ['p_tenant_id', 'p_authenticated_user_id', 'p_grantee_actor_id', 'p_city_id', 'p_name', 'p_source_kind', 'p_source_reference', 'p_evidence', 'p_reason']) {
      if (!new RegExp(`\\b${p}\\b`).test(body)) failures.push(`${WRITER}: parâmetro ${p} ausente.`);
    }
    if (/\bp_(capability_key|create_grant_id|approve_grant_id|grant_id|token|executed_by_actor_id|responsible_human_actor_id|approved_by_actor_id|is_active|status|valid_from|approved_at)\b/i.test(body)) {
      failures.push(`${WRITER}: recebe parâmetro proibido do caller (capability/grant/token/executor/approved/status/timestamp).`);
    }

    // ── 3. OWNERSHIP-DIRETO (D-A) ──
    if (!/FROM\s+public\.actors\s+a\s+WHERE\s+a\.id\s*=\s*p_grantee_actor_id\s+FOR\s+SHARE/i.test(body)) {
      failures.push(`${WRITER}: não trava a row do Actor grantee (FROM public.actors ... FOR SHARE).`);
    }
    if (!/actor_type\s*<>\s*'user'/i.test(body)) failures.push(`${WRITER}: não exige actor_type='user'.`);
    if (!/tenant_id\s+IS\s+DISTINCT\s+FROM\s+p_tenant_id/i.test(body)) failures.push(`${WRITER}: não exige tenant do Actor = p_tenant_id.`);
    if (!/user_id\s+IS\s+DISTINCT\s+FROM\s+p_authenticated_user_id/i.test(body)) failures.push(`${WRITER}: não exige user_id do Actor = usuário autenticado.`);
    if (/company_id|group_id|delegation|actor_registry|canManageCompany/i.test(body)) failures.push(`${WRITER}: usa representação company/group/delegation — proibido (ownership-direto).`);
    if (/OR\s+[^;]*tenant_id\s+IS\s+NULL/i.test(body)) failures.push(`${WRITER}: usa OR tenant IS NULL — bypass proibido.`);

    // ── 4. DUAS CAPABILITIES EXPLÍCITAS (D-B) ──
    const createCall = /fn_assert_territorial_capability\s*\(\s*p_grantee_actor_id\s*,\s*'territory:create_neighborhood'\s*,\s*p_city_id\s*\)/i.test(body);
    const approveCall = /fn_assert_territorial_capability\s*\(\s*p_grantee_actor_id\s*,\s*'territory:approve_neighborhood'\s*,\s*p_city_id\s*\)/i.test(body);
    if (!createCall) failures.push(`${WRITER}: falta assertion territory:create_neighborhood(grantee, city).`);
    if (!approveCall) failures.push(`${WRITER}: falta assertion territory:approve_neighborhood(grantee, city).`);
    const asserts = (body.match(/fn_assert_territorial_capability\s*\(/gi) || []).length;
    if (asserts !== 2) failures.push(`${WRITER}: esperado 2 assertions (achado ${asserts}) — create+approve explícitos.`);
    // ordem fixa: create antes de approve
    if (createCall && approveCall && body.search(/'territory:create_neighborhood'/) > body.search(/'territory:approve_neighborhood'/)) {
      failures.push(`${WRITER}: ordem create/approve invertida.`);
    }
    if (/capability_key\s+(LIKE|~)/i.test(body) || /startsWith/i.test(body)) failures.push(`${WRITER}: prefix matching de capability — proibido.`);

    // ── 5. CITY única (D-A/§7) ──
    if (/authority_city|p_authority_city/i.test(body)) failures.push(`${WRITER}: city de autoridade separada — proibido (city do recurso é única).`);

    // ── 6. TOKEN transacional (D-D) ──
    if (!/INSERT\s+INTO\s+public\.neighborhood_writer_authorizations[\s\S]*pg_current_xact_id\(\)[\s\S]*pg_backend_pid\(\)[\s\S]*'create_neighborhood'/i.test(body)) {
      failures.push(`${WRITER}: token não emitido com pg_current_xact_id()+pg_backend_pid()+operação.`);
    }
    if (/current_setting|set_config|session_user|pg_has_role|SET\s+ROLE/i.test(body)) failures.push(`${WRITER}: usa GUC/role/SET ROLE — bypass proibido.`);

    // ── 7. INSERT ÚNICO + 2 eventos + retorno ──
    const nbInserts = (body.match(/INSERT\s+INTO\s+public\.neighborhoods\b/gi) || []).length;
    if (nbInserts !== 1) failures.push(`${WRITER}: esperado 1 INSERT em neighborhoods (achado ${nbInserts}).`);
    if (/INSERT\s+INTO\s+public\.neighborhoods[\s\S]*?SELECT/i.test(body)) failures.push(`${WRITER}: INSERT ... SELECT em neighborhoods — proibido (uma row VALUES).`);
    if (/ON\s+CONFLICT/i.test(body)) failures.push(`${WRITER}: ON CONFLICT — upsert/idempotência silenciosa proibida.`);
    if (!/created_by_actor_id\s*,\s*approved_by_actor_id/i.test(body) && !/created_by_actor_id[\s\S]{0,40}approved_by_actor_id/i.test(body)) {
      failures.push(`${WRITER}: INSERT não grava created_by/approved_by.`);
    }
    const ceInserts = (body.match(/INSERT\s+INTO\s+public\.neighborhood_curation_events\b/gi) || []).length;
    if (ceInserts !== 1) failures.push(`${WRITER}: esperado 1 INSERT (com 2 VALUES) em neighborhood_curation_events.`);
    if (!/'created'[\s\S]*'territory:create_neighborhood'[\s\S]*v_create_grant/i.test(body)) failures.push(`${WRITER}: evento created não mapeia create_grant/create key.`);
    if (!/'approved'[\s\S]*'territory:approve_neighborhood'[\s\S]*v_approve_grant/i.test(body)) failures.push(`${WRITER}: evento approved não mapeia approve_grant/approve key.`);
    if (!/RETURN\s+v_neighborhood_id\s*;/i.test(body)) failures.push(`${WRITER}: não retorna somente v_neighborhood_id.`);
    if (/RETURN\s+[^;]*grant/i.test(body)) failures.push(`${WRITER}: retorno expõe grant — proibido.`);

    // ── 8. denial uniforme; nome inválido é validation distinta; infra não vira denial ──
    if (!/RAISE\s+EXCEPTION\s+'TERRITORIAL_CAPABILITY_DENIED'/i.test(body)) failures.push(`${WRITER}: denial de autoridade não é uniforme TERRITORIAL_CAPABILITY_DENIED.`);
    if (!/NEIGHBORHOOD_NAME_INVALID/i.test(body)) failures.push(`${WRITER}: validação de nome (NEIGHBORHOOD_NAME_INVALID) ausente.`);
  }

  // ── 9. HOLD reescrito (D-D) — R-1 LIVENESS: p/ TG_OP≠INSERT, TODO caminho executável termina em RAISE. ──
  const holdFn = fnBody(sql, 'enforce_neighborhoods_canonical_writer_hold');
  if (!holdFn) failures.push('HOLD reescrito ausente na migration N2-E.');
  else {
    if (/current_setting|set_config|session_user|pg_has_role|SET\s+ROLE/i.test(holdFn)) failures.push('HOLD: usa GUC/role — bypass proibido.');
    if (!/NEIGHBORHOOD_CANONICAL_WRITER_HOLD/.test(holdFn)) failures.push('HOLD: erro estável NEIGHBORHOOD_CANONICAL_WRITER_HOLD ausente.');
    const hb = execBody(holdFn);
    const insBranch = /IF\s+TG_OP\s*=\s*'INSERT'\s*THEN([\s\S]*?)END\s+IF\s*;/i.exec(hb);
    if (!insBranch) failures.push("HOLD (R-1): branch INSERT canônico (IF TG_OP = 'INSERT' THEN … END IF;) ausente/divergente — condição alterada permitiria desvio de UPDATE/DELETE.");
    else {
      const remainder = stripStrings(hb.slice(0, insBranch.index) + hb.slice(insBranch.index + insBranch[0].length));
      if (/\bRETURN\b|\bEXIT\b|\bCONTINUE\b/i.test(remainder)) failures.push('HOLD (R-1): RETURN/EXIT/CONTINUE fora do branch INSERT — torna o RAISE de UPDATE/DELETE inalcançável (G-1).');
      if (/\bEXCEPTION\s+WHEN\b/i.test(remainder)) failures.push('HOLD (R-1): EXCEPTION handler no HOLD — pode engolir o RAISE.');
      if (/\bIF\b|\bCASE\b|\bLOOP\b|\bWHILE\b/i.test(remainder)) failures.push('HOLD (R-1): RAISE de UPDATE/DELETE sob IF/CASE/LOOP (ramo possivelmente morto) — deve ser incondicional.');
      if ((remainder.match(/\bRAISE\b/gi) || []).length < 1) failures.push('HOLD (R-1): nenhum RAISE incondicional alcançável para UPDATE/DELETE.');
      if (/\b(INSERT|UPDATE|DELETE|PERFORM)\b/i.test(stripStrings(insBranch[1]))) failures.push('HOLD (R-1): branch INSERT contém DML/PERFORM — deve apenas deferir (RETURN NULL).');
    }
  }
  // ── consume (R-2 LIVENESS): ordem DELETE → cardinalidade → gate <>1 → RAISE → RETURN NEW; sem retorno antes. ──
  const consumeFn = fnBody(sql, 'consume_neighborhood_writer_authorization');
  if (!consumeFn) failures.push('função de consumo do token ausente.');
  else {
    if (/current_setting|set_config|SET\s+ROLE/i.test(consumeFn)) failures.push('consume: usa GUC/role — proibido.');
    const cbRaw = execBody(consumeFn);
    const cb = stripStrings(cbRaw);
    if (/\bEXCEPTION\s+WHEN\b/i.test(cb)) failures.push('consume (R-2): EXCEPTION handler — pode engolir o denial de token ausente.');
    const iDelete = cb.search(/\bDELETE\s+FROM\s+public\.neighborhood_writer_authorizations/i);
    const iDiag = cb.search(/GET\s+DIAGNOSTICS\s+v_consumed/i);
    const iGate = cb.search(/IF\s+v_consumed\s*<>\s*1\s*THEN/i);
    const iRaise = iGate >= 0 ? cb.slice(iGate).search(/\bRAISE\b/i) : -1;
    const iReturn = cb.search(/\bRETURN\s+NEW\b/i);
    const returns = (cb.match(/\bRETURN\b/gi) || []).length;
    if (iDelete < 0) failures.push('consume (R-2): DELETE do token ausente (fora de comentário/string).');
    if (!/DELETE\s+FROM\s+public\.neighborhood_writer_authorizations[\s\S]*pg_current_xact_id\(\)[\s\S]*pg_backend_pid\(\)/i.test(cbRaw)) failures.push('consume: token não vinculado a xid+backend.');
    if (!/LIMIT\s+1/i.test(cbRaw)) failures.push('consume: sem LIMIT 1 (consumo de exatamente um token).');
    if (iDiag < 0 || iDiag < iDelete) failures.push('consume (R-2): GET DIAGNOSTICS da cardinalidade ausente/antes do DELETE.');
    if (iGate < 0) failures.push('consume (R-2): gate `IF v_consumed <> 1` ausente/enfraquecido (>=0 / IS NOT NULL / =0 proibidos).');
    else if (iGate < iDiag) failures.push('consume (R-2): gate antes da obtenção da cardinalidade.');
    if (iRaise < 0) failures.push('consume (R-2): RAISE de denial não vive dentro do gate.');
    if (iReturn < 0) failures.push('consume (R-2): RETURN NEW ausente.');
    if (returns !== 1) failures.push(`consume (R-2): esperado exatamente 1 RETURN (achado ${returns}) — retorno antecipado/alternativo permite INSERT sem consumo (G-2).`);
    if (iReturn >= 0 && iGate >= 0 && iReturn < iGate) failures.push('consume (R-2): RETURN NEW antes do gate/RAISE — INSERT alcança sucesso sem consumir token (G-2).');
    if (iReturn >= 0 && iDelete >= 0 && iReturn < iDelete) failures.push('consume (R-2): RETURN NEW antes do DELETE do token (G-2).');
  }
  if (!/CREATE\s+TRIGGER\s+trg_neighborhoods_writer_token_consume\s+BEFORE\s+INSERT\s+ON\s+neighborhoods\s+FOR\s+EACH\s+ROW/i.test(sql)) {
    failures.push('trigger de consumo (BEFORE INSERT FOR EACH ROW) ausente.');
  }
  if (!/ALTER\s+TABLE\s+neighborhoods\s+ENABLE\s+ALWAYS\s+TRIGGER\s+trg_neighborhoods_writer_token_consume/i.test(sql)) {
    failures.push('trigger de consumo sem ENABLE ALWAYS.');
  }

  // ── 10. token não sobrevive ao commit (constraint trigger diferido) ──
  if (!/CREATE\s+CONSTRAINT\s+TRIGGER\s+trg_nwa_must_be_consumed[\s\S]*DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(sql)) {
    failures.push('constraint trigger diferido de não-sobrevivência do token ausente.');
  }

  // ── 11. Tabelas internas + ACL ──
  if (!/CREATE\s+TABLE\s+neighborhood_writer_authorizations/i.test(sql)) failures.push('token table ausente.');
  if (!/REVOKE\s+ALL\s+ON\s+neighborhood_writer_authorizations\s+FROM\s+unificard_app/i.test(sql)) failures.push('token table sem REVOKE ALL de unificard_app.');
  if (!/CREATE\s+TABLE\s+neighborhood_curation_events/i.test(sql)) failures.push('curation events ausente.');
  if (!/GRANT\s+SELECT\s+ON\s+neighborhood_curation_events\s+TO\s+unificard_app/i.test(sql)) failures.push('curation sem GRANT SELECT p/ app.');
  if (/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[\s\S]{0,60}ON\s+neighborhood_curation_events\s+TO\s+unificard_app/i.test(sql)) failures.push('curation com DML p/ app — proibido (SELECT-only).');
  // curation append-only + snapshot + cardinalidade + capability↔operation
  if (!/uq_nce_one_event_per_operation\s+UNIQUE\s*\(\s*neighborhood_id\s*,\s*operation\s*\)/i.test(sql)) failures.push('curation sem UNIQUE(neighborhood_id, operation).');
  if (!/chk_nce_capability_matches_operation/i.test(sql)) failures.push('curation sem CHECK capability↔operation.');
  if (!/trg_nce_no_update/i.test(sql) || !/trg_nce_no_delete/i.test(sql) || !/trg_nce_snapshot/i.test(sql)) failures.push('curation sem triggers snapshot/no_update/no_delete.');
  // ACL do writer
  if (!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_create_canonical_neighborhood\(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT\)\s+TO\s+unificard_app/i.test(sql)) failures.push('writer sem GRANT EXECUTE p/ app na assinatura exata.');
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+fn_create_canonical_neighborhood[\s\S]*FROM\s+PUBLIC/i.test(sql)) failures.push('writer sem REVOKE de PUBLIC.');
  if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_create_canonical_neighborhood[\s\S]{0,140}TO\s+PUBLIC/i.test(sql)) failures.push('writer com GRANT EXECUTE a PUBLIC — proibido.');
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+consume_neighborhood_writer_authorization\(\)\s+FROM\s+unificard_app/i.test(sql)) failures.push('consume interno com EXECUTE p/ app (falta REVOKE).');

  // ── 12. Fronteiras SQL: não toca fn_assert_territorial/keys/matriz/immutability/grant fns; sem Social/Bank ──
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_assert_territorial_capability/i.test(sql)) failures.push('migration redefine fn_assert_territorial_capability — proibido.');
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_(grant|revoke|expire|regrant)_actor_capability/i.test(sql)) failures.push('migration toca funções de grant/revoke/expire/regrant — proibido.');
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+enforce_neighborhood_identity_immutability/i.test(sql)) failures.push('migration redefine imutabilidade — proibido.');
  if (/'territory:(deactivate|correct|manage_neighborhood_aliases|register_neighborhood_succession)/i.test(sql)) failures.push('migration usa capability de correction/deactivate/alias/succession — fora do escopo N2-E.');
  if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_(aliases|success\w*|candidates)/i.test(sql)) failures.push('migration cria alias/succession/candidate — proibido.');
  if (/\bbank_\w+|\bsocial_\w+/i.test(sql)) failures.push('migration toca Bank/Social.');

  // ── R-3: DML SOLTA sobre neighborhoods na migration (fora dos corpos das funções canônicas). ──
  // Remove os corpos $func$…$func$ das funções nominais autorizadas (a DML interna delas é legítima);
  // o remanescente inclui DDL + DO-blocks + top-level. Nele, NENHUMA DML direta sobre neighborhoods.
  {
    let skel = sql;
    for (const fn of ['fn_create_canonical_neighborhood', 'consume_neighborhood_writer_authorization',
      'enforce_neighborhoods_canonical_writer_hold', 'enforce_neighborhood_curation_event_snapshot',
      'prevent_neighborhood_curation_events_modification', 'assert_neighborhood_writer_token_consumed']) {
      skel = removeNamedFnBody(skel, fn);
    }
    // remanescente sem literais SINGLE-QUOTE (mensagens); DO-blocks (dollar-quote) PRESERVADOS para varrer
    // DML dentro deles. SELECT ... FROM neighborhoods (PRE/POST) não casa os verbos DML → sem falso-positivo.
    const bare = stripSingleQuotes(skel);
    const DML_NB = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|MERGE\s+INTO|COPY)\s+(?:public\.)?"?neighborhoods"?\b/i;
    if (DML_NB.test(bare)) failures.push('R-3: DML DIRETA sobre neighborhoods FORA das funções canônicas (INSERT/UPDATE/DELETE/TRUNCATE/MERGE/COPY) — seed/mutação solta proibida.');
    if (/\bWITH\b[\s\S]{0,200}?\b(INSERT|UPDATE|DELETE)\b[\s\S]{0,80}?(?:public\.)?"?neighborhoods"?\b/i.test(bare)) failures.push('R-3: CTE com DML sobre neighborhoods fora das funções canônicas — proibido.');
    // EXECUTE dinâmico: a DML costuma viver DENTRO de um literal single-quote → checar no `skel` (aspas preservadas).
    if (/\bEXECUTE\b[\s\S]{0,140}?(INSERT|UPDATE|DELETE|TRUNCATE|MERGE)[\s\S]{0,80}?neighborhoods/i.test(skel)) failures.push('R-3: EXECUTE dinâmico com DML sobre neighborhoods — proibido.');
  }

  // ── 13. TS repository ──
  const repoP = join(SRC, 'modules/neighborhoods/neighborhood-canonical-writer.repository.ts');
  const repo = existsSync(repoP) ? stripTs(readFileSync(repoP, 'utf-8')) : '';
  if (!repo) failures.push('repository ausente.');
  else {
    if (!/client\.query</.test(repo) || !/fn_create_canonical_neighborhood\s*\(\s*\$1::uuid/i.test(repo)) failures.push('repository: não chama fn_create_canonical_neighborhood via client.query.');
    if (/runQueryWithTenant|runQueriesWithTenant|\bpool\b|getClientWithTenant/.test(repo)) failures.push('repository: usa pool/runQueryWithTenant — deve exigir TxQueryClient (sem fallback).');
    if (/INSERT\s+INTO\s+neighborhoods/i.test(repo)) failures.push('repository: INSERT direto em neighborhoods — proibido.');
    if (!/TERRITORIAL_CAPABILITY_DENIED[\s\S]*forbidden/i.test(repo)) failures.push('repository: denial não vira 403 uniforme.');
    if (!/NEIGHBORHOOD_NAME_INVALID/i.test(repo)) failures.push('repository: validation de nome ausente.');
    if (!/conflict/i.test(repo)) failures.push('repository: conflito (409) ausente.');
    if (!/throw\s+error/.test(repo)) failures.push('repository: não repropaga infra (fail-closed honesto).');
  }

  // ── 14. TS service (transaction-service) ──
  const svcP = join(SRC, 'modules/neighborhoods/neighborhood-canonical-writer.service.ts');
  const svc = existsSync(svcP) ? stripTs(readFileSync(svcP, 'utf-8')) : '';
  if (!svc) failures.push('service ausente.');
  else {
    if (!/withTransaction\s*\(/.test(svc)) failures.push('service: não usa withTransaction (atomicidade).');
    if (!/canRepresentActor\s*\(/.test(svc)) failures.push('service: não invoca canRepresentActor (prevalidation).');
    // canRep gateia mas NÃO é engolido (infra propaga) — nenhum try/catch em volta da chamada
    const svcResolve = svc;
    if (/try\s*{[\s\S]*canRepresentActor[\s\S]*catch/i.test(svcResolve)) failures.push('service: canRepresentActor dentro de try/catch — infra deve propagar (lição D.3).');
    if (/canRep\s*=\s*(true|false)/.test(svcResolve)) failures.push('service: atribuição literal a canRep — fail-open/swallow proibido.');
    if (!/if\s*\(\s*!\s*canRep\s*\)/.test(svcResolve)) failures.push('service: canRep não gateia.');
    if (!/createCanonicalNeighborhood\s*\(\s*client/.test(svc)) failures.push('service: não passa o MESMO client ao repository.');
    if (/INSERT\s+INTO\s+neighborhoods|fn_assert_territorial_capability/i.test(svc)) failures.push('service: INSERT direto ou assertion fora da função canônica.');
    // contexto separado do payload
    if (!/NeighborhoodWriterContext/.test(svc) || !/NeighborhoodCreatePayload/.test(svc)) failures.push('service: contexto autenticado não separado do payload.');
  }

  // ── 15. Fronteira de superfície: nenhuma rota referencia o writer ──
  function walk(dir) { const out = []; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.ts')) out.push(p); } return out; }
  for (const f of (existsSync(SRC) ? walk(SRC) : [])) {
    if (!f.endsWith('.routes.ts')) continue;
    const c = stripTs(readFileSync(f, 'utf-8'));
    if (/(neighborhoodCanonicalWriterService|fn_create_canonical_neighborhood|neighborhood-canonical-writer)/.test(c)) {
      failures.push(`[fronteira] ${f.replace(ROOT, '')}: rota referencia o writer canônico — N2-E é interno (sem rota).`);
    }
  }

  // ── 16. wiring ──
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-neighborhood-canonical-writer.mjs')) failures.push('runner: audit-neighborhood-canonical-writer.mjs fora do run-regression-guards.');
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL.`);
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-canonical-writer]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Writer canônico de neighborhood (N2-E) ausente/enfraquecido. Exige: CHECK de nome forward-only; writer SECURITY DEFINER com ownership-direto material (Actor user do próprio usuário, FOR SHARE) + duas capabilities explícitas (create/approve, mesma city, ordem fixa) + token transacional de uso único abrindo o HOLD só p/ o INSERT (sem GUC/role) + INSERT único + dois eventos append-only; app sem DML; sem rota/PORTA/grant/writer alternativo; fn_assert_territorial/keys/matriz/imutabilidade intactos.');
  process.exit(1);
}
console.log('GATE OK [neighborhood-canonical-writer] — integridade VERSIONADA da N2-E: CHECK forward-only do nome (normalize_name intocado); fn_create_canonical_neighborhood (SECURITY DEFINER, assinatura exata sem grant/token/capability do caller) com ownership-direto material (Actor user do próprio usuário, mesmo tenant, FOR SHARE) + duas assertions territoriais explícitas (create+approve, mesma city, ordem fixa) + token transacional uso-único (xid+backend, sem GUC/role) abrindo o HOLD só p/ o INSERT único + dois eventos de auditoria própria (created/approved, capability↔operation, append-only, snapshot, 1 por operação, não-sobrevivência do token); ACL app-só-na-assinatura/sem-DML; repository exige TxQueryClient (sem pool), service compõe canRepresentActor (prevalidation gateada, infra propaga) numa withTransaction com o mesmo client; sem rota/PORTA/grant/writer alternativo; fn_assert_territorial/keys/matriz/imutabilidade/aliases/succession intactos. (Estado vivo = introspecção.)');
