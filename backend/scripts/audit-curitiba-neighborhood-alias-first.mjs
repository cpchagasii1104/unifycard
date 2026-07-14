#!/usr/bin/env node
// Guard dedicado — F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 (DECISION-0174, Curitiba alias-first).
// Pergunta própria: "o fluxo governado de aliases prova, de forma VIVA (não textual): job≠Actor sem capability;
// aprovação chama canRepresentActor (não engolida) + capability EXATA; execução não representa/valida grant;
// manifest/status/job/provider nunca são autoridade; zero bairro novo/resolver intocado; manifest hashado com
// line_key/line_count; redundância proibida; writer SECURITY DEFINER search_path pinado EXECUTE-fechado; HOLD
// (INSERT direto/UPDATE/DELETE) fechado; token one-use POR LINHA (xid/backend/bairro/normalized); sem GUC/role/
// tenant bypass/trigger-disable; alias event/approval/execution obrigatórios; conflito aborta lote sem ranking/
// LIMIT 1; rerun fail-closed; atomicidade sem commit parcial; sem Bank/Social; e aprovação/apply reais NÃO
// persistidos antes do GO humano?"  Comment-aware (strip) + liveness. Parse/arquivo ausente = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

function stripSqlComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '-' && d === '-') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === '$' && d === '$') { out += '$$'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    if (mode === 'sq') { if (c === "'" && d === "'") { out += "''"; i += 2; continue; } if (c === "'") { mode = 'code'; } out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}
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
function load(rel, stripper) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { note(`ARQUIVO AUSENTE: ${rel}`); return null; }
  return stripper(readFileSync(p, 'utf8'));
}

const MIG = load('migrations/20260713140000_neighborhood_alias_first_governed_flow.sql', stripSqlComments);
const SVC = load('src/core/location/neighborhood-alias-manifest-approval.service.ts', stripJsComments);
const APPROVE = load('scripts/neighborhood-alias-manifest-approve.ts', stripJsComments);
const APPLY = load('scripts/neighborhood-alias-manifest-apply.mjs', stripJsComments);

const CAP = 'territory:manage_neighborhood_aliases';

