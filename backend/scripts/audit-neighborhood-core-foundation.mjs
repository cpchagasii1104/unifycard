#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-A · FUNDAÇÃO DO NÚCLEO neighborhoods.
// DECISION-0171 (identidade canônica) + DECISION-0172 P4 (proveniência híbrida) e P6 (vigência).
// Pergunta própria: "a fundação aditiva do núcleo está íntegra e não foi enfraquecida/adulterada?"
// (texto→identidade = guard irmão freetext; HOLD físico = guard irmão dml-hold. Não misturar.)
//
// PROMESSA HONESTA: este guard prova integridade VERSIONADA (migrations/arquivos do repo). Ele NÃO
// prova o estado vivo do banco — isso é papel da introspecção operacional e dos fail-closed da
// própria migration. Contenção completa = migration fail-closed + guards + introspecção viva.
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heurística textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const CORE_MIG = '20260711110000_neighborhoods_core_foundation.sql';
// N2-A.1 (remediação da ressalva Yala): CHECKs nonempty endurecidos (~ '[^[:space:]]') e
// REDEFINIÇÃO AUTORIZADA da função de imutabilidade (mesma lógica; só o texto do DELETE).
// Esta é a definição canônica VIGENTE — redefinições em migrations POSTERIORES a ela são proibidas.
const A1_MIG = '20260711120000_neighborhoods_core_hardening.sql';
// N2-B (ajuste consciente deste guard): a casa canônica de ALIASES nasce nesta migration —
// a proibição genérica de tabelas neighborhood_* excetua NOMINALMENTE esta criação; a integridade
// da tabela de aliases é governada pelo guard próprio audit-neighborhood-alias-foundation.mjs.
const B_MIG = '20260711130000_neighborhood_aliases_foundation.sql';
// N2-C (ajuste consciente): casa canônica de SUCESSÃO nasce aqui; excecao nominal ao bloqueio
// generico de tabelas neighborhood_* (integridade governada pelo guard audit-neighborhood-succession-foundation).
const C_MIG = '20260711150000_neighborhood_succession_foundation.sql';
const HOLD_MIG = '20260711100000_neighborhoods_dml_hold.sql';
const IMMUT_FN = 'enforce_neighborhood_identity_immutability';
const IMMUT_TRG = 'trg_neighborhood_identity_immutability';

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (migFiles.length === 0) throw new Error('zero migrations lidas');

  // ── 1. Migration N2-A presente e íntegra ────────────────────────────────────────────────────
  if (!migFiles.includes(CORE_MIG)) {
    failures.push(`migration da fundação ausente: ${CORE_MIG}`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, CORE_MIG), 'utf-8'));

    // (2) catálogo precisa nascer/continuar vazio (fail-closed pré e pós)
    if (!/count\(\*\)\s+FROM\s+neighborhoods\)\s*<>\s*0/i.test(sql) || !(sql.match(/count\(\*\)\s+FROM\s+neighborhoods\)\s*<>\s*0/gi) || []).length >= 2) {
      if (((sql.match(/count\(\*\)\s+FROM\s+neighborhoods\)\s*<>\s*0/gi)) || []).length < 2) {
        failures.push(`${CORE_MIG}: fail-closed de catálogo VAZIO (pré e pós) ausente/incompleto.`);
      }
    }

    // (3)(4)(5) oito colunas NOT NULL sem DEFAULT (o pós-ALTER da migration verifica shape vivo;
    // aqui verificamos o DDL versionado)
    const COLS = ['source_kind', 'source_reference', 'evidence', 'created_by_actor_id',
                  'approved_by_actor_id', 'approved_at', 'valid_from_at', 'valid_until_at'];
    for (const c of COLS) {
      if (!new RegExp(`ADD\\s+COLUMN\\s+${c}\\b`, 'i').test(sql)) {
        failures.push(`${CORE_MIG}: coluna ${c} não é adicionada.`);
      }
    }
    for (const c of COLS.filter((c) => c !== 'valid_until_at')) {
      if (!new RegExp(`ADD\\s+COLUMN\\s+${c}\\s+\\w[\\w ]*?\\s+NOT\\s+NULL`, 'i').test(sql)) {
        failures.push(`${CORE_MIG}: coluna ${c} deve ser NOT NULL.`);
      }
    }
    // nenhuma das 8 pode ter DEFAULT
    for (const c of COLS) {
      if (new RegExp(`ADD\\s+COLUMN\\s+${c}\\b[^,;]*?\\bDEFAULT\\b`, 'i').test(sql)) {
        failures.push(`${CORE_MIG}: coluna ${c} ganhou DEFAULT — proveniência/aprovação/vigência não podem ser inventadas (DECISION-0172).`);
      }
    }

    // (6) vocabulário fechado de source_kind: exatamente os 3 valores
    const skMatch = sql.match(/chk_neighborhoods_source_kind\s+CHECK\s*\(source_kind\s+IN\s*\(([^)]*)\)\)/i);
    if (!skMatch) {
      failures.push(`${CORE_MIG}: CHECK chk_neighborhoods_source_kind ausente.`);
    } else {
      const vals = (skMatch[1].match(/'[^']*'/g) || []).map((v) => v.slice(1, -1)).sort();
      const expected = ['government_official', 'internal_curation', 'public_documentary'];
      if (JSON.stringify(vals) !== JSON.stringify(expected)) {
        failures.push(`${CORE_MIG}: vocabulário de source_kind divergente do canônico [${expected.join(', ')}] — encontrado [${vals.join(', ')}].`);
      }
    }

    // (7) nonempty CHECKs nascem na CORE_MIG (forma histórica btrim) — a forma VIGENTE endurecida
    // (~ '[^[:space:]]') é exigida na A1_MIG, verificada na seção 1b abaixo.
    if (!/chk_neighborhoods_source_reference_nonempty/i.test(sql)) {
      failures.push(`${CORE_MIG}: CHECK nonempty de source_reference ausente.`);
    }
    if (!/chk_neighborhoods_evidence_nonempty/i.test(sql)) {
      failures.push(`${CORE_MIG}: CHECK nonempty de evidence ausente.`);
    }

    // (8) FKs reais para actors com RESTRICT
    for (const fk of ['fk_neighborhoods_created_by_actor', 'fk_neighborhoods_approved_by_actor']) {
      if (!new RegExp(`${fk}[\\s\\S]{0,120}REFERENCES\\s+actors\\s*\\(id\\)\\s+ON\\s+DELETE\\s+RESTRICT`, 'i').test(sql)) {
        failures.push(`${CORE_MIG}: FK ${fk} ausente ou sem REFERENCES actors(id) ON DELETE RESTRICT.`);
      }
    }

    // (9) CHECK temporal
    if (!/chk_neighborhoods_validity_interval[\s\S]{0,120}valid_until_at\s+IS\s+NULL\s+OR\s+valid_until_at\s*>\s*valid_from_at/i.test(sql)) {
      failures.push(`${CORE_MIG}: CHECK de intervalo de vigência ausente (until IS NULL OR until > from).`);
    }

    // (10)-(14) função/trigger de imutabilidade com os 5 bloqueios
    const fnMatch = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${IMMUT_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!fnMatch) {
      failures.push(`${CORE_MIG}: função ${IMMUT_FN}() ausente.`);
    } else {
      const body = fnMatch[1];
      for (const err of ['NEIGHBORHOOD_IDENTITY_DELETE_FORBIDDEN', 'NEIGHBORHOOD_IDENTITY_ID_IMMUTABLE',
                         'NEIGHBORHOOD_IDENTITY_CITY_IMMUTABLE', 'NEIGHBORHOOD_IDENTITY_CREATOR_IMMUTABLE',
                         'NEIGHBORHOOD_IDENTITY_CREATED_AT_IMMUTABLE']) {
        if (!body.includes(err)) failures.push(`${CORE_MIG}: função de imutabilidade perdeu o bloqueio ${err}.`);
      }
      // (15) sem bypass
      if (/current_setting|session_user|current_user|pg_has_role|set_config/i.test(body)) {
        failures.push(`${CORE_MIG}: função de imutabilidade contém consulta de sessão/GUC — bypass proibido.`);
      }
    }
    const trgMatch = sql.match(new RegExp(`CREATE\\s+TRIGGER\\s+${IMMUT_TRG}([\\s\\S]*?);`, 'i'));
    if (!trgMatch) {
      failures.push(`${CORE_MIG}: trigger ${IMMUT_TRG} ausente.`);
    } else {
      const trg = trgMatch[1];
      if (!/BEFORE/i.test(trg) || !/\bUPDATE\b/i.test(trg) || !/\bDELETE\b/i.test(trg)) {
        failures.push(`${CORE_MIG}: trigger de imutabilidade deve ser BEFORE UPDATE OR DELETE.`);
      }
      if (!/FOR\s+EACH\s+ROW/i.test(trg)) {
        failures.push(`${CORE_MIG}: trigger de imutabilidade deve ser FOR EACH ROW (compara OLD/NEW).`);
      }
      if (!new RegExp(`EXECUTE\\s+FUNCTION\\s+${IMMUT_FN}`, 'i').test(trg)) {
        failures.push(`${CORE_MIG}: trigger de imutabilidade não chama ${IMMUT_FN}().`);
      }
    }

    // (16)(17) N2-A não mexe no HOLD nem na ACL
    if (/DROP\s+TRIGGER[\s\S]{0,120}trg_neighborhoods_canonical_writer_hold|DISABLE\s+TRIGGER|GRANT\s+[\w\s,()]*?(INSERT|UPDATE|DELETE|ALL)[\w\s,()]*?ON\s+(TABLE\s+)?(public\.)?neighborhoods/i.test(sql)) {
      failures.push(`${CORE_MIG}: a migration N2-A não pode dropar/desabilitar o HOLD nem regrantar DML.`);
    }

    // (18)(19)(20) colunas proibidas não nascem na N2-A
    for (const bad of ['tenant_id', 'external_code']) {
      if (new RegExp(`ADD\\s+COLUMN\\s+${bad}\\b`, 'i').test(sql)) {
        failures.push(`${CORE_MIG}: coluna proibida ${bad} adicionada.`);
      }
    }
    if (/ADD\s+COLUMN\s+status\s/i.test(sql)) {
      failures.push(`${CORE_MIG}: coluna 'status' genérica adicionada (07_NOMENCLATURA §3.4 + DECISION-0172 P6 vetam).`);
    }
    // (24) sem seed/INSERT
    if (/INSERT\s+INTO\s+neighborhoods/i.test(sql)) {
      failures.push(`${CORE_MIG}: INSERT/seed dentro da migration estrutural é proibido (seed = N3, via contrato canônico).`);
    }
    // RLS não pode ser ligada
    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) {
      failures.push(`${CORE_MIG}: RLS ligada em catálogo global — proibido (padrão Location Core).`);
    }
  }

  // ── 1b. Migration N2-A.1 presente e íntegra (CHECKs endurecidos + redefinição autorizada) ────
  if (!migFiles.includes(A1_MIG)) {
    failures.push(`migration de saneamento ausente: ${A1_MIG} (ressalvas Yala R1/N2 exigem CHECKs endurecidos + mensagem de extinção corrigida).`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, A1_MIG), 'utf-8'));
    // CHECKs VIGENTES endurecidos: mesmos nomes canônicos + [^[:space:]]
    for (const [con, col] of [['chk_neighborhoods_source_reference_nonempty', 'source_reference'],
                              ['chk_neighborhoods_evidence_nonempty', 'evidence']]) {
      if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${con}\\s+CHECK\\s*\\(${col}\\s*~\\s*'\\[\\^\\[:space:\\]\\]'\\)`, 'i').test(sql)) {
        failures.push(`${A1_MIG}: CHECK endurecido ${con} ausente ou sem a forma canônica ${col} ~ '[^[:space:]]' (btrim sem 2º argumento aceita tab/newline-only — ressalva Yala R1).`);
      }
    }
    // redefinição autorizada: os 5 bloqueios permanecem, sem bypass; mensagem de extinção corrigida
    const fnM = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${IMMUT_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!fnM) {
      failures.push(`${A1_MIG}: redefinição autorizada da função de imutabilidade ausente.`);
    } else {
      const body = fnM[1];
      for (const err of ['NEIGHBORHOOD_IDENTITY_DELETE_FORBIDDEN', 'NEIGHBORHOOD_IDENTITY_ID_IMMUTABLE',
                         'NEIGHBORHOOD_IDENTITY_CITY_IMMUTABLE', 'NEIGHBORHOOD_IDENTITY_CREATOR_IMMUTABLE',
                         'NEIGHBORHOOD_IDENTITY_CREATED_AT_IMMUTABLE']) {
        if (!body.includes(err)) failures.push(`${A1_MIG}: redefinição perdeu o bloqueio ${err}.`);
      }
      if (/current_setting|session_user|current_user|pg_has_role|set_config/i.test(body)) {
        failures.push(`${A1_MIG}: redefinição ganhou bypass de sessão/GUC — proibido.`);
      }
      if (/desativacao \+ evento de sucessao/i.test(body)) {
        failures.push(`${A1_MIG}: mensagem de extinção continua tornando sucessão obrigatória (ressalva Yala N2).`);
      }
    }
  }

  // ── 2. Migrations POSTERIORES não enfraquecem a fundação ────────────────────────────────────
  // (posteriores à CORE_MIG; a A1_MIG é a redefinição AUTORIZADA e é excetuada nominalmente)
  const after = migFiles.filter((f) => f > CORE_MIG);
  for (const f of after) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (new RegExp(`DROP\\s+TRIGGER[\\s\\S]{0,120}${IMMUT_TRG}`, 'i').test(sql)) {
      failures.push(`[pos-N2A] ${f}: dropa o trigger de imutabilidade da identidade — proibido (imutabilidade é PERMANENTE).`);
    }
    // rebaixamento/desligamento do trigger permanente (ressalva Yala R2): DISABLE nomeado/ALL/USER
    // e ENABLE REPLICA. ENABLE ALWAYS NÃO é bloqueado (seria fortalecimento, não enfraquecimento).
    if (/ALTER\s+TABLE\s+(?:public\.)?neighborhoods[\s\S]{0,120}DISABLE\s+TRIGGER\s+(ALL|USER|trg_neighborhood_identity_immutability)/i.test(sql)) {
      failures.push(`[pos-N2A] ${f}: desabilita o trigger de imutabilidade (DISABLE nomeado/ALL/USER) — neutralização silenciosa proibida (ressalva Yala R2).`);
    }
    if (new RegExp(`ENABLE\\s+REPLICA\\s+TRIGGER\\s+${IMMUT_TRG}`, 'i').test(sql)) {
      failures.push(`[pos-N2A] ${f}: rebaixa o trigger de imutabilidade para ENABLE REPLICA — deixaria de disparar no fluxo normal (ressalva Yala R2).`);
    }
    if (new RegExp(`DROP\\s+FUNCTION[\\s\\S]{0,80}${IMMUT_FN}`, 'i').test(sql)) {
      failures.push(`[pos-N2A] ${f}: dropa a função de imutabilidade (com/sem assinatura/CASCADE) — proibido.`);
    }
    if (f !== A1_MIG && new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${IMMUT_FN}`, 'i').test(sql)) {
      failures.push(`[pos-N2A] ${f}: redefine a função de imutabilidade FORA da redefinição autorizada (${A1_MIG}) — exige fatia própria + guard consciente.`);
    }
    if (f !== A1_MIG && /ALTER\s+TABLE\s+(?:public\.)?neighborhoods[\s\S]{0,200}(DROP\s+CONSTRAINT\s+chk_neighborhoods_|ALTER\s+COLUMN\s+(source_kind|source_reference|evidence|created_by_actor_id|approved_by_actor_id|approved_at|valid_from_at)\s+DROP\s+NOT\s+NULL|ALTER\s+COLUMN\s+\w+\s+SET\s+DEFAULT)/i.test(sql)) {
      failures.push(`[pos-N2A] ${f}: enfraquece constraint/nullability/default da fundação — proibido sem decisão própria.`);
    }
    // recriação FRACA dos CHECKs nonempty em qualquer migration posterior (inclusive regressão a btrim)
    if (new RegExp(`ADD\\s+CONSTRAINT\\s+chk_neighborhoods_(source_reference|evidence)_nonempty\\s+CHECK\\s*\\((?![^)]*\\[\\^\\[:space:\\]\\])`, 'i').test(sql)) {
      failures.push(`[pos-N2A] ${f}: recria CHECK nonempty com forma FRACA (sem [^[:space:]]) — regressão à ressalva Yala R1 proibida.`);
    }
    if (/ADD\s+COLUMN\s+(tenant_id|external_code|status)\b[\s\S]{0,40}/i.test(sql) && /neighborhoods/i.test(sql)
        && /ALTER\s+TABLE\s+(?:public\.)?neighborhoods[\s\S]{0,120}ADD\s+COLUMN\s+(tenant_id|external_code|status)\b/i.test(sql)) {
      failures.push(`[pos-N2A] ${f}: adiciona coluna proibida (tenant_id/external_code/status) em neighborhoods.`);
    }
    // (21) alias/sucessão/candidato não nascem antes das fatias próprias — EXCETO as casas canônicas
    // nominais: B_MIG (aliases, N2-B) e C_MIG (sucessão, N2-C). Cada uma tem GO próprio + guard próprio
    // (alias-foundation / succession-foundation). Candidatos seguem proibidos (fatia futura).
    if (f !== B_MIG && f !== C_MIG && /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?neighborhood_(aliases|success\w*|candidates)\b/i.test(sql)) {
      failures.push(`[pos-N2A] ${f}: cria tabela de alias/sucessão/candidato FORA da casa canônica autorizada — fatias N2-B/N2-C com GO próprio.`);
    }
  }

  // ── 2b. (fechamento da observação do selo N2-A) redefinição ÚNICA dentro da A1 ──────────────
  // A A1 auditada contém exatamente UMA CREATE OR REPLACE da função de imutabilidade; uma segunda
  // ocorrência MATERIAL (comment-stripped) dentro do próprio arquivo histórico = FAIL.
  if (migFiles.includes(A1_MIG)) {
    const a1sql = stripSql(readFileSync(join(MIG, A1_MIG), 'utf-8'));
    const redefs = (a1sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${IMMUT_FN}`, 'gi')) || []).length;
    if (redefs !== 1) {
      failures.push(`${A1_MIG}: esperada exatamente UMA redefinição autorizada de ${IMMUT_FN} — encontradas ${redefs} (segunda redefinição no mesmo arquivo histórico é adulteração forward-only).`);
    }
  }

  // ── 3. (22)(23) writer não nasceu; CANONICAL_WRITER_ALLOW vazia ─────────────────────────────
  const ftGuard = stripTs(readFileSync(join(ROOT, 'scripts', 'audit-neighborhood-freetext-writer-containment.mjs'), 'utf-8'));
  const allowMatch = ftGuard.match(/CANONICAL_WRITER_ALLOW\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!allowMatch) {
    failures.push('guard anti-texto: CANONICAL_WRITER_ALLOW não encontrada.');
  } else if (/['"`]/.test(allowMatch[1])) {
    failures.push('CANONICAL_WRITER_ALLOW deixou de estar vazia — writer é N2-E com decisão + allow por-check.');
  }

  // ── 4. wiring: os três guards de neighborhood permanecem no runner ──────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  for (const g of ['audit-neighborhood-freetext-writer-containment.mjs', 'audit-neighborhood-dml-hold.mjs',
                   'audit-neighborhood-core-foundation.mjs']) {
    if (!runner.includes(g)) failures.push(`runner: ${g} saiu do run-regression-guards.`);
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-core-foundation]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Fundação do núcleo neighborhoods (DECISION-0171/0172 N2-A) ausente/enfraquecida. Proveniência sem default, vocabulário fechado, FKs de actor RESTRICT, vigência e imutabilidade permanente são invariantes — alterações exigem decisão própria + guard consciente.');
  process.exit(1);
}
console.log(`GATE OK [neighborhood-core-foundation] — integridade VERSIONADA da fundação N2-A(+A.1): 8 colunas NOT-NULL-sem-DEFAULT (proveniência P4 + autoria/aprovação + vigência P6); source_kind fechado em 3 valores; CHECKs de conteúdo endurecidos (~ '[^[:space:]]' — tab/newline-only rejeitados); FKs actors(id) RESTRICT; CHECK temporal; imutabilidade permanente (DELETE/id/city/creator/created_at) sem bypass, com redefinição autorizada única na A1 e proteção contra DROP/DISABLE(ALL|USER)/ENABLE REPLICA/redefinições posteriores; HOLD N2-pre e ACL não tocados; sem tenant_id/external_code/status; sem alias/sucessão/candidato/writer/seed; CANONICAL_WRITER_ALLOW vazia; 3 guards no runner. (Estado vivo = introspecção; DECISION-0172.)`);
