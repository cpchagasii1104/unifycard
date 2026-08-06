#!/usr/bin/env node
// backend/scripts/audit-commitment-layer-db-constraint.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT, GATE + GO Clayton 2026-08-06)
// ║ NORMA:   DECISION_0146 §A.7 (metade PRESCRITA) · §A.4 (status vivos) · G8 · DECISION_0196 §D.1
// ║ NÃO:     remover o advisory lock / a contagem por capacidade achando que "agora o banco garante"
// ║ EM VEZ:  mantenha as DUAS — EXCLUDE cobre o não-fungível; o lock cobre TAMBÉM o fungível.
// ╚════════════════════════════════════════════════════════════════
//
// ── AS DUAS GARANTIAS TÊM COBERTURAS DIFERENTES, E É POR ISSO QUE ESTE GUARD EXISTE ─────────────
//   (a) EXCLUDE `bookings_commitment_no_overlap` — declarativa, vale contra QUALQUER escritor
//       (psql, script, worker, migration). Cobre service_offering, user e actor_asset NÃO-fungível.
//   (b) advisory lock + `count(*) >= capacity` no confirm — cobre TUDO, inclusive o equipment
//       fungível (quantity até 10), lendo a capacidade AO VIVO.
// 🔴 A leitura errada ÓBVIA depois desta fatia é *"o banco garante, posso simplificar o lock"*. Isso
//    deixaria os ativos de equipment SEM trava nenhuma, EM SILÊNCIO — o defeito mudo, que este
//    repositório já pagou caro. Por isso o guard morde nas DUAS pontas, não só na constraint nova.
//
// ── E VIGIA A PREMISSA QUE SUSTENTA O DESENHO ──────────────────────────────────────────────────
// `commitment_resource_id` NÃO é snapshot de termo mutável: só recebe valor onde a exclusividade é
// ESTRUTURAL. Para `actor_asset` isso se apoia em `resource_type` ser WRITE-ONCE (aparece em INSERT
// e SELECT; em nenhum `UPDATE ... SET`) + no CHECK vivo `chk_aart_quantity_single_unless_equipment`.
// Se alguém passar a atualizar `resource_type`, a premissa cai e o desenho tem de ser revisto →
// este guard FALHA de propósito, para forçar a revisão em vez de deixar envelhecer calado.
//
// (A) ESTÁTICO — a migration existe, nenhuma a remove, e o código materializa o que a trava lê.
// (B) DINÂMICO — a constraint está VIVA na tabela VIVA, com a SUBSTÂNCIA conferida no catálogo.
//     🔴 Banco indisponível = FAIL. Não conseguir verificar NÃO é aprovação.
//
// Em validate:regression-guards (comando direto).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const MIG = join(ROOT, 'migrations');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const readTs = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const EXCL = 'bookings_commitment_no_overlap';
const CHK = 'chk_bookings_blocking_requires_interval';
const REPO = 'src/core/availability/unified-availability.repository.ts';
const RENTAL_REPO = 'src/modules/rentals/rentable-resource.repository.ts';

const failures = [];
const files = existsSync(MIG) ? readdirSync(MIG).filter((n) => n.endsWith('.sql')) : [];

// ══ (A1) ESTÁTICO — a migration da trava existe e tem a substância ════════════════════════════
const home = files.find((n) => /_commitment_layer_db_exclusivity_constraint\.sql$/.test(n));
if (!home) {
  failures.push('migration *_commitment_layer_db_exclusivity_constraint.sql ausente — a metade PRESCRITA da §A.7 não foi materializada.');
} else {
  const sql = stripSql(readFileSync(join(MIG, home), 'utf-8'));
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${EXCL}[\\s\\S]{0,120}?EXCLUDE\\s+USING\\s+gist`, 'i').test(sql))
    failures.push(`migration: ${EXCL} não é EXCLUDE USING gist.`);
  if (!/tstzrange\(booked_start_datetime,\s*booked_end_datetime,\s*'\[\)'\)/i.test(sql))
    failures.push('migration: o intervalo não é tstzrange(booked_*, [)) — ou virou coluna temporal NOVA (3ª verdade na mesma linha), ou o meio-aberto (G8) caiu.');
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${CHK}`, 'i').test(sql))
    failures.push(`migration: ${CHK} ausente — sem ele, tstzrange(NULL,NULL) = (,) trava o recurso em TODA data.`);
  if (!/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+btree_gist/i.test(sql))
    failures.push('migration: sem CREATE EXTENSION btree_gist — a EXCLUDE não nasce em ambiente novo/efêmero.');
}
for (const n of files) {
  const sql = stripSql(readFileSync(join(MIG, n), 'utf-8'));
  for (const alvo of [EXCL, CHK]) {
    if (new RegExp(`DROP\\s+CONSTRAINT\\s+(IF\\s+EXISTS\\s+)?${alvo}\\b`, 'i').test(sql))
      failures.push(`${n}: DROP CONSTRAINT ${alvo} — remoção da trava do COMPROMISSO (proibido).`);
  }
}

