#!/usr/bin/env node
// backend/scripts/audit-rental-hardening-constraints.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (v2 — F-RENTAL-EXCLUSIVITY-GUARANTEE, GO Clayton 2026-08-05)
// ║ NORMA:   docs/02_decisions/DECISION_0146_… §A.7 e §B-bis G1 · CONSTITUIÇÃO ARTIGO II
// ║ NÃO:     exigir a EXCLUDE em `availability` — a norma a PROÍBE; e não é onde a garantia mora
// ║ EM VEZ:  a garantia viva é chk_aart_quantity_single_unless_equipment (actor_asset_rental_terms)
// ╚════════════════════════════════════════════════════════════════
//
// ── POR QUE ESTA v2 EXISTE (a v1 estava reprovando o próprio conserto) ─────────────────────────
// A v1 (Trava 3, 2026-07-08) EXIGIA, na linha do partial WHERE, que a EXCLUDE de overlap citasse
// `owner_type='rentable_resource'`. Quando o arco asset-first migrou a locação para `actor_asset`,
// aquele `WHERE` passou a alcançar ZERO linhas — e o guard, sendo ESTÁTICO, seguiu VERDE o tempo
// todo, porque provava que o TEXTO existia na migration, nunca que a linha estava protegida.
// Pior: como ele exigia o `WHERE` pelo nome morto, **mover a garantia para o substrato vivo fazia
// o guard FALHAR**. Ele não estava desatualizado — estava reprovando o conserto.
//
// E apontava para o lado oposto da norma: `DECISION-0146 G1` prescreve, literalmente,
// *"availability overlap NUNCA hard-blocka […] (NP: introduzir EXCLUDE em availability → guard
// morde)"*. A v1 mordia ao REMOVER. A v2 morde ao INTRODUZIR, que é o que a norma pede.
//
// ── O QUE MUDOU DE FATO (GATE-pequeno de 2026-08-05, evidência no cartório) ────────────────────
// A trava do COMPROMISSO (`confirmBookingWithResourceLock` + RENTAL_RESOURCE_TIME_CONFLICT,
// commit 6359d31cc, 2026-06-23) é QUINZE DIAS ANTERIOR ao bloqueio de declaração e cobre a
// impossibilidade física na camada que a §A.7 prescreve. O bloqueio de declaração era
// desnecessário; saiu na migration 20260806010000, junto com a EXCLUDE.
//
// ── DINÂMICO, e o estático continua ────────────────────────────────────────────────────────────
// (A) ESTÁTICO — histórico forward-only: a migration da garantia existe e nenhuma migration a
//     remove. Prova o TEXTO.
// (B) DINÂMICO — conecta ao banco: a constraint está VIVA na tabela VIVA, e não há EXCLUDE em
//     `availability`. Prova a LINHA PROTEGIDA.
//     🔴 Banco indisponível = FAIL. Não conseguir verificar NÃO é aprovação.
//
// Em validate:regression-guards (via audit-authority-residual-hygiene-suite).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const MIG = join(ROOT, 'migrations');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

/** A garantia VIVA: só equipamento é fungível; veículo/imóvel/espaço têm identidade própria. */
const QUANTITY_LIVE = 'chk_aart_quantity_single_unless_equipment';
const QUANTITY_LIVE_TABLE = 'actor_asset_rental_terms';
/** A garantia LEGADA, na tabela aposentada. Preservada como histórico; não é exigida nem proibida. */
const QUANTITY_LEGACY = 'rentable_quantity_single_unless_equipment';
/** O bloqueio de DECLARAÇÃO que a norma proíbe (§A.7 / G1). */
const DECLARATION_BLOCK = 'availability_rental_no_overlap';

const failures = [];
const files = existsSync(MIG) ? readdirSync(MIG).filter((n) => n.endsWith('.sql')) : [];

