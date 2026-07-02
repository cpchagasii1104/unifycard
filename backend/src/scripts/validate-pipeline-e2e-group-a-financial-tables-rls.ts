/**
 * E2E — Grupo A (15 tabelas financeiras dormentes/request-driven), continuação do achado B3
 * do auditoria.md. NÃO MOVE DINHEIRO. `SET ROLE unificard_app` real (não superuser) prova
 * isolamento por tenant em cada uma das 15 tabelas.
 *
 * 🔒 DB EFÊMERA. NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/group.*a|financial|rls|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<{ actorId: string; tax: string }> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { actorId, tax };
}

interface TableFixture {
  table: string;
  pkColumn?: string;
  insert: (tenantId: string, ctx: Record<string, string>) => Promise<string>;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Group A RLS E2E',$2)`, [TENANT_A, `group-a-rls-e2e-a-${TENANT_A.slice(0, 8)}`]);
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Group A RLS E2E',$2)`, [TENANT_B, `group-a-rls-e2e-b-${TENANT_B.slice(0, 8)}`]);

  const ctxA: Record<string, string> = {};
  const ctxB: Record<string, string> = {};
  const mkA = await mkActor(TENANT_A, 'GA-ActorA');
  const mkB = await mkActor(TENANT_B, 'GA-ActorB');
  ctxA.actorId = mkA.actorId;
  ctxA.actorTax = mkA.tax;
  ctxB.actorId = mkB.actorId;
  ctxB.actorTax = mkB.tax;
  ctxA.actorId2 = (await mkActor(TENANT_A, 'GA-ActorA2')).actorId;
  ctxB.actorId2 = (await mkActor(TENANT_B, 'GA-ActorB2')).actorId;

  ctxA.eventId = (await pool.query<{ id: string }>(`INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1::uuid,$2::uuid,'user','test','Evento A') RETURNING id::text AS id`, [TENANT_A, ctxA.actorId])).rows[0].id;
  ctxB.eventId = (await pool.query<{ id: string }>(`INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1::uuid,$2::uuid,'user','test','Evento B') RETURNING id::text AS id`, [TENANT_B, ctxB.actorId])).rows[0].id;

  ctxA.escrowId = (await pool.query<{ id: string }>(`INSERT INTO escrow_accounts (tenant_id, buyer_actor_id, seller_actor_id, amount_cents) VALUES ($1::uuid,$2::uuid,$3::uuid,1000) RETURNING escrow_id::text AS id`, [TENANT_A, ctxA.actorId, ctxA.actorId2])).rows[0].id;
  ctxB.escrowId = (await pool.query<{ id: string }>(`INSERT INTO escrow_accounts (tenant_id, buyer_actor_id, seller_actor_id, amount_cents) VALUES ($1::uuid,$2::uuid,$3::uuid,2000) RETURNING escrow_id::text AS id`, [TENANT_B, ctxB.actorId, ctxB.actorId2])).rows[0].id;

  ctxA.bankAccountId = (await pool.query<{ id: string }>(`INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::uuid,'credit') RETURNING id::text AS id`, [TENANT_A, ctxA.actorId])).rows[0].id;
  ctxB.bankAccountId = (await pool.query<{ id: string }>(`INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2::uuid,'credit') RETURNING id::text AS id`, [TENANT_B, ctxB.actorId])).rows[0].id;

  const fixtures: TableFixture[] = [
    { table: 'bank_settlements', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO bank_settlements (tenant_id, payout_id, amount_cents, currency, status) VALUES ($1::uuid,$2::uuid,100,'BRL','pending') RETURNING id::text AS id`, [t, randomUUID()])).rows[0].id },
    { table: 'financial_alerts', insert: async (t) => (await pool.query<{ id: string }>(`INSERT INTO financial_alerts (tenant_id, alert_type, reference_id, severity, message) VALUES ($1::uuid,'test',$2::uuid,'low','test alert') RETURNING id::text AS id`, [t, randomUUID()])).rows[0].id },
    { table: 'financial_risk_events', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO financial_risk_events (tenant_id, actor_id, risk_type, risk_score) VALUES ($1::uuid,$2::uuid,'test',10) RETURNING id::text AS id`, [t, c.actorId])).rows[0].id },
    { table: 'financial_sla_events', insert: async (t) => (await pool.query<{ id: string }>(`INSERT INTO financial_sla_events (tenant_id, sla_type, reference_id, expected_at, actual_at, delay_seconds) VALUES ($1::uuid,'test',$2::uuid,NOW(),NOW(),0) RETURNING id::text AS id`, [t, randomUUID()])).rows[0].id },
    { table: 'financial_audit_trail', insert: async (t) => (await pool.query<{ id: string }>(`INSERT INTO financial_audit_trail (tenant_id, event_type) VALUES ($1::uuid,'test') RETURNING id::text AS id`, [t])).rows[0].id },
    { table: 'escrow_accounts', pkColumn: 'escrow_id', insert: async (t, c) => c.escrowId },
    { table: 'escrow_transactions', pkColumn: 'transaction_id', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO escrow_transactions (escrow_id, tenant_id, transaction_type, amount_cents) VALUES ($1::uuid,$2::uuid,'hold',100) RETURNING transaction_id::text AS id`, [c.escrowId, t])).rows[0].id },
    { table: 'payment_milestones', pkColumn: 'milestone_id', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO payment_milestones (escrow_id, tenant_id, amount_cents) VALUES ($1::uuid,$2::uuid,100) RETURNING milestone_id::text AS id`, [c.escrowId, t])).rows[0].id },
    { table: 'financial_circuit_breakers', insert: async (t) => (await pool.query<{ id: string }>(`INSERT INTO financial_circuit_breakers (tenant_id, breaker_type, status) VALUES ($1::uuid,'test','active') RETURNING id::text AS id`, [t])).rows[0].id },
    { table: 'financial_disputes', insert: async (t) => (await pool.query<{ id: string }>(`INSERT INTO financial_disputes (tenant_id, reference_id, dispute_type, amount_cents, status) VALUES ($1::uuid,$2::uuid,'test',100,'opened') RETURNING id::text AS id`, [t, randomUUID()])).rows[0].id },
    { table: 'financial_freezes', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO financial_freezes (tenant_id, account_id, reference_id, amount_cents, status) VALUES ($1::uuid,$2::uuid,$3::uuid,100,'active') RETURNING id::text AS id`, [t, c.bankAccountId, randomUUID()])).rows[0].id },
    { table: 'financial_rate_limits', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO financial_rate_limits (tenant_id, actor_id, action_type, window_start) VALUES ($1::uuid,$2::uuid,'test',NOW()) RETURNING id::text AS id`, [t, c.actorId])).rows[0].id },
    { table: 'payout_requests', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO payout_requests (tenant_id, actor_id, amount_cents, currency, status) VALUES ($1::uuid,$2::uuid,100,'BRL','requested') RETURNING id::text AS id`, [t, c.actorId])).rows[0].id },
    { table: 'actor_bank_destinations', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO actor_bank_destinations (tenant_id, actor_id, destination_type, pix_key_type, pix_key_value_normalized, holder_name, holder_document, holder_document_type) VALUES ($1::uuid,$2::uuid,'pix_key','cpf',$3,'Test Holder',$3,'cpf') RETURNING id::text AS id`, [t, c.actorId, c.actorTax])).rows[0].id },
    { table: 'event_financial_execution', insert: async (t, c) => (await pool.query<{ id: string }>(`INSERT INTO event_financial_execution (tenant_id, event_id) VALUES ($1::uuid,$2::uuid) RETURNING id::text AS id`, [t, c.eventId])).rows[0].id },
  ];

  const rowsA: Record<string, string> = {};
  const rowsB: Record<string, string> = {};
  for (const f of fixtures) {
    rowsA[f.table] = await f.insert(TENANT_A, ctxA);
    rowsB[f.table] = await f.insert(TENANT_B, ctxB);
  }

  console.log(`\n— Isolamento sob unificard_app real (${fixtures.length} tabelas) —`);
  const client = await pool.connect();
  try {
    await client.query('SET ROLE unificard_app');

    for (const f of fixtures) {
      const pk = f.pkColumn ?? 'id';
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_A]);
      const seenAsA = (await client.query<{ id: string }>(`SELECT ${pk}::text AS id FROM ${f.table}`)).rows.map(r => r.id);
      const aOk = seenAsA.includes(rowsA[f.table]) && !seenAsA.includes(rowsB[f.table]);
      record(`${f.table}: tenant=A vê só a própria linha`, aOk, `seen=${seenAsA.length}`);

      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_B]);
      const seenAsB = (await client.query<{ id: string }>(`SELECT ${pk}::text AS id FROM ${f.table}`)).rows.map(r => r.id);
      const bOk = seenAsB.includes(rowsB[f.table]) && !seenAsB.includes(rowsA[f.table]);
      record(`${f.table}: tenant=B vê só a própria linha`, bOk, `seen=${seenAsB.length}`);
    }

    await client.query('RESET ROLE');
  } finally {
    client.release();
  }

  console.log('\n— superuser (conexão normal) continua vendo tudo, sem regressão —');
  const superuserSample = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM financial_disputes WHERE id::text = ANY($1::text[])`, [[rowsA.financial_disputes, rowsB.financial_disputes]])).rows;
  record('superuser vê ambas as linhas (A e B) em financial_disputes', superuserSample.length === 2, `count=${superuserSample.length}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log(`✨ ${fixtures.length} tabelas do Grupo A isoladas por tenant sob unificard_app real; superuser sem regressão; Δbank=0.`);
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
