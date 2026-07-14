#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.1 · EIXO TERRITORIAL CITY-SCOPED.
// DECISION-0173 §1/§2/§3 + ADENDO D1 (D1.1/D1.5) + ADENDO D2 (D2.1 anti-suspended nasce AQUI; D2.4 indice
// territorial sem tenant/now()). Pergunta propria: "a casa canonica actor_capability_grants admite o eixo
// territorial city-scoped com os dois shapes fechados, anti-suspended, FK real e as duas casas de unicidade
// — sem key territorial, sem grant, sem lifecycle, sem resolver, sem enforcement, sem segunda casa?"
//
// PROMESSA HONESTA: integridade VERSIONADA (migrations/arquivos). Estado vivo = introspecao.
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heuristica textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

const D1_MIG = '20260711160000_actor_capability_grants_territorial_city_scope.sql';
// AJUSTE CONSCIENTE (N2-D.2, GO §18): D2_MIG e os 4 arquivos de modules/authority/ sao a UNICA janela
// nominal autorizada a introduzir as 6 keys territory:*/scope_city_id em runtime — a fiscalizacao FINA
// desses invariantes (matriz scope-aware, lifecycle, atomicidade, ACL) passa a ser do guard proprio
// audit-territorial-capability-grant-lifecycle.mjs. Este guard (D.1) continua bloqueando: 7a key,
// writer territorial publico, resolver territorial, rota territorial, grant real, segunda casa,
// Bank/Social — em QUALQUER outro arquivo fora desta janela nominal.
const D2_MIG = '20260711170000_actor_capability_grant_lifecycle.sql';
// N2-D.3: migration nominal do RESOLVER (fiscalizacao fina em audit-territorial-capability-resolver.mjs).
const D3_MIG = '20260711200000_actor_territorial_capability_resolver.sql';
const D2_AUTHORIZED_RUNTIME_FILES = new Set([
  'src/modules/authority/actor-capability-grant.repository.ts',
  'src/modules/authority/actor-capability-grant.service.ts',
  'src/modules/authority/actor-capability-grant.types.ts',
  'src/modules/authority/actor-capability-grant.routes.ts',
  'src/core/authorization/permission-keys.ts', // SSOT de existencia — as 6 keys nascem aqui (D.2 §E)
  'src/modules/authority/territorial-capability-resolver.ts', // N2-D.3 nominal — guard proprio fiscaliza
]);
const TBL = 'actor_capability_grants';
const FORBIDDEN_SCOPES = ['global', 'city', 'neighborhood', 'state', 'country', 'region', 'system'];

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (migFiles.length === 0) throw new Error('zero migrations lidas');

  // ── 1. Migration N2-D.1 presente e íntegra ──────────────────────────────────────────────────
  if (!migFiles.includes(D1_MIG)) {
    failures.push(`migration do eixo territorial ausente: ${D1_MIG}`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, D1_MIG), 'utf-8'));

    // coluna territorial: exatamente UMA, UUID, FK REAL cities(city_id) RESTRICT
    const addCols = sql.match(/ADD\s+COLUMN\s+scope_city_id\s+UUID/gi) || [];
    if (addCols.length !== 1) failures.push(`${D1_MIG}: esperada exatamente 1 ADD COLUMN scope_city_id UUID (achado ${addCols.length}).`);
    if (!/fk_acg_scope_city\s+FOREIGN\s+KEY\s*\(scope_city_id\)\s*REFERENCES\s+cities\s*\(city_id\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql)) {
      failures.push(`${D1_MIG}: FK fk_acg_scope_city (scope_city_id)->cities(city_id) ON DELETE RESTRICT ausente/divergente.`);
    }
    // sem referencia generica / cidade textual / JSON territorial (definicao de coluna)
    if (/^\s*scope_ref_id\s+\w|ADD\s+COLUMN\s+scope_ref_id/im.test(sql)) failures.push(`${D1_MIG}: scope_ref_id generico proibido (FK real por nivel — DECISION-0172 P1).`);
    if (/ADD\s+COLUMN\s+(city_name|city_text|scope_city_name|scope_city_text)/i.test(sql)) failures.push(`${D1_MIG}: cidade TEXTUAL proibida — escopo territorial e FK real.`);
    if (/ADD\s+COLUMN\s+\w*(metadata|payload|scope_json|territory_json)\w*\s+(JSONB|JSON)/i.test(sql)) failures.push(`${D1_MIG}: JSON/metadata territorial proibido.`);

    // nullability condicionada (a obrigatoriedade migra para o CHECK de shape)
    for (const col of ['tenant_id', 'scope_actor_id']) {
      if (!new RegExp(`ALTER\\s+COLUMN\\s+${col}\\s+DROP\\s+NOT\\s+NULL`, 'i').test(sql)) {
        failures.push(`${D1_MIG}: ALTER COLUMN ${col} DROP NOT NULL ausente — nullability condicionada ao scope.`);
      }
    }

    // vocabulario de scope fechado: actor | territory (sem terceiro valor)
    const st = sql.match(/ADD\s+CONSTRAINT\s+chk_acg_scope_type\s+CHECK\s*\(scope_type\s+IN\s*\(([^)]*)\)\)/i);
    if (!st) {
      failures.push(`${D1_MIG}: CHECK chk_acg_scope_type IN (...) ausente.`);
    } else {
      const vals = (st[1].match(/'[^']*'/g) || []).map((v) => v.slice(1, -1)).sort();
      if (JSON.stringify(vals) !== JSON.stringify(['actor', 'territory'])) {
        failures.push(`${D1_MIG}: vocabulario de scope divergente — esperado exatamente [actor, territory], achado [${vals.join(', ')}].`);
      }
    }
    for (const bad of FORBIDDEN_SCOPES) {
      if (new RegExp(`scope_type[\\s\\S]{0,80}'${bad}'`, 'i').test(sql)) {
        failures.push(`${D1_MIG}: scope proibido '${bad}' aparece associado a scope_type.`);
      }
    }

    // CHECK fechado de shape — os DOIS ramos exatos
    const shape = sql.match(/ADD\s+CONSTRAINT\s+chk_acg_scope_shape\s+CHECK\s*\(([\s\S]*?)\)\s*;/i);
    if (!shape) {
      failures.push(`${D1_MIG}: CHECK chk_acg_scope_shape ausente.`);
    } else {
      const body = shape[1];
      if (!/scope_type\s*=\s*'actor'\s+AND\s+tenant_id\s+IS\s+NOT\s+NULL\s+AND\s+scope_actor_id\s+IS\s+NOT\s+NULL\s+AND\s+scope_city_id\s+IS\s+NULL/i.test(body.replace(/\s+/g, ' '))) {
        failures.push(`${D1_MIG}: ramo actor do shape divergente (tenant NOT NULL + scope_actor NOT NULL + city NULL).`);
      }
      if (!/scope_type\s*=\s*'territory'\s+AND\s+tenant_id\s+IS\s+NULL\s+AND\s+scope_actor_id\s+IS\s+NULL\s+AND\s+scope_city_id\s+IS\s+NOT\s+NULL/i.test(body.replace(/\s+/g, ' '))) {
        failures.push(`${D1_MIG}: ramo territory do shape divergente (tenant NULL + scope_actor NULL + city NOT NULL).`);
      }
    }

    // ANTI-SUSPENDED territorial (ADENDO D2.1 — nasce NESTA fatia, no MESMO commit do scope)
    if (!/ADD\s+CONSTRAINT\s+chk_acg_territory_not_suspended\s+CHECK\s*\(\s*scope_type\s*<>\s*'territory'\s+OR\s+status\s*<>\s*'suspended'\s*\)/i.test(sql.replace(/\s+/g, ' '))) {
      failures.push(`${D1_MIG}: CHECK anti-suspended territorial ausente/divergente (scope_type <> 'territory' OR status <> 'suspended').`);
    }
    // constraints reais (nao NOT VALID) — mira o STATEMENT DDL, nao textos de erro dos DO-blocks
    for (const stmt of sql.split(';')) {
      if (/ADD\s+CONSTRAINT/i.test(stmt) && /NOT\s+VALID/i.test(stmt)) {
        failures.push(`${D1_MIG}: constraint NOT VALID proibida — CHECKs devem nascer validados.`);
      }
    }

    // UNICIDADE: duas casas parciais explicitas
    const idxActor = sql.match(/CREATE\s+UNIQUE\s+INDEX\s+uidx_actor_capability_grants_active\s+ON\s+actor_capability_grants\s*\(([^)]*)\)\s*WHERE\s+([^;]*);/i);
    if (!idxActor) {
      failures.push(`${D1_MIG}: casa de unicidade actor (uidx_actor_capability_grants_active) ausente.`);
    } else {
      if (idxActor[1].replace(/\s+/g, '') !== 'tenant_id,grantee_actor_id,capability_key,scope_actor_id') {
        failures.push(`${D1_MIG}: colunas da casa actor divergentes (esperado tenant_id, grantee_actor_id, capability_key, scope_actor_id).`);
      }
      if (!/scope_type\s*=\s*'actor'/i.test(idxActor[2]) || !/status\s*=\s*'active'/i.test(idxActor[2])) {
        failures.push(`${D1_MIG}: predicado da casa actor deve exigir scope_type='actor' AND status='active'.`);
      }
      if (!/tenant_id/i.test(idxActor[1])) failures.push(`${D1_MIG}: casa actor SEM tenant_id — actor-scoped e tenant-scoped por construcao.`);
    }
    const idxTerr = sql.match(/CREATE\s+UNIQUE\s+INDEX\s+uidx_actor_capability_grants_territory_active\s+ON\s+actor_capability_grants\s*\(([^)]*)\)\s*WHERE\s+([^;]*);/i);
    if (!idxTerr) {
      failures.push(`${D1_MIG}: casa de unicidade territory (uidx_actor_capability_grants_territory_active) ausente.`);
    } else {
      if (idxTerr[1].replace(/\s+/g, '') !== 'grantee_actor_id,capability_key,scope_city_id') {
        failures.push(`${D1_MIG}: colunas da casa territory divergentes (esperado grantee_actor_id, capability_key, scope_city_id).`);
      }
      if (/tenant_id/i.test(idxTerr[1]) || /tenant_id/i.test(idxTerr[2])) {
        failures.push(`${D1_MIG}: casa territory contem tenant_id — grant territorial e INDEPENDENTE de tenant (ADENDO D1.5-B).`);
      }
      if (/now\s*\(|valid_from|valid_until/i.test(idxTerr[1] + idxTerr[2])) {
        failures.push(`${D1_MIG}: casa territory usa now()/vigencia no indice — proibido (ADENDO D2.4; colisao de active-vencido e intencional).`);
      }
      if (!/scope_type\s*=\s*'territory'/i.test(idxTerr[2]) || !/status\s*=\s*'active'/i.test(idxTerr[2])) {
        failures.push(`${D1_MIG}: predicado da casa territory deve exigir scope_type='territory' AND status='active'.`);
      }
    }
    // nenhuma UNIQUE global mista (toda UNIQUE nova sobre a tabela deve ser parcial por scope)
    for (const m of sql.matchAll(/CREATE\s+UNIQUE\s+INDEX\s+(\w+)\s+ON\s+actor_capability_grants[\s\S]*?(;|$)/gi)) {
      if (!/WHERE[\s\S]*scope_type/i.test(m[0])) {
        failures.push(`${D1_MIG}: indice UNIQUE ${m[1]} sem discriminante de scope_type — UNIQUE mista actor+territory proibida.`);
      }
    }

    // ZERO vocabulario/grant/lifecycle nesta fatia — mira KEY citada ('territory:acao'), nao textos de erro
    if (/'territory:[a-z_]+'/i.test(sql)) failures.push(`${D1_MIG}: key territory:* aparece — vocabulario e N2-D.2.`);
    if (/INSERT\s+INTO\s+actor_capability_grants/i.test(sql)) failures.push(`${D1_MIG}: INSERT/seed em actor_capability_grants proibido na N2-D.1.`);
    if (/chk_acg_capability_nonfinancial/i.test(sql.replace(/MIGRATION_ABORT[^;]*/g, ''))) {
      // permitido SOMENTE dentro dos DO-blocks fail-closed (leitura via pg_constraint); DDL sobre ela e proibido
      if (/(DROP|ADD)\s+CONSTRAINT\s+chk_acg_capability_nonfinancial/i.test(sql)) {
        failures.push(`${D1_MIG}: altera chk_acg_capability_nonfinancial — allowlist de capability e intocavel nesta fatia.`);
      }
    }
    if (/CREATE\s+TABLE/i.test(sql)) failures.push(`${D1_MIG}: CREATE TABLE proibido — a fatia EVOLUI a casa canonica, nao cria segunda casa.`);
    if (/\bbank_\w+/i.test(sql)) failures.push(`${D1_MIG}: toca bank_* — Bank esta FORA da frente territorial.`);
    if (/system_tenant|tenant_sistema|'system'::/i.test(sql)) failures.push(`${D1_MIG}: tenant institucional/sistema — REJEITADO (DECISION-0173 §2).`);
  }

  // ── 2. Migrations POSTERIORES não enfraquecem o eixo territorial ────────────────────────────
  const after = migFiles.filter((f) => f > D1_MIG);
  for (const f of after) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (/DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?(fk_acg_scope_city|chk_acg_scope_shape|chk_acg_territory_not_suspended|chk_acg_scope_type)/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: dropa constraint do eixo territorial — exige fatia propria + ajuste consciente do guard.`);
    }
    if (/scope_city_id[\s\S]{0,120}ON\s+DELETE\s+(CASCADE|SET\s+NULL)/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: enfraquece a FK territorial para CASCADE/SET NULL — RESTRICT e contrato.`);
    }
    for (const bad of FORBIDDEN_SCOPES) {
      if (new RegExp(`scope_type[\\s\\S]{0,80}'${bad}'`, 'i').test(sql)) {
        failures.push(`[pos-D1] ${f}: admite scope proibido '${bad}' — terceiro scope exige decisao propria.`);
      }
    }
    if (/DROP\s+INDEX\s+(IF\s+EXISTS\s+)?(uidx_actor_capability_grants_active|uidx_actor_capability_grants_territory_active)/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: dropa casa de unicidade de grants — proibido sem fatia propria.`);
    }
    if (/CREATE\s+(UNIQUE\s+)?INDEX[\s\S]{0,200}actor_capability_grants[\s\S]{0,300}scope_type\s*=\s*'territory'[\s\S]{0,200}(tenant_id|now\s*\(|valid_until|valid_from)/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: indice territorial com tenant/now()/vigencia — proibido (ADENDO D2.4).`);
    }
    if (/ADD\s+COLUMN\s+(scope_ref_id|city_name|city_text)/i.test(sql) && /actor_capability_grants/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: adiciona referencia generica/textual de territorio a grants — FK real e contrato.`);
    }
    if (/INSERT\s+INTO\s+actor_capability_grants/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: seed em actor_capability_grants — grants reais nascem SO na PORTA-TERRITORY-1 (pos selo D.1+D.2+D.3), nunca em migration.`);
    }
    // N2-E: a migration nominal do writer consome as keys territoriais (assertions + CHECK da trilha de
    // curadoria); fiscalizada por audit-neighborhood-canonical-writer.mjs.
    const N2E_WRITER_MIG = '20260711210000_neighborhood_canonical_create_writer.sql';
    // PORTA-TERRITORY-1: o writer governado de grant territorial (fn_grant_territorial_capability) consome
    // as 6 keys territoriais na validacao — migration nominal autorizada; fiscalizada por
    // audit-territorial-grant-bootstrap.mjs. Grants reais continuam nascendo SO pela operacao one-shot, nunca em migration.
    const PORTA_WRITER_MIG = '20260712120000_territorial_capability_grant_bootstrap_writer.sql';
    // N1 (DECISION-0174): a migration nominal do writer de aliases consome territory:manage_neighborhood_aliases
    // (assertions fn_assert_territorial_capability + CHECK das casas de governança); fiscalizada por
    // audit-curitiba-neighborhood-alias-first.mjs. Não semeia grants — grants reais só pela PORTA one-shot.
    const N1_ALIAS_WRITER_MIG = '20260713140000_neighborhood_alias_first_governed_flow.sql';
    if (f !== D2_MIG && f !== D3_MIG && f !== N2E_WRITER_MIG && f !== PORTA_WRITER_MIG && f !== N1_ALIAS_WRITER_MIG && /'territory:[a-z_]+'/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: key territory:* em migration — vocabulario e N2-D.2/D.3/N2-E/PORTA/N1 (migrations nominais autorizadas: ${D2_MIG}, ${D3_MIG}, ${N2E_WRITER_MIG}, ${PORTA_WRITER_MIG}, ${N1_ALIAS_WRITER_MIG}).`);
    }
    if (/ALTER\s+TABLE\s+(public\.)?actor_capability_grants\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: liga RLS em actor_capability_grants — mudanca de acesso exige decisao propria (ADENDO D1.5-E).`);
    }
    if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?(territorial_permissions|city_admins|neighborhood_admins|curator_roles|\w*territor\w*grant\w*)/i.test(sql)) {
      failures.push(`[pos-D1] ${f}: segunda casa de authority territorial — SSOT paralelo proibido (DECISION-0173 §1).`);
    }
  }

  // ── 3. Runtime: nenhum reader/writer/resolver/rota territorial nasceu ───────────────────────
  const SRC = join(ROOT, 'src');
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
    if (D2_AUTHORIZED_RUNTIME_FILES.has(f.rel)) continue; // janela nominal D.2 — fiscalizacao fina no guard proprio
    if (/scope_city_id/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: referencia scope_city_id — repository/resolver territorial e N2-D.2/D.3, proibido fora da janela nominal.`);
    }
    if (/['"]territory:[a-z_]+['"]/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: capability key territory:* em runtime — vocabulario e N2-D.2, proibido fora da janela nominal.`);
    }
    if (/actor_capability_grants/i.test(f.src) && /'territory'/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: consulta grants com scope 'territory' — resolver territorial e N2-D.3, proibido fora da janela nominal.`);
    }
  }

  // ── 4. Registry SSOT das keys: territory:* SOMENTE na janela nominal D.2 (permission-keys.ts) ──
  const pkP = join(SRC, 'core/authorization/permission-keys.ts');
  if (existsSync(pkP)) {
    const pk = stripTs(readFileSync(pkP, 'utf-8'));
    const terrKeys = (pk.match(/['"]territory:[a-z_]+['"]/gi) || []).length;
    if (terrKeys > 0 && terrKeys !== 12) { // 6 no union type + 6 no PERMISSION_CAPABILITIES = 12 ocorrencias esperadas
      failures.push(`permission-keys.ts: ${terrKeys} ocorrencias de territory:* (esperado 0 ou exatamente 12 — 6 keys x union+map). Fiscalizacao fina no guard D.2.`);
    }
  }
  // canRepresentActor permanece PURO (nao consulta grants nem territorio)
  const authP = join(SRC, 'core/authorization/authorization.service.ts');
  if (!existsSync(authP)) {
    failures.push('authorization.service.ts ausente — terreno divergente.');
  } else {
    const auth = stripTs(readFileSync(authP, 'utf-8'));
    if (/actor_capability_grants|scope_city_id|hasTerritorialCapability/i.test(auth)) {
      failures.push('authorization.service.ts: canRepresentActor deixou de ser puro (referencia grants/territorio) — proibido (DECISION-0173 §1).');
    }
  }

  // ── 5. wiring no runner ─────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-territorial-capability-grant-foundation.mjs')) {
    failures.push('runner: audit-territorial-capability-grant-foundation.mjs fora do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [territorial-capability-grant-foundation]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Eixo territorial da casa canonica (DECISION-0173 / N2-D.1) ausente/enfraquecido. Grant territorial e city-scoped global (tenant NULL + FK real cities), shape fechado, anti-suspended, unicidade parcial propria; ZERO key/grant/lifecycle/resolver ate as fatias proprias.');
  process.exit(1);
}
console.log('GATE OK [territorial-capability-grant-foundation] — integridade VERSIONADA da N2-D.1: casa canonica evoluida (scope actor|territory, sem terceiro valor); shape fechado (actor=tenant+scope_actor NOT NULL+city NULL; territory=tenant NULL+scope_actor NULL+city NOT NULL FK real cities RESTRICT); anti-suspended territorial nascido nesta fatia; duas casas de unicidade parciais (actor COM tenant; territory SEM tenant, SEM now()/vigencia — colisao de active-vencido intencional); zero key territory:*, zero seed/grant, zero runtime territorial; canRepresentActor puro; sem segunda casa de authority. (Estado vivo = introspecao.)');
