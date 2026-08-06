#!/usr/bin/env node
// backend/scripts/audit-demand-need-tenant-coherence.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F3 · DECISION-0196 §H, GATE + GO Clayton 2026-08-06)
// ║ NORMA:   DECISION_0196 §H/§H.2 · DECISION_0146 §A.6 (writer fail-closed onde FK não cobre)
// ║ NÃO:     confiar na FK para isolamento — `event_operational_needs` NÃO tem tenant_id nem RLS
// ║ EM VEZ:  a coerência é do WRITER (demand.service.ts → findNeedEventIdInTenant) + este guard
// ╚════════════════════════════════════════════════════════════════
//
// ── POR QUE ESTE GUARD EXISTE (o vão que a FK NÃO fecha) ───────────────────────────────────────
//   SELECT relname, relrowsecurity FROM pg_class
//    WHERE relname IN ('service_demands','event_operational_needs');
//   -- service_demands          t   ← RLS LIGADO + tenant_id NOT NULL
//   -- event_operational_needs  f   ← RLS DESLIGADO + SEM coluna tenant_id
// O tenant da need mora UM SALTO adiante, em `events.tenant_id`. Uma FK anulável simples não impede
// uma demanda do tenant A apontar para need de evento do tenant B — DUAS respostas para "de quem é
// isto", que é o que a regra de Clayton ("não pode existir segunda verdade") proíbe.
//
// ⚠️ E a ausência de `tenant_id` NÃO é defeito da need: é o padrão de 6 tabelas `event_*`. Este
//    guard NÃO manda adicionar a coluna — manda manter a trava onde a 0146 §A.6 a coloca.
//
// (A) ESTÁTICO — a coluna nasceu anulável, ninguém a dropa, e o WRITER continua checando.
// (B) DINÂMICO — nenhuma linha VIVA viola a coerência. 🔴 Banco indisponível = FAIL: não conseguir
//     verificar NÃO é aprovação, e reportar 0 sem ler seria afirmar "não há".
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

const SVC = 'src/modules/demands/demand.service.ts';
const REPO = 'src/modules/demands/demand.repository.ts';

const failures = [];
const files = existsSync(MIG) ? readdirSync(MIG).filter((n) => n.endsWith('.sql')) : [];

// ══ (A1) a migration existe e a coluna é ANULÁVEL (nulo = demanda avulsa; nada regride) ════════
const home = files.find((n) => /_service_demand_need_id_event_key\.sql$/.test(n));
if (!home) {
  failures.push('migration *_service_demand_need_id_event_key.sql ausente — a chave evento↔demanda (§H) não foi materializada.');
} else {
  const sql = stripSql(readFileSync(join(MIG, home), 'utf-8'));
  if (!/ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?need_id\s+uuid\s+NULL/i.test(sql))
    failures.push('migration: need_id precisa nascer uuid NULL (anulável). NOT NULL faria toda demanda avulsa regredir.');
  if (!/REFERENCES\s+event_operational_needs\s*\(\s*id\s*\)/i.test(sql))
    failures.push('migration: need_id não referencia event_operational_needs — a chave é a NECESSIDADE, não o evento (§H: ligar ao evento cria segunda verdade sobre "o que este evento precisa").');
  if (!/ON\s+DELETE\s+SET\s+NULL/i.test(sql))
    failures.push('migration: FK sem ON DELETE SET NULL — apagar a NECESSIDADE não pode apagar o PEDIDO (a demanda tem respostas e possivelmente compromisso).');
  // §H.2: o valor NÃO entra na chave. Se alguém acrescentar preço aqui, a F3 ganha segunda fonte.
  if (/need_id[\s\S]{0,400}?(price_cents|amount_cents|cost|budget)/i.test(sql))
    failures.push('migration: apareceu valor perto de need_id — §H.2 é explícita: o preço mora na RESPOSTA (quote_cents). Duas fontes de custo = segunda verdade.');
}
for (const n of files) {
  const sql = stripSql(readFileSync(join(MIG, n), 'utf-8'));
  if (/ALTER\s+TABLE\s+service_demands[\s\S]{0,120}?DROP\s+COLUMN\s+(IF\s+EXISTS\s+)?need_id\b/i.test(sql))
    failures.push(`${n}: DROP COLUMN need_id — remoção da chave evento↔demanda (proibido).`);
}

// ══ (A2) o WRITER continua sendo a trava — é ele, não o banco ═════════════════════════════════
const svc = readTs(SVC);
if (svc === null) failures.push(`arquivo ausente: ${SVC}`);
else {
  if (!/findNeedEventIdInTenant/.test(svc))
    failures.push(`${SVC}: o writer não chama findNeedEventIdInTenant — sem ele a FK aceita need de OUTRO tenant (o banco não cobre: event_operational_needs não tem tenant_id nem RLS).`);
  if (!/DEMAND_NEED_NOT_IN_TENANT/.test(svc))
    failures.push(`${SVC}: a recusa perdeu o código nomeado DEMAND_NEED_NOT_IN_TENANT — recusa sem nome vira 500 genérico e ninguém sabe o que barrou.`);
  // fail-closed de verdade: precisa RECUSAR quando a resolução falha, não seguir com null.
  const bloco = svc.slice(Math.max(0, svc.indexOf('findNeedEventIdInTenant') - 400), svc.indexOf('findNeedEventIdInTenant') + 700);
  if (!/if\s*\(\s*!\s*eventId\s*\)[\s\S]{0,200}?throw/.test(bloco))
    failures.push(`${SVC}: a resolução falhando não LANÇA — seguir com need_id não resolvido é fail-ABERTO, o oposto da 0146 §A.6.`);
}

