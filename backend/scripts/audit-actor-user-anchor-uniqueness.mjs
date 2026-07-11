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

    // ── 4. Os dois writers endurecidos (ON CONFLICT DO NOTHING no alvo exato + reselect + conferência) ──
    for (const name of ['findOrCreateUserActor', 'findOrCreateUserActorTx']) {
      const body = (repo.match(new RegExp(`async ${name}\\([\\s\\S]*?\\n  \\}`)) || [''])[0];
      if (!body) { failures.push(`repo: ${name} não localizado.`); continue; }
      // aceita a constante compartilhada (validada acima) OU o alvo literal inline
      const usesTarget = /ON\s+CONFLICT\s+\$\{USER_ANCHOR_CONFLICT_TARGET\}/.test(body)
        || /ON\s+CONFLICT\s*\(tenant_id,\s*user_id\)\s*WHERE\s+actor_type\s*=\s*'user'/i.test(body);
      if (!usesTarget) {
        failures.push(`repo: ${name} sem ON CONFLICT no alvo EXATO da âncora (constante USER_ANCHOR_CONFLICT_TARGET ou literal).`);
      }
      if (!/DO\s+NOTHING/i.test(body)) failures.push(`repo: ${name} sem DO NOTHING.`);
      if (/DO\s+UPDATE/i.test(body)) failures.push(`repo: ${name} usa ON CONFLICT DO UPDATE — proibido (não atualiza identidade).`);
      // reselect após conflito + conferência EXPLÍCITA de global_user_id (comparação, não só menção)
      if (!/\.global_user_id\s*!==\s*user\.global_user_id/.test(body)) {
        failures.push(`repo: ${name} não compara a global_user_id da âncora vencedora com a esperada (conferência de identidade ausente).`);
      }
      if (!/ACTOR_USER_CANONICAL_ANCHOR_CONFLICT/.test(body)) failures.push(`repo: ${name} não falha em âncora com identidade incompatível.`);
      // não pode reinserir depois de perder a corrida (um único INSERT no corpo)
      const inserts = (body.match(/INSERT\s+INTO\s+actors/gi) || []).length;
      if (inserts !== 1) failures.push(`repo: ${name} tem ${inserts} INSERT em actors (esperado 1 — não reinserir após perder a corrida).`);
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