// ══ (A2) ESTÁTICO — o CÓDIGO alimenta a trava, e as DUAS garantias seguem vivas ════════════════
const repo = readTs(REPO);
if (repo === null) failures.push(`arquivo ausente: ${REPO}`);
else {
  // materialização: sem ela o CHECK recusa o confirm (fail-closed) e a trava fica sem o que ler.
  const mat = (repo.match(/commitment_resource_id\s*=\s*\$\d+::uuid/g) || []).length;
  if (mat < 2) failures.push(`${REPO}: os DOIS confirms precisam gravar commitment_resource_id (achei ${mat}).`);
  const booked = (repo.match(/booked_start_datetime\s*=\s*COALESCE\(booked_start_datetime/g) || []).length;
  if (booked < 2) failures.push(`${REPO}: os DOIS confirms precisam materializar booked_start_datetime (achei ${booked}).`);
  // 🔴 A OUTRA garantia — a que cobre o fungível — não pode sumir.
  if ((repo.match(/pg_advisory_xact_lock/g) || []).length < 2)
    failures.push(`${REPO}: advisory lock sumiu de algum confirm. A EXCLUDE NÃO o substitui — ela não cobre o equipment fungível.`);
  if (!/>=\s*capacity/.test(repo))
    failures.push(`${REPO}: a contagem por capacidade (count >= capacity) sumiu — é a ÚNICA proteção do equipment fungível, que fica fora da EXCLUDE.`);
  if (!/SELECT quantity, resource_type FROM actor_asset_rental_terms/.test(repo))
    failures.push(`${REPO}: o confirm de recurso precisa ler quantity E resource_type (resource_type decide quem entra na EXCLUDE).`);
  if (!/isFungible/.test(repo))
    failures.push(`${REPO}: a distinção fungível×não-fungível sumiu do confirm de recurso — ou o fungível entrou na EXCLUDE (bloqueia quem pode), ou o veículo saiu dela.`);
  // conflito lê o intervalo COMPROMETIDO nos DOIS ramos (fim da assimetria medida no GATE).
  if ((repo.match(/COALESCE\(b2\.booked_start_datetime, a2\.start_datetime\)/g) || []).length < 2)
    failures.push(`${REPO}: algum ramo voltou a comparar a janela macro em vez do intervalo COMPROMETIDO — editar a declaração reabriria double-booking.`);
}

// ══ (A3) ESTÁTICO — a PREMISSA: resource_type é write-once ═════════════════════════════════════
const rental = readTs(RENTAL_REPO);
if (rental === null) failures.push(`arquivo ausente: ${RENTAL_REPO}`);
else if (/UPDATE\s+actor_asset_rental_terms\s+SET[\s\S]{0,1200}?resource_type\s*=/i.test(rental)) {
  failures.push(
    `${RENTAL_REPO}: passou a ATUALIZAR resource_type. A premissa de que commitment_resource_id não é ` +
    `snapshot de termo mutável CAI — um asset que vire 'equipment' deixa compromissos antigos numa trava ` +
    `que não corresponde mais. Revise o desenho (DT-COMMITMENT-LAYER-…) antes de liberar.`
  );
}

// ══ (B) DINÂMICO — a trava está VIVA, com substância lida do catálogo ═════════════════════════
let reach = null;
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
      `SELECT contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = $1 AND conrelid = 'bookings'::regclass`, [EXCL]);
    if (live.rowCount === 0) {
      failures.push(`banco: ${EXCL} NÃO existe em bookings — a trava do COMPROMISSO não está viva.`);
    } else {
      const def = live.rows[0].def;
      if (live.rows[0].contype !== 'x') failures.push(`banco: ${EXCL} não é EXCLUDE (contype=${live.rows[0].contype}).`);
      // SUBSTÂNCIA, não nome — foi assim que a v1 do guard de locação passou verde provando texto.
      if (!/tenant_id WITH =/.test(def)) failures.push(`banco: ${EXCL} sem tenant_id na chave — conflito CROSS-TENANT falso/ausente. def=${def}`);
      if (!/commitment_resource_id WITH =/.test(def)) failures.push(`banco: ${EXCL} não é por recurso. def=${def}`);
      if (!/tstzrange\(booked_start_datetime, booked_end_datetime, '\[\)'/.test(def))
        failures.push(`banco: ${EXCL} não usa o intervalo meio-aberto [start,end) sobre booked_* (G8). def=${def}`);
      for (const st of ['confirmed', 'checked_in', 'checked_out']) {
        if (!new RegExp(`'${st}'`).test(def)) failures.push(`banco: ${EXCL} não cobre o status bloqueante '${st}' (§A.4). def=${def}`);
      }
    }
    const chk = await c.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = $1 AND conrelid = 'bookings'::regclass`, [CHK]);
    if (chk.rowCount === 0) failures.push(`banco: ${CHK} NÃO existe — compromisso sem intervalo viraria range ILIMITADO.`);
    else if (!/booked_start_datetime IS NOT NULL/.test(chk.rows[0].def))
      failures.push(`banco: ${CHK} não exige intervalo materializado. def=${chk.rows[0].def}`);

    // A garantia que a EXCLUDE NÃO cobre segue existindo no substrato (é o que o lock lê).
    const cap = await c.query(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname='chk_aart_quantity_single_unless_equipment'`);
    if (cap.rows[0].n === 0)
      failures.push('banco: chk_aart_quantity_single_unless_equipment sumiu — sem ela, "não-equipment ⇒ quantity=1" deixa de ser estrutural e commitment_resource_id vira snapshot mentiroso.');

    // Denominador declarado: alcance real, e o que fica de fora POR DECISÃO.
    const r = await c.query(
      `SELECT count(*) FILTER (WHERE a.owner_type <> 'actor_asset' OR t.resource_type <> 'equipment') AS na_trava,
              count(*) FILTER (WHERE a.owner_type = 'actor_asset' AND t.resource_type = 'equipment') AS fungivel_fora
         FROM availability a
         LEFT JOIN actor_asset_rental_terms t ON a.owner_type='actor_asset' AND t.asset_id = a.owner_id
        WHERE a.owner_type IN ('service_offering','user','actor_asset')`);
    reach = r.rows[0];
  } finally {
    await c.end();
  }
} catch (e) {
  failures.push(`banco INDISPONÍVEL para a metade dinâmica (${e.message}) — FAIL: não verificar não é aprovar.`);
}

