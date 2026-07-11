/**
 * E2E — F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 (Slice 1A · DECISION-0136).
 * NÃO MOVE DINHEIRO. NENHUM enforcement em rota de negócio (testa o SERVICE direto).
 *
 * Prova o substrato de capability grants por actor: grant/list/revoke + hasCapabilityGrant +
 * resolver por actors.slug (não users.referral_code) + invariantes (allowlist não-financeira, scope actor,
 * autoridade do concedente, isolamento multi-tenant, grant por actor_id).
 *
 * 🔒 DB EFÊMERA (run-actor-capability-grants-slice1-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/grant|capability|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string, slug?: string): Promise<{ userId: string; actorId: string; gu: string; slug: string | null }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id, slug) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid,$5) RETURNING id::text AS id`, [tenantId, name, userId, gu, slug ?? null])).rows[0].id;
  return { userId, actorId, gu, slug: slug ?? null };
}
async function mkCompanyPageActor(tenantId: string, name: string, responsibleActorId: string): Promise<{ companyId: string; pageActorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [tenantId, name])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`, [tenantId, name, companyId, `page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId])).rows[0].id;
  return { companyId, pageActorId };
}
async function mkCompanyMember(tenantId: string, companyId: string, gu: string): Promise<void> {
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, gu]);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const { actorCapabilityGrantService } = await import('../modules/authority/actor-capability-grant.service');
  const { actorLookupService } = await import('../modules/authority/actor-lookup.service');

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Capability Grants', slug: `cg-${Date.now()}` });
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_B, name: 'Capability Grants B', slug: `cgb-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice');                              // gerente da empresa (concedente legítimo)
  const operatorSlug = `operator-bob-${Date.now()}`;
  const bob = await mkUserActor(TENANT, 'Bob', operatorSlug);                    // operador (grantee), com slug humano
  const carol = await mkUserActor(TENANT, 'Carol');                             // terceiro sem autoridade
  const coA = await mkCompanyPageActor(TENANT, 'EmpresaA', alice.actorId);
  await mkCompanyMember(TENANT, coA.companyId, alice.gu);                        // Alice gere A → representa o page-actor
  const otherScope = await mkUserActor(TENANT, 'OtherScopeActor');              // outro scope_actor

  const st = (e: unknown): number | undefined => (e as { statusCode?: number })?.statusCode;
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  try {
    // T1 — grant legítimo: Alice (representa o page-actor) concede calendar:block ao operador, scope=page.
    let grantId = '';
    {
      let ok = false; let reason = '';
      try {
        const g = await actorCapabilityGrantService.grant(TENANT, {
          granteeActorId: bob.actorId, capabilityKey: 'calendar:block', scopeActorId: coA.pageActorId,
          grantedByUserId: alice.userId, grantedByActorId: alice.actorId, eventReason: 'e2e T1',
        });
        grantId = g.grantId;
        ok = g.status === 'active' && g.granteeActorId === bob.actorId && g.scopeActorId === coA.pageActorId;
        reason = `status=${g.status}`;
      } catch (e) { reason = e instanceof Error ? e.message : String(e); }
      record('T1 grant legítimo (concedente representa o scope) → ativo + grantee/scope=actor_id', ok, reason);
    }

    // T2 — hasCapabilityGrant do grantee no scope correto → true.
    record('T2 hasCapabilityGrant(operador, calendar:block, page) → true',
      (await actorCapabilityGrantService.hasCapabilityGrant(TENANT, bob.actorId, 'calendar:block', coA.pageActorId)) === true);

    // T3 — actor sem grant → false.
    record('T3 hasCapabilityGrant(carol, calendar:block, page) → false (sem grant)',
      (await actorCapabilityGrantService.hasCapabilityGrant(TENANT, carol.actorId, 'calendar:block', coA.pageActorId)) === false);

    // T4 — grant não vale em OUTRO scope_actor.
    record('T4 grant não vale em outro scope_actor → false',
      (await actorCapabilityGrantService.hasCapabilityGrant(TENANT, bob.actorId, 'calendar:block', otherScope.actorId)) === false);

    // T5 — revoke → false.
    {
      let revoked = false;
      try { await actorCapabilityGrantService.revoke(TENANT, grantId, { userId: alice.userId, actorId: alice.actorId }, 'fim'); revoked = true; } catch { revoked = false; }
      const after = await actorCapabilityGrantService.hasCapabilityGrant(TENANT, bob.actorId, 'calendar:block', coA.pageActorId);
      record('T5 revoke → hasCapabilityGrant false', revoked && after === false, `revoked=${revoked} after=${after}`);
    }

    // T6 — concedente SEM autoridade sobre o scope (carol não gere a empresa) → 403.
    {
      let rejected = false; let s: number | undefined;
      try {
        await actorCapabilityGrantService.grant(TENANT, {
          granteeActorId: bob.actorId, capabilityKey: 'calendar:block', scopeActorId: coA.pageActorId,
          grantedByUserId: carol.userId, grantedByActorId: carol.actorId, eventReason: 'e2e T6',
        });
      } catch (e) { rejected = true; s = st(e); }
      record('T6 concedente sem autoridade sobre o scope → 403 + sem grant', rejected && s === 403, `status=${s}`);
    }

    // T7 — capability FINANCEIRA rejeitada (allowlist).
    {
      let rejected = false; let s: number | undefined;
      try {
        await actorCapabilityGrantService.grant(TENANT, {
          granteeActorId: bob.actorId, capabilityKey: 'financial:execute_payout' as any, scopeActorId: coA.pageActorId,
          grantedByUserId: alice.userId, grantedByActorId: alice.actorId, eventReason: 'e2e T7',
        });
      } catch (e) { rejected = true; s = st(e); }
      record('T7 capability financeira (financial:execute_payout) → 403 (allowlist não-financeira)', rejected && s === 403, `status=${s}`);
    }

    // T8 — isolamento multi-tenant: re-grant e checar no tenant B → false.
    {
      const g2 = await actorCapabilityGrantService.grant(TENANT, {
        granteeActorId: bob.actorId, capabilityKey: 'calendar:block', scopeActorId: coA.pageActorId,
        grantedByUserId: alice.userId, grantedByActorId: alice.actorId, eventReason: 'e2e T8',
      });
      const inA = await actorCapabilityGrantService.hasCapabilityGrant(TENANT, bob.actorId, 'calendar:block', coA.pageActorId);
      const inB = await actorCapabilityGrantService.hasCapabilityGrant(TENANT_B, bob.actorId, 'calendar:block', coA.pageActorId);
      record('T8 grant em tenant A NÃO vale em tenant B (isolamento)', g2.status === 'active' && inA === true && inB === false, `inA=${inA} inB=${inB}`);
    }

    // T9 — resolver por actors.slug (lookup humano), NÃO users.referral_code.
    {
      const r = await actorLookupService.resolveBySlug(TENANT, operatorSlug);
      const rNonExist = await actorLookupService.resolveBySlug(TENANT, 'inexistente-xyz');
      const rEmpty = await actorLookupService.resolveBySlug(TENANT, '');
      record('T9 resolveBySlug(slug) → operador; inexistente/vazio → null (fail-closed)',
        r?.actorId === bob.actorId && rNonExist === null && rEmpty === null, `r=${r?.actorId}`);
    }

    // T10 — grant gravado por actor_id (grantee/scope/concedente), nunca slug/referral (DB material).
    {
      const row = (await pool.query<{ g: string; s: string; b: string }>(
        `SELECT grantee_actor_id::text AS g, scope_actor_id::text AS s, granted_by_actor_id::text AS b
           FROM actor_capability_grants WHERE tenant_id=$1 AND grantee_actor_id=$2 LIMIT 1`,
        [TENANT, bob.actorId]
      )).rows[0];
      record('T10 grant grava actor_id (grantee/scope/concedente), nunca slug',
        !!row && row.g === bob.actorId && row.s === coA.pageActorId && row.b === alice.actorId, JSON.stringify(row));
    }

    // T-bank — Bank intocado.
    {
      const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado (bank_ledger + bank_transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
    }

    // C — estrutural: allowlist não-financeira + scope actor + sem enforcement de rota.
    {
      const mig = readFileSync(join(process.cwd(), 'migrations/20260616210000_create_actor_capability_grants.sql'), 'utf8');
      record('C1 migration: CHECK allowlist não-financeira + scope_type=actor',
        /chk_acg_capability_nonfinancial/.test(mig) && /scope_type = 'actor'/.test(mig)
        && !/CHECK[\s\S]*?(financial:|split:|cards:|payout|ledger)/.test((mig.match(/chk_acg_capability_nonfinancial CHECK \([\s\S]*?\)\s*\)/) || [''])[0]));
      const types = readFileSync(join(process.cwd(), 'src/modules/authority/actor-capability-grant.types.ts'), 'utf8');
      record('C2 allowlist do service não-financeira (sem financial/split/cards/payout/ledger)',
        !/(financial:|split:|cards:|cash_drawer:|customer_credit:|payout|ledger|refund|payment|transfer)/.test((types.match(/NON_FINANCIAL_CAPABILITY_ALLOWLIST[\s\S]*?\]/) || [''])[0]));
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
    if (failed.length > 0) {
      console.log('FALHAS:');
      failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
      await pool.end();
      process.exit(1);
    }
    await pool.end();
    console.log('✨ actor_capability_grants Slice 1A: substrato provado (grant/revoke/scope/tenant/allowlist/slug); zero enforcement de rota.');
  } catch (e) {
    console.error('💥 Erro no corpo do teste:', e);
    try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
