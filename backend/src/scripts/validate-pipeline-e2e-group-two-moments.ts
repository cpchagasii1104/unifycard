/**
 * E2E FASE 3C.3 — Group-Actor em Dois Momentos (Etapa 4)
 * Desenho: docs/02_decisions/DESENHO_FASE_3C_GROUP_ACTOR_DOIS_MOMENTOS.md (commit 962987b1)
 *
 * Prova M/A/CLEANUP:
 *   M (schema)    — uq_actors_group, FK actors.group_id, uq_groups_actor.
 *                   Rodam em BEGIN/ROLLBACK → ZERO resíduo.
 *   A (ativação)  — createGroup: group-actor criado implicitamente, actor_type='group',
 *                   responsible_actor_id = owner_actor_id, idempotência, owner não downgraded.
 *
 * Base: tenant DEV + PF canônica da 3A (dev@unificard.local).
 * Grupos de teste são criados via groupsService e LIMPOS ao fim (DEV intacto).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-group-two-moments.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool, getClientWithTenant } from '../core/database/pool';
import { groupsService } from '../modules/groups/groups.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function main(): Promise<void> {
  await bootstrap();

  // ── Fixtures ──────────────────────────────────────────────────────────────
  const dev = await pool.query<{ user_id: string; global_user_id: string }>(
    `SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devUserId = dev.rows[0].user_id;

  const devActor = await pool.query<{ actor_id: string }>(
    `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  if (devActor.rowCount === 0) {
    console.error('❌ actor humano DEV não encontrado.');
    process.exit(1);
  }
  const devActorId = devActor.rows[0].actor_id;

  const createdGroupIds: string[] = [];

  try {
    // ═══ M — SCHEMA (BEGIN/ROLLBACK, zero resíduo) ═══════════════════════════
    console.log('\n— M (schema) —');
    const mc = await getClientWithTenant(TENANT_ID);
    try {
      await mc.query('BEGIN');

      // Grupo temporário para as provas de schema
      const mGroupRes = await mc.query<{ id: string }>(
        `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status)
         VALUES ($1, 'M-test-group', 'm-test-group-schema', $2, 'active')
         RETURNING id::text`,
        [TENANT_ID, devActorId]
      );
      const mGroupId = mGroupRes.rows[0].id;
      record('M1 groups aceita Momento 1 (actor_id NULL)', true);

      const expectSql = async (label: string, sql: string, params: unknown[], pgcode: string) => {
        await mc.query('SAVEPOINT sp');
        try {
          await mc.query(sql, params);
          await mc.query('RELEASE SAVEPOINT sp');
          record(label, false, `esperava ${pgcode}, mas passou`);
        } catch (e) {
          await mc.query('ROLLBACK TO SAVEPOINT sp');
          const c = (e as { code?: string }).code;
          record(label, c === pgcode, c === pgcode ? undefined : `code=${c} msg=${(e as Error).message}`);
        }
      };

      // M2 — uq_actors_group: segundo group-actor para o mesmo group_id bloqueado
      await mc.query(
        `INSERT INTO actors (tenant_id, actor_type, group_id, display_name, responsible_actor_id)
         VALUES ($1, 'group', $2, 'm2-a', $3)`,
        [TENANT_ID, mGroupId, devActorId]
      );
      await expectSql(
        'M2 uq_actors_group bloqueia 2º group-actor',
        `INSERT INTO actors (tenant_id, actor_type, group_id, display_name, responsible_actor_id)
         VALUES ($1, 'group', $2, 'm2-b', $3)`,
        [TENANT_ID, mGroupId, devActorId],
        '23505'
      );

      // M3 — FK actors.group_id rejeita group_id fantasma
      await expectSql(
        'M3 FK actors.group_id rejeita group_id inexistente',
        `INSERT INTO actors (tenant_id, actor_type, group_id, display_name, responsible_actor_id)
         VALUES ($1, 'group', '00000000-0000-0000-0000-000000000000', 'm3', $2)`,
        [TENANT_ID, devActorId],
        '23503'
      );

      await mc.query('ROLLBACK');
    } finally {
      mc.release();
    }

    // ═══ A — ATIVAÇÃO (real, commit; limpo no fim) ═══════════════════════════
    console.log('\n— A (ativação) —');

    const g1 = await groupsService.createGroup(TENANT_ID, devUserId, {
      name: 'E2E Group Two-Moments G1',
      description: 'Grupo de teste para E2E 3C.3',
    });
    const g1Id = g1.groupId;
    createdGroupIds.push(g1Id);

    // A1 — groups.actor_id preenchido após createGroup
    const actorCheck = await pool.query<{ actor_id: string | null; a_actor_type: string | null; a_responsible: string | null; a_group_id: string | null }>(
      `SELECT g.actor_id::text,
              a.actor_type AS a_actor_type,
              a.responsible_actor_id::text AS a_responsible,
              a.group_id::text AS a_group_id
         FROM groups g
         LEFT JOIN actors a ON a.actor_id = g.actor_id
        WHERE g.id = $1 AND g.tenant_id = $2`,
      [g1Id, TENANT_ID]
    );
    const row = actorCheck.rows[0];
    record('A1 groups.actor_id preenchido após createGroup', row?.actor_id !== null && row?.actor_id !== undefined);
    record('A2 actor_type = \'group\'', row?.a_actor_type === 'group');
    record('A3 responsible_actor_id = owner_actor_id', row?.a_responsible === g1.ownerActorId);
    record('A4 actor.group_id aponta para o grupo', row?.a_group_id === g1Id);

    // A5 — idempotência: ensureGroupActor chamado segunda vez retorna mesmo actor
    const { ensureGroupActor } = await import('@modules/identity/actor-writer.service');
    const secondCall = await ensureGroupActor(TENANT_ID, g1Id);
    record('A5 ensureGroupActor idempotente (mesmo actor_id)', secondCall.actor_id === row?.actor_id);

    // A6 — uq_actors_group honrado: só 1 group-actor por grupo
    const dupeCheck = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM actors WHERE group_id = $1 AND actor_type = 'group'`,
      [g1Id]
    );
    record('A6 uq_actors_group: exatamente 1 group-actor', dupeCheck.rows[0].n === '1');

    // A7 — owner permanece 'owner' em group_members (guard ON CONFLICT WHERE aplicado)
    const memberCheck = await pool.query<{ role: string }>(
      `SELECT role FROM group_members WHERE group_id = $1 AND tenant_id = $2 AND user_id = $3 LIMIT 1`,
      [g1Id, TENANT_ID, devUserId]
    );
    record('A7 owner permanece \'owner\' em group_members (não downgraded)', memberCheck.rows[0]?.role === 'owner');

  } finally {
    // ═══ CLEANUP — DEV intacto ════════════════════════════════════════════════
    console.log('\n— cleanup —');
    if (createdGroupIds.length > 0) {
      const ids = createdGroupIds;
      try {
        await pool.query(`DELETE FROM group_members WHERE group_id = ANY($1::uuid[]) AND tenant_id = $2`, [ids, TENANT_ID]);
      } catch (e) {
        if ((e as { code?: string }).code !== '42P01') console.warn('cleanup group_members:', (e as Error).message);
      }
      // NULL groups.actor_id before deleting actors (groups_actor_id_fkey ON DELETE RESTRICT)
      await pool.query(`UPDATE groups SET actor_id = NULL WHERE id = ANY($1::uuid[]) AND tenant_id = $2`, [ids, TENANT_ID]);
      await pool.query(`DELETE FROM actors WHERE group_id = ANY($1::uuid[]) AND tenant_id = $2`, [ids, TENANT_ID]);
      await pool.query(`DELETE FROM groups WHERE id = ANY($1::uuid[]) AND tenant_id = $2`, [ids, TENANT_ID]);
      const leftGroups = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM groups WHERE id = ANY($1::uuid[])`, [ids]);
      const leftActors = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM actors WHERE group_id = ANY($1::uuid[])`, [ids]);
      console.log(`  groups restantes=${leftGroups.rows[0].n} · group-actors restantes=${leftActors.rows[0].n}`);
      record('CLEANUP DEV intacto (groups/group-actors de teste = 0)', leftGroups.rows[0].n === '0' && leftActors.rows[0].n === '0');
    }
  }

  // ── Resumo ──────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Todos os cenários M/A verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
