#!/usr/bin/env node
// F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 — ATO DE APLICAÇÃO (§16, ato 2 de 2).
//
// JOB TÉCNICO NÃO-ACTOR. NÃO chama canRepresentActor, NÃO representa humano, NÃO aprova. Carrega o
// manifest_approved PERSISTIDO (decisão humana anterior), revalida o grant, registra a execução técnica
// (executor_kind='job'), e chama o writer canônico fn_create_canonical_alias por linha. Atômico:
//   BEGIN → advisory lock (city+manifest) → carrega approval → valida lifecycle → revalida grant (via writer)
//   → preflight de TODAS as linhas (prova ZERO conflitos) → registra execution → cria aliases+eventos
//   → provas finais → COMMIT único. Qualquer falha → ROLLBACK integral. SEM commit parcial. SEM chunking.
//
//   dry-run (default): tudo acima + ROLLBACK (nada persiste).
//   --apply "APPLY_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1": COMMIT após todas as assertions.
//
// Rerun fail-closed: mesmo manifest já aplicado (mesmas relações exatas) → replay/no-op; hash divergente do
// approval → falha; approval revogado/supersedido → falha; execução parcial → ROLLBACK. Conecta como owner
// (writer é EXECUTE-fechado p/ app). Recusa rodar como unificard_app. Sem provider/CEP, sem Bank/Social.

import pg from 'pg';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const CONFIRM_TOKEN = 'APPLY_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1';
const EXECUTOR_NAME = 'neighborhood-alias-manifest-apply';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);
const manifestPath = argv[argv.indexOf('--manifest') + 1];

function envDatabaseUrl() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const m = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

function structuralHash(manifest) {
  const header = {
    manifest_code: manifest.manifest_code, manifest_version: manifest.manifest_version,
    city_id: manifest.city_id, city_external_code: manifest.city_external_code,
    source_dataset: manifest.source_dataset, source_dataset_version: manifest.source_dataset_version,
    source_dataset_hash: manifest.source_dataset_hash, line_count: manifest.lines.length,
  };
  const lines = [...manifest.lines].sort((a, b) => String(a.line_key).localeCompare(String(b.line_key)))
    .map((l) => ({ line_key: l.line_key, alias_text: l.alias_text, neighborhood_id: l.neighborhood_id,
      canonical_neighborhood_name: l.canonical_neighborhood_name, source_kind: l.source_kind,
      source_reference: l.source_reference, evidence: l.evidence }));
  return createHash('sha256').update(JSON.stringify({ header, lines }), 'utf8').digest('hex');
}

let failed = false;
const log = (m) => console.log(m);

