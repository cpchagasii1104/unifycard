#!/usr/bin/env node
// N3 — carga inicial do catálogo canônico de bairros de Curitiba (75), via o writer canônico N2-E.
// Lê o manifest versionado (UTF-8), chama fn_create_canonical_neighborhood por bairro (nome PARAMETRIZADO,
// nunca inline → seguro para acentos), numa ÚNICA transação. Sem rota/HTTP. Sem INSERT direto/disable-trigger.
//
//   dry-run (default): cria os 75 em transação, valida tudo, ROLLBACK (nada persiste).
//   --apply "N3-LOAD-CURITIBA": só então COMMIT, após TODAS as assertions.
//
// Fail-closed: exige neighborhoods=0 no início; count exato 75; qualquer divergência → ROLLBACK + exit 1.
// A UNIQUE(city_id, name_normalized) é o enforcement final contra colisão normalizada. Conecta como owner (não unificard_app).

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'curitiba-neighborhoods-manifest.json');
const CONFIRM_TOKEN = 'N3-LOAD-CURITIBA';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);

function envDatabaseUrl() {
  const m = readFileSync(join(HERE, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };

async function main() {
  const M = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const meta = M.meta, items = M.items;

  // ── validação do manifest (estrutura, unicidade, whitespace) ──
  assert(items.length === meta.expected_count && items.length === 75, `manifest tem ${meta.expected_count} itens (=75)`);
  const names = items.map((i) => i.name);
  assert(names.every((n) => typeof n === 'string' && n.length > 0 && n === n.trim()), 'nenhum nome vazio / com whitespace de borda');
  assert(new Set(names).size === names.length, 'nenhum nome duplicado exato');
  const ords = items.map((i) => i.ordinal);
  assert(new Set(ords).size === 75 && Math.min(...ords) === 1 && Math.max(...ords) === 75, 'ordinais 1..75 únicos');
  if (failed) { log('[n3-load] manifest inválido — abortado'); process.exit(1); }

  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u')).rows[0].u;
    if (cu === 'unificard_app') throw new Error('recuso executar como unificard_app — use o papel operacional/owner');
    log(`[n3-load] modo=${APPLY ? (CONFIRMED ? 'APPLY (confirmado)' : 'APPLY SEM CONFIRMAÇÃO → recusado') : 'DRY-RUN'} · current_user=${cu} · city=Curitiba(${meta.city_id})`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token de confirmação explícito: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`N3-LOAD:${meta.city_id}`]);
    // estado inicial ESTRITAMENTE ZERO (fail-closed, sem reconciliação)
    const n0 = (await client.query('SELECT count(*)::int n FROM neighborhoods')).rows[0].n;
    if (n0 !== 0) throw new Error(`estado inicial NÃO-ZERO: ${n0} neighborhoods já existem — fail-closed`);
    assert(n0 === 0, 'estado inicial neighborhoods=0');

    // ── carga: writer canônico N2-E por bairro (nome parametrizado $5) ──
    const ids = [];
    for (const it of items) {
      const evidence = `Bairro oficial no ${it.ordinal} da relacao dos 75 bairros de Curitiba (IPPUC/GeoCuritiba).`;
      const r = await client.query(
        'SELECT public.fn_create_canonical_neighborhood($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id',
        [meta.tenant_id, meta.authenticated_user_id, meta.grantee_actor_id, meta.city_id, it.name,
         meta.source_kind, meta.source_reference, evidence, meta.reason]
      );
      ids.push(r.rows[0].id);
    }
    assert(ids.length === 75 && new Set(ids).size === 75, '75 neighborhood_ids distintos criados');

    // ── assertions de integridade ──
    const tot = (await client.query('SELECT count(*)::int n FROM neighborhoods')).rows[0].n;
    assert(tot === 75, `exatamente 75 neighborhoods (${tot})`);
    const wrongCity = (await client.query('SELECT count(*)::int n FROM neighborhoods WHERE city_id <> $1', [meta.city_id])).rows[0].n;
    assert(wrongCity === 0, 'todos em Curitiba (0 em outra city)');
    const notCurrent = (await client.query('SELECT count(*)::int n FROM neighborhoods WHERE NOT (is_active = true AND valid_from_at <= CURRENT_TIMESTAMP AND valid_until_at IS NULL)').catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
    assert(notCurrent === 0, 'todos ativos, valid_from<=agora, valid_until NULL');
    const badSrc = (await client.query("SELECT count(*)::int n FROM neighborhoods WHERE source_kind <> 'government_official'")).rows[0].n;
    assert(badSrc === 0, "todos source_kind='government_official'");
    const distinctNorm = (await client.query('SELECT count(DISTINCT name_normalized)::int n FROM neighborhoods')).rows[0].n;
    assert(distinctNorm === 75, `75 name_normalized distintos (${distinctNorm}) — sem colisão`);
    const ev = (await client.query('SELECT count(*)::int n FROM neighborhood_curation_events')).rows[0].n;
    assert(ev === 150, `150 eventos de curadoria (2 por bairro: create+approve) (${ev})`);
    const tok = (await client.query('SELECT count(*)::int n FROM neighborhood_writer_authorizations')).rows[0].n;
    assert(tok === 0, 'nenhum token residual (one-use consumido)');
    const al = (await client.query('SELECT count(*)::int n FROM neighborhood_aliases')).rows[0].n;
    const su = (await client.query('SELECT count(*)::int n FROM neighborhood_succession_events')).rows[0].n;
    assert(al === 0 && su === 0, 'zero aliases, zero succession');
    const addr = (await client.query('SELECT count(*)::int n FROM addresses')).rows[0].n;
    const addrNb = (await client.query('SELECT count(*)::int n FROM addresses WHERE neighborhood_id IS NOT NULL')).rows[0].n;
    assert(addr === 3 && addrNb === 0, 'addresses=3 e nenhum vinculado (a carga não toca address)');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[n3-load] APPLY COMMIT — 75 bairros de Curitiba persistidos.`);
    } else {
      await client.query('ROLLBACK');
      log(`[n3-load] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido)`);
    }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    failed = true;
    log('  XX  ERRO: ' + String(e.message).split('\n')[0]);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}
main();
