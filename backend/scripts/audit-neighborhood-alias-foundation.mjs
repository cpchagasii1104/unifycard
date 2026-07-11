#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-B · FUNDAÇÃO DE ALIASES DE BAIRRO.
// DECISION-0171 §8 (aliases tabela-filha; colisão = AMBIGUIDADE, nunca escolha silenciosa) +
// DECISION-0172 §2 (alias nunca auto-resolve FK) e P4/P6.
// Pergunta própria: "a fundação de aliases está íntegra, sem city_id redundante, sem UNIQUE
// global que mate a ambiguidade, sem resolver/writer, e inviolável até o N2-E?"
// (núcleo = guard core-foundation; HOLD do núcleo = guard dml-hold; texto→identidade = guard
// freetext. Não misturar.)
//
// PROMESSA HONESTA: integridade VERSIONADA (migrations/arquivos do repo). Estado vivo = introspecção.
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heurística textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

const B_MIG = '20260711130000_neighborhood_aliases_foundation.sql';
const IMMUT_FN = 'enforce_neighborhood_alias_identity_immutability';
const IMMUT_TRG = 'trg_neighborhood_alias_identity_immutability';
const HOLD_FN = 'enforce_neighborhood_aliases_writer_hold';
const HOLD_TRG = 'trg_neighborhood_aliases_writer_hold';
const HOLD_ERR = 'NEIGHBORHOOD_ALIAS_CANONICAL_WRITER_HOLD';

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (migFiles.length === 0) throw new Error('zero migrations lidas');

  // ── 1. Migration N2-B presente e íntegra ────────────────────────────────────────────────────
  if (!migFiles.includes(B_MIG)) {
    failures.push(`migration da fundação de aliases ausente: ${B_MIG}`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, B_MIG), 'utf-8'));

    // tabela única canônica
    if (!/CREATE\s+TABLE\s+neighborhood_aliases\s*\(/i.test(sql)) {
      failures.push(`${B_MIG}: CREATE TABLE neighborhood_aliases ausente.`);
    }
    // shape: colunas obrigatórias
    for (const c of ['neighborhood_id', 'alias', 'alias_normalized', 'source_kind', 'source_reference',
                     'evidence', 'created_by_actor_id', 'approved_by_actor_id', 'approved_at',
                     'is_active', 'valid_from_at', 'valid_until_at']) {
      if (!new RegExp(`\\b${c}\\b`, 'i').test(sql)) failures.push(`${B_MIG}: coluna ${c} ausente.`);
    }
    // NOT NULL obrigatório (todas exceto valid_until_at e a GENERATED)
    for (const [c, typ] of [['neighborhood_id', 'UUID'], ['alias', 'TEXT'], ['source_kind', 'TEXT'],
                            ['source_reference', 'TEXT'], ['evidence', 'TEXT'],
                            ['created_by_actor_id', 'UUID'], ['approved_by_actor_id', 'UUID'],
                            ['approved_at', 'TIMESTAMPTZ'], ['is_active', 'BOOLEAN'],
                            ['valid_from_at', 'TIMESTAMPTZ']]) {
      if (!new RegExp(`\\b${c}\\s+${typ}\\s+NOT\\s+NULL`, 'i').test(sql)) {
        failures.push(`${B_MIG}: coluna ${c} deve ser ${typ} NOT NULL.`);
      }
    }
    // ZERO DEFAULTS nos campos de proveniência/aprovação/vigência/disponibilidade
    for (const c of ['alias', 'source_kind', 'source_reference', 'evidence', 'created_by_actor_id',
                     'approved_by_actor_id', 'approved_at', 'is_active', 'valid_from_at', 'valid_until_at']) {
      if (new RegExp(`\\b${c}\\s+\\w+(\\s+NOT\\s+NULL)?[^,\\n]*\\bDEFAULT\\b`, 'i').test(sql)) {
        failures.push(`${B_MIG}: coluna ${c} ganhou DEFAULT — proveniência/aprovação/vigência/disponibilidade não podem ser inventadas.`);
      }
    }
    // colunas proibidas
    for (const bad of ['city_id', 'tenant_id', 'external_code', 'metadata', 'owner_actor_id', 'account_id', 'capability_id']) {
      if (new RegExp(`^\\s*${bad}\\s+\\w`, 'im').test(sql)) {
        failures.push(`${B_MIG}: coluna proibida ${bad} na tabela de aliases (city deriva do pai; DECISION-0172).`);
      }
    }
    if (/^\s*status\s+TEXT/im.test(sql)) failures.push(`${B_MIG}: coluna 'status' genérica proibida.`);
    // GENERATED via normalize_name (sem normalização local paralela)
    if (!/alias_normalized\s+TEXT\s+GENERATED\s+ALWAYS\s+AS\s*\(normalize_name\(alias\)\)\s*STORED/i.test(sql)) {
      failures.push(`${B_MIG}: alias_normalized deve ser GENERATED ALWAYS AS (normalize_name(alias)) STORED.`);
    }
    if (/GENERATED\s+ALWAYS\s+AS\s*\((lower|regexp_replace|btrim|trim)\(/i.test(sql)) {
      failures.push(`${B_MIG}: normalização LOCAL paralela detectada — usar exclusivamente normalize_name().`);
    }
    // CHECKs whitespace robustos
    for (const [con, col] of [['chk_neighborhood_aliases_alias_nonempty', 'alias'],
                              ['chk_neighborhood_aliases_source_reference_nonempty', 'source_reference'],
                              ['chk_neighborhood_aliases_evidence_nonempty', 'evidence']]) {
      if (!new RegExp(`${con}\\s+CHECK\\s*\\(${col}\\s*~\\s*'\\[\\^\\[:space:\\]\\]'\\)`, 'i').test(sql)) {
        failures.push(`${B_MIG}: CHECK robusto ${con} ausente ou sem a forma ${col} ~ '[^[:space:]]'.`);
      }
    }
    // vocabulário source_kind: exatamente os 3 do núcleo (sem taxonomia paralela)
    const skM = sql.match(/chk_neighborhood_aliases_source_kind\s+CHECK\s*\(source_kind\s+IN\s*\(([^)]*)\)\)/i);
    if (!skM) {
      failures.push(`${B_MIG}: CHECK de source_kind ausente.`);
    } else {
      const vals = (skM[1].match(/'[^']*'/g) || []).map((v) => v.slice(1, -1)).sort();
      if (JSON.stringify(vals) !== JSON.stringify(['government_official', 'internal_curation', 'public_documentary'])) {
        failures.push(`${B_MIG}: source_kind divergente do vocabulário governado do núcleo — encontrado [${vals.join(', ')}].`);
      }
    }
    if (/alias_kind|source_type|provenance_type/i.test(sql)) {
      failures.push(`${B_MIG}: taxonomia paralela (alias_kind/source_type/provenance_type) proibida.`);
    }
    // FKs reais RESTRICT
    for (const [fk, target] of [['fk_neighborhood_aliases_neighborhood', 'neighborhoods\\s*\\(neighborhood_id\\)'],
                                ['fk_neighborhood_aliases_created_by_actor', 'actors\\s*\\(id\\)'],
                                ['fk_neighborhood_aliases_approved_by_actor', 'actors\\s*\\(id\\)']]) {
      if (!new RegExp(`${fk}[\\s\\S]{0,140}REFERENCES\\s+${target}\\s+ON\\s+DELETE\\s+RESTRICT`, 'i').test(sql)) {
        failures.push(`${B_MIG}: FK ${fk} ausente ou sem REFERENCES ... ON DELETE RESTRICT.`);
      }
    }
    // CHECK temporal
    if (!/chk_neighborhood_aliases_validity_interval[\s\S]{0,120}valid_until_at\s+IS\s+NULL\s+OR\s+valid_until_at\s*>\s*valid_from_at/i.test(sql)) {
      failures.push(`${B_MIG}: CHECK de intervalo de vigência ausente.`);
    }
    // UNIQUE PISO — e NADA mais forte
    if (!/uq_neighborhood_aliases_parent_normalized\s+UNIQUE\s*\(neighborhood_id,\s*alias_normalized\)/i.test(sql)) {
      failures.push(`${B_MIG}: UNIQUE(neighborhood_id, alias_normalized) piso ausente.`);
    }
    const uniques = sql.match(/UNIQUE\s*(?:INDEX\s+\w+\s+ON\s+neighborhood_aliases)?\s*\(([^)]*)\)/gi) || [];
    for (const u of uniques) {
      if (/alias_normalized/i.test(u) && !/neighborhood_id/i.test(u)) {
        failures.push(`${B_MIG}: UNIQUE sobre alias_normalized SEM neighborhood_id mataria a ambiguidade legítima entre bairros.`);
      }
    }
    if (/EXCLUDE\s+USING/i.test(sql)) {
      failures.push(`${B_MIG}: constraint de exclusão global proibida (ambiguidade entre bairros é legítima).`);
    }
    // sem mecanismos de resolução/ranking
    if (/\b(preferred|is_primary|priority|score|confidence|ranking|match_strength|canonical)\b/i.test(sql)) {
      failures.push(`${B_MIG}: mecanismo de resolução/ranking (preferred/primary/priority/score/confidence...) proibido na N2-B.`);
    }
    // imutabilidade: função com os 6 bloqueios, sem bypass, trigger ROW
    const fnM = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${IMMUT_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!fnM) {
      failures.push(`${B_MIG}: função ${IMMUT_FN}() ausente.`);
    } else {
      for (const err of ['NEIGHBORHOOD_ALIAS_DELETE_FORBIDDEN', 'NEIGHBORHOOD_ALIAS_ID_IMMUTABLE',
                         'NEIGHBORHOOD_ALIAS_PARENT_IMMUTABLE', 'NEIGHBORHOOD_ALIAS_TEXT_IMMUTABLE',
                         'NEIGHBORHOOD_ALIAS_CREATOR_IMMUTABLE', 'NEIGHBORHOOD_ALIAS_CREATED_AT_IMMUTABLE']) {
        if (!fnM[1].includes(err)) failures.push(`${B_MIG}: imutabilidade perdeu o bloqueio ${err}.`);
      }
      if (/current_setting|session_user|current_user|pg_has_role|set_config/i.test(fnM[1])) {
        failures.push(`${B_MIG}: função de imutabilidade com bypass de sessão/GUC — proibido.`);
      }
    }
    const trgM = sql.match(new RegExp(`CREATE\\s+TRIGGER\\s+${IMMUT_TRG}([\\s\\S]*?);`, 'i'));
    if (!trgM || !/BEFORE/i.test(trgM[1]) || !/\bUPDATE\b/i.test(trgM[1]) || !/\bDELETE\b/i.test(trgM[1]) || !/FOR\s+EACH\s+ROW/i.test(trgM[1])) {
      failures.push(`${B_MIG}: trigger de imutabilidade deve ser BEFORE UPDATE OR DELETE FOR EACH ROW.`);
    }
    // HOLD: função incondicional + trigger STATEMENT + ENABLE ALWAYS
    const holdM = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${HOLD_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!holdM) {
      failures.push(`${B_MIG}: função do HOLD ${HOLD_FN}() ausente.`);
    } else {
      if (!holdM[1].includes(HOLD_ERR)) failures.push(`${B_MIG}: HOLD perdeu o erro estável ${HOLD_ERR}.`);
      if (/current_setting|session_user|current_user|pg_has_role|set_config|\bCASE\b/i.test(holdM[1])
          || /\bIF\b(?![\s\S]{0,40}TG_OP)/i.test(holdM[1].replace(/RAISE EXCEPTION[\s\S]*?;/gi, ''))) {
        // HOLD deve ser incondicional: nenhum IF além de nenhum (a função só tem RAISE+RETURN)
      }
      if (/\b(IF|CASE)\b/i.test(holdM[1])) {
        failures.push(`${B_MIG}: função do HOLD contém condicional — deve negar INCONDICIONALMENTE.`);
      }
    }
    const holdTrgM = sql.match(new RegExp(`CREATE\\s+TRIGGER\\s+${HOLD_TRG}([\\s\\S]*?);`, 'i'));
    if (!holdTrgM || !/BEFORE/i.test(holdTrgM[1]) || !/\bINSERT\b/i.test(holdTrgM[1]) || !/\bUPDATE\b/i.test(holdTrgM[1])
        || !/\bDELETE\b/i.test(holdTrgM[1]) || !/FOR\s+EACH\s+STATEMENT/i.test(holdTrgM[1])) {
      failures.push(`${B_MIG}: trigger do HOLD deve ser BEFORE I/U/D FOR EACH STATEMENT.`);
    }
    if (!new RegExp(`ALTER\\s+TABLE\\s+neighborhood_aliases\\s+ENABLE\\s+ALWAYS\\s+TRIGGER\\s+${HOLD_TRG}`, 'i').test(sql)) {
      failures.push(`${B_MIG}: HOLD de aliases sem ENABLE ALWAYS.`);
    }
    // ACL
    if (!/REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+public\.neighborhood_aliases\s+FROM\s+unificard_app/i.test(sql)) {
      failures.push(`${B_MIG}: REVOKE de DML para unificard_app ausente.`);
    }
    if (!/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.neighborhood_aliases\s+TO\s+unificard_app/i.test(sql)) {
      failures.push(`${B_MIG}: GRANT SELECT para unificard_app ausente.`);
    }
    // sem RLS, sem seed, não toca o núcleo
    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) failures.push(`${B_MIG}: RLS ligada em catálogo global — proibido.`);
    if (/INSERT\s+INTO\s+neighborhood_aliases/i.test(sql)) failures.push(`${B_MIG}: seed dentro da migration estrutural proibido.`);
    if (/INSERT\s+INTO\s+neighborhoods\b/i.test(sql)) failures.push(`${B_MIG}: INSERT no núcleo proibido.`);
    if (/DROP\s+TRIGGER[\s\S]{0,120}trg_neighborhoods_canonical_writer_hold|GRANT\s+[\w\s,]*?(INSERT|UPDATE|DELETE|ALL)[\w\s,]*?ON\s+(TABLE\s+)?(public\.)?neighborhoods\b/i.test(sql)) {
      failures.push(`${B_MIG}: a N2-B não pode tocar HOLD/ACL do núcleo.`);
    }
    // updated_at reusa a função canônica
    if (!/EXECUTE\s+FUNCTION\s+update_updated_at_column\(\)/i.test(sql)) {
      failures.push(`${B_MIG}: trigger updated_at deve reusar update_updated_at_column() (sem segunda implementação).`);
    }
  }

  // ── 2. Migrations POSTERIORES não enfraquecem a fundação de aliases ─────────────────────────
  const after = migFiles.filter((f) => f > B_MIG);
  for (const f of after) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (new RegExp(`DROP\\s+TRIGGER[\\s\\S]{0,120}(${IMMUT_TRG}|${HOLD_TRG})`, 'i').test(sql)) {
      failures.push(`[pos-N2B] ${f}: dropa trigger de aliases (imutabilidade/HOLD) — HOLD só cai junto do writer N2-E.`);
    }
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_aliases[\s\S]{0,120}(DISABLE\s+TRIGGER|ENABLE\s+REPLICA\s+TRIGGER)/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: desabilita/rebaixa trigger de neighborhood_aliases.`);
    }
    if (new RegExp(`ENABLE\\s+TRIGGER\\s+${HOLD_TRG}`, 'i').test(sql)) {
      failures.push(`[pos-N2B] ${f}: rebaixa o HOLD de aliases de ALWAYS para ordinário.`);
    }
    if (new RegExp(`DROP\\s+FUNCTION[\\s\\S]{0,80}(${IMMUT_FN}|${HOLD_FN})`, 'i').test(sql)) {
      failures.push(`[pos-N2B] ${f}: dropa função de aliases — proibido.`);
    }
    if (new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(${IMMUT_FN}|${HOLD_FN})`, 'i').test(sql)) {
      failures.push(`[pos-N2B] ${f}: redefine função de aliases — exige fatia própria + guard consciente.`);
    }
    if (/GRANT\b[\s\S]{0,80}?\b(INSERT|UPDATE|DELETE|ALL(?:\s+PRIVILEGES)?)\b[\s\S]{0,80}?\bON\b[\s\S]{0,40}?(TABLE\s+)?(public\.)?neighborhood_aliases\b[\s\S]{0,80}?\bTO\b/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: re-concede DML de neighborhood_aliases (qualquer grantee/coluna) — proibido antes do writer.`);
    }
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhood_aliases[\s\S]{0,200}(DROP\s+CONSTRAINT\s+(chk|uq|fk)_neighborhood_aliases|ADD\s+COLUMN\s+(city_id|tenant_id|status|external_code)\b|ALTER\s+COLUMN\s+\w+\s+(DROP\s+NOT\s+NULL|SET\s+DEFAULT))/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: enfraquece constraints/shape de neighborhood_aliases — proibido sem decisão própria.`);
    }
    if (/ADD\s+CONSTRAINT\s+\w*alias\w*\s+UNIQUE\s*\((?![^)]*neighborhood_id)[^)]*alias_normalized/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: UNIQUE global/por-cidade sobre alias_normalized mataria a ambiguidade — proibido.`);
    }
    if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_\w*(synonym|alias)\w*/i.test(sql) && !/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_aliases\b/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: segunda tabela de alias/synonym territorial — SSOT paralelo proibido.`);
    }
    // seed em QUALQUER migration posterior (alias ou núcleo) — seed é N3, via contrato canônico
    if (/INSERT\s+INTO\s+(public\.)?(neighborhood_aliases|neighborhoods)\b/i.test(sql)) {
      failures.push(`[pos-N2B] ${f}: INSERT/seed em neighborhood_aliases/neighborhoods dentro de migration — seed é N3, via contrato canônico, nunca SQL paralelo.`);
    }
  }

  // ── 3. Runtime: nenhum writer/resolver de aliases nasceu ────────────────────────────────────
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
  if (files.length === 0) failures.push('varredura de src vazia — FAIL (nunca PASS silencioso).');
  for (const f of files) {
    if (/INSERT\s+INTO\s+neighborhood_aliases|UPDATE\s+neighborhood_aliases|DELETE\s+FROM\s+neighborhood_aliases/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: writer de neighborhood_aliases em runtime — proibido até N2-E.`);
    }
    // resolver que escolhe vencedor a partir de alias (LIMIT 1 sobre a tabela de aliases)
    if (/FROM\s+neighborhood_aliases[\s\S]{0,240}?LIMIT\s+1/i.test(f.src)) {
      failures.push(`[runtime] ${f.rel}: resolver LIMIT 1 sobre neighborhood_aliases — colisão não escolhe vencedor (DECISION-0171 §8).`);
    }
  }

  // ── 4. wiring: os quatro guards de neighborhood no runner ───────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  for (const g of ['audit-neighborhood-freetext-writer-containment.mjs', 'audit-neighborhood-dml-hold.mjs',
                   'audit-neighborhood-core-foundation.mjs', 'audit-neighborhood-alias-foundation.mjs']) {
    if (!runner.includes(g)) failures.push(`runner: ${g} saiu do run-regression-guards.`);
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-alias-foundation]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Fundação de aliases (DECISION-0171 §8 / 0172 N2-B) ausente/enfraquecida. Alias é rótulo subordinado — nunca identidade, nunca resolvido por LIMIT 1, nunca UNIQUE global; tabela nasce inviolável até o writer N2-E.');
  process.exit(1);
}
console.log(`GATE OK [neighborhood-alias-foundation] — integridade VERSIONADA da N2-B: tabela filha única (sem city_id/tenant_id/RLS/status/external_code); alias_normalized GENERATED via normalize_name (sem normalização paralela); CHECKs whitespace robustos; source_kind = vocabulário do núcleo (3 valores); FKs RESTRICT; UNIQUE PISO (neighborhood_id, alias_normalized) sem UNIQUE global (ambiguidade entre bairros preservada); sem preferred/primary/score/resolver; imutabilidade (DELETE/id/pai/texto/creator/created_at) sem bypass; HOLD I/U/D STATEMENT ENABLE ALWAYS + ACL SELECT-only sem regrant posterior; zero writer/resolver LIMIT-1 em runtime; zero seed/sucessão/candidato; 4 guards no runner. (Estado vivo = introspecção.)`);