async function main() {
  if (!manifestPath) throw new Error('uso: --manifest <path> [--apply APPLY_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1]');
  if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.lines) || manifest.lines.length < 1) {
    throw new Error('MANIFEST_EMPTY: manifest sem linhas — nada a aplicar (bloqueio documental honesto).');
  }
  const hash = structuralHash(manifest);

  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u')).rows[0].u;
    if (cu === 'unificard_app') throw new Error('recuso executar como unificard_app — o writer é EXECUTE-fechado p/ app; use o papel operacional/owner');
    log(`[alias-apply] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO') : 'DRY-RUN'} manifest=${manifest.manifest_code}@${manifest.manifest_version} hash=${hash} lines=${manifest.lines.length} current_user=${cu}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ALIAS-APPLY:${manifest.city_id}:${manifest.manifest_code}:${manifest.manifest_version}:${hash}`]);

    // carrega approval vivo para ESTE hash exato
    const appr = (await client.query(
      `SELECT event_id, scope_city_id, line_count FROM public.neighborhood_alias_manifest_events
        WHERE event_type='manifest_approved' AND manifest_code=$1 AND manifest_version=$2 AND manifest_hash=$3`,
      [manifest.manifest_code, manifest.manifest_version, hash],
    )).rows[0];
    if (!appr) throw new Error('APPROVAL_NOT_FOUND: nenhum manifest_approved para (code, version, hash) — aprove antes de aplicar.');
    const revoked = (await client.query(
      `SELECT count(*)::int n FROM public.neighborhood_alias_manifest_events
        WHERE event_type IN ('manifest_revoked','manifest_superseded') AND manifest_code=$1 AND manifest_version=$2 AND manifest_hash=$3`,
      [manifest.manifest_code, manifest.manifest_version, hash],
    )).rows[0].n;
    if (revoked > 0) throw new Error('APPROVAL_NOT_LIVE: manifest revogado/supersedido — fail-closed.');

    // PREFLIGHT de TODAS as linhas: classifica insert/replay/conflict; conflito aborta ANTES de qualquer INSERT.
    let toInsert = [], replay = 0;
    for (const l of manifest.lines) {
      const norm = (await client.query('SELECT public.normalize_name($1) AS n', [l.alias_text])).rows[0].n;
      const nb = (await client.query('SELECT city_id FROM public.neighborhoods WHERE neighborhood_id=$1 AND is_active', [l.neighborhood_id])).rows[0];
      if (!nb) throw new Error(`LINE_NEIGHBORHOOD_INVALID: bairro inativo/inexistente na linha ${l.line_key}`);
      if (nb.city_id !== appr.scope_city_id) throw new Error(`LINE_OUT_OF_SCOPE: bairro fora da cidade do manifest na linha ${l.line_key}`);
      const exact = (await client.query('SELECT count(*)::int n FROM public.neighborhood_aliases WHERE neighborhood_id=$1 AND alias_normalized=$2', [l.neighborhood_id, norm])).rows[0].n;
      if (exact > 0) { replay++; continue; }
      const conflict = (await client.query(
        `SELECT count(*)::int n FROM public.neighborhood_aliases a JOIN public.neighborhoods n ON n.neighborhood_id=a.neighborhood_id
          WHERE n.city_id=$1 AND a.alias_normalized=$2 AND a.neighborhood_id<>$3`, [nb.city_id, norm, l.neighborhood_id])).rows[0].n;
      if (conflict > 0) throw new Error(`ALIAS_CITY_NORMALIZED_CONFLICT: linha ${l.line_key} colide com outro bairro na cidade — decisão humana resolve; lote abortado sem escrita.`);
      toInsert.push(l);
    }
    log(`[alias-apply] preflight: inserir=${toInsert.length} replay=${replay} conflito=0`);

    // rerun/no-op: nada a inserir → não registra execução (evita execução vazia repetida)
    if (toInsert.length === 0) {
      await client.query('ROLLBACK');
      log('[alias-apply] no-op: todas as linhas já aplicadas (replay). Nada a fazer.');
      return;
    }

    // registra execução técnica (job) com contagens do preflight — ANTES dos aliases (§15)
    const execId = (await client.query(
      `SELECT public.fn_register_alias_automation_execution($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
      [appr.event_id, EXECUTOR_NAME, `run-${Date.now()}`, EXECUTOR_NAME, process.env.CODE_COMMIT ?? 'unknown', new Date().toISOString(), toInsert.length, replay],
    )).rows[0].id;

    // cria aliases via writer canônico (owner-only), um por linha
    let created = 0;
    for (const l of toInsert) {
      const r = (await client.query(
        `SELECT outcome FROM public.fn_create_canonical_alias($1,$2,$3,$4,$5,$6,$7,$8)`,
        [appr.event_id, execId, l.neighborhood_id, l.alias_text, l.source_kind, l.source_reference, l.evidence, l.line_key],
      )).rows[0];
      if (r.outcome === 'created') created++;
    }
    if (created !== toInsert.length) { failed = true; log(`  XX  cardinalidade: criados=${created} esperado=${toInsert.length}`); }

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[alias-apply] APPLY COMMIT — ${created} alias(es) criados, execução ${execId}`);
    } else {
      await client.query('ROLLBACK');
      log(`[alias-apply] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido)`);
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
