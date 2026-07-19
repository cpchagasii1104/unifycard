// validate-company-access-f2-dualwrite.ts — PROVA DE ATOMICIDADE DA DUAL-WRITE (DECISION-0189 F2)
//
// Roda contra o banco apontado por DATABASE_URL (usar CLONE efêmero do dev — nunca o dev).
// Prova, por FALHA INJETADA, que delegação (fonte antiga) + casa jurídica + evento são
// UMA transação: se qualquer perna falha, NENHUMA linha persiste (B5 remediada).
//
// Casos:
//   1. ROLLBACK por falha injetada APÓS delegation.create(client) e relationship.open(client)
//      → contagens de actor_delegations / company_member_relationships / company_member_events
//        IDÊNTICAS às de antes.
//   2. COMMIT feliz → +1 delegação ativa, vínculo vigente substituído (cadeia predecessor_id),
//      +1 evento; depois revoke(client) na mesma mecânica.
//   3. Trilha append-only: UPDATE/DELETE em company_member_events FALHAM (trigger).
//
// Sai com exit 1 em qualquer divergência. Não é seed: só roda em clone efêmero.

import { getClientWithTenant, runQueryWithTenant, pool } from '@core/database/pool';
import { actorDelegationRepository } from '@core/actor-delegation/actor-delegation.repository';
import { companyMemberRelationshipsRepository } from '@core/companies/company-member-relationships.repository';

const die = (msg: string): never => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

async function counts(tenantId: string) {
  const q = async (sql: string) =>
    Number((await runQueryWithTenant<{ c: string }>(tenantId, sql, [tenantId]))?.c ?? '0');
  return {
    delegations: await q(`SELECT COUNT(*)::text AS c FROM actor_delegations WHERE tenant_id = $1`),
    relationships: await q(`SELECT COUNT(*)::text AS c FROM company_member_relationships WHERE tenant_id = $1`),
    events: await q(`SELECT COUNT(*)::text AS c FROM company_member_events WHERE tenant_id = $1`),
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/f2|ephemeral|clone|upgrade/i.test(dbUrl)) {
    die(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()}) — esta prova só roda em clone descartável`);
  }

  // fixture real do clone: 1 company_user + page actor + user actor
  const fixture = await pool.query(`
    SELECT cu.id AS company_user_id, cu.tenant_id, cu.company_id, cu.global_user_id,
           ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`);
  if (fixture.rows.length === 0) die('clone sem company_users/actors — fixture ausente');
  const fx = fixture.rows[0] as {
    company_user_id: string; tenant_id: string; company_id: string;
    user_actor_id: string; page_actor_id: string;
  };
  const tenantId = fx.tenant_id;

  const before = await counts(tenantId);

  // ── CASO 1: falha injetada → rollback TOTAL ────────────────────────────────
  {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      await actorDelegationRepository.create(
        tenantId,
        {
          userActorId: fx.user_actor_id,
          institutionalActorId: fx.page_actor_id,
          scopes: ['publish_feed'],
          relationshipType: 'employee',
          grantedByActorId: fx.user_actor_id,
        },
        client
      );
      await companyMemberRelationshipsRepository.openRelationshipOnClient(client, {
        tenantId,
        companyId: fx.company_id,
        companyUserId: fx.company_user_id,
        relationshipType: 'employee',
        source: 'declared',
      });
      // FALHA INJETADA (simula crash entre as pernas — nada pode persistir)
      throw new Error('INJECTED_FAILURE_F2_PROOF');
    } catch (err) {
      if (!(err instanceof Error) || err.message !== 'INJECTED_FAILURE_F2_PROOF') throw err;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const after = await counts(tenantId);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      die(`CASO 1 FALHOU: contagens mudaram após rollback (antes=${JSON.stringify(before)} depois=${JSON.stringify(after)})`);
    }
    console.log('✅ CASO 1: falha injetada → ROLLBACK total (delegação+vínculo+evento não persistiram)');
  }

  // ── CASO 2: commit feliz → tudo persiste junto; depois revoke na mesma mecânica ──
  {
    const client = await getClientWithTenant(tenantId);
    let delegationId = '';
    try {
      await client.query('BEGIN');
      const d = await actorDelegationRepository.create(
        tenantId,
        {
          userActorId: fx.user_actor_id,
          institutionalActorId: fx.page_actor_id,
          scopes: ['publish_feed'],
          relationshipType: 'employee',
          grantedByActorId: fx.user_actor_id,
        },
        client
      );
      delegationId = d.delegationId;
      const rel = await companyMemberRelationshipsRepository.openRelationshipOnClient(client, {
        tenantId,
        companyId: fx.company_id,
        companyUserId: fx.company_user_id,
        relationshipType: 'employee',
        source: 'declared',
      });
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId,
        companyId: fx.company_id,
        companyUserId: fx.company_user_id,
        eventType: 'relationship_declared',
        details: { proof: 'f2-dualwrite', relationship_id: rel.relationshipId },
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw err;
    }
    client.release();

    const after = await counts(tenantId);
    if (after.delegations !== before.delegations + 1) die(`CASO 2: delegações esperadas ${before.delegations + 1}, obtidas ${after.delegations}`);
    if (after.events < before.events + 1) die(`CASO 2: eventos não cresceram`);
    const chain = await pool.query(
      `SELECT COUNT(*)::int AS c FROM company_member_relationships
        WHERE tenant_id = $1 AND company_user_id = $2 AND valid_to IS NULL`,
      [tenantId, fx.company_user_id]
    );
    if ((chain.rows[0] as { c: number }).c !== 1) die('CASO 2: vínculo vigente não é único');
    console.log('✅ CASO 2: commit feliz → delegação+vínculo(único vigente)+evento persistidos juntos');

    // revoke na mesma mecânica transacional
    const client2 = await getClientWithTenant(tenantId);
    try {
      await client2.query('BEGIN');
      const ok = await actorDelegationRepository.revoke(tenantId, delegationId, fx.user_actor_id, client2);
      if (!ok) throw new Error('revoke retornou false');
      await client2.query('COMMIT');
    } catch (err) {
      await client2.query('ROLLBACK').catch(() => {});
      client2.release();
      throw err;
    }
    client2.release();
    console.log('✅ CASO 2b: revoke transaction-aware OK');
  }

  // ── CASO 3: trilha append-only ─────────────────────────────────────────────
  {
    let blocked = 0;
    for (const sql of [
      `UPDATE company_member_events SET details = '{}'::jsonb WHERE tenant_id = $1`,
      `DELETE FROM company_member_events WHERE tenant_id = $1`,
    ]) {
      try {
        await pool.query(sql, [tenantId]);
        die(`CASO 3: ${sql.split(' ')[0]} em company_member_events NÃO foi bloqueado`);
      } catch (err) {
        if (err instanceof Error && /APPEND-ONLY/i.test(err.message)) blocked++;
        else throw err;
      }
    }
    if (blocked !== 2) die('CASO 3: trigger append-only não bloqueou UPDATE e DELETE');
    console.log('✅ CASO 3: company_member_events é append-only (UPDATE/DELETE bloqueados por trigger)');
  }

  console.log('\n✅✅ PROVA F2 DUAL-WRITE: 3/3 casos verdes');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ prova F2 falhou:', err);
  process.exit(1);
});
