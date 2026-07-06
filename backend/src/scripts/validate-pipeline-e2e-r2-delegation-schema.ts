/**
 * E2E — R2.1 (Lote L2): schema de delegação governada + audit append-only.
 * 🔒 Roda SÓ em DB efêmera (run-r2-delegation-schema-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova as invariantes da migration 20260706120000_r2_delegation_governed_links_and_audit:
 *   1 três colunas novas (relationship_type/granted_by_actor_id/previous_link_id) nullable;
 *   2 actor_delegation_events existe;
 *   3 delegação legada (colunas novas NULL) continua inserível (aditivo, Lei 4);
 *   4 relationship_type válido (director) aceito;
 *   5 relationship_type inválido REJEITADO pelo CHECK;
 *   6 previous_link_id encadeamento válido aceito;
 *   7 previous_link_id inexistente REJEITADO pela FK;
 *   8 evento granted inserível;
 *   9 event_type inválido REJEITADO pelo CHECK;
 *  10 UPDATE em actor_delegation_events BLOQUEADO (append-only);
 *  11 DELETE em actor_delegation_events BLOQUEADO (append-only).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/r2|delegation|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeral();

  // 1. Colunas novas nullable.
  const cols = (await pool.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name='actor_delegations'
       AND column_name IN ('relationship_type','granted_by_actor_id','previous_link_id')`
  )).rows;
  rec('1 três colunas novas nullable', cols.length === 3 && cols.every((r) => r.is_nullable === 'YES'), JSON.stringify(cols));

  // 2. Tabela de eventos existe.
  const t = (await pool.query<{ t: string | null }>(`SELECT to_regclass('public.actor_delegation_events') AS t`)).rows[0].t;
  rec('2 actor_delegation_events existe', t !== null, String(t));

  // Fixtures: tenant + 2 actors. a1='user' exige identidade (chk_actor_requires_identity cobre user/
  // actor_human/person desde 20260530577000) → cadeia global_users→identities→global_user_id. a2='page'
  // (institucional) não exige.
  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'R2 T',$2)`, [T, `r2-t-${Date.now()}`]);
  const gu = randomUUID();
  const tax = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  const a1 = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','A1',$2::uuid) RETURNING id`, [T, gu])).rows[0].id;
  // a2='page' exige responsible_actor_id (§4.8 âncora humana) → aponta para a1 (o humano).
  const a2 = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, responsible_actor_id) VALUES ($1,'page','A2',$2) RETURNING id`, [T, a1])).rows[0].id;

  // 3. Delegação legada (colunas novas NULL) continua inserível.
  const d1 = (await pool.query<{ delegation_id: string }>(
    `INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json) VALUES ($1,$2,$3,'[]'::jsonb) RETURNING delegation_id`,
    [T, a1, a2]
  )).rows[0].delegation_id;
  rec('3 delegação legada (colunas novas NULL) inserível', !!d1);

  // 4. relationship_type válido aceito.
  let okValid = false;
  try { await pool.query(`UPDATE actor_delegations SET relationship_type='director', granted_by_actor_id=$2 WHERE delegation_id=$1`, [d1, a2]); okValid = true; } catch { okValid = false; }
  rec('4 relationship_type válido (director) aceito', okValid);

  // 5. relationship_type inválido REJEITADO.
  let rejected = false;
  try { await pool.query(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, relationship_type) VALUES ($1,$2,$3,'presidente_supremo')`, [T, a1, a2]); }
  catch (e: any) { rejected = /chk_actor_delegations_relationship_type|check constraint/i.test(e.message); }
  rec('5 relationship_type inválido REJEITADO pelo CHECK', rejected);

  // 6. previous_link_id encadeamento válido aceito.
  let chainOk = false;
  try { const d2 = (await pool.query<{ delegation_id: string }>(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, previous_link_id) VALUES ($1,$2,$3,$4) RETURNING delegation_id`, [T, a1, a2, d1])).rows[0].delegation_id; chainOk = !!d2; } catch { chainOk = false; }
  rec('6 previous_link_id encadeamento válido aceito', chainOk);

  // 7. previous_link_id inexistente REJEITADO pela FK.
  let fkRej = false;
  try { await pool.query(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, previous_link_id) VALUES ($1,$2,$3,$4)`, [T, a1, a2, randomUUID()]); }
  catch (e: any) { fkRej = /foreign key|fk_actor_delegations_previous_link/i.test(e.message); }
  rec('7 previous_link_id inexistente REJEITADO pela FK', fkRej);

  // 8. Evento granted inserível.
  const e1 = (await pool.query<{ event_id: string }>(
    `INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type, actor_id, relationship_type) VALUES ($1,$2,'granted',$3,'director') RETURNING event_id`,
    [T, d1, a2]
  )).rows[0].event_id;
  rec('8 evento granted inserível', !!e1);

  // 9. event_type inválido REJEITADO.
  let etRej = false;
  try { await pool.query(`INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type) VALUES ($1,$2,'hackeado')`, [T, d1]); }
  catch (e: any) { etRej = /check constraint|event_type/i.test(e.message); }
  rec('9 event_type inválido REJEITADO pelo CHECK', etRej);

  // 10. Append-only: UPDATE bloqueado.
  let upBlocked = false;
  try { await pool.query(`UPDATE actor_delegation_events SET reason='x' WHERE event_id=$1`, [e1]); }
  catch (e: any) { upBlocked = /append-only/i.test(e.message); }
  rec('10 UPDATE em actor_delegation_events BLOQUEADO (append-only)', upBlocked);

  // 11. Append-only: DELETE bloqueado.
  let delBlocked = false;
  try { await pool.query(`DELETE FROM actor_delegation_events WHERE event_id=$1`, [e1]); }
  catch (e: any) { delBlocked = /append-only/i.test(e.message); }
  rec('11 DELETE em actor_delegation_events BLOQUEADO (append-only)', delBlocked);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
