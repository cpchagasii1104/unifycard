#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-pre · HOLD FÍSICO DE DML EM neighborhoods.
// DECISION-0172 P5 (vinculante): HOLD físico = trigger + REVOKE + guard. Este guard responde UMA
// pergunta: "o HOLD físico está materialmente presente e não foi revivido/enfraquecido?"
// (a pergunta texto→identidade continua no guard irmão audit-neighborhood-freetext-writer-containment).
//
// MORDE se: a migration do HOLD sumir/enfraquecer (função sem erro estável, bypass por GUC, trigger
// sem I/U/D, FOR EACH ROW, sem ENABLE ALWAYS, REVOKE ausente ou revogando SELECT) OU se QUALQUER
// migration POSTERIOR ao HOLD dropar/desabilitar/trocar o trigger/função, re-conceder DML de
// neighborhoods a unificard_app (específico ou por GRANT amplo), OU se CANONICAL_WRITER_ALLOW
// deixar de estar vazia, OU se os dois guards saírem do runner.
// ORDEM TEMPORAL COMPREENDIDA: o grant histórico amplo (20260620120000, ANTERIOR ao HOLD) é
// legítimo — o REVOKE específico prevalece; só reaberturas POSTERIORES falham.
// Falha de leitura/parsing = FAIL (nunca PASS silencioso). Heurística textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];

const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const HOLD_MIG = '20260711100000_neighborhoods_dml_hold.sql';
const HOLD_FN = 'enforce_neighborhoods_canonical_writer_hold';
const HOLD_TRG = 'trg_neighborhoods_canonical_writer_hold';
const HOLD_ERR = 'NEIGHBORHOOD_CANONICAL_WRITER_HOLD';

