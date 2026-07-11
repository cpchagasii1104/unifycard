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

  // ── 2. FN_GRANT valida os actors via helper ANTES do INSERT ─────────────────────────────────
  const grant = fnBody(sql, 'fn_grant_actor_capability');
  if (!grant) {
    failures.push(`${R2_MIG}: fn_grant_actor_capability nao recriada na R2.`);
  } else {
    if (!/SECURITY DEFINER/i.test(grant)) failures.push('fn_grant: nao SECURITY DEFINER.');
    if (!/fn_assert_actors_in_tenant/i.test(grant)) failures.push('fn_grant: nao chama fn_assert_actors_in_tenant.');
    // a chamada do helper deve vir ANTES do INSERT no grant
    const iHelper = grant.search(/fn_assert_actors_in_tenant/i);
    const iInsert = grant.search(/INSERT\s+INTO\s+public\.actor_capability_grants/i);
    if (iHelper < 0 || iInsert < 0 || iHelper > iInsert) failures.push('fn_grant: validacao de coerencia NAO ocorre antes do INSERT.');
    // os 4 actors nomeados devem constar no ARRAY validado
    for (const a of ['p_grantee_actor_id', 'p_scope_actor_id', 'p_granted_by_actor_id', 'p_responsible_human_actor_id']) {
      if (!new RegExp(`ARRAY\\[[^\\]]*${a}`, 'i').test(grant.replace(/\s+/g, ' '))) {
        failures.push(`fn_grant: ${a} nao consta no ARRAY validado pelo helper.`);
      }
    }
    if (!/p_tenant_id\s+IS\s+NULL/i.test(grant)) failures.push('fn_grant: nao rejeita p_tenant_id nulo.');
  }

  // ── 3. FN_REVOKE nova (com tenant esperado); assinatura antiga DROPADA ───────────────────────
  if (!/DROP\s+FUNCTION\s+fn_revoke_actor_capability_grant\(UUID,UUID,UUID,UUID,TEXT\)/i.test(sql)) {
    failures.push(`${R2_MIG}: assinatura ANTIGA de fn_revoke (sem tenant) nao foi DROPADA.`);
  }
  const revoke = fnBody(sql, 'fn_revoke_actor_capability_grant');
  if (!revoke) {
    failures.push(`${R2_MIG}: fn_revoke_actor_capability_grant nova ausente.`);
  } else {
    if (!/p_expected_tenant_id\s+UUID/i.test(revoke)) failures.push('fn_revoke: nova assinatura sem p_expected_tenant_id.');
    if (!/v_grant\.tenant_id\s+IS\s+DISTINCT\s+FROM\s+p_expected_tenant_id/i.test(revoke)) {
      failures.push('fn_revoke: nao compara grant.tenant_id com o tenant esperado.');
    }
    // cross-tenant → NOT_FOUND (nao-vazante); territory → scope mismatch
    if (!/scope_type\s*<>\s*'actor'[\s\S]{0,120}ACTOR_CAPABILITY_GRANT_REVOKE_SCOPE_MISMATCH/i.test(revoke)) {
      failures.push('fn_revoke: territory nao rejeitado por scope mismatch.');
    }
    if (!/IS\s+DISTINCT\s+FROM\s+p_expected_tenant_id[\s\S]{0,120}ACTOR_CAPABILITY_GRANT_NOT_FOUND/i.test(revoke)) {
      failures.push('fn_revoke: tenant divergente nao vira NOT_FOUND (nao-vazante).');
    }
    if (!/fn_assert_actors_in_tenant/i.test(revoke)) failures.push('fn_revoke: nao valida coerencia dos actors armazenados/executores.');
    for (const a of ['v_grant\\.grantee_actor_id', 'v_grant\\.scope_actor_id', 'p_executed_by_actor_id', 'p_responsible_human_actor_id']) {
      if (!new RegExp(`ARRAY\\[[^\\]]*${a}`, 'i').test(revoke.replace(/\s+/g, ' '))) {
        failures.push(`fn_revoke: ${a.replace('\\\\','')} nao consta no ARRAY validado.`);
      }
    }
    // validacao ANTES do UPDATE
    const iH = revoke.search(/fn_assert_actors_in_tenant/i);
    const iU = revoke.search(/UPDATE\s+public\.actor_capability_grants/i);
    if (iH < 0 || iU < 0 || iH > iU) failures.push('fn_revoke: validacao ocorre depois do UPDATE.');
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
