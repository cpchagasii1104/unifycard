#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-C · FUNDAÇÃO DE SUCESSÃO TERRITORIAL.
// DECISION-0171 §3-E/§9 (sucessao N:N append-only; linhagem, nao segunda identidade) + DECISION-0172 §2.
// Pergunta propria: "a fundacao de sucessao esta integra (3 tabelas N:N same-city, cardinalidade
// governada deferred, append-only, HOLD), sem segunda identidade/writer/efeito automatico?"
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

const C_MIG = '20260711150000_neighborhood_succession_foundation.sql';
const TABLES = ['neighborhood_succession_events', 'neighborhood_succession_sources', 'neighborhood_succession_targets'];
const CARD_FN = 'enforce_neighborhood_succession_cardinality';
const AO_FN = 'enforce_neighborhood_succession_append_only';
const HOLD_FN = 'enforce_neighborhood_successions_writer_hold';

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (migFiles.length === 0) throw new Error('zero migrations lidas');

  // ── 1. Migration N2-C presente e íntegra ────────────────────────────────────────────────────
  if (!migFiles.includes(C_MIG)) {
    failures.push(`migration da fundação de sucessão ausente: ${C_MIG}`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, C_MIG), 'utf-8'));

    // 3 tabelas canônicas
    for (const t of TABLES) {
      if (!new RegExp(`CREATE\\s+TABLE\\s+${t}\\s*\\(`, 'i').test(sql)) {
        failures.push(`${C_MIG}: CREATE TABLE ${t} ausente.`);
      }
    }
    // sem modelo singular/array/json (segunda identidade proibida) — mira DEFINIÇÃO de coluna,
    // não textos de comentário/validação (ex.: a msg de MIGRATION_ABORT cita "superseded_by").
    if (/^\s*(superseded_by\w*|predecessor_neighborhood_id|successor_neighborhood_id)\s+UUID/im.test(sql)) {
      failures.push(`${C_MIG}: coluna singular superseded_by/predecessor/successor — sucessao e N:N, nao coluna singular.`);
    }
    if (/^\s*(sources|targets|participants)\s+(UUID\s*\[\s*\]|JSONB)/im.test(sql)) {
      failures.push(`${C_MIG}: sources/targets como array/JSONB — proibido; devem ser tabelas filhas N:N.`);
    }
    // colunas proibidas no evento
    for (const bad of ['tenant_id', 'is_active', 'external_code', 'metadata', 'payload', 'authority_grant_id', 'valid_until_at', 'updated_at']) {
      if (new RegExp(`^\\s*${bad}\\s+\\w`, 'im').test(sql)) {
        failures.push(`${C_MIG}: coluna proibida ${bad} em sucessao.`);
      }
    }
    if (/^\s*status\s+TEXT/im.test(sql)) failures.push(`${C_MIG}: coluna 'status' generica proibida.`);
    // vocabulário succession_type exato (sem rename/correction/other/creation)
    const st = sql.match(/chk_nse_succession_type\s+CHECK\s*\(succession_type\s+IN\s*\(([^)]*)\)\)/i);
    if (!st) {
      failures.push(`${C_MIG}: CHECK chk_nse_succession_type ausente.`);
    } else {
      const vals = (st[1].match(/'[^']*'/g) || []).map((v) => v.slice(1, -1)).sort();
      if (JSON.stringify(vals) !== JSON.stringify(['division', 'extinction', 'merger', 'reorganization'])) {
        failures.push(`${C_MIG}: succession_type divergente do vocabulario governado — encontrado [${vals.join(', ')}].`);
      }
    }
    if (/'(rename|correction|spelling_fix|creation|migration|other|generic)'/i.test(sql)) {
      failures.push(`${C_MIG}: succession_type inclui valor proibido (rename/correction/other/...) — rename/correcao = fluxo nome+alias, nao sucessao.`);
    }
    // proveniência governada + nonempty robustos + FKs actors RESTRICT
    if (!/chk_nse_source_kind\s+CHECK\s*\(source_kind\s+IN\s*\('government_official',\s*'public_documentary',\s*'internal_curation'\)\)/i.test(sql)) {
      failures.push(`${C_MIG}: source_kind divergente do vocabulario do nucleo.`);
    }
    for (const c of ['source_reference', 'evidence']) {
      if (!new RegExp(`chk_nse_${c}_nonempty[\\s\\S]{0,60}${c}\\s*~\\s*'\\[\\^\\[:space:\\]\\]'`, 'i').test(sql)) {
        failures.push(`${C_MIG}: CHECK robusto de ${c} ausente (deve ser ~ '[^[:space:]]').`);
      }
    }
    for (const fk of ['fk_nse_created_by_actor', 'fk_nse_approved_by_actor']) {
      if (!new RegExp(`${fk}[\\s\\S]{0,80}REFERENCES\\s+actors\\s*\\(id\\)\\s+ON\\s+DELETE\\s+RESTRICT`, 'i').test(sql)) {
        failures.push(`${C_MIG}: FK ${fk} ausente ou sem actors(id) RESTRICT.`);
      }
    }
    if (!/fk_nse_city[\s\S]{0,60}REFERENCES\s+cities\s*\(city_id\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql)) {
      failures.push(`${C_MIG}: FK do evento para cities(city_id) RESTRICT ausente.`);
    }
    // FKs compostas same-city em sources/targets
    for (const [fk, ev] of [['fk_nss_event', 'nss'], ['fk_nst_event', 'nst']]) {
      if (!new RegExp(`${fk}\\s+FOREIGN\\s+KEY\\s*\\(event_id,\\s*city_id\\)\\s*REFERENCES\\s+neighborhood_succession_events\\(id,\\s*city_id\\)\\s+ON\\s+DELETE\\s+RESTRICT`, 'i').test(sql)) {
        failures.push(`${C_MIG}: FK composta ${fk} (event_id,city_id)->events(id,city_id) RESTRICT ausente (garante same-city).`);
      }
    }
    for (const fk of ['fk_nss_neighborhood', 'fk_nst_neighborhood']) {
      if (!new RegExp(`${fk}\\s+FOREIGN\\s+KEY\\s*\\(city_id,\\s*neighborhood_id\\)\\s*REFERENCES\\s+neighborhoods\\(city_id,\\s*neighborhood_id\\)\\s+ON\\s+DELETE\\s+RESTRICT`, 'i').test(sql)) {
        failures.push(`${C_MIG}: FK composta ${fk} (city_id,neighborhood_id)->neighborhoods RESTRICT ausente (garante bairro na cidade).`);
      }
    }
    // events UNIQUE(id, city_id) para suportar a FK composta
    if (!/uq_nse_id_city\s+UNIQUE\s*\(id,\s*city_id\)/i.test(sql)) {
      failures.push(`${C_MIG}: UNIQUE(id, city_id) do evento ausente (necessario para a FK composta same-city).`);
    }
    // PKs compostas das filhas (sem id surrogate)
    for (const t of ['neighborhood_succession_sources', 'neighborhood_succession_targets']) {
      if (!new RegExp(`PRIMARY\\s+KEY\\s*\\(event_id,\\s*neighborhood_id\\)`, 'i').test(sql)) {
        failures.push(`${C_MIG}: ${t} sem PRIMARY KEY (event_id, neighborhood_id).`);
      }
    }

    // cardinalidade: função com os 6 erros governados + constraint triggers DEFERRABLE INITIALLY DEFERRED
    const cf = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${CARD_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!cf) {
      failures.push(`${C_MIG}: função ${CARD_FN} ausente.`);
    } else {
      for (const e of ['SOURCE_REQUIRED', 'SELF_REFERENCE_FORBIDDEN', 'DIVISION_CARDINALITY_INVALID',
                       'MERGER_CARDINALITY_INVALID', 'REORGANIZATION_CARDINALITY_INVALID', 'EXTINCTION_CARDINALITY_INVALID']) {
        if (!cf[1].includes('NEIGHBORHOOD_SUCCESSION_' + e)) failures.push(`${C_MIG}: cardinalidade sem o erro ${e}.`);
      }
      // cardinalidade exata por tipo — mutacao que afrouxe qualquer lado morde
      if (!/v_src\s*=\s*1\s+AND\s+v_tgt\s*>=\s*2/i.test(cf[1])) {
        failures.push(`${C_MIG}: division deve exigir exatamente 1 source e >=2 targets.`);
      }
      if (!/v_src\s*>=\s*2\s+AND\s+v_tgt\s*=\s*1/i.test(cf[1])) {
        failures.push(`${C_MIG}: merger deve exigir >=2 sources e exatamente 1 target.`);
      }
      if (!/v_src\s*>=\s*1\s+AND\s+v_tgt\s*=\s*0/i.test(cf[1])) {
        failures.push(`${C_MIG}: extinction deve exigir >=1 source e 0 targets.`);
      }
      // 1->1 proibido em reorganization
      if (!/v_src\s*>\s*1\s+OR\s+v_tgt\s*>\s*1/i.test(cf[1])) {
        failures.push(`${C_MIG}: reorganization nao proibe 1->1 (deve exigir >1 em um lado).`);
      }
      if (/current_setting|session_user|current_user|pg_has_role|set_config/i.test(cf[1])) {
        failures.push(`${C_MIG}: cardinalidade com bypass de sessao/GUC.`);
      }
    }
    for (const trg of ['trg_nse_cardinality', 'trg_nss_cardinality', 'trg_nst_cardinality']) {
      if (!new RegExp(`CREATE\\s+CONSTRAINT\\s+TRIGGER\\s+${trg}[\\s\\S]{0,160}DEFERRABLE\\s+INITIALLY\\s+DEFERRED[\\s\\S]{0,80}${CARD_FN}`, 'i').test(sql)) {
        failures.push(`${C_MIG}: constraint trigger ${trg} ausente ou nao DEFERRABLE INITIALLY DEFERRED.`);
      }
    }

    // append-only: função com os 3 erros + triggers BEFORE UPDATE OR DELETE FOR EACH ROW
    const af = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${AO_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!af) {
      failures.push(`${C_MIG}: função ${AO_FN} ausente.`);
    } else {
      for (const e of ['EVENT_APPEND_ONLY', 'SOURCE_APPEND_ONLY', 'TARGET_APPEND_ONLY']) {
        if (!af[1].includes('NEIGHBORHOOD_SUCCESSION_' + e)) failures.push(`${C_MIG}: append-only sem ${e}.`);
      }
    }
    for (const trg of ['trg_nse_append_only', 'trg_nss_append_only', 'trg_nst_append_only']) {
      if (!new RegExp(`CREATE\\s+TRIGGER\\s+${trg}\\s+BEFORE\\s+UPDATE\\s+OR\\s+DELETE[\\s\\S]{0,60}FOR\\s+EACH\\s+ROW[\\s\\S]{0,60}${AO_FN}`, 'i').test(sql)) {
        failures.push(`${C_MIG}: trigger ${trg} ausente/nao BEFORE UPDATE OR DELETE FOR EACH ROW.`);
      }
    }

    // HOLD: função incondicional + trigger STATEMENT + ENABLE ALWAYS nas 3 tabelas
    const hf = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${HOLD_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!hf) {
      failures.push(`${C_MIG}: função do HOLD ${HOLD_FN} ausente.`);
    } else {
      if (!hf[1].includes('NEIGHBORHOOD_SUCCESSION_CANONICAL_WRITER_HOLD')) failures.push(`${C_MIG}: HOLD sem erro estavel.`);
      if (/\b(IF|CASE)\b/i.test(hf[1])) failures.push(`${C_MIG}: HOLD deve ser INCONDICIONAL (sem IF/CASE).`);
    }
    for (const [trg, tbl] of [['trg_nse_writer_hold', 'neighborhood_succession_events'],
                              ['trg_nss_writer_hold', 'neighborhood_succession_sources'],
                              ['trg_nst_writer_hold', 'neighborhood_succession_targets']]) {
      if (!new RegExp(`CREATE\\s+TRIGGER\\s+${trg}\\s+BEFORE\\s+INSERT\\s+OR\\s+UPDATE\\s+OR\\s+DELETE\\s+ON\\s+${tbl}\\s+FOR\\s+EACH\\s+STATEMENT`, 'i').test(sql)) {
        failures.push(`${C_MIG}: HOLD trigger ${trg} ausente/nao BEFORE I/U/D FOR EACH STATEMENT.`);
      }
      if (!new RegExp(`ALTER\\s+TABLE\\s+${tbl}\\s+ENABLE\\s+ALWAYS\\s+TRIGGER\\s+${trg}`, 'i').test(sql)) {
        failures.push(`${C_MIG}: HOLD de ${tbl} sem ENABLE ALWAYS.`);
      }
    }

    // ACL: REVOKE ALL (app + PUBLIC) + GRANT SELECT
    if (!/REVOKE\s+ALL\s+ON\s+TABLE[\s\S]{0,200}FROM\s+unificard_app/i.test(sql)) failures.push(`${C_MIG}: REVOKE ALL de unificard_app ausente.`);
    if (!/REVOKE\s+ALL\s+ON\s+TABLE[\s\S]{0,200}FROM\s+PUBLIC/i.test(sql)) failures.push(`${C_MIG}: REVOKE ALL de PUBLIC ausente.`);
    if (!/GRANT\s+SELECT\s+ON\s+TABLE[\s\S]{0,200}TO\s+unificard_app/i.test(sql)) failures.push(`${C_MIG}: GRANT SELECT para unificard_app ausente.`);

    // sem RLS / seed / efeito automático / toca núcleo
    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) failures.push(`${C_MIG}: RLS ligada — proibido (catalogo global).`);
    for (const t of TABLES) if (new RegExp(`INSERT\\s+INTO\\s+${t}`, 'i').test(sql)) failures.push(`${C_MIG}: seed em ${t} proibido.`);
    if (/UPDATE\s+neighborhoods\s+SET|INSERT\s+INTO\s+neighborhoods\b|UPDATE\s+addresses\s+SET/i.test(sql)) {
      failures.push(`${C_MIG}: efeito automatico sobre neighborhoods/addresses proibido (sucessao e linhagem, nao reescreve FK).`);
    }
    if (/DROP\s+TRIGGER[\s\S]{0,120}trg_neighborhoods_canonical_writer_hold|GRANT[\s\S]{0,80}neighborhoods\b[\s\S]{0,40}TO\s+unificard_app/i.test(sql)) {
      failures.push(`${C_MIG}: N2-C nao pode tocar HOLD/ACL do nucleo.`);
    }
  }

  // ── 2. Migrations POSTERIORES não enfraquecem a fundação ────────────────────────────────────
  const after = migFiles.filter((f) => f > C_MIG);
  for (const f of after) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (/superseded_by\w*\s+UUID|ADD\s+COLUMN\s+(superseded_by|predecessor|successor)/i.test(sql) && /neighborhoods\b/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: adiciona superseded_by/predecessor/successor ao nucleo — sucessao e N:N, nao coluna singular.`);
    }
    if (new RegExp(`DROP\\s+TRIGGER[\\s\\S]{0,120}(trg_ns[est]_(cardinality|append_only|writer_hold))`, 'i').test(sql)) {
      failures.push(`[pos-N2C] ${f}: dropa trigger de sucessao (cardinalidade/append-only/HOLD).`);
    }
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_succession_\w+[\s\S]{0,120}(DISABLE\s+TRIGGER|ENABLE\s+REPLICA\s+TRIGGER)/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: desabilita/rebaixa trigger de sucessao.`);
    }
    if (new RegExp(`(DROP\\s+FUNCTION|CREATE\\s+OR\\s+REPLACE\\s+FUNCTION)[\\s\\S]{0,80}(${CARD_FN}|${AO_FN}|${HOLD_FN})`, 'i').test(sql)) {
      failures.push(`[pos-N2C] ${f}: dropa/redefine funcao de sucessao — exige fatia propria + guard consciente.`);
    }
    if (/GRANT\b[\s\S]{0,80}?\b(INSERT|UPDATE|DELETE|TRUNCATE|ALL(?:\s+PRIVILEGES)?)\b[\s\S]{0,80}?\bON\b[\s\S]{0,40}?(TABLE\s+)?(public\.)?neighborhood_succession_\w+[\s\S]{0,80}?\bTO\b/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: re-concede DML/TRUNCATE de sucessao (qualquer grantee) — proibido antes do writer.`);
    }
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_succession_\w+\s+OWNER\s+TO\b/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: troca ownership de tabela de sucessao — decisao consciente propria.`);
    }
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_succession_\w+[\s\S]{0,200}(DROP\s+CONSTRAINT\s+(chk_nse|fk_ns|uq_nse)|ADD\s+COLUMN\s+(tenant_id|status|is_active))/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: enfraquece constraints/shape de sucessao.`);
    }
    if (/'rename'|'correction'|'other'/i.test(sql) && /succession_type/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: adiciona succession_type proibido (rename/correction/other).`);
    }
    if (/INSERT\s+INTO\s+(public\.)?neighborhood_succession_\w+/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: seed em tabela de sucessao — seed e N3, via contrato canonico.`);
    }
    if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_\w*(lineage|history|merge|split)\w*/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: segunda tabela de linhagem/history — SSOT paralelo proibido.`);
    }
    // RLS ligada em tabela de sucessao (catalogo global) por migration posterior
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_succession_\w+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: liga RLS em tabela de sucessao — catalogo global nao tem RLS.`);
    }
    // efeito automatico sobre nucleo/addresses por migration posterior (sucessao e linhagem). EXCETO a
    // migration nominal do writer N2-E (INSERT unico DENTRO da funcao canonica; sem UPDATE/DELETE de
    // neighborhoods nem addresses; fiscalizado por audit-neighborhood-canonical-writer.mjs).
    if (f !== '20260711210000_neighborhood_canonical_create_writer.sql'
        && /UPDATE\s+neighborhoods\s+SET|INSERT\s+INTO\s+neighborhoods\b|UPDATE\s+addresses\s+SET\s+neighborhood_id|DELETE\s+FROM\s+neighborhoods\b/i.test(sql)) {
      failures.push(`[pos-N2C] ${f}: efeito automatico sobre neighborhoods/addresses — sucessao nao reescreve FK retroativamente (contrato do consumidor decide).`);
    }
  }

  // ── 3. Runtime: nenhum writer/resolver de sucessão nasceu ───────────────────────────────────
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
    if (/INSERT\s+INTO\s+neighborhood_succession_\w+|UPDATE\s+neighborhood_succession_\w+|DELETE\s+FROM\s+neighborhood_succession_\w+/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: writer de sucessao em runtime — proibido ate N2-E.`);
    }
  }

  // ── 4. wiring: os cinco guards de neighborhood no runner ────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  for (const g of ['audit-neighborhood-freetext-writer-containment.mjs', 'audit-neighborhood-dml-hold.mjs',
                   'audit-neighborhood-core-foundation.mjs', 'audit-neighborhood-alias-foundation.mjs',
                   'audit-neighborhood-succession-foundation.mjs']) {
    if (!runner.includes(g)) failures.push(`runner: ${g} saiu do run-regression-guards.`);
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-succession-foundation]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Fundacao de sucessao (DECISION-0171 §9 / 0172 N2-C) ausente/enfraquecida. Sucessao e LINHAGEM N:N append-only same-city; nunca coluna singular/segunda identidade/writer/efeito automatico; nasce inviolavel ate N2-E.');
  process.exit(1);
}
console.log(`GATE OK [neighborhood-succession-foundation] — integridade VERSIONADA da N2-C: 3 tabelas N:N (events + sources + targets), same-city por FK composta, sem coluna singular superseded_by/array/JSONB; succession_type governado (division/merger/reorganization/extinction; sem rename/correction); cardinalidade por constraint trigger DEFERRABLE INITIALLY DEFERRED (1->N / N->1 / N->N com >1 de um lado / N->0; 1->1 proibido; self-ref proibido); append-only (UPDATE/DELETE bloqueados); HOLD I/U/D STATEMENT ENABLE ALWAYS + ACL SELECT-only (REVOKE ALL app+PUBLIC); sem RLS/seed/writer; zero efeito automatico sobre neighborhoods/addresses; nucleo/aliases intocados; 5 guards no runner. (Estado vivo = introspecao.)`);