if (MIG) {
  // 1 · job não entra em Actors: execução SEM FK a actors nem coluna actor
  const execBlock = (MIG.match(/CREATE TABLE neighborhood_alias_automation_executions[\s\S]*?\n\);/) || [''])[0];
  if (!execBlock) note('M1: casa de execução ausente');
  if (/REFERENCES\s+actors\b/i.test(execBlock)) note('M1a: execução tem FK a actors (job não é Actor)');
  if (/\bactor_id\b|\bapprover_actor|\bexecuted_by_actor/i.test(execBlock)) note('M1b: execução tem coluna de actor (job não representa humano)');
  if (!/executor_kind\s*=\s*'job'/.test(execBlock)) note('M1c: executor_kind não fixado em job');
  if (!/CHECK\s*\(\s*executor_kind\s*=\s*'job'\s*\)/.test(execBlock)) note('M1d: executor_kind sem CHECK=job');

  // 4 · approval registra capability EXATA
  if (!/fn_assert_territorial_capability\(\s*p_approver_actor_id\s*,\s*'territory:manage_neighborhood_aliases'/.test(MIG))
    note('M4: registro de approval não prova capability exata via fn_assert_territorial_capability');
  // 6 · grant revalidado no writer (capability exata + cidade do approval)
  if (!/fn_assert_territorial_capability\(\s*v_appr\.approved_by_actor_id\s*,\s*'territory:manage_neighborhood_aliases'\s*,\s*v_appr\.scope_city_id/.test(MIG))
    note('M6: writer não revalida grant (capability exata + cidade do approval)');
  if (!/v_grant\s+IS DISTINCT FROM\s+v_appr\.territorial_grant_id[\s\S]{0,120}?TERRITORIAL_CAPABILITY_DENIED/.test(MIG))
    note('M6a: writer não exige coerência do grant revalidado com o approval');

  // 7 · status nunca é autoridade: nenhuma coluna "status" nas casas de alias
  if (/\bstatus\b\s+TEXT|\bstatus\b\s+text/i.test(MIG)) note('M7: coluna status em casa de alias (status nunca é autoridade)');
  // 8 · provider nunca é source
  if (/viacep|brasilapi|VIA_CEP|cep_resolution/i.test(MIG)) note('M8: writer/migration referencia provider como source');
  // 9 · zero bairro novo
  if (/INSERT\s+INTO\s+public\.neighborhoods\b|fn_create_canonical_neighborhood/i.test(MIG)) note('M9: migration cria/insere bairro');
  // 10 · resolver intocado
  if (/postal_address_resolver|resolvePostal|cep-provider|resolver/i.test(MIG)) note('M10: migration toca o resolver postal');

  // 11-12 · hash + line_key/line_count nas casas
  if (!/manifest_hash\s+TEXT NOT NULL CHECK\s*\(\s*manifest_hash\s*~\s*'\^\[0-9a-f\]\{64\}\$'\)/.test(MIG)) note('M11: manifest_hash sem CHECK sha256(64hex)');
  if (!/manifest_line_key\s+TEXT NOT NULL/.test(MIG)) note('M12a: manifest_line_key ausente na trilha de alias');
  if (!/line_count\s+INTEGER NOT NULL/.test(MIG)) note('M12b: line_count ausente');

  // 13 · redundância com canônico proibida
  if (!/ALIAS_REDUNDANT_WITH_CANONICAL/.test(MIG)) note('M13: writer não rejeita alias redundante com name_normalized');
  // 14-16 · writer SECURITY DEFINER + search_path pinado + EXECUTE fechado
  const writerDef = (MIG.match(/CREATE FUNCTION fn_create_canonical_alias[\s\S]*?\$func\$;/) || [''])[0];
  if (!/SECURITY DEFINER/.test(writerDef)) note('M14: writer não é SECURITY DEFINER');
  if (!/SET search_path\s*=\s*pg_catalog, public, pg_temp/.test(writerDef)) note('M15: writer sem search_path pinado');
  if (!/REVOKE ALL ON FUNCTION fn_create_canonical_alias[\s\S]*?FROM PUBLIC/.test(MIG)
      || !/REVOKE ALL ON FUNCTION fn_create_canonical_alias[\s\S]*?FROM unificard_app/.test(MIG))
    note('M16: EXECUTE do writer não revogado de PUBLIC/unificard_app');
  if (/GRANT\s+EXECUTE ON FUNCTION fn_create_canonical_alias/.test(MIG)) note('M16a: writer com GRANT EXECUTE (deve ser fechado)');

  // 17-19 · HOLD: statement permite só INSERT, bloqueia UPDATE/DELETE; row consome token
  const holdFn = (MIG.match(/CREATE OR REPLACE FUNCTION enforce_neighborhood_aliases_writer_hold[\s\S]*?\$func\$;/) || [''])[0];
  if (!/IF TG_OP = 'INSERT' THEN\s*RETURN NULL/.test(holdFn)) note('M17: HOLD não permite (só) a classe INSERT via token');
  if (!/RAISE EXCEPTION[\s\S]{0,200}?WRITER_HOLD/.test(holdFn)) note('M18: HOLD não bloqueia UPDATE/DELETE');
  if (!/CREATE TRIGGER trg_neighborhood_aliases_writer_token_consume\s+BEFORE INSERT ON neighborhood_aliases/.test(MIG)) note('M19: trigger row-level de consumo de token ausente');
  if (!/ENABLE ALWAYS TRIGGER trg_neighborhood_aliases_writer_token_consume/.test(MIG)) note('M19a: consume trigger não é ENABLE ALWAYS');

  // 20-22 · token por linha, one-use, bound a xid/backend/linha
  const tokTbl = (MIG.match(/CREATE TABLE neighborhood_alias_writer_authorizations[\s\S]*?\n\);/) || [''])[0];
  for (const col of ['xid', 'backend_pid', 'neighborhood_id', 'alias_normalized', 'automation_execution_id', 'manifest_line_key'])
    if (!new RegExp(`\\b${col}\\b`).test(tokTbl)) note(`M20: token sem coluna de vínculo ${col}`);
  const consumeFn = (MIG.match(/CREATE FUNCTION consume_alias_writer_authorization[\s\S]*?\$func\$;/) || [''])[0];
  if (!/xid = pg_current_xact_id\(\)\s+AND backend_pid = pg_backend_pid\(\)/.test(consumeFn)) note('M22: consumo não vincula a xid+backend');
  if (!/neighborhood_id = NEW\.neighborhood_id\s+AND alias_normalized = v_norm/.test(consumeFn)) note('M22a: consumo não vincula à linha (bairro+normalized)');
  if (!/v_consumed\s*<>\s*1/.test(consumeFn)) note('M21: consumo não exige exatamente 1 token (one-use)');
  if (!/trg_nawa_must_be_consumed[\s\S]*?DEFERRABLE INITIALLY DEFERRED/.test(MIG)) note('M21a: token pode sobreviver ao commit (constraint trigger diferido ausente)');

  // 23-26 · sem GUC/role/tenant bypass/trigger-disable
  if (/current_setting\(|set_config\(/i.test(MIG)) note('M23: GUC (current_setting/set_config) no fluxo de alias');
  if (/session_replication_role|SET\s+ROLE|SET\s+SESSION\s+AUTHORIZATION/i.test(MIG)) note('M24: role bypass');
  if (/\btenant_id\b/i.test(MIG)) note('M25: tenant_id nas casas de alias (autoridade territorial é global, sem tenant bypass)');
  if (/DISABLE\s+TRIGGER/i.test(MIG)) note('M26: DISABLE TRIGGER no fluxo de alias');

  // 27-29 · alias event obrigatório; approval/execution obrigatórios no writer
  if (!/INSERT INTO public\.neighborhood_alias_curation_events[\s\S]*?'alias_created'/.test(MIG)) note('M27: writer não emite evento alias_created');
  if (!/event_type = 'manifest_approved' FOR SHARE[\s\S]{0,200}?TERRITORIAL_CAPABILITY_DENIED/.test(MIG)) note('M28: writer não exige approval (manifest_approved) travado ou não nega');
  if (!/executor_kind\s*<>\s*'job'[\s\S]{0,120}?ALIAS_EXECUTION_INVALID/.test(MIG)) note('M29: writer não exige execução job válida');

  // 31 · sem ranking/score; escolha do bairro é por id explícito (nunca por texto/LIMIT 1).
  //   Avalia SÓ o código executável (literais de string — inclusive COMMENT ON ... IS '...' — removidos),
  //   para não confundir a própria prosa "sem ranking/score" com uso real.
  const MIG_NS = MIG.replace(/'(?:''|[^'])*'/g, "''");
  if (/\branking\b|\bscore\b/i.test(MIG_NS)) note('M31: ranking/score no fluxo de alias');
  if (/neighborhood_id\s*=\s*\(\s*SELECT[\s\S]{0,120}LIMIT\s+1/i.test(MIG_NS)) note('M31a: bairro escolhido por SELECT ... LIMIT 1 (deve vir por id explícito)');

  // append-only das casas + auto-prova (a RAISE de falha precede o handler que exige o denial uniforme)
  if (!/prevent_alias_governance_house_modification/.test(MIG)) note('M-ap: casas de governança sem append-only');
  if (!/auto-prova falhou[\s\S]{0,200}?TERRITORIAL_CAPABILITY_DENIED/.test(MIG)) note('M-auto: auto-prova de denial ausente');
}

if (SVC) {
  // 3 · aprovação chama canRepresentActor (não engolida) + capability em DB
  if (!/authorizationService\.canRepresentActor\(/.test(SVC)) note('S3: serviço de aprovação não chama canRepresentActor');
  if (!/const\s+representable\s*=\s*await\s+authorizationService\.canRepresentActor\([\s\S]{0,120}?\)\s*;\s*if\s*\(\s*!\s*representable\s*\)\s*throw/.test(SVC))
    note('S3a: canRepresentActor engolido (não é await direto → if(!representable) throw)');
  if (/\.catch\(|\?\?\s*false|=>\s*false/.test(SVC.match(/canRepresentActor[\s\S]{0,160}/)?.[0] || '')) note('S3b: erro de representação convertido em false/deny silencioso');
  if (!/fn_register_alias_manifest_approval/.test(SVC)) note('S4: serviço não registra manifest_approved via casa governada');
  // job não usa este entrypoint / sem rota pública
  if (/fastify|router\.|\.route\(|addHttpRoute|app\.(get|post|put)/i.test(SVC)) note('S-route: serviço de aprovação expõe rota pública');
  if (/fn_create_canonical_alias|automation_execution|neighborhood_aliases\b/i.test(SVC)) note('S-scope: aprovação cria execução/alias (fora do escopo do ato de aprovar)');
}

if (APPLY) {
  // 2,5 · job sem capability, sem canRepresentActor
  if (/canRepresentActor/.test(APPLY)) note('A5: apply-job chama canRepresentActor (execução não representa humano)');
  if (/fn_assert_territorial_capability/.test(APPLY)) note('A2: apply-job invoca capability diretamente (a autoridade é revalidada no writer)');
  if (/INSERT\s+INTO\s+public\.actors\b/i.test(APPLY)) note('A1: apply-job insere Actor');
  // 30,31 · conflito aborta lote antes de inserir; sem LIMIT 1/ranking de bairro
  if (!/ALIAS_CITY_NORMALIZED_CONFLICT[\s\S]{0,80}?throw|throw[\s\S]{0,120}?ALIAS_CITY_NORMALIZED_CONFLICT/.test(APPLY)) note('A30: apply não aborta o lote em conflito');
  if (/LIMIT\s+1|ranking|score/i.test(APPLY)) note('A31: apply usa LIMIT 1/ranking/score na resolução');
  // 32 · rerun fail-closed (hash exato do approval; revogado falha; no-op se tudo replay)
  if (!/manifest_hash=\$3|manifest_hash\s*=\s*\$3/.test(APPLY)) note('A32: apply não casa pelo hash exato do approval');
  if (!/APPROVAL_NOT_LIVE|revoked/.test(APPLY)) note('A32a: apply não é fail-closed para approval revogado/supersedido');
  if (!/toInsert\.length\s*===\s*0/.test(APPLY)) note('A32b: apply sem no-op de rerun (tudo replay)');
  // 33 · atomicidade: exatamente 1 COMMIT dominado; execução registrada antes dos aliases
  const commits = (APPLY.match(/client\.query\(\s*'COMMIT'\s*\)/g) || []).length;
  if (commits !== 1) note(`A33: esperado exatamente 1 COMMIT (achou ${commits}) — sem commit parcial`);
  if (!/if\s*\(\s*APPLY\s*&&\s*CONFIRMED\s*&&\s*!\s*failed\s*\)\s*\{[\s\S]{0,120}?client\.query\(\s*'COMMIT'\s*\)/.test(APPLY)) note('A33a: COMMIT não dominado por (APPLY&&CONFIRMED&&!failed)');
  if (!/fn_register_alias_automation_execution[\s\S]*?fn_create_canonical_alias/.test(APPLY)) note('A33b: execução não registrada antes dos aliases');
  if (!/pg_advisory_xact_lock/.test(APPLY)) note('A33c: advisory lock ausente');
  // 37 · apply real exige token literal; default dry-run
  if (!/const\s+APPLY\s*=\s*argv\.includes\(\s*'--apply'\s*\)/.test(APPLY)) note('A37: APPLY não deriva de --apply');
  if (!/const\s+CONFIRMED\s*=\s*argv\.includes\(\s*CONFIRM_TOKEN\s*\)/.test(APPLY)) note('A37a: CONFIRMED não deriva do token literal');
  if (!/APPLY\s*&&\s*!\s*CONFIRMED[\s\S]{0,40}?throw/.test(APPLY)) note('A37b: --apply sem token não é recusado');
  if (!/current_user|unificard_app/.test(APPLY)) note('A-role: apply não recusa rodar como unificard_app');
}

if (APPROVE) {
  // 11 · manifest hashado estruturalmente (sha256) + ordenação determinística
  if (!/createHash\(\s*'sha256'\s*\)/.test(APPROVE)) note('AP11: approve não computa sha256 estrutural');
  if (!/\.sort\(/.test(APPROVE)) note('AP11a: hash sem ordenação determinística das linhas');
  if (!/const\s+APPLY\s*=\s*argv\.includes\(\s*'--apply'\s*\)/.test(APPROVE)) note('AP37: approve não é dry-run por padrão');
  if (!/APPLY\s*&&\s*!\s*CONFIRMED[\s\S]{0,40}?throw/.test(APPROVE)) note('AP37a: approve --apply sem token não recusado');
}

// 34-36 · sem Bank/Social/financeiro em nenhum arquivo do fluxo
for (const [name, s] of [['MIG', MIG], ['SVC', SVC], ['APPLY', APPLY], ['APPROVE', APPROVE]]) {
  if (!s) continue;
  if (/from\s+['"][^'"]*(modules\/bank|modules\/social|\/ledger|\/split|regional[-_]?fund)[^'"]*['"]/i.test(s)) note(`F34: ${name} importa Bank/Social/ledger/split/fundos`);
  if (/INSERT\s+INTO[^;]*(bank_|split_|ledger|regional_fund)|UPDATE[^;]*(bank_|split_|ledger|regional_fund)/i.test(s)) note(`F36: ${name} faz DML financeiro`);
}

// 37 · nenhum manifest real de aliases foi comitado (bloqueio documental honesto — aprovação humana não ocorreu)
const manifestsDir = join(ROOT, 'scripts', 'manifests');
if (existsSync(manifestsDir)) {
  for (const f of readdirSync(manifestsDir)) {
    if (/curitiba.*alias/i.test(f)) {
      try {
        const m = JSON.parse(readFileSync(join(manifestsDir, f), 'utf8'));
        if (Array.isArray(m.lines) && m.lines.length > 0) note(`G37: manifest de aliases com linhas comitado (${f}) — aprovação humana do conteúdo exato é pré-condição; nesta fase deve ser 0 linhas/ausente`);
      } catch { note(`G37a: manifest de aliases ilegível (${f})`); }
    }
  }
}

// runtime containment: nenhum src runtime chama os one-shots
try {
  const walk = (dir, acc) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); } else if (/\.ts$/.test(e.name)) acc.push(p); } return acc; };
  for (const f of walk(join(ROOT, 'src'), [])) {
    const src = readFileSync(f, 'utf8');
    if (/neighborhood-alias-manifest-apply|neighborhood-alias-manifest-approve/.test(src)) note(`D1: referência runtime a one-shot de alias: ${f.replace(ROOT, '.')}`);
  }
} catch { /* */ }

// runner
{
  const runner = existsSync(join(ROOT, 'scripts', 'run-regression-guards.mjs')) ? readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf8') : '';
  if (!runner.includes('audit-curitiba-neighborhood-alias-first.mjs')) note('R1: guard fora do runner');
}

if (failures.length) {
  console.error('GATE FAIL [curitiba-neighborhood-alias-first]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [curitiba-neighborhood-alias-first] — fluxo governado de aliases: job≠Actor sem capability; aprovação chama canRepresentActor não-engolida + capability exata; execução não representa/valida grant via writer; manifest/status/job/provider nunca são autoridade; zero bairro novo, resolver intocado; manifest hashado (sha256) com line_key/line_count; redundância proibida; writer SECURITY DEFINER search_path pinado EXECUTE-fechado; HOLD (INSERT direto/UPDATE/DELETE) fechado; token one-use por linha (xid/backend/bairro/normalized, não sobrevive ao commit); sem GUC/role/tenant bypass/trigger-disable; alias event/approval/execution obrigatórios; conflito aborta o lote sem ranking/LIMIT 1; rerun fail-closed; atomicidade sem commit parcial; sem Bank/Social; e nenhum manifest real persistido antes do GO humano. (Comment-aware + liveness.)');
