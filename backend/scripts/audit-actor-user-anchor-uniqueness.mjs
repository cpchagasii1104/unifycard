#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2-R1 · UNICIDADE CANONICA DO ACTOR user.
// Fecha a R1 da auditoria Yala da N2-D.2 (responsible_human_actor_id via findByUserId + LIMIT 1 sobre
// relacao NAO-unica). Pergunta propria: "existe unicidade FISICA de actor_type='user' por (tenant_id,
// user_id), findByUserId NAO escolhe arbitrariamente entre 2+, e os dois writers sao idempotentes sob
// corrida (ON CONFLICT DO NOTHING no alvo exato + reselect + conferencia de identidade)?"
//
// PROMESSA HONESTA: integridade VERSIONADA (migration/arquivos). Estado vivo = introspecao.
// Falha de leitura/parsing = FAIL, nunca PASS silencioso. Heuristica textual comment-stripped.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const R1_MIG = '20260711180000_actor_user_anchor_uniqueness.sql';
const REPO = join(SRC, 'modules/social/actor.repository.ts');

// ── Extração BRACE-AWARE (N2-D.2-R1-FIX-R4): balanceia `{}` ignorando strings '..'/".."/`..` (templates
// tratados como opacos — as interpolações `${}` do SQL não devem desbalancear a contagem). A partir de
// `fromIdx`, acha o primeiro `{` e devolve o bloco `{...}` balanceado. null se não fechar. ──────────────
function extractBalancedBlock(code, fromIdx) {
  const open = code.indexOf('{', fromIdx);
  if (open < 0) return null;
  let depth = 0, i = open;
  while (i < code.length) {
    const c = code[i];
    if (c === "'" || c === '"') { const q = c; i++; while (i < code.length && code[i] !== q) { if (code[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') { i++; while (i < code.length && code[i] !== '`') { if (code[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { start: open, end: i, body: code.slice(open, i + 1) }; }
    i++;
  }
  return null;
}

// Corpo NOMINAL de um método async, brace-aware. null se ausente/inextraível (o chamador falha o guard).
function extractMethodBody(code, methodName) {
  const sig = new RegExp(`async\\s+${methodName}\\s*\\(`).exec(code);
  if (!sig) return null;
  const blk = extractBalancedBlock(code, sig.index);
  return blk ? blk.body : null;
}

// Bloco `if (<cond>) { ... }` brace-aware dentro de um corpo. Retorna {body, end} do bloco ou null.
function extractIfBlock(body, condRe) {
  const m = condRe.exec(body);
  if (!m) return null;
  const blk = extractBalancedBlock(body, m.index);
  return blk;
}

// PROVA BRANCH-LOCAL (N2-D.2-R1-FIX-R4): dentro de `window`, TODO `return <Actor>` (exceto `return null`)
// deve ser precedido, NA MESMA janela, por `assertCanonicalUserActorAnchor(<mesma expr>, ...)`. Chamadas de
// helper em OUTRO ramo não contam (a janela é local). Fecha a evasão composta (remover da corrida +
// duplicar no existing). `label` identifica o ramo nas mensagens; `pushFail` acumula falhas.
function proveBranchValidatesReturnedActor(window, label, pushFail) {
  if (!window) { pushFail(`${label}: janela do ramo não pôde ser extraída (inspeção ambígua).`); return; }
  const returns = [...window.matchAll(/return\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\s*\d+\s*\])*)\s*(?:as\s+\w+\s*)?;/g)];
  const actorReturns = returns.filter((r) => r[1] !== 'null');
  if (actorReturns.length === 0) { pushFail(`${label}: nenhum return de Actor na janela (ramo não identificado).`); return; }
  for (const ret of actorReturns) {
    const retVar = ret[1];
    const esc = retVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // helper aplicado à MESMA expressão retornada, com o primeiro argumento = retVar (aceita `as Tipo`).
    const helperRe = new RegExp(`assertCanonicalUserActorAnchor\\s*\\(\\s*${esc}\\s*(?:as\\s+\\w+\\s*)?,`);
    const hm = helperRe.exec(window);
    if (!hm) {
      pushFail(`${label}: return de '${retVar}' SEM assertCanonicalUserActorAnchor(${retVar}, ...) na mesma janela (validação branch-local ausente).`);
    } else if (hm.index > ret.index) {
      pushFail(`${label}: assertCanonicalUserActorAnchor(${retVar}) ocorre DEPOIS do return (inalcançável/tarde demais).`);
    }
  }
}

try {
  const MIG = join(ROOT, 'migrations');
  if (!existsSync(MIG)) throw new Error('diretório migrations ausente');
  const migFiles = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();

  // ── 1. Migration R1 presente e íntegra ──────────────────────────────────────────────────────
  if (!migFiles.includes(R1_MIG)) {
    failures.push(`migration da unicidade de ancora ausente: ${R1_MIG}`);
  } else {
    const sql = stripSql(readFileSync(join(MIG, R1_MIG), 'utf-8'));
    // UNIQUE parcial exato
    const idx = sql.match(/CREATE\s+UNIQUE\s+INDEX\s+uq_actors_user\s+ON\s+actors\s*\(([^)]*)\)\s*WHERE\s+([^;]*);/i);
    if (!idx) {
      failures.push(`${R1_MIG}: CREATE UNIQUE INDEX uq_actors_user ausente/divergente.`);
    } else {
      if (idx[1].replace(/\s+/g, '') !== 'tenant_id,user_id') {
        failures.push(`${R1_MIG}: colunas do índice divergentes (esperado tenant_id, user_id; achado ${idx[1]}).`);
      }
      const pred = idx[2];
      if (!/actor_type\s*=\s*'user'/i.test(pred)) failures.push(`${R1_MIG}: predicate sem actor_type='user'.`);
      if (!/tenant_id\s+IS\s+NOT\s+NULL/i.test(pred)) failures.push(`${R1_MIG}: predicate sem tenant_id IS NOT NULL.`);
      if (!/user_id\s+IS\s+NOT\s+NULL/i.test(pred)) failures.push(`${R1_MIG}: predicate sem user_id IS NOT NULL (user_id NULL deve ficar fora da unicidade).`);
      // NAO ampliar alem de actor_type=user; NAO usar global_user_id como ancora
      if (/actor_human|person|'page'|'group'|'channel'|company/i.test(pred)) {
        failures.push(`${R1_MIG}: predicate amplia além de actor_type='user'.`);
      }
      if (/global_user_id/i.test(idx[1] + pred)) failures.push(`${R1_MIG}: usa global_user_id na âncora — a âncora é (tenant_id, user_id).`);
    }
    // NAO unicidade global só por user_id
    if (/CREATE\s+UNIQUE\s+INDEX[\s\S]{0,80}ON\s+actors\s*\(\s*user_id\s*\)/i.test(sql)) {
      failures.push(`${R1_MIG}: unicidade global só por user_id — proibido (mesmo user em tenants distintos é permitido).`);
    }
    // NAO remove o indice historico, NAO altera PK/RLS/policies/triggers/owner/ACL, NAO limpa dados
    if (/DROP\s+INDEX[\s\S]{0,40}idx_actors_user_id/i.test(sql)) failures.push(`${R1_MIG}: remove idx_actors_user_id histórico — proibido.`);
    if (/CONCURRENTLY/i.test(sql)) failures.push(`${R1_MIG}: usa CREATE INDEX CONCURRENTLY — proibido (não transacional).`);
    for (const [re, why] of [
      [/DELETE\s+FROM\s+actors/i, 'DELETE em actors (limpeza proibida)'],
      [/UPDATE\s+actors\s+SET/i, 'UPDATE em actors (correção de dados proibida)'],
      [/INSERT\s+INTO\s+actors/i, 'INSERT em actors (backfill proibido)'],
      [/MERGE\s+INTO\s+actors/i, 'MERGE em actors (dedup proibido)'],
      [/ALTER\s+TABLE\s+actors[\s\S]{0,80}(ENABLE|DISABLE|FORCE)\s+ROW\s+LEVEL/i, 'altera RLS de actors'],
      [/DROP\s+CONSTRAINT\s+actors_pkey|chk_actors_actor_id_equals_id/i, 'altera PK/actor_id=id'],
      [/ALTER\s+TABLE\s+actors\s+OWNER\s+TO/i, 'troca owner de actors'],
      [/ADD\s+COLUMN\s+(user_id)[\s\S]{0,40}NOT\s+NULL/i, 'adiciona NOT NULL global em user_id'],
      [/'canonical_actor'|is_canonical|preferred_actor/i, 'inventa flag/metadata de canonical actor'],
    ]) {
      if (re.test(sql)) failures.push(`${R1_MIG}: ${why}.`);
    }
    // precheck de duplicidades presente e fail-closed
    if (!/HAVING\s+count\(\*\)\s*>\s*1/i.test(sql) || !/MIGRATION_ABORT/i.test(sql)) {
      failures.push(`${R1_MIG}: precheck fail-closed de duplicidades ausente.`);
    }
  }

  // ── 2. Migrations POSTERIORES não enfraquecem a unicidade ────────────────────────────────────
  for (const f of migFiles.filter((f) => f > R1_MIG)) {
    const sql = stripSql(readFileSync(join(MIG, f), 'utf-8'));
    if (/DROP\s+INDEX\s+(IF\s+EXISTS\s+)?uq_actors_user/i.test(sql)) failures.push(`[pos-R1] ${f}: dropa uq_actors_user.`);
    if (/ALTER\s+INDEX\s+uq_actors_user/i.test(sql)) failures.push(`[pos-R1] ${f}: altera uq_actors_user.`);
  }

  // ── 3. findByUserId fail-closed (sem LIMIT 1 como resolvedor; cardinalidade >1 → erro) ────────
  if (!existsSync(REPO)) {
    failures.push('actor.repository.ts ausente — terreno divergente.');
  } else {
    const repo = stripTs(readFileSync(REPO, 'utf-8'));
    // erro estável definido
    if (!/ACTOR_USER_ANCHOR_AMBIGUOUS/.test(repo)) failures.push('repo: ACTOR_USER_ANCHOR_AMBIGUOUS ausente.');
    if (!/ACTOR_USER_CANONICAL_ANCHOR_CONFLICT/.test(repo)) failures.push('repo: ACTOR_USER_CANONICAL_ANCHOR_CONFLICT ausente.');

    // A constante compartilhada do alvo do conflito deve espelhar EXATAMENTE a âncora parcial.
    const target = (repo.match(/USER_ANCHOR_CONFLICT_TARGET\s*=\s*`([^`]*)`/) || [])[1] || '';
    if (!/\(tenant_id,\s*user_id\)\s*WHERE\s+actor_type\s*=\s*'user'\s+AND\s+tenant_id\s+IS\s+NOT\s+NULL\s+AND\s+user_id\s+IS\s+NOT\s+NULL/i.test(target)) {
      failures.push('repo: USER_ANCHOR_CONFLICT_TARGET não espelha o alvo parcial exato (tenant_id, user_id) WHERE actor_type=user AND ambos NOT NULL.');
    }

    // ── N2-D.2-R1-FIX: helper canônico ÚNICO valida a âncora em TODOS os caminhos de reuso ──
    const helper = (repo.match(/function assertCanonicalUserActorAnchor\(([\s\S]*?)\n\}/) || [''])[0];
    if (!helper) {
      failures.push('repo: helper assertCanonicalUserActorAnchor ausente (validação da âncora não centralizada).');
    } else {
      // deve comparar EXPLICITAMENTE actor_type, tenant_id, user_id, global_user_id (===/!==, sem truthiness)
      if (!/actor\.actor_type\s*!==\s*'user'/.test(helper)) failures.push('helper: não verifica actor_type === user.');
      if (!/actor\.tenant_id\s*!==\s*expectedTenantId/.test(helper)) failures.push('helper: não verifica tenant_id exato.');
      if (!/actor\.user_id\s*!==\s*expectedUserId/.test(helper)) failures.push('helper: não verifica user_id exato.');
      if (!/actor\.global_user_id\s*!==\s*expectedGlobalUserId/.test(helper)) failures.push('helper: não verifica global_user_id exato.');
      if (!/throw new Error\(ACTOR_USER_CANONICAL_ANCHOR_CONFLICT\)/.test(helper)) failures.push('helper: não lança ACTOR_USER_CANONICAL_ANCHOR_CONFLICT (fail-closed).');
      // proibido corrigir/atualizar/log em vez de throw
      if (/UPDATE\s+actors|console\.(warn|log|error)|actor\.global_user_id\s*=/.test(helper)) {
        failures.push('helper: corrige/loga em vez de fail-closed — proibido.');
      }
      // comparação frouxa proibida (==/!= não-estritos entre os campos)
      if (/actor\.(actor_type|tenant_id|user_id|global_user_id)\s*(?<![!=])==(?!=)/.test(helper) ||
          /actor\.(actor_type|tenant_id|user_id|global_user_id)\s*!=(?!=)/.test(helper)) {
        failures.push('helper: usa comparação frouxa (==/!=) — exige ===/!==.');
      }
    }

    // corpo do findByUserId
    const fbu = (repo.match(/async findByUserId\([\s\S]*?\n  \}/) || [''])[0];
    if (!fbu) {
      failures.push('repo: findByUserId não localizado.');
    } else {
      if (/LIMIT\s+1/i.test(fbu)) failures.push('repo: findByUserId ainda usa LIMIT 1 (resolvedor arbitrário de ambiguidade).');
      if (!/LIMIT\s+2/i.test(fbu)) failures.push('repo: findByUserId não busca até 2 rows para conferir cardinalidade.');
      if (!/rows\.length\s*>\s*1/.test(fbu) || !/ACTOR_USER_ANCHOR_AMBIGUOUS/.test(fbu)) {
        failures.push('repo: findByUserId não falha fail-closed em cardinalidade >1.');
      }
      if (!/rows\.length\s*===\s*0/.test(fbu) || !/return null/.test(fbu)) {
        failures.push('repo: findByUserId perdeu o contrato 0→null.');
      }
      if (!/actor_type\s*=\s*'user'/i.test(fbu) || !/tenant_id\s*=\s*\$1/.test(fbu) || !/user_id\s*=\s*\$2/.test(fbu)) {
        failures.push('repo: findByUserId perdeu filtro exato tenant/user/actor_type=user.');
      }
      if (/ORDER\s+BY\s+(created_at|id)/i.test(fbu)) failures.push('repo: findByUserId usa ORDER BY para escolher identidade — proibido.');
    }

    // ── 4. Os dois writers endurecidos: prova BRANCH-LOCAL dos 3 ramos de retorno de Actor (R4) ──
    // Config por writer: como se identifica o ramo existing e o ramo insert-returning (o race-loser é o
    // resto do método, após o bloco insert-returning). Não depende de números de linha.
    const writers = [
      { name: 'findOrCreateUserActor',   existingCond: /if\s*\(\s*existing\s*\)/,            createCond: /if\s*\(\s*newActor\s*\)/ },
      { name: 'findOrCreateUserActorTx', existingCond: /if\s*\(\s*existing\.rows\[\s*0\s*\]\s*\)/, createCond: /if\s*\(\s*inserted\.rows\[\s*0\s*\]\s*\)/ },
    ];
    for (const w of writers) {
      const body = extractMethodBody(repo, w.name);
      if (!body) { failures.push(`repo: ${w.name} não localizado / corpo não extraível (inspeção ambígua).`); continue; }

      const usesTarget = /ON\s+CONFLICT\s+\$\{USER_ANCHOR_CONFLICT_TARGET\}/.test(body)
        || /ON\s+CONFLICT\s*\(tenant_id,\s*user_id\)\s*WHERE\s+actor_type\s*=\s*'user'/i.test(body);
      if (!usesTarget) failures.push(`repo: ${w.name} sem ON CONFLICT no alvo EXATO da âncora.`);
      if (!/DO\s+NOTHING/i.test(body)) failures.push(`repo: ${w.name} sem DO NOTHING.`);
      if (/DO\s+UPDATE/i.test(body)) failures.push(`repo: ${w.name} usa ON CONFLICT DO UPDATE — proibido.`);
      if (!/ACTOR_USER_CANONICAL_ANCHOR_CONFLICT/.test(body)) failures.push(`repo: ${w.name} não falha em âncora incompatível.`);
      const inserts = (body.match(/INSERT\s+INTO\s+actors/gi) || []).length;
      if (inserts !== 1) failures.push(`repo: ${w.name} tem ${inserts} INSERT em actors (esperado 1).`);

      // RAMO A/D — existing: bloco `if (existing...) { ... }` valida a MESMA row antes do return.
      const existingBlk = extractIfBlock(body, w.existingCond);
      if (!existingBlk) failures.push(`repo: ${w.name} ramo 'existing' não localizado.`);
      else proveBranchValidatesReturnedActor(existingBlk.body, `${w.name}:existing`, (m) => failures.push('repo: ' + m));

      // RAMO B/E — insert-returning: bloco `if (newActor|inserted.rows[0]) { ... }` valida antes do return.
      const createBlk = extractIfBlock(body, w.createCond);
      if (!createBlk) { failures.push(`repo: ${w.name} ramo 'insert-returning' não localizado.`); continue; }
      proveBranchValidatesReturnedActor(createBlk.body, `${w.name}:insert-returning`, (m) => failures.push('repo: ' + m));

      // RAMO C/F — race-loser: TUDO após o bloco insert-returning até o fim do método. Janela DEDICADA
      // (chamadas dos outros ramos ficam fora → fecha a evasão composta remover-da-corrida+duplicar-noutro).
      const raceWindow = body.slice(createBlk.end + 1);
      // §7: prova estrutural da forma esperada — reselect da âncora + cardinalidade + helper no retornado.
      if (!/actor_type\s*=\s*'user'/i.test(raceWindow) || !/LIMIT\s+2/i.test(raceWindow)) {
        failures.push(`repo: ${w.name}:race-loser sem reselect da âncora (actor_type='user' + LIMIT 2).`);
      }
      if (!/\.length\s*===\s*0/.test(raceWindow) || !/\.length\s*>\s*1/.test(raceWindow)) {
        failures.push(`repo: ${w.name}:race-loser sem verificação de cardinalidade (0 e >1).`);
      }
      proveBranchValidatesReturnedActor(raceWindow, `${w.name}:race-loser`, (m) => failures.push('repo: ' + m));
    }
    // o predicado do conflito é compartilhado por uma constante (higiene) — não obrigatório, mas não pode
    // haver ON CONFLICT genérico sem alvo em lugar nenhum do writer path.
    if (/ON\s+CONFLICT\s+DO\s+NOTHING(?!\s*\()/i.test(repo) && !/USER_ANCHOR_CONFLICT_TARGET/.test(repo)) {
      failures.push('repo: ON CONFLICT DO NOTHING genérico (sem alvo) — deve mirar a âncora parcial exata.');
    }
  }

  // ── 5. Escopo negativo: R1 não toca Authority/grants/eventos/fn_* ────────────────────────────
  if (existsSync(REPO)) {
    const repo = stripTs(readFileSync(REPO, 'utf-8'));
    if (/actor_capability_grants|fn_grant_actor_capability|fn_revoke_actor_capability|fn_expire_actor_capability|fn_regrant_actor_capability/i.test(repo)) {
      failures.push('repo: actor.repository.ts referencia Authority/grants — R1 é domínio Actors SSOT, R2 é fatia própria.');
    }
  }

  // ── 6. wiring no runner ──────────────────────────────────────────────────────────────────────
  const runner = stripTs(readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf-8'));
  if (!runner.includes('audit-actor-user-anchor-uniqueness.mjs')) {
    failures.push('runner: audit-actor-user-anchor-uniqueness.mjs fora do run-regression-guards.');
  }
} catch (e) {
  failures.push(`falha de leitura/parsing: ${e.message} — FAIL (nunca PASS silencioso).`);
}

if (failures.length) {
  console.error('GATE FAIL [actor-user-anchor-uniqueness]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Unicidade canônica do Actor user (N2-D.2-R1 / ressalva Yala) ausente/enfraquecida. UNIQUE parcial (tenant_id,user_id) WHERE actor_type=user; findByUserId fail-closed em 2+; writers idempotentes sob corrida (ON CONFLICT DO NOTHING no alvo exato + reselect + conferência de identidade). LIMIT 1/ordenação/documentação NÃO decidem o Actor humano.');
  process.exit(1);
}
console.log('GATE OK [actor-user-anchor-uniqueness] — integridade VERSIONADA da N2-D.2-R1: UNIQUE parcial uq_actors_user (tenant_id, user_id) WHERE actor_type=user (user_id NULL fora; sem ampliar p/ outros tipos; sem unicidade global por user_id); idx_actors_user_id histórico preservado; findByUserId busca 2 rows e falha ACTOR_USER_ANCHOR_AMBIGUOUS em >1 (0→null, sem LIMIT 1/ORDER BY); os dois writers usam ON CONFLICT DO NOTHING no alvo exato + reselect + conferência de global_user_id (sem DO UPDATE, sem reinserir); R1 não toca Authority/grants. (Estado vivo = introspecao.)');
