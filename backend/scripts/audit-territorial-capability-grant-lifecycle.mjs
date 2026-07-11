#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2 · KEYS + MATRIZ SCOPE-AWARE + LIFECYCLE
// APPEND-ONLY. DECISION-0173 §4/§5 + ADENDO D1 (D1.3/D1.4/D1.6) + ADENDO D3 (matriz scope x capability).
// Pergunta propria: "as 6 keys territoriais e a matriz scope-aware nasceram JUNTAS e fechadas; o
// lifecycle e append-only e atomico (estado+evento na mesma transacao); a fronteira de escrita fechou
// o DML direto do app; o runtime permanece actor-only (create/revoke publicos; explicit-expire/regrant
// internos, sem rota); zero grant territorial real; canRepresentActor segue puro?"
//
// PROMESSA HONESTA: integridade VERSIONADA (migrations/arquivos). Estado vivo = introspecao (ver
// provas DB/mutation do relatorio). Falha de leitura/parsing = FAIL, nunca PASS silencioso.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

const D2_MIG = '20260711170000_actor_capability_grant_lifecycle.sql';
const TERRITORY_KEYS = [
  'territory:create_neighborhood', 'territory:approve_neighborhood', 'territory:correct_neighborhood',
  'territory:deactivate_neighborhood', 'territory:manage_neighborhood_aliases', 'territory:register_neighborhood_succession',
];
const ACTOR_KEYS = ['calendar:block', 'calendar:unblock', 'services:create', 'services:edit', 'services:disable', 'service_order:view'];
const FORBIDDEN_TERRITORY_KEYS = [
  'territory:manage_all', 'territory:admin', 'territory:manage_grants', 'territory:propose_neighborhood', 'territory:*',
];

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (!migFiles.includes(D2_MIG)) throw new Error(`migration da D.2 ausente: ${D2_MIG}`);
  const rawSql = readFileSync(join(MIG, D2_MIG), 'utf-8');
  const sql = stripSql(rawSql);

  // ── A. KEYS / MATRIZ ──────────────────────────────────────────────────────────────────────
  // existencia: exatamente as 12 keys (6 actor + 6 territory), sem 7a/8a
  const existBlock = (sql.match(/chk_acg_capability_nonfinancial CHECK\s*\(\s*capability_key IN\s*\(([^)]*)\)\s*\)/i) || [])[1] || '';
  const existKeys = (existBlock.match(/'[a-z_:]+'/g) || []).map((v) => v.slice(1, -1)).sort();
  const expectedExist = [...ACTOR_KEYS, ...TERRITORY_KEYS].sort();
  if (JSON.stringify(existKeys) !== JSON.stringify(expectedExist)) {
    failures.push(`${D2_MIG}: allowlist de existencia divergente (esperado exatamente as 12 keys, achado [${existKeys.join(', ')}]).`);
  }
  for (const bad of FORBIDDEN_TERRITORY_KEYS) {
    if (sql.includes(`'${bad}'`)) failures.push(`${D2_MIG}: key proibida presente: ${bad}.`);
  }

  // matriz scope-aware: ramo actor com as 6 actor keys, ramo territory com as 6 territory keys, validada
  const matrixBlock = (sql.match(/ADD CONSTRAINT chk_acg_scope_capability_matrix CHECK \(([\s\S]*?)\n  \);/i) || [])[1] || '';
  if (!matrixBlock) {
    failures.push(`${D2_MIG}: chk_acg_scope_capability_matrix ausente.`);
  } else {
    if (!/scope_type\s*=\s*'actor'/i.test(matrixBlock)) failures.push(`${D2_MIG}: matriz sem ramo actor.`);
    if (!/scope_type\s*=\s*'territory'/i.test(matrixBlock)) failures.push(`${D2_MIG}: matriz sem ramo territory.`);
    for (const k of ACTOR_KEYS) if (!matrixBlock.includes(`'${k}'`)) failures.push(`${D2_MIG}: matriz nao lista actor key ${k}.`);
    for (const k of TERRITORY_KEYS) if (!matrixBlock.includes(`'${k}'`)) failures.push(`${D2_MIG}: matriz nao lista territory key ${k}.`);
    // ramo actor NAO pode conter territory key e vice-versa (dentro do MESMO parenteses IN)
    const actorBranch = (matrixBlock.match(/scope_type\s*=\s*'actor'[\s\S]*?IN\s*\(([^)]*)\)/i) || [])[1] || '';
    const territoryBranch = (matrixBlock.match(/scope_type\s*=\s*'territory'[\s\S]*?IN\s*\(([^)]*)\)/i) || [])[1] || '';
    for (const k of TERRITORY_KEYS) if (actorBranch.includes(k)) failures.push(`${D2_MIG}: ramo actor da matriz contem territory key ${k} — combinacao cruzada.`);
    for (const k of ACTOR_KEYS) if (territoryBranch.includes(k)) failures.push(`${D2_MIG}: ramo territory da matriz contem actor key ${k} — combinacao cruzada.`);
  }
  // prefix/wildcard proibidos na matriz (correspondencia deve ser por lista exata)
  if (/LIKE\s+'territory:%'|LIKE\s+'territory:\*'|starts_?with/i.test(sql)) {
    failures.push(`${D2_MIG}: matriz usa prefix/LIKE/starts_with — correspondencia deve ser por conjunto exato.`);
  }
  // constraints reais (nao NOT VALID) nos ADD CONSTRAINT do arquivo
  for (const stmt of sql.split(';')) {
    if (/ADD\s+CONSTRAINT/i.test(stmt) && /NOT\s+VALID/i.test(stmt)) {
      failures.push(`${D2_MIG}: constraint NOT VALID proibida.`);
    }
  }

  // ── B. LIFECYCLE ──────────────────────────────────────────────────────────────────────────
  if (!/ADD COLUMN\s+revoke_reason\s+TEXT\s+NULL/i.test(sql)) failures.push(`${D2_MIG}: coluna revoke_reason ausente.`);
  if (!/chk_acg_revoke_reason_shape/i.test(sql)) failures.push(`${D2_MIG}: chk_acg_revoke_reason_shape ausente.`);
  const revokeShape = (sql.match(/ADD CONSTRAINT chk_acg_revoke_reason_shape CHECK \(([\s\S]*?)\n  \);/i) || [])[1] || '';
  if (!/status\s*=\s*'revoked'/i.test(revokeShape) || !revokeShape.includes('revoke_reason IS NOT NULL')) {
    failures.push(`${D2_MIG}: shape de revoke_reason nao amarra status='revoked' a revoke_reason NOT NULL.`);
  }
  if (!/status\s*<>\s*'revoked'[\s\S]*revoke_reason IS NULL/i.test(revokeShape)) {
    failures.push(`${D2_MIG}: shape de revoke_reason nao garante NULL fora de revoked.`);
  }

  if (!/CREATE TABLE actor_capability_grant_events/i.test(sql)) failures.push(`${D2_MIG}: actor_capability_grant_events ausente.`);
  for (const col of ['grant_id', 'event_type', 'grantee_actor_id', 'capability_key', 'scope_type', 'tenant_id',
                      'scope_actor_id', 'scope_city_id', 'valid_from', 'valid_until', 'authority_source',
                      'executed_by_user_id', 'executed_by_actor_id', 'responsible_human_actor_id', 'event_reason', 'occurred_at']) {
    if (!new RegExp(`\\b${col}\\b`, 'i').test(sql)) failures.push(`${D2_MIG}: coluna ${col} ausente em actor_capability_grant_events.`);
  }
  if (!/event_type\s+TEXT NOT NULL CHECK\s*\(event_type IN \('granted', 'revoked', 'expired'\)\)/i.test(sql)) {
    failures.push(`${D2_MIG}: event_type nao fechado em granted|revoked|expired.`);
  }
  for (const bad of ['suspended', 'resumed', 'reactivated', 'deleted', 'updated']) {
    if (new RegExp(`event_type[\\s\\S]{0,80}'${bad}'`, 'i').test(sql)) {
      failures.push(`${D2_MIG}: event_type territorial proibido presente: ${bad}.`);
    }
  }
  if (!/CONSTRAINT uq_acge_grant_event_type UNIQUE \(grant_id, event_type\)/i.test(sql)) failures.push(`${D2_MIG}: UNIQUE(grant_id,event_type) ausente.`);
  if (!/CREATE UNIQUE INDEX uidx_acge_one_terminal_event[\s\S]{0,200}WHERE event_type IN \('revoked', 'expired'\)/i.test(sql)) {
    failures.push(`${D2_MIG}: indice de terminal unico (revoked|expired) ausente/divergente.`);
  }
  // snapshot + append-only triggers
  if (!/CREATE TRIGGER trg_acge_snapshot\s+BEFORE INSERT ON actor_capability_grant_events/i.test(sql)) failures.push(`${D2_MIG}: trigger de snapshot ausente.`);
  if (!/CREATE TRIGGER trg_acge_no_update\s+BEFORE UPDATE ON actor_capability_grant_events/i.test(sql)) failures.push(`${D2_MIG}: trigger no_update de eventos ausente.`);
  if (!/CREATE TRIGGER trg_acge_no_delete\s+BEFORE DELETE ON actor_capability_grant_events/i.test(sql)) failures.push(`${D2_MIG}: trigger no_delete de eventos ausente.`);
  // imutabilidade do grant (delete permanente + campos imutaveis)
  if (!/CREATE TRIGGER trg_acg_immutability\s+BEFORE UPDATE OR DELETE ON actor_capability_grants/i.test(sql)) {
    failures.push(`${D2_MIG}: trigger de imutabilidade do grant ausente.`);
  }
  if (!/ACTOR_CAPABILITY_GRANT_DELETE_FORBIDDEN/.test(sql)) failures.push(`${D2_MIG}: erro estavel de DELETE proibido ausente.`);
  if (!/ACTOR_CAPABILITY_GRANT_IMMUTABLE_FIELD_CHANGED/.test(sql)) failures.push(`${D2_MIG}: erro estavel de campo imutavel ausente.`);

  // ── C. ATOMICIDADE (4 funcoes; estado+evento na MESMA funcao) ────────────────────────────────
  const fnGrant = (sql.match(/CREATE FUNCTION fn_grant_actor_capability\([\s\S]*?\$func\$;/i) || [''])[0];
  const fnRevoke = (sql.match(/CREATE FUNCTION fn_revoke_actor_capability_grant\([\s\S]*?\$func\$;/i) || [''])[0];
  const fnExpire = (sql.match(/CREATE FUNCTION fn_expire_actor_capability_grant\([\s\S]*?\$func\$;/i) || [''])[0];
  const fnRegrant = (sql.match(/CREATE FUNCTION fn_regrant_actor_capability\([\s\S]*?\$func\$;/i) || [''])[0];
  for (const [name, body] of [['fn_grant_actor_capability', fnGrant], ['fn_revoke_actor_capability_grant', fnRevoke],
                               ['fn_expire_actor_capability_grant', fnExpire], ['fn_regrant_actor_capability', fnRegrant]]) {
    if (!body) { failures.push(`${D2_MIG}: funcao ${name} ausente.`); continue; }
    if (!/SECURITY DEFINER/i.test(body)) failures.push(`${name}: nao e SECURITY DEFINER.`);
    if (!/SET search_path = pg_catalog, pg_temp/i.test(body)) failures.push(`${name}: search_path nao pinado.`);
    if (!/INSERT INTO public\.actor_capability_grant_events/i.test(body)) failures.push(`${name}: nao insere evento — atomicidade quebrada.`);
    if (/ON CONFLICT/i.test(body)) failures.push(`${name}: usa ON CONFLICT — proibido (regrant nao pode reciclar/sobrescrever).`);
  }
  if (fnGrant && !/'actor',\s*p_scope_actor_id/.test(fnGrant)) failures.push('fn_grant_actor_capability: nao fixa scope_type=actor internamente (esperado literal \'actor\' na posicao de scope_type do INSERT).');
  if (fnGrant && /p_scope_type|p_scope_city_id/i.test(fnGrant)) failures.push('fn_grant_actor_capability: aceita scope_type/scope_city_id do chamador — proibido.');
  if (fnRevoke && !/scope_type\s*<>\s*'actor'/.test(fnRevoke)) failures.push('fn_revoke_actor_capability_grant: nao rejeita scope_type<>actor (territory nao revogavel por esta funcao).');
  if (fnExpire && !/valid_until\s*>\s*now\(\)/.test(fnExpire)) failures.push('fn_expire_actor_capability_grant: nao valida vigencia ainda ativa.');
  if (fnRegrant && !/fn_expire_actor_capability_grant\(/.test(fnRegrant)) failures.push('fn_regrant_actor_capability: nao chama fn_expire_actor_capability_grant (expire atomico do antigo).');
  if (fnRegrant && /p_grantee_actor_id|p_capability_key|p_scope_actor_id/i.test(fnRegrant)) {
    failures.push('fn_regrant_actor_capability: aceita grantee/key/scope como parametro — deve DERIVAR do grant antigo (prova estrutural).');
  }

  // ── D. FRONTEIRA DE ESCRITA / ACL / EXECUTE ──────────────────────────────────────────────────
  if (!/REVOKE INSERT, UPDATE, DELETE ON actor_capability_grants FROM unificard_app/i.test(sql)) {
    failures.push(`${D2_MIG}: nao revoga INSERT/UPDATE/DELETE de unificard_app em actor_capability_grants.`);
  }
  if (!/GRANT SELECT ON actor_capability_grant_events TO unificard_app/i.test(sql)) failures.push(`${D2_MIG}: eventos nao SELECT-only para app.`);
  if (!/REVOKE ALL ON actor_capability_grant_events FROM unificard_app/i.test(sql)) failures.push(`${D2_MIG}: eventos sem REVOKE ALL previo de app.`);
  if (!/REVOKE EXECUTE ON FUNCTION fn_expire_actor_capability_grant[\s\S]{0,120}FROM unificard_app/i.test(sql)) {
    failures.push(`${D2_MIG}: EXECUTE de fn_expire nao revogado explicitamente de unificard_app (default privilege auto-concede).`);
  }
  if (!/REVOKE EXECUTE ON FUNCTION fn_regrant_actor_capability[\s\S]{0,120}FROM unificard_app/i.test(sql)) {
    failures.push(`${D2_MIG}: EXECUTE de fn_regrant nao revogado explicitamente de unificard_app.`);
  }
  if (!/GRANT EXECUTE ON FUNCTION fn_grant_actor_capability[\s\S]{0,150}TO unificard_app/i.test(sql)) failures.push(`${D2_MIG}: EXECUTE de fn_grant nao concedido a app.`);
  if (!/GRANT EXECUTE ON FUNCTION fn_revoke_actor_capability_grant[\s\S]{0,150}TO unificard_app/i.test(sql)) failures.push(`${D2_MIG}: EXECUTE de fn_revoke nao concedido a app.`);
  // as 4 funcoes devem ter EXECUTE revogado de PUBLIC
  for (const fn of ['fn_grant_actor_capability', 'fn_revoke_actor_capability_grant', 'fn_expire_actor_capability_grant', 'fn_regrant_actor_capability']) {
    if (!new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn}[\\s\\S]{0,150}FROM PUBLIC`, 'i').test(sql)) {
      failures.push(`${D2_MIG}: EXECUTE de ${fn} nao revogado de PUBLIC.`);
    }
  }

  // ── E. TRI-REGISTRY (permission-keys.ts + types.ts) ──────────────────────────────────────────
  const pkP = join(SRC, 'core/authorization/permission-keys.ts');
  const pk = existsSync(pkP) ? stripTs(readFileSync(pkP, 'utf-8')) : '';
  if (!pk) failures.push('permission-keys.ts ausente.');
  for (const k of TERRITORY_KEYS) {
    if (!new RegExp(`\\|\\s*'${k}'`).test(pk)) failures.push(`permission-keys.ts: '${k}' ausente do union PermissionKey.`);
    if (!new RegExp(`'${k}':\\s*null`).test(pk)) failures.push(`permission-keys.ts: '${k}' ausente/nao-null em PERMISSION_CAPABILITIES.`);
  }

  const typesP = join(SRC, 'modules/authority/actor-capability-grant.types.ts');
  const types = existsSync(typesP) ? stripTs(readFileSync(typesP, 'utf-8')) : '';
  if (!types) failures.push('actor-capability-grant.types.ts ausente.');
  // ACTOR_SCOPED_CAPABILITY_KEYS pode ser array literal direto OU alias de NON_FINANCIAL_CAPABILITY_
  // ALLOWLIST (mesma array, sem duplicar — DECISION-0173 ADENDO D3); resolve ambas as formas.
  const actorSetBlock = (types.match(/(?:ACTOR_SCOPED_CAPABILITY_KEYS|NON_FINANCIAL_CAPABILITY_ALLOWLIST) = \[([\s\S]*?)\] as const/) || [])[1] || '';
  const terrSetBlock = (types.match(/TERRITORIAL_CAPABILITY_KEYS = \[([\s\S]*?)\] as const/) || [])[1] || '';
  const actorSetKeys = (actorSetBlock.match(/'[a-z_:]+'/g) || []).map((v) => v.slice(1, -1)).sort();
  const terrSetKeys = (terrSetBlock.match(/'[a-z_:]+'/g) || []).map((v) => v.slice(1, -1)).sort();
  if (JSON.stringify(actorSetKeys) !== JSON.stringify([...ACTOR_KEYS].sort())) {
    failures.push(`types.ts: ACTOR_SCOPED_CAPABILITY_KEYS divergente (achado [${actorSetKeys.join(', ')}]).`);
  }
  if (JSON.stringify(terrSetKeys) !== JSON.stringify([...TERRITORY_KEYS].sort())) {
    failures.push(`types.ts: TERRITORIAL_CAPABILITY_KEYS divergente (achado [${terrSetKeys.join(', ')}]).`);
  }
  // interseccao vazia e uniao ⊆ permission-keys
  const intersection = actorSetKeys.filter((k) => terrSetKeys.includes(k));
  if (intersection.length > 0) failures.push(`types.ts: intersecao actor∩territory NAO vazia: [${intersection.join(', ')}].`);
  for (const k of [...actorSetKeys, ...terrSetKeys]) {
    if (!new RegExp(`'${k}'`).test(pk)) failures.push(`types.ts: key '${k}' fora de permission-keys.ts (uniao nao e subset do SSOT).`);
  }
  // sem prefix/wildcard/startsWith na logica de compatibilidade
  if (/startsWith\s*\(\s*['"]territory:/i.test(types)) failures.push('types.ts: usa startsWith(\'territory:\') — inferencia de autoridade proibida.');
  if (/\.endsWith\s*\(/.test(types) || /new RegExp\(/.test(types)) failures.push('types.ts: usa endsWith/RegExp dinamico para compatibilidade de scope — proibido (conjuntos exatos apenas).');
  if (!/assertCapabilityCompatibleWithScope/.test(types)) failures.push('types.ts: assertCapabilityCompatibleWithScope ausente.');
  // uniao derivada existe mas nao decide nada sozinha (apenas presenca/comentario de nao-autoridade)
  if (!/GRANT_CAPABILITY_KEYS/.test(types)) failures.push('types.ts: uniao derivada GRANT_CAPABILITY_KEYS ausente.');

  // ── F. RUNTIME ACTOR-ONLY (repository/service/routes) ────────────────────────────────────────
  const repoP = join(SRC, 'modules/authority/actor-capability-grant.repository.ts');
  const repo = existsSync(repoP) ? stripTs(readFileSync(repoP, 'utf-8')) : '';
  if (!repo) failures.push('repository ausente.');
  if (!/FROM fn_grant_actor_capability\(/.test(repo)) failures.push('repository.insert: nao chama fn_grant_actor_capability — caminho territorial/DML direto suspeito.');
  if (!/FROM fn_revoke_actor_capability_grant\(/.test(repo)) failures.push('repository.revoke: nao chama fn_revoke_actor_capability_grant.');
  if (/INSERT\s+INTO\s+actor_capability_grants/i.test(repo)) failures.push('repository: INSERT direto em actor_capability_grants — fronteira de escrita violada.');
  if (/UPDATE\s+actor_capability_grants/i.test(repo)) failures.push('repository: UPDATE direto em actor_capability_grants — fronteira de escrita violada.');
  if (/fn_expire_actor_capability_grant|fn_regrant_actor_capability/.test(repo)) {
    failures.push('repository: referencia funcao INTERNA (expire/regrant) — sem rota publica nesta fatia.');
  }

  const routesP = join(SRC, 'modules/authority/actor-capability-grant.routes.ts');
  const routes = existsSync(routesP) ? stripTs(readFileSync(routesP, 'utf-8')) : '';
  if (!routes) failures.push('routes ausente.');
  if (/scopeType|scopeCityId|scope_type|scope_city_id/i.test(routes)) failures.push('routes: aceita scopeType/scopeCityId — endpoint territorial proibido nesta fatia.');
  // rota literal de expire/regrant (path fastify), NAO o status 'expired' do enum de filtro (benigno).
  if (/fastify\.(get|post|put|patch|delete)[\s\S]{0,20}['"`][^'"`]*\/(expire|regrant)/i.test(routes)) {
    failures.push('routes: rota de explicit-expire/regrant presente — proibido (operacoes internas, sem rota).');
  }
  if (!/z\.enum\(NON_FINANCIAL_CAPABILITY_ALLOWLIST\)/.test(routes) && !/z\.enum\(ACTOR_SCOPED_CAPABILITY_KEYS\)/.test(routes)) {
    failures.push('routes: capabilityKey nao validado contra allowlist actor-scoped (z.enum).');
  }

  // ── G. RUNTIME GERAL: zero hasTerritorialCapability, zero writer de bairro, canRepresentActor puro ──
  const walk = (dir, acc = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name === '__tests__' || e.name === 'node_modules') continue; walk(p, acc); }
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts')) {
        acc.push({ rel: norm(p.slice(ROOT.length + 1)), src: stripTs(readFileSync(p, 'utf-8')) });
      }
    }
    return acc;
  };
  const files = existsSync(SRC) ? walk(SRC) : [];
  if (files.length === 0) failures.push('varredura de src vazia — FAIL.');
  for (const f of files) {
    if (/hasTerritorialCapability/.test(f.src)) failures.push(`[runtime] ${f.rel}: hasTerritorialCapability presente — resolver e N2-D.3, proibido agora.`);
    // mira uso SQL/tabela real (FROM/INTO/UPDATE + nome de tabela), nao a substring incidental dentro
    // do literal 'territory:manage_neighborhood_aliases' (que contem "neighborhood_aliases" por acaso).
    if (/\b(FROM|INTO|UPDATE)\s+(public\.)?neighborhood_(succession_\w+|aliases)\b/i.test(f.src) && /territory:/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: writer de bairro referenciando capability territorial — proibido (N2-E).`);
    }
    if (/PORTA.TERRITORY.1|porta_territory_1/i.test(f.src)) failures.push(`[runtime] ${f.rel}: referencia PORTA-TERRITORY-1 — trancada.`);
  }
  const authP = join(SRC, 'core/authorization/authorization.service.ts');
  const auth = existsSync(authP) ? stripTs(readFileSync(authP, 'utf-8')) : '';
  const canRepBody = (auth.match(/async canRepresentActor\([\s\S]*?\n  \}/) || [''])[0];
  if (/actor_capability_grants|scope_city_id|hasTerritorialCapability|territory:/i.test(canRepBody)) {
    failures.push('authorization.service.ts: canRepresentActor deixou de ser puro — proibido (DECISION-0173 §1).');
  }

  // ── H. ESCOPO NEGATIVO: zero grant/seed territorial; zero Social/Bank ─────────────────────────
  if (/INSERT\s+INTO\s+actor_capability_grants[\s\S]{0,300}'territory'/i.test(sql)) {
    failures.push(`${D2_MIG}: seed/INSERT territorial real na migration — proibido.`);
  }
  if (/\bbank_\w+/i.test(sql) || /\bsocial_\w+/i.test(sql)) {
    failures.push(`${D2_MIG}: referencia Bank/Social — fora do escopo desta frente.`);
  }
  if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(territorial_permissions|city_admins|neighborhood_admins|curator_roles)/i.test(sql)) {
    failures.push(`${D2_MIG}: segunda casa de authority territorial — proibido.`);
  }

  // ── I. Migrations POSTERIORES não enfraquecem a fatia ────────────────────────────────────────
  const after = migFiles.filter((f) => f > D2_MIG);
  for (const f of after) {
    const s = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (/DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?(chk_acg_scope_capability_matrix|chk_acg_revoke_reason_shape)/i.test(s)) {
      failures.push(`[pos-D2] ${f}: dropa constraint da matriz/revoke_reason.`);
    }
    if (/DROP\s+TRIGGER[\s\S]{0,120}(trg_acg_immutability|trg_acge_snapshot|trg_acge_no_update|trg_acge_no_delete)/i.test(s)) {
      failures.push(`[pos-D2] ${f}: dropa trigger de lifecycle/imutabilidade.`);
    }
    if (/GRANT\b[\s\S]{0,80}?\b(INSERT|UPDATE|DELETE|TRUNCATE|ALL(?:\s+PRIVILEGES)?)\b[\s\S]{0,80}?\bON\b[\s\S]{0,60}?actor_capability_grants(_events)?\b[\s\S]{0,80}?\bTO\b/i.test(s)) {
      failures.push(`[pos-D2] ${f}: re-concede DML de grants/eventos — fronteira de escrita reaberta.`);
    }
    if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+fn_(expire|regrant)_actor_capability[\s\S]{0,100}TO\s+(unificard_app|PUBLIC)/i.test(s)) {
      failures.push(`[pos-D2] ${f}: concede EXECUTE de funcao interna a app/PUBLIC — proibido sem decisao propria.`);
    }
    if (/INSERT\s+INTO\s+(public\.)?actor_capability_grants[\s\S]{0,300}'territory'/i.test(s)) {
      failures.push(`[pos-D2] ${f}: seed territorial em migration posterior — proibido antes da PORTA-TERRITORY-1.`);
    }
  }

  // ── J. wiring no runner ───────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-territorial-capability-grant-lifecycle.mjs')) {
    failures.push('runner: audit-territorial-capability-grant-lifecycle.mjs fora do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [territorial-capability-grant-lifecycle]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Lifecycle da N2-D.2 (DECISION-0173 ADENDO D3) ausente/enfraquecido. Matriz scope-aware fechada + trilha append-only + atomicidade + fronteira de escrita; runtime actor-only ate N2-D.3/N2-E.');
  process.exit(1);
}
console.log('GATE OK [territorial-capability-grant-lifecycle] — integridade VERSIONADA da N2-D.2: 12 keys exatas (6 actor + 6 territory) na existencia; matriz scope-aware fechada sem combinacao cruzada/prefixo; revoke_reason separado de reason; trilha append-only (snapshot validado, cardinalidade 1-granted+no-maximo-1-terminal); 4 funcoes canonicas atomicas (SECURITY DEFINER, search_path pinado, sem ON CONFLICT); fronteira de escrita fechada (app sem DML direto; EXECUTE so nas 2 funcoes publicas); tri-registry sincronizado (permission-keys ⊇ uniao, intersecao vazia); repository/routes actor-only; canRepresentActor puro; zero grant territorial real.');