const repo = readTs(REPO);
if (repo === null) failures.push(`arquivo ausente: ${REPO}`);
else {
  // 🔴 SUBSTÂNCIA: o JOIN tem de amarrar o tenant no EVENTO (é onde o tenant da need mora).
  if (!/JOIN\s+events\s+e\s+ON\s+e\.id\s*=\s*n\.event_id/i.test(repo) || !/e\.tenant_id\s*=\s*\$1/.test(repo))
    failures.push(`${REPO}: findNeedEventIdInTenant não amarra e.tenant_id — sem o JOIN em events a checagem não prova nada (a need não tem tenant próprio).`);
}

// ══ (B) DINÂMICO — nenhuma linha viva viola. Zero MEDIDO, nunca zero presumido. ════════════════
let vivas = null, ligadas = null;
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
    const col = await c.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_name='service_demands' AND column_name='need_id'`);
    if (col.rowCount === 0) {
      failures.push('banco: service_demands.need_id NÃO existe — a chave da F3 não está viva.');
    } else if (col.rows[0].is_nullable !== 'YES') {
      failures.push('banco: need_id não é anulável — demanda avulsa (o caso comum) deixaria de ser possível.');
    }
    const fk = await c.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='service_demands'::regclass AND contype='f'
          AND pg_get_constraintdef(oid) ILIKE '%need_id%'`);
    if (fk.rowCount === 0) failures.push('banco: sem FK de need_id — a chave existiria como uuid solto, sem integridade.');
    else if (!/event_operational_needs/i.test(fk.rows[0].def))
      failures.push(`banco: a FK de need_id não aponta para event_operational_needs. def=${fk.rows[0].def}`);

    // 🔴 A PROVA QUE IMPORTA: alguma demanda aponta para need de OUTRO tenant?
    const leak = await c.query(
      `SELECT count(*)::int AS n
         FROM service_demands d
         JOIN event_operational_needs n ON n.id = d.need_id
         JOIN events e ON e.id = n.event_id
        WHERE d.need_id IS NOT NULL AND e.tenant_id <> d.tenant_id`);
    if (leak.rows[0].n > 0) {
      failures.push(
        `banco: ${leak.rows[0].n} demanda(s) apontam para necessidade de OUTRO tenant — duas respostas ` +
        `para "de quem é isto". O writer falhou ou alguém escreveu por fora dele.`);
    }
    // órfã: need_id preenchido cuja need sumiu sem o SET NULL agir (não deveria acontecer)
    const orfa = await c.query(
      `SELECT count(*)::int AS n FROM service_demands d
        WHERE d.need_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM event_operational_needs n WHERE n.id = d.need_id)`);
    if (orfa.rows[0].n > 0) failures.push(`banco: ${orfa.rows[0].n} demanda(s) com need_id órfão — a FK deveria impedir.`);

    const tot = await c.query(
      `SELECT count(*)::int AS total, count(need_id)::int AS com_need FROM service_demands`);
    vivas = tot.rows[0].total; ligadas = tot.rows[0].com_need;
  } finally {
    await c.end();
  }
} catch (e) {
  failures.push(`banco INDISPONÍVEL para a metade dinâmica (${e.message}) — FAIL: não verificar não é aprovar.`);
}

if (failures.length) {
  console.log('GATE FAIL [demand-need-tenant-coherence]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    '\n→ A chave evento↔demanda é a NECESSIDADE (DECISION-0196 §H), não o evento.' +
    '\n→ O banco NÃO consegue isolar: event_operational_needs não tem tenant_id nem RLS (padrão de 6 tabelas event_*, NÃO endurecer).' +
    '\n→ EM VEZ: a trava é o writer (demand.service.ts → findNeedEventIdInTenant), como a DECISION-0146 §A.6 prescreve.');
  process.exit(1);
}

console.log(
  `GATE OK [demand-need-tenant-coherence] — service_demands.need_id VIVA e ANULÁVEL, FK para ` +
  `event_operational_needs com ON DELETE SET NULL; writer fail-closed (DEMAND_NEED_NOT_IN_TENANT) ` +
  `amarrando o tenant via events, porque a need não tem tenant próprio (0146 §A.6). ` +
  `Medido no banco: ${vivas} demanda(s), ${ligadas} ligada(s) a necessidade · 0 apontando para outro ` +
  `tenant · 0 órfã. O valor NÃO mora na chave (§H.2: preço vive na RESPOSTA).`
);
