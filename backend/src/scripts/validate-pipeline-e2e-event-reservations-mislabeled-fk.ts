// E2E — F-EVENT-RESERVATIONS-MISLABELED-FK-CONTAIN (achado B7 / DT-IDENTITY-TRIAD-AND-MISLABELED-FK c).
// Roda SÓ em DB efêmera (runner run-event-reservations-mislabeled-fk-ephemeral.ps1). NUNCA unificard_dev.
// Prova, contra migrations VIVAS aplicadas FULL:
//   A) a migration 20260703120000 aplicou → event_reservations NÃO tem global_user_id e TEM actor_id NOT NULL;
//   B) o fail-closed do DROP funciona (dado divergente → RAISE; reconciliado → DROP ok) — unit em temp table;
//   C) o leitor vivo (home-feed shape: WHERE er.actor_id = $1) executa.
// Money-free por construção: a migration dropa uma coluna NÃO-monetária e nenhum arquivo do
// domínio de valor é tocado — garantido pelo gate de fronteira do Bank (§4.6) + diff sem arquivo
// do core do Bank. (Deliberadamente NÃO consultamos as tabelas de valor do Bank aqui: uma
// asserção redundante só faria o teto de vocabulário de DECISION-0158 subir sem ganho.)

import { Client } from 'pg';

const url = process.env.DATABASE_URL || '';
const dbName = url.replace(/^.*\//, '').replace(/\?.*$/, '');
if (!dbName || dbName === 'unificard_dev') {
  console.error(`ABORT: E2E recusa rodar fora de DB efêmera (db='${dbName}').`);
  process.exit(1);
}

let failed = false;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) failed = true;
};

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    // ── A: schema pós-migration ──
    const cols = await c.query(
      `SELECT column_name, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'event_reservations'
          AND column_name IN ('global_user_id', 'actor_id')`
    );
    const byName = new Map(cols.rows.map((r: any) => [r.column_name, r.is_nullable]));
    ok(!byName.has('global_user_id'), 'A1 · event_reservations.global_user_id (a FK que mentia) foi DROPADA');
    ok(byName.has('actor_id'), 'A2 · event_reservations.actor_id (canônico actor-first) presente');
    ok(byName.get('actor_id') === 'NO', 'A3 · actor_id é NOT NULL (garante completude de referência de actor)');

    // o índice da coluna mentirosa também sumiu (cascata do DROP COLUMN)
    const idx = await c.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'event_reservations' AND indexname = 'idx_event_reservations_global_user'`
    );
    ok(idx.rowCount === 0, 'A4 · idx_event_reservations_global_user removido em cascata');

    // ── B: fail-closed do DROP (unit em temp table espelhando a lógica do DO block) ──
    await c.query(`CREATE TEMP TABLE _er_fc (actor_id uuid NOT NULL, global_user_id uuid)`);
    const A = '11111111-1111-1111-1111-111111111111';
    const B = '22222222-2222-2222-2222-222222222222';
    await c.query(`INSERT INTO _er_fc (actor_id, global_user_id) VALUES ($1, $2)`, [A, B]); // divergente
    const guardSql = `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM _er_fc WHERE global_user_id IS NOT NULL AND global_user_id IS DISTINCT FROM actor_id) THEN
        RAISE EXCEPTION 'ABORT_FAILCLOSED';
      END IF;
      ALTER TABLE _er_fc DROP COLUMN IF EXISTS global_user_id;
    END $$;`;
    let raised = false;
    try { await c.query(guardSql); } catch (e: any) { raised = /ABORT_FAILCLOSED/.test(e.message); }
    ok(raised, 'B1 · dado divergente (global_user_id ≠ actor_id) → migration ABORTA fail-closed (não destrói identidade)');
    // reconcilia (iguala) → o guard passa e o DROP ocorre
    await c.query(`UPDATE _er_fc SET global_user_id = actor_id`);
    let dropped = false;
    try { await c.query(guardSql); dropped = true; } catch { dropped = false; }
    const stillHasCol = await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = '_er_fc' AND column_name = 'global_user_id'`
    );
    ok(dropped && stillHasCol.rowCount === 0, 'B2 · dado reconciliado (redundante) → DROP prossegue');

    // ── C: shape do leitor vivo (home-feed) executa sobre actor_id ──
    const readerShape = await c.query(
      `SELECT er.id FROM event_reservations er WHERE er.actor_id = $1 LIMIT 1`,
      ['00000000-0000-0000-0000-000000000000']
    );
    ok(readerShape.rowCount === 0, 'C1 · shape do home-feed (WHERE er.actor_id = $1) executa sem erro de coluna');
  } finally {
    await c.end();
  }
}

main()
  .then(() => {
    if (failed) { console.error('\nE2E EVENT-RESERVATIONS-MISLABELED-FK: FALHOU'); process.exit(1); }
    console.log('\nE2E EVENT-RESERVATIONS-MISLABELED-FK: OK (A schema + B fail-closed + C reader)');
  })
  .catch((e) => { console.error('💥', e.message); process.exit(1); });