// ══ (A) ESTÁTICO — a garantia foi materializada e nenhuma migration a remove ═══════════════════
const home = files.find((n) => /_rental_exclusivity_guarantee_follows_live_substrate\.sql$/.test(n));
if (!home) {
  failures.push('migration *_rental_exclusivity_guarantee_follows_live_substrate.sql ausente — a garantia de quantidade não foi materializada no substrato vivo.');
} else {
  const sql = stripSql(readFileSync(join(MIG, home), 'utf-8'));
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${QUANTITY_LIVE}[\\s\\S]{0,200}?CHECK`, 'i').test(sql))
    failures.push(`migration: ${QUANTITY_LIVE} não é CHECK.`);
  // 🔴 SUBSTÂNCIA, não nome: a regra é "equipment OU quantity=1". Renomear a constraint mantendo
  // outra semântica não pode passar — foi assim que um EVENT TRIGGER deste repo leu NOME em 08/05.
  if (!/resource_type\s*=\s*'equipment'\s+OR\s+quantity\s*=\s*1/i.test(sql))
    failures.push('migration: a regra não é (resource_type=equipment OR quantity=1) — semântica divergente da Trava 3.');
  if (!new RegExp(`ALTER\\s+TABLE\\s+${QUANTITY_LIVE_TABLE}`, 'i').test(sql))
    failures.push(`migration: a garantia não foi aplicada em ${QUANTITY_LIVE_TABLE} (a tabela VIVA).`);
}

for (const n of files) {
  const sql = stripSql(readFileSync(join(MIG, n), 'utf-8'));
  if (new RegExp(`DROP\\s+CONSTRAINT\\s+(IF\\s+EXISTS\\s+)?${QUANTITY_LIVE}\\b`, 'i').test(sql))
    failures.push(`${n}: DROP CONSTRAINT ${QUANTITY_LIVE} — remoção da garantia de quantidade (proibido).`);
}

// ══ (B) DINÂMICO — a garantia está VIVA e o bloqueio proibido NÃO voltou ═══════════════════════
let dynamicRan = false;
try {
  const { Client } = require('pg');
  const envPath = join(ROOT, '.env');
  const line = existsSync(envPath)
    ? readFileSync(envPath, 'utf-8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
    : null;
  const url = process.env.DATABASE_URL || (line ? line.slice('DATABASE_URL='.length).trim() : null);
  if (!url) throw new Error('DATABASE_URL ausente (.env e env)');

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const live = await c.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = $1 AND conrelid = $2::regclass`,
      [QUANTITY_LIVE, QUANTITY_LIVE_TABLE]
    );
    if (live.rowCount === 0) {
      failures.push(`banco: ${QUANTITY_LIVE} NÃO existe em ${QUANTITY_LIVE_TABLE} — a garantia não está viva.`);
    } else if (!/resource_type\s*=\s*'equipment'[\s\S]{0,60}?quantity\s*=\s*1/i.test(live.rows[0].def)) {
      // CHECK pode ser trocado por outro de mesmo nome; confere a SUBSTÂNCIA no catálogo.
      failures.push(`banco: ${QUANTITY_LIVE} existe mas a definição não é (equipment OR quantity=1): ${live.rows[0].def}`);
    }

    // A norma (G1) quer que a REINTRODUÇÃO de EXCLUDE em availability seja vermelha.
    const excl = await c.query(
      `SELECT conname FROM pg_constraint WHERE conrelid='availability'::regclass AND contype='x'`
    );
    if (excl.rowCount > 0) {
      failures.push(
        `banco: EXCLUDE em availability (${excl.rows.map((r) => r.conname).join(', ')}) — ` +
        `DECISION-0146 §A.7 PROÍBE hard-block na DECLARAÇÃO (G1). A constraint forte mira o COMPROMISSO.`
      );
    }

    // Denominador declarado: quantas linhas a garantia realmente alcança hoje.
    const reach = await c.query(`SELECT count(*)::int AS n FROM ${QUANTITY_LIVE_TABLE}`);
    const legacy = await c.query(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = $1`, [QUANTITY_LEGACY]
    );
    globalThis.__reach = reach.rows[0].n;
    globalThis.__legacyPresent = legacy.rows[0].n > 0;
    dynamicRan = true;
  } finally {
    await c.end();
  }
} catch (e) {
  // 🔴 Não conseguir verificar NÃO é aprovação — é o defeito que este repo mais persegue.
  failures.push(`banco INDISPONÍVEL para a metade dinâmica (${e.message}) — FAIL: não verificar não é aprovar.`);
}

if (failures.length) {
  console.log('GATE FAIL [rental-hardening-constraints]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log('\n→ A garantia de exclusividade da locação mora em ' + QUANTITY_LIVE_TABLE + '.' +
    '\n→ Ela alimenta a capacidade lida por confirmBookingWithResourceLock (unified-availability.repository.ts:490→:505).' +
    '\n→ Bloquear a DECLARAÇÃO (EXCLUDE em availability) é PROIBIDO: DECISION-0146 §A.7/G1, CONSTITUIÇÃO ART. II.');
  process.exit(1);
}

console.log(
  `GATE OK [rental-hardening-constraints] — garantia de quantidade VIVA em ${QUANTITY_LIVE_TABLE}` +
  ` (${QUANTITY_LIVE}: só equipment é fungível), verificada no CATÁLOGO do banco por substância, não por nome;` +
  ` alcance real ${globalThis.__reach} linha(s).` +
  ` Zero EXCLUDE em availability (§A.7/G1 — hard-block na declaração é proibido; a trava forte é o COMPROMISSO).` +
  ` Nenhuma migration remove a garantia.` +
  (globalThis.__legacyPresent
    ? ` ⚠️ ${QUANTITY_LEGACY} segue existindo em rentable_resources (0 linhas) — histórico, não garantia.`
    : '') +
  (dynamicRan ? '' : ' ⚠️ metade dinâmica NÃO rodou.')
);
