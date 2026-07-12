#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.3 · RESOLVER/ASSERTION DE CAPABILITY
// TERRITORIAL. Pergunta própria: "o primitivo SQL fn_assert_territorial_capability valida a key territorial
// EXATA, o grantee Actor tenant-bound, o grant GLOBAL ativo por city (nunca por tenant), com cardinalidade
// fail-closed + FOR SHARE + ordem determinística + negação uniforme não-vazante e ZERO escrita; o wrapper TS
// compõe canRepresentActor (representabilidade) numa FONTE ÚNICA has/assert; e NENHUM writer/rota/grant
// territorial foi aberto?"
//
// PROMESSA HONESTA: integridade VERSIONADA (migration/arquivos). Estado vivo = introspeção (ver provas DB).
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heurística textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, ' ');

const MIG_FILE = '20260711200000_actor_territorial_capability_resolver.sql';
const FN = 'fn_assert_territorial_capability';

// extrai o corpo balanceado da função (do CREATE FUNCTION até o $func$; final)
function fnBody(sql, name) {
  const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(([\\s\\S]*?)\\$func\\$;`, 'i');
  const m = sql.match(re);
  return m ? m[0] : '';
}

const TERRITORY_KEYS = [
  'territory:create_neighborhood',
  'territory:approve_neighborhood',
  'territory:correct_neighborhood',
  'territory:deactivate_neighborhood',
  'territory:manage_neighborhood_aliases',
  'territory:register_neighborhood_succession',
];
const ACTOR_KEYS = ['calendar:block', 'calendar:unblock', 'services:create', 'services:edit', 'services:disable', 'service_order:view'];

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (!migFiles.includes(MIG_FILE)) throw new Error(`migration N2-D.3 ausente: ${MIG_FILE}`);
  const rawSql = readFileSync(join(MIG, MIG_FILE), 'utf-8');
  const sql = stripSql(rawSql);

  // ── 1. FUNÇÃO SQL: assinatura única, SECURITY DEFINER, search_path, RETURNS uuid ──────────────
  const defs = [...sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${FN}\\s*\\(`, 'gi'))];
  if (defs.length === 0) failures.push(`${FN}: definição ausente.`);
  if (defs.length > 1) failures.push(`${FN}: ${defs.length} definições (overload inesperado).`);
  const body = fnBody(sql, FN);
  if (!body) {
    failures.push(`${FN}: corpo não extraível.`);
  } else {
    // assinatura exata (uuid, text, uuid) RETURNS uuid
    if (!/p_grantee_actor_id\s+UUID/i.test(body) || !/p_capability_key\s+TEXT/i.test(body) || !/p_scope_city_id\s+UUID/i.test(body)) {
      failures.push(`${FN}: assinatura divergente (esperado p_grantee_actor_id UUID, p_capability_key TEXT, p_scope_city_id UUID).`);
    }
    if (!/RETURNS\s+UUID/i.test(body)) failures.push(`${FN}: não RETURNS UUID.`);
    if (!/SECURITY DEFINER/i.test(body)) failures.push(`${FN}: não SECURITY DEFINER.`);
    if (!/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i.test(body)) failures.push(`${FN}: search_path não pinado.`);

    // ── 2. KEY TERRITORIAL EXATA — as 6 presentes; ZERO actor key; ZERO prefixo/wildcard ──────────
    for (const k of TERRITORY_KEYS) {
      if (!body.includes(`'${k}'`)) failures.push(`${FN}: key territorial ausente do conjunto exato: ${k}.`);
    }
    for (const k of ACTOR_KEYS) {
      if (body.includes(`'${k}'`)) failures.push(`${FN}: contém literal de key actor-scoped (${k}) — proibido.`);
    }
    // conjunto EXATO: nenhum literal territory:* fora das 6 seladas (sétima key proibida)
    for (const lit of [...new Set(body.match(/'territory:[a-z_]+'/g) || [])]) {
      if (!TERRITORY_KEYS.map((k) => `'${k}'`).includes(lit)) {
        failures.push(`${FN}: literal de key territorial FORA do conjunto selado: ${lit} — sétima key proibida.`);
      }
    }
    if (/capability_key\s+LIKE|capability_key\s*~~|capability_key\s*~|LIKE\s*'territory:%'|startsWith|substring\s*\(\s*[^)]*capability_key|left\s*\(\s*[^)]*capability_key/i.test(body)) {
      failures.push(`${FN}: usa prefix/LIKE/substring em capability_key — match deve ser por igualdade exata.`);
    }
    // deve casar a key por IN(...) de literais OU igualdade explícita a p_capability_key
    if (!/capability_key\s+NOT\s+IN\s*\(/i.test(body) && !/capability_key\s*=\s*p_capability_key/i.test(body)) {
      failures.push(`${FN}: não valida capability_key por conjunto fechado nem por igualdade a p_capability_key.`);
    }

    // ── 3. QUERY CANÔNICA: grantee/city/scope/lifecycle exatos; NUNCA tenant no grant ─────────────
    if (!/grantee_actor_id\s*=\s*p_grantee_actor_id/i.test(body)) failures.push(`${FN}: não filtra grantee_actor_id = p_grantee_actor_id.`);
    if (!/scope_city_id\s*=\s*p_scope_city_id/i.test(body)) failures.push(`${FN}: não filtra scope_city_id = p_scope_city_id (city obrigatória).`);
    if (!/scope_type\s*=\s*'territory'/i.test(body)) failures.push(`${FN}: não fixa scope_type = 'territory'.`);
    if (!/status\s*=\s*'active'/i.test(body)) failures.push(`${FN}: não exige status = 'active'.`);
    if (!/revoked_at\s+IS\s+NULL/i.test(body)) failures.push(`${FN}: não exige revoked_at IS NULL.`);
    if (!/valid_from\s*<=\s*now\(\)/i.test(body)) failures.push(`${FN}: não exige valid_from <= now().`);
    if (!/valid_until\s+IS\s+NULL\s+OR\s+.*valid_until\s*>\s*now\(\)/i.test(body)) failures.push(`${FN}: não exige (valid_until IS NULL OR valid_until > now()).`);
    // tenant como autoridade/bypass PROIBIDO no grant (mas actors.tenant_id IS NOT NULL é legítimo)
    if (/g\.tenant_id/i.test(body)) failures.push(`${FN}: filtra o grant por g.tenant_id — grant é global; proibido.`);
    if (/OR\s+[^;]*\btenant_id\s+IS\s+NULL/i.test(body)) failures.push(`${FN}: usa \`OR tenant_id IS NULL\` — bypass proibido.`);
    if (/COALESCE\s*\([^)]*tenant/i.test(body)) failures.push(`${FN}: usa COALESCE de tenant — proibido.`);
    // grantee Actor tenant-bound (validação legítima) presente
    if (!/actors\s+a[\s\S]*a\.tenant_id\s+IS\s+NOT\s+NULL/i.test(body)) failures.push(`${FN}: não exige grantee Actor tenant-bound (actors.tenant_id IS NOT NULL).`);

    // ── 4. CARDINALIDADE / LOCK / ORDEM ──────────────────────────────────────────────────────────
    if (!/LIMIT\s+2/i.test(body)) failures.push(`${FN}: sem LIMIT 2 (distinção 0/1/>1).`);
    if (/LIMIT\s+1\b/i.test(body)) failures.push(`${FN}: usa LIMIT 1 arbitrário — proibido (mascara duplicidade).`);
    if (!/FOR\s+SHARE/i.test(body)) failures.push(`${FN}: sem FOR SHARE (lock da row do grant).`);
    // FOR SHARE ESPECÍFICO na query de candidatos do grant (não basta o lock do Actor ter FOR SHARE)
    if (!/FROM\s+public\.actor_capability_grants\s+g[\s\S]*?FOR\s+SHARE[\s\S]*?LIMIT\s+2/i.test(body)) {
      failures.push(`${FN}: query de candidatos do grant sem FOR SHARE + LIMIT 2 (lock da row do grant ausente).`);
    }
    if (!/ORDER\s+BY\s+g\.grant_id/i.test(body)) failures.push(`${FN}: sem ordem determinística (ORDER BY g.grant_id).`);
    // grantee Actor também travado FOR SHARE (FK grantee_actor_id é ON DELETE CASCADE)
    if (!/FROM\s+public\.actors\s+a[\s\S]*FOR\s+SHARE/i.test(body)) failures.push(`${FN}: grantee Actor não é travado FOR SHARE (FK CASCADE exige o lock).`);
    // cardinalidade <> 1 nega
    if (!/v_cnt\s*<>\s*1|v_cnt\s*!=\s*1/i.test(body)) failures.push(`${FN}: não nega quando a cardinalidade ≠ 1 (fail-closed).`);

    // ── 5. NEGAÇÃO UNIFORME NÃO-VAZANTE; ZERO escrita; ZERO evento ────────────────────────────────
    const raises = body.match(/RAISE\s+EXCEPTION[\s\S]*?;/gi) || [];
    if (raises.length === 0) failures.push(`${FN}: nenhuma negação RAISE.`);
    for (const r of raises) {
      if (!/'TERRITORIAL_CAPABILITY_DENIED'/.test(r)) {
        failures.push(`${FN}: RAISE com código não-uniforme (esperado 'TERRITORIAL_CAPABILITY_DENIED'): ${r.replace(/\s+/g, ' ').slice(0, 60)}.`);
      }
      if (/%/.test(r)) failures.push(`${FN}: RAISE interpola valor (%) — negação deve ser não-vazante.`);
    }
    if (/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(body)) failures.push(`${FN}: contém INSERT/UPDATE/DELETE — deve ser LEITURA pura.`);
    if (/actor_capability_grant_events/i.test(body)) failures.push(`${FN}: consulta actor_capability_grant_events — eventos não são autoridade de lifecycle (D4).`);
    if (/EXECUTE\s+format|EXECUTE\s+'|SET\s+ROLE/i.test(body)) failures.push(`${FN}: usa SQL dinâmico/SET ROLE — proibido.`);
  }

  // ── 6. ACL: PUBLIC sem EXECUTE; unificard_app EXECUTE na assinatura exata ──────────────────────
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fn_assert_territorial_capability\(UUID,\s*TEXT,\s*UUID\)\s+FROM\s+PUBLIC/i.test(sql)) {
    failures.push(`${MIG_FILE}: falta REVOKE ALL ... FROM PUBLIC no resolver.`);
  }
  if (!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.fn_assert_territorial_capability\(UUID,\s*TEXT,\s*UUID\)\s+TO\s+unificard_app/i.test(sql)) {
    failures.push(`${MIG_FILE}: falta GRANT EXECUTE ... TO unificard_app no resolver.`);
  }
  if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.fn_assert_territorial_capability[\s\S]*TO\s+PUBLIC/i.test(sql)) {
    failures.push(`${MIG_FILE}: concede EXECUTE do resolver a PUBLIC — proibido.`);
  }

  // ── 7. FRONTEIRAS SQL: sem grant/revoke territorial; sem seed; sem nova key/matriz/status ──────
  if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_(grant|revoke)_[a-z_]*territor/i.test(sql)) {
    failures.push(`${MIG_FILE}: cria função de grant/revoke territorial — proibido na N2-D.3.`);
  }
  if (/INSERT\s+INTO\s+actor_capability_grants|INSERT\s+INTO\s+public\.actor_capability_grants/i.test(sql)) {
    failures.push(`${MIG_FILE}: INSERT em actor_capability_grants (seed/grant real) — proibido.`);
  }
  if (/ALTER\s+TABLE\s+actor_capability_grants|DROP\s+CONSTRAINT\s+chk_acg_|CREATE\s+TABLE/i.test(sql)) {
    failures.push(`${MIG_FILE}: altera tabela/constraint/matriz da casa — fora do escopo N2-D.3.`);
  }
  if (/permission-keys|chk_acg_scope_capability_matrix\s+(?:ADD|DROP)/i.test(sql)) {
    failures.push(`${MIG_FILE}: toca matriz/keys seladas — proibido.`);
  }
  if (/(CREATE|DROP|ALTER)\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_(expire|regrant)_actor_capability/i.test(sql)) {
    failures.push(`${MIG_FILE}: recria/dropa fn_expire/fn_regrant — devem ficar intocadas (menção em prova fail-closed é permitida).`);
  }
  if (/\bbank_\w+|\bsocial_\w+/i.test(sql)) failures.push(`${MIG_FILE}: toca Bank/Social — fora do escopo.`);

  // ── 8. WRAPPER TS: fonte única has/assert; compõe key exata + canRepresentActor + função SQL ───
  const resP = join(SRC, 'modules/authority/territorial-capability-resolver.ts');
  const res = existsSync(resP) ? stripTs(readFileSync(resP, 'utf-8')) : '';
  if (!res) {
    failures.push('territorial-capability-resolver.ts ausente.');
  } else {
    if (!/isTerritorialCapabilityKey\s*\(/.test(res)) failures.push('resolver TS: não invoca isTerritorialCapabilityKey (match exato da key).');
    if (/startsWith\s*\(\s*['"]territory:|\.startsWith\(/.test(res)) failures.push('resolver TS: usa startsWith — prefixo proibido.');
    if (!/canRepresentActor\s*\(\s*[^)]*tenantId[^)]*userId[^)]*granteeActorId/.test(res.replace(/\s+/g, ' '))) {
      failures.push('resolver TS: não invoca canRepresentActor(tenantId, userId, granteeActorId).');
    }
    // o resultado de canRepresentActor deve GATEAR (não basta computar): if (!canRep) → deny
    if (!/if\s*\(\s*!\s*canRep\s*\)\s*{\s*return\s+null/.test(res.replace(/\s+/g, ' ').replace(/\{\s+/g, '{ '))) {
      failures.push('resolver TS: canRepresentActor computado mas não gateia (falta `if (!canRep) return null`).');
    }
    if (!/assertTerritorialCapability\s*\(/.test(res) || !/actorCapabilityGrantRepository\.assertTerritorialCapability|repository\.assertTerritorialCapability/.test(res)) {
      failures.push('resolver TS: não invoca a função SQL via repository.assertTerritorialCapability.');
    }
    // FONTE ÚNICA: has e assert delegam ao mesmo resolveTerritorialGrantId
    const hasSrc = /export\s+async\s+function\s+hasTerritorialCapability[\s\S]*?\n}/.exec(res)?.[0] || '';
    const assertSrc = /export\s+async\s+function\s+assertTerritorialCapability[\s\S]*?\n}/.exec(res)?.[0] || '';
    if (!/resolveTerritorialGrantId\s*\(/.test(hasSrc)) failures.push('resolver TS: hasTerritorialCapability não usa a fonte única resolveTerritorialGrantId.');
    if (!/resolveTerritorialGrantId\s*\(/.test(assertSrc)) failures.push('resolver TS: assertTerritorialCapability não usa a fonte única resolveTerritorialGrantId.');
    // não duplica a query/lifecycle no TS
    if (/actor_capability_grants\b/.test(res)) failures.push('resolver TS: referencia a tabela actor_capability_grants — a query/lifecycle vive só no SQL.');
    if (/valid_until|scope_type\s*=|revoked_at/.test(res)) failures.push('resolver TS: reimplementa lifecycle do grant — deve viver só no SQL.');
    // tenant/city NUNCA do body; sem rota; sem cache
    if (/req\.body|request\.body|\.body\./.test(res)) failures.push('resolver TS: lê do body — tenant/city devem ser server-side.');
    if (/fastify|\.route\(|router\.|addRoute|\.get\(|\.post\(/.test(res)) failures.push('resolver TS: registra rota — proibido (módulo interno).');
    if (/[cC]ache/.test(res)) failures.push('resolver TS: introduz cache — proibido na fundação.');
    // não expõe grant_id na mensagem pública de negação
    if (/forbidden\([^)]*grant/i.test(res)) failures.push('resolver TS: mensagem de negação expõe grant — deve ser uniforme não-vazante.');
  }

  // ── 9. REPOSITORY: chama a função SQL; denial→null; infra PROPAGA (não vira null) ──────────────
  const repoP = join(SRC, 'modules/authority/actor-capability-grant.repository.ts');
  const repo = existsSync(repoP) ? stripTs(readFileSync(repoP, 'utf-8')) : '';
  if (!repo) failures.push('repository ausente.');
  else {
    const m = /async\s+assertTerritorialCapability\s*\([\s\S]*?\n {2}},/.exec(repo)?.[0] || '';
    if (!m) failures.push('repository: método assertTerritorialCapability ausente.');
    else {
      if (!/fn_assert_territorial_capability\s*\(\s*\$1::uuid\s*,\s*\$2\s*,\s*\$3::uuid\s*\)/.test(m)) {
        failures.push('repository: não chama public.fn_assert_territorial_capability($1::uuid,$2,$3::uuid).');
      }
      if (!/TERRITORIAL_CAPABILITY_DENIED[\s\S]*return\s+null/.test(m)) failures.push('repository: não mapeia TERRITORIAL_CAPABILITY_DENIED → null.');
      if (!/throw\s+error/.test(m)) failures.push('repository: não repropaga erro inesperado de infra (fail-closed honesto).');
      if (/scope_type|valid_until|revoked_at|actor_capability_grants\s+WHERE/i.test(m)) failures.push('repository: reimplementa a query do grant — deve viver só na função SQL.');
    }
  }

  // ── 10. FRONTEIRAS DE SUPERFÍCIE: nenhum writer/rota territorial consome o resolver ────────────
  // 10a. nenhuma *.routes.ts referencia o resolver (superfície interna, sem rota).
  function walk(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (e.isFile() && e.name.endsWith('.ts')) out.push(p);
    }
    return out;
  }
  const tsFiles = existsSync(SRC) ? walk(SRC) : [];
  for (const f of tsFiles) {
    const isRoute = f.endsWith('.routes.ts');
    const c = stripTs(readFileSync(f, 'utf-8'));
    if (isRoute && /(hasTerritorialCapability|assertTerritorialCapability|fn_assert_territorial_capability|territorial-capability-resolver)/.test(c)) {
      failures.push(`[fronteira] ${f.replace(ROOT, '')}: rota referencia o resolver territorial — proibido nesta fatia (sem rota).`);
    }
    // writer territorial (INSERT/UPDATE/DELETE em neighborhoods*/succession) que também toca o resolver
    const touchesResolver = /(assertTerritorialCapability|fn_assert_territorial_capability|territorial-capability-resolver)/.test(c);
    const isWriter = /INSERT\s+INTO\s+neighborhood|UPDATE\s+neighborhood|DELETE\s+FROM\s+neighborhood|neighborhood_succession|neighborhood_aliases/i.test(c);
    if (touchesResolver && isWriter) {
      failures.push(`[fronteira] ${f.replace(ROOT, '')}: writer territorial que consome o resolver — proibido até a N2-E (D6).`);
    }
  }
  // 10b. nenhuma migration POSTERIOR abre grant/revoke territorial ou writer gated pelo resolver
  for (const f of migFiles.filter((x) => x > MIG_FILE)) {
    const s = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+fn_(grant|revoke)_[a-z_]*territor/i.test(s)) {
      failures.push(`[pós-D.3] ${f}: cria grant/revoke territorial — exige envelope próprio.`);
    }
  }

  // ── 11. WIRING no runner ──────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-territorial-capability-resolver.mjs')) {
    failures.push('runner: audit-territorial-capability-resolver.mjs fora do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [territorial-capability-resolver]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Resolver territorial (N2-D.3) ausente/enfraquecido. A autoridade territorial exige: key territorial EXATA (sem prefixo); grantee Actor tenant-bound travado FOR SHARE; grant GLOBAL ativo por city (nunca filtrado por tenant); cardinalidade 0/1/>1 fail-closed; negação uniforme não-vazante; ZERO escrita/evento; wrapper TS compondo canRepresentActor numa fonte única has/assert; ZERO writer/rota/grant territorial.');
  process.exit(1);
}
console.log('GATE OK [territorial-capability-resolver] — integridade VERSIONADA da N2-D.3: fn_assert_territorial_capability (SECURITY DEFINER, search_path pinado, RETURNS uuid) valida key territorial por conjunto EXATO + grantee Actor tenant-bound (FOR SHARE) + grant global ativo por city (grantee/key/city/scope_type/status/revoked_at/valid_from/valid_until; NUNCA tenant), cardinalidade 0/1/>1 fail-closed, ordem determinística + FOR SHARE, negação uniforme TERRITORIAL_CAPABILITY_DENIED não-vazante, ZERO escrita/evento; ACL PUBLIC-sem-EXECUTE/app-só-na-assinatura; wrapper TS compõe isTerritorialCapabilityKey + canRepresentActor + função SQL numa FONTE ÚNICA has/assert (infra propaga, denial→null/403); ZERO writer/rota/grant territorial. (Estado vivo = introspecção.)');
