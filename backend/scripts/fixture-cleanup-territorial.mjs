#!/usr/bin/env node
// FASE D (F-ADDRESS-CANONICAL-BINDING) — LIMPEZA GOVERNADA de fixtures territoriais.
// One-shot NÃO rerunnable: remove EXATAMENTE as 34 addresses + 9 address_assignments do MANIFEST
// FECHADO, preservando os 3 pares vivos. Sem descoberta dinâmica, sem wildcard, sem CASCADE, sem
// migration, sem provider, sem cache, sem actor-scoped, sem Bank/Social. Ordem: assignments→addresses.
//
// Modos:
//   --dry-run                                     → executa todo o fluxo e ROLLBACK obrigatório.
//   --apply --confirm APPLY_FIXTURE_CLEANUP_TERRITORIAL_V1  → COMMIT único após todas as provas.
// Sem token exato / argumento inválido → uso seguro, exit≠0, ZERO write.
//
// Rerun fail-closed: um segundo apply encontra baseline divergente (addresses≠37/assignments≠12) e
// ABORTA — a ausência das rows NÃO é tratada como sucesso idempotente silencioso.

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, 'fixture-cleanup-territorial-manifest.json');
const CONFIRM_TOKEN = 'APPLY_FIXTURE_CLEANUP_TERRITORIAL_V1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function log(m) { console.log(m); }
function envDatabaseUrl() {
  const m = readFileSync(join(HERE, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

function parseArgs(argv) {
  const a = argv.slice(2);
  const dryRun = a.includes('--dry-run');
  const apply = a.includes('--apply');
  const ci = a.indexOf('--confirm');
  const confirm = ci >= 0 ? a[ci + 1] : null;
  return { dryRun, apply, confirm, raw: a };
}

// Hash canônico do manifest (sobre o núcleo, excluindo manifestHash/evidence).
function canonicalManifestHash(m) {
  const core = {
    version: m.version,
    baseline: m.baseline,
    expectedFinal: m.expectedFinal,
    preserve: m.preserve,
    remove: m.remove,
  };
  return createHash('sha256').update(JSON.stringify(core)).digest('hex');
}

function validateManifestSchema(m) {
  if (m.version !== 1) throw new Error('manifest.version != 1');
  const okCounts = m.baseline.addresses === 37 && m.baseline.addressAssignments === 12 && m.baseline.actorScoped === 0
    && m.expectedFinal.addresses === 3 && m.expectedFinal.addressAssignments === 3 && m.expectedFinal.actorScoped === 0;
  if (!okCounts) throw new Error('manifest baseline/expectedFinal inesperado');
  const pA = m.preserve.addressIds, pS = m.preserve.assignmentIds, rA = m.remove.addressIds, rS = m.remove.assignmentIds;
  if (pA.length !== 3 || pS.length !== 3) throw new Error('preserve deve ter 3 addr + 3 asg');
  if (rA.length !== 34 || rS.length !== 9) throw new Error('remove deve ter 34 addr + 9 asg');
  for (const id of [...pA, ...pS, ...rA, ...rS]) if (!UUID_RE.test(id)) throw new Error('UUID inválido no manifest: ' + id);
  if (new Set([...pA, ...rA]).size !== 37) throw new Error('overlap/duplicidade em addressIds');
  if (new Set([...pS, ...rS]).size !== 12) throw new Error('overlap/duplicidade em assignmentIds');
  const recomputed = canonicalManifestHash(m);
  if (recomputed !== m.manifestHash) throw new Error(`manifestHash divergente (esperado ${m.manifestHash}, recomputado ${recomputed})`);
  return { pA, pS, rA, rS };
}

async function count(client, sql, params = []) { return (await client.query(sql, params)).rows[0].n; }

async function main() {
  const { dryRun, apply, confirm, raw } = parseArgs(process.argv);
  const validMode = (dryRun && !apply) || (apply && !dryRun);
  if (!validMode) {
    log('Uso seguro:');
    log('  node scripts/fixture-cleanup-territorial.mjs --dry-run');
    log('  node scripts/fixture-cleanup-territorial.mjs --apply --confirm ' + CONFIRM_TOKEN);
    log('ZERO write. Modo ausente/ambíguo → recusado.');
    process.exit(2);
  }
  if (apply && confirm !== CONFIRM_TOKEN) {
    log(`--apply exige o token EXATO: ${CONFIRM_TOKEN} (recebido: ${confirm ?? '∅'}). ZERO write.`);
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const { pA, pS, rA, rS } = validateManifestSchema(manifest);
  log(`[fixture-cleanup] manifest OK (hash ${manifest.manifestHash.slice(0, 12)}…) · preserve 3/3 · remove 34/9`);

  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  let failed = false;
  try {
    const cu = (await client.query('SELECT current_user AS u')).rows[0].u;
    if (cu === 'unificard_app') throw new Error('recuso executar como unificard_app — use o papel operacional/owner');
    log(`[fixture-cleanup] modo=${apply ? 'APPLY (confirmado)' : 'DRY-RUN'} · current_user=${cu}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['FIXTURE-CLEANUP-TERRITORIAL:v1']);

    // ── PREFLIGHT · baseline (rerun fail-closed: divergência aborta, nunca sucesso silencioso) ──
    const baseAddr = await count(client, 'SELECT count(*)::int n FROM addresses');
    const baseAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments');
    const baseActorScoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor'");
    if (baseAddr !== 37 || baseAsg !== 12 || baseActorScoped !== 0) {
      throw new Error(`BASELINE DIVERGENTE (addresses=${baseAddr}/assignments=${baseAsg}/actor-scoped=${baseActorScoped}; esperado 37/12/0) — fail-closed (one-shot já aplicado? estado inesperado?).`);
    }

    // ── PREFLIGHT · preservados existem e coerentes (nunca tocados) ──
    for (let i = 0; i < 3; i++) {
      const addrId = pA[i];
      // par preserve[i] não é assumido — validamos que CADA address preservado existe e tem assignment vivo coerente.
      const okAddr = await count(client, 'SELECT count(*)::int n FROM addresses WHERE address_id=$1', [addrId]);
      if (okAddr !== 1) throw new Error(`preservado address ${addrId} não existe (n=${okAddr})`);
    }
    const preservedCoherent = await count(client, `
      SELECT count(*)::int n FROM address_assignments aa
      JOIN addresses ad ON ad.address_id = aa.address_id
      JOIN cities c ON c.city_id = ad.city_id AND c.is_active = true
      WHERE aa.assignment_id = ANY($1::uuid[])
        AND aa.address_id = ANY($2::uuid[])
        AND aa.valid_until_at IS NULL AND aa.is_primary = true
        AND (
          (aa.owner_type='profile' AND EXISTS(SELECT 1 FROM actors a WHERE a.id=aa.owner_id))
          OR (aa.owner_type='actor_asset' AND EXISTS(SELECT 1 FROM actor_assets x WHERE x.id=aa.owner_id))
        )`, [pS, pA]);
    if (preservedCoherent !== 3) throw new Error(`preservados incoerentes (esperado 3, obtido ${preservedCoherent}): owner/tenant/city/vigência`);

    // ── PREFLIGHT · removíveis existem, na quantidade exata, sem overlap com preservados ──
    const remAddrExist = await count(client, 'SELECT count(*)::int n FROM addresses WHERE address_id = ANY($1::uuid[])', [rA]);
    if (remAddrExist !== 34) throw new Error(`remove addresses: esperado 34 existentes, obtido ${remAddrExist}`);
    const remAsgExist = await count(client, 'SELECT count(*)::int n FROM address_assignments WHERE assignment_id = ANY($1::uuid[])', [rS]);
    if (remAsgExist !== 9) throw new Error(`remove assignments: esperado 9 existentes, obtido ${remAsgExist}`);
    const overlapAddr = await count(client, 'SELECT count(*)::int n FROM addresses WHERE address_id = ANY($1::uuid[]) AND address_id = ANY($2::uuid[])', [pA, rA]);
    const overlapAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments WHERE assignment_id = ANY($1::uuid[]) AND assignment_id = ANY($2::uuid[])', [pS, rS]);
    if (overlapAddr !== 0 || overlapAsg !== 0) throw new Error('overlap preserve∩remove detectado no banco — fail-closed');

    // ── PREFLIGHT · morte do owner AINDA vale por classe (removível ganhando owner vivo → aborta) ──
    const revived = await count(client, `
      SELECT count(*)::int n FROM address_assignments aa
      WHERE aa.assignment_id = ANY($1::uuid[]) AND (
        (aa.owner_type='profile' AND EXISTS(SELECT 1 FROM actors a WHERE a.id=aa.owner_id))
        OR (aa.owner_type='company' AND EXISTS(SELECT 1 FROM companies co WHERE co.company_id=aa.owner_id))
        OR (aa.owner_type='rentable_resource' AND EXISTS(SELECT 1 FROM rentable_resources rr WHERE rr.id=aa.owner_id))
      )`, [rS]);
    if (revived !== 0) throw new Error(`removível ganhou owner VIVO (${revived}) desde o GATE — fail-closed`);
    // actor-scoped nunca é removido por esta limpeza (defesa: nenhum remove é actor-scoped)
    const remActorScoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE assignment_id = ANY($1::uuid[]) AND owner_type='actor'", [rS]);
    if (remActorScoped !== 0) throw new Error('remove inclui actor-scoped — proibido');

    // ── PREFLIGHT · grafo de referências: nenhum dos 34 addresses referenciado fora dos 9 assignments ──
    const extRefs = await count(client, `
      SELECT (
        (SELECT count(*) FROM actor_active_location WHERE address_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM companies WHERE primary_address_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM posts WHERE address_id = ANY($1::uuid[]))
      + (SELECT count(*) FROM tenants WHERE headquarters_address_id = ANY($1::uuid[]))
      )::int AS n`, [rA]);
    if (extRefs !== 0) throw new Error(`remove address com FK externa VIVA (${extRefs}) — fail-closed`);
    // introspecção: nenhuma FK NOVA (fora das 5 conhecidas) referencia addresses
    const knownFkTargets = new Set(['actor_active_location.address_id', 'address_assignments.address_id', 'companies.primary_address_id', 'posts.address_id', 'tenants.headquarters_address_id']);
    const fkRows = (await client.query(`
      SELECT tc.table_name AS src, kcu.column_name AS col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='addresses'`)).rows;
    for (const r of fkRows) {
      const key = `${r.src}.${r.col}`;
      if (!knownFkTargets.has(key)) throw new Error(`FK NOVA para addresses descoberta (${key}) — o manifest não cobre; fail-closed`);
    }
    // nenhum assignment (fora dos 9) aponta para os 34 addresses
    const otherAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments WHERE address_id = ANY($1::uuid[]) AND NOT (assignment_id = ANY($2::uuid[]))', [rA, rS]);
    if (otherAsg !== 0) throw new Error(`address removível referenciado por assignment fora do manifest (${otherAsg}) — fail-closed`);
    // nenhum evento/auditoria referencia os 34 addresses
    const evRefs = await count(client, 'SELECT count(*)::int n FROM actor_events WHERE reference_id = ANY(SELECT unnest($1::uuid[])::text)', [rA]);
    if (evRefs !== 0) throw new Error(`address removível referenciado por actor_events (${evRefs}) — fail-closed`);
    log('[fixture-cleanup] preflight VERDE: baseline 37/12/0, preservados coerentes, 34/9 removíveis sem owner vivo/FK/evento.');

    // ── DELETE · ordem estrita: assignments (9) → addresses (34), UUIDs exatos parametrizados ──
    const delAsg = (await client.query('DELETE FROM address_assignments WHERE assignment_id = ANY($1::uuid[])', [rS])).rowCount;
    if (delAsg !== 9) throw new Error(`DELETE assignments removeu ${delAsg} (esperado 9) — fail-closed`);
    const delAddr = (await client.query('DELETE FROM addresses WHERE address_id = ANY($1::uuid[])', [rA])).rowCount;
    if (delAddr !== 34) throw new Error(`DELETE addresses removeu ${delAddr} (esperado 34) — fail-closed`);

    // ── POST-DELETE · estado final na transação ──
    const fAddr = await count(client, 'SELECT count(*)::int n FROM addresses');
    const fAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments');
    const fActorScoped = await count(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor'");
    if (fAddr !== 3 || fAsg !== 3 || fActorScoped !== 0) throw new Error(`final divergente (addresses=${fAddr}/assignments=${fAsg}/actor-scoped=${fActorScoped}; esperado 3/3/0)`);
    // preservados intactos
    const preservedStill = await count(client, 'SELECT count(*)::int n FROM addresses WHERE address_id = ANY($1::uuid[])', [pA]);
    const preservedAsgStill = await count(client, 'SELECT count(*)::int n FROM address_assignments WHERE assignment_id = ANY($1::uuid[])', [pS]);
    if (preservedStill !== 3 || preservedAsgStill !== 3) throw new Error('preservados sumiram — fail-closed');
    // removidos ausentes
    const removedGone = await count(client, 'SELECT count(*)::int n FROM addresses WHERE address_id = ANY($1::uuid[])', [rA]);
    const removedAsgGone = await count(client, 'SELECT count(*)::int n FROM address_assignments WHERE assignment_id = ANY($1::uuid[])', [rS]);
    if (removedGone !== 0 || removedAsgGone !== 0) throw new Error('removidos remanescentes — fail-closed');
    // órfãos finais = 0 (todo address restante tem assignment) e nenhum assignment aponta para address ausente
    const orphans = await count(client, 'SELECT count(*)::int n FROM addresses a WHERE NOT EXISTS(SELECT 1 FROM address_assignments aa WHERE aa.address_id=a.address_id)');
    if (orphans !== 0) throw new Error(`órfãos finais != 0 (${orphans}) — fail-closed`);
    const danglingAsg = await count(client, 'SELECT count(*)::int n FROM address_assignments aa WHERE NOT EXISTS(SELECT 1 FROM addresses a WHERE a.address_id=aa.address_id)');
    if (danglingAsg !== 0) throw new Error(`assignment apontando para address ausente (${danglingAsg}) — fail-closed`);
    // território/cache/bank inalterados
    const nb = await count(client, 'SELECT count(*)::int n FROM neighborhoods');
    const cities = await count(client, 'SELECT count(*)::int n FROM cities');
    const states = await count(client, 'SELECT count(*)::int n FROM states');
    const cache = await count(client, 'SELECT count(*)::int n FROM cep_resolution_cache');
    const bank = await count(client, 'SELECT count(*)::int n FROM bank_accounts');
    const bankSum = (await client.query('SELECT coalesce(sum(reconciliation_balance_cents),0)::bigint AS n FROM bank_accounts')).rows[0].n;
    if (nb !== 75 || cities !== 27 || states !== 27 || cache !== 3 || bank !== 15 || String(bankSum) !== '0') {
      throw new Error(`território/cache/bank alterado (nb=${nb}/cities=${cities}/states=${states}/cache=${cache}/bank=${bank}/Δbank=${bankSum}) — fail-closed`);
    }
    log('[fixture-cleanup] pós-delete VERDE: 3/3/0, preservados intactos, removidos ausentes, órfãos=0, território/cache/bank inalterados, Δbank=0.');

    if (apply && confirm === CONFIRM_TOKEN && !failed) {
      await client.query('COMMIT');
      log('[fixture-cleanup] APPLY COMMIT — 34 addresses + 9 assignments removidos; 3 pares preservados.');
    } else {
      await client.query('ROLLBACK');
      log('[fixture-cleanup] DRY-RUN → ROLLBACK (nada persistido).');
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

main().catch((e) => { console.error('CRASH: ' + (e?.message ?? e)); process.exit(1); });