if (failures.length) {
  console.log('GATE FAIL [commitment-layer-db-constraint]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    '\n→ A trava forte do COMPROMISSO é a metade PRESCRITA da DECISION-0146 §A.7 ("se houver constraint forte, ela mira compromisso real de booking").' +
    '\n→ Ela NÃO substitui o advisory lock: EXCLUDE não sabe CONTAR, e o equipment fungível (quantity até 10) depende de count >= capacity.' +
    '\n→ EM VEZ de simplificar uma das duas: mantenha as duas. Ver DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE.');
  process.exit(1);
}

console.log(
  `GATE OK [commitment-layer-db-constraint] — ${EXCL} VIVA em bookings, conferida por SUBSTÂNCIA no catálogo ` +
  `(tenant + recurso + tstzrange(booked_*,'[)') · status bloqueantes {confirmed,checked_in,checked_out}); ` +
  `${CHK} viva (compromisso sem intervalo é impossível — range ilimitado não trava recurso). ` +
  (reach ? `Alcance medido: ${reach.na_trava} janela(s) confirmável(is) sob a trava de banco · ${reach.fungivel_fora} de equipment fungível FORA dela por decisão (DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE). ` : '') +
  `As DUAS garantias seguem vivas: advisory lock + count>=capacity no código, EXCLUDE no banco. ` +
  `resource_type segue write-once (premissa de que o recurso gravado não é snapshot de termo mutável).`
);