let migFiles = [];
try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  if (migFiles.length === 0) throw new Error('zero migrations lidas');

  // ── 1. Migration do HOLD presente e íntegra ─────────────────────────────────────────────────
  if (!migFiles.includes(HOLD_MIG)) {
    failures.push(`migration do HOLD ausente: ${HOLD_MIG}`);
  } else {
    const raw = readFileSync(join(MIG, HOLD_MIG), 'utf-8');
    const sql = stripSql(raw);

    // função presente, com erro estável
    const fnMatch = sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${HOLD_FN}\\s*\\(\\s*\\)([\\s\\S]*?)\\$\\$;`, 'i'));
    if (!fnMatch) {
      failures.push(`${HOLD_MIG}: função ${HOLD_FN}() ausente.`);
    } else {
      const fnBody = fnMatch[1];
      if (!new RegExp(`RAISE\\s+EXCEPTION[\\s\\S]{0,200}${HOLD_ERR}`, 'i').test(fnBody)) {
        failures.push(`${HOLD_MIG}: função do HOLD não lança o erro estável ${HOLD_ERR}.`);
      }
      // sem bypass: nenhum current_setting/GUC/checagem de role/session na função
      if (/current_setting|session_user|current_user|pg_has_role|set_config/i.test(fnBody)) {
        failures.push(`${HOLD_MIG}: função do HOLD contém consulta de sessão/GUC — bypass proibido (DECISION-0172 P5).`);
      }
    }

    // trigger: BEFORE + I/U/D (qualquer ordem) + FOR EACH STATEMENT + função correta
    const trgMatch = sql.match(new RegExp(`CREATE\\s+TRIGGER\\s+${HOLD_TRG}([\\s\\S]*?);`, 'i'));
    if (!trgMatch) {
      failures.push(`${HOLD_MIG}: trigger ${HOLD_TRG} ausente.`);
    } else {
      const trg = trgMatch[1];
      if (!/BEFORE/i.test(trg)) failures.push(`${HOLD_MIG}: trigger do HOLD não é BEFORE.`);
      for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
        if (!new RegExp(`\\b${op}\\b`, 'i').test(trg)) {
          failures.push(`${HOLD_MIG}: trigger do HOLD não cobre ${op}.`);
        }
      }
      if (!/FOR\s+EACH\s+STATEMENT/i.test(trg)) {
        failures.push(`${HOLD_MIG}: trigger do HOLD deve ser FOR EACH STATEMENT (tabela vazia — HOLD bloqueia a TENTATIVA, não só a mutação efetiva).`);
      }
      if (!new RegExp(`EXECUTE\\s+FUNCTION\\s+${HOLD_FN}`, 'i').test(trg)) {
        failures.push(`${HOLD_MIG}: trigger do HOLD não chama ${HOLD_FN}().`);
      }
    }

    // ENABLE ALWAYS (imune a session_replication_role)
    if (!new RegExp(`ALTER\\s+TABLE\\s+neighborhoods\\s+ENABLE\\s+ALWAYS\\s+TRIGGER\\s+${HOLD_TRG}`, 'i').test(sql)) {
      failures.push(`${HOLD_MIG}: trigger do HOLD sem ENABLE ALWAYS — bypass por session_replication_role ficaria aberto.`);
    }

    // REVOKE de I/U/D para unificard_app, sem tocar SELECT
    const revokeMatch = sql.match(/REVOKE\s+([\w\s,]+?)\s+ON\s+TABLE\s+(?:public\.)?neighborhoods\s+FROM\s+unificard_app/i);
    if (!revokeMatch) {
      failures.push(`${HOLD_MIG}: REVOKE de DML em neighborhoods para unificard_app ausente.`);
    } else {
      const ops = revokeMatch[1].toUpperCase();
      for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
        if (!ops.includes(op)) failures.push(`${HOLD_MIG}: REVOKE não inclui ${op}.`);
      }
      if (ops.includes('SELECT') || ops.includes('ALL')) {
        failures.push(`${HOLD_MIG}: REVOKE não pode revogar SELECT/ALL — readers legítimos devem continuar vivos.`);
      }
    }
  }

  // ── 2. Nenhuma migration POSTERIOR revive/enfraquece o HOLD ─────────────────────────────────
  const after = migFiles.filter((f) => f > HOLD_MIG);
  for (const f of after) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (new RegExp(`DROP\\s+TRIGGER[\\s\\S]{0,120}${HOLD_TRG}`, 'i').test(sql)) {
      failures.push(`[pos-HOLD] ${f}: dropa o trigger do HOLD — substituição só na fatia do writer canônico (N2-E) com alteração CONSCIENTE deste guard.`);
    }
    if (new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?neighborhoods[\\s\\S]{0,120}DISABLE\\s+TRIGGER`, 'i').test(sql)) {
      failures.push(`[pos-HOLD] ${f}: desabilita trigger de neighborhoods.`);
    }
    // rebaixamento de ALWAYS para ordinário (ENABLE TRIGGER sem ALWAYS/REPLICA sobre o trigger do HOLD)
    if (new RegExp(`ENABLE\\s+TRIGGER\\s+${HOLD_TRG}`, 'i').test(sql)) {
      failures.push(`[pos-HOLD] ${f}: rebaixa o trigger do HOLD de ENABLE ALWAYS para ordinário.`);
    }
    if (new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${HOLD_FN}`, 'i').test(sql)) {
      failures.push(`[pos-HOLD] ${f}: redefine a função do HOLD — troca de função exige fatia do writer + guard consciente.`);
    }
    // re-concessão de DML: específica de neighborhoods OU ampla (ALL TABLES) para unificard_app
    if (/GRANT\s+[\w\s,]*?(INSERT|UPDATE|DELETE|ALL)[\w\s,]*?\s+ON\s+(TABLE\s+)?(public\.)?neighborhoods\b[\s\S]{0,80}?TO\s+unificard_app/i.test(sql)) {
      failures.push(`[pos-HOLD] ${f}: re-concede DML de neighborhoods a unificard_app — reabertura proibida antes do writer canônico.`);
    }
    if (/GRANT\s+[\w\s,]*?(INSERT|UPDATE|DELETE|ALL)[\w\s,]*?ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+unificard_app/i.test(sql)) {
      failures.push(`[pos-HOLD] ${f}: GRANT amplo em ALL TABLES pós-HOLD reintroduz DML efetivo em neighborhoods — precisa excetuar ou re-aplicar o REVOKE na mesma migration.`);
    }
  }
} catch (e) {
  failures.push(`falha de leitura/parsing das migrations: ${e.message} — FAIL (nunca PASS silencioso).`);
}

// ── 3. CANONICAL_WRITER_ALLOW continua vazia (anti-texto universal preservado) ────────────────
try {
  const guardPath = join(ROOT, 'scripts', 'audit-neighborhood-freetext-writer-containment.mjs');
  const gsrc = stripTs(readFileSync(guardPath, 'utf-8'));
  const allowMatch = gsrc.match(/CANONICAL_WRITER_ALLOW\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!allowMatch) {
    failures.push('guard anti-texto: CANONICAL_WRITER_ALLOW não encontrada — estrutura mudou sem atualizar este guard.');
  } else if (/['"`]/.test(allowMatch[1])) {
    failures.push('CANONICAL_WRITER_ALLOW deixou de estar VAZIA — liberar writer exige fatia N2-E com decisão + modelo arquivo+check (allowlist por arquivo foi REJEITADA na DECISION-0172).');
  }
} catch (e) {
  failures.push(`falha ao ler guard anti-texto: ${e.message} — FAIL.`);
}

// ── 4. Wiring: ambos os guards permanecem no runner ───────────────────────────────────────────
try {
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-neighborhood-freetext-writer-containment.mjs')) {
    failures.push('runner: guard anti-texto saiu do run-regression-guards.');
  }
  if (!runner.includes('audit-neighborhood-dml-hold.mjs')) {
    failures.push('runner: ESTE guard (dml-hold) saiu do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha ao ler runner: ${e.message} — FAIL.`);
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-dml-hold]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ HOLD físico de neighborhoods (DECISION-0172 P5) ausente/enfraquecido/revivido. O catálogo permanece read-only até o writer canônico N2-E (authority N2-D + guard consciente + auditoria).');
  process.exit(1);
}
console.log(`GATE OK [neighborhood-dml-hold] — migration do HOLD íntegra (função ${HOLD_FN} com erro estável e sem bypass; trigger ${HOLD_TRG} BEFORE I/U/D FOR EACH STATEMENT ENABLE ALWAYS; REVOKE I/U/D de unificard_app com SELECT preservado); nenhuma migration posterior reabre DML/dropa/desabilita/troca; CANONICAL_WRITER_ALLOW vazia; ambos os guards no runner.`);
