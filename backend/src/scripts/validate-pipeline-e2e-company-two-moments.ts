/**
 * E2E FASE 3B.3 — Empresa em Dois Momentos (Momento 1 inerte → Momento 2 operacional)
 * Desenho: docs/02_decisions/DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md (commit 691b2169)
 *
 * Prova M/A/R:
 *   M (schema)   — colunas primary_*, CHECK pareado, FKs, unique partial index de page-actor.
 *                  Rodam em BEGIN/ROLLBACK → ZERO resíduo.
 *   A (ativação) — activateCompanyOperationally: validação de par, idempotência, fail-closed,
 *                  page-actor garantido, primary_* gravados, ZERO capabilities.
 *   R (resolver) — findAvailableActors só enxerga empresa OPERACIONAL; usa companies.primary_*
 *                  (não tenants.company_type_id); human actor permanece; par inválido some.
 *
 * Base: tenant DEV + PF canônica da 3A (dev@unificard.local). Empresas de teste são criadas
 * via companies.service (Momento 1), ativadas via o novo writer, e LIMPAS ao fim (DEV intacto).
 *
 * Standalone → exige wireSocialPorts (achado 3A): ensure*Actor falham sem injeção dos ports.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-company-two-moments.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool, getClientWithTenant } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';

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

function randomCnpj(): string {
  let s = '';
  for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

async function expectServiceError(label: string, fn: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await fn();
    record(label, false, `esperava erro ${code}, mas passou`);
  } catch (e) {
    const c = (e as { code?: string }).code;
    record(label, c === code, c === code ? undefined : `code=${c} msg=${(e as Error).message}`);
  }
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
  const devGlobalUserId = dev.rows[0].global_user_id;

  const devActor = await pool.query<{ actor_id: string }>(
    `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  if (devActor.rowCount === 0) {
    console.error('❌ actor humano DEV não encontrado.');
    process.exit(1);
  }
  const devActorId = devActor.rows[0].actor_id;

  const pairARes = await pool.query<{ company_type_id: string; slug: string; concept_id: string }>(
    `SELECT ctac.company_type_id::text, ct.slug, ctac.concept_id::text
       FROM company_type_allowed_concepts ctac
       JOIN company_types ct ON ct.id = ctac.company_type_id
      ORDER BY ct.slug LIMIT 1`
  );
  const pairA = pairARes.rows[0];
  const pairBRes = await pool.query<{ company_type_id: string; slug: string; concept_id: string }>(
    `SELECT ctac.company_type_id::text, ct.slug, ctac.concept_id::text
       FROM company_type_allowed_concepts ctac
       JOIN company_types ct ON ct.id = ctac.company_type_id
      WHERE ctac.company_type_id <> $1 LIMIT 1`,
    [pairA.company_type_id]
  );
  const pairB = pairBRes.rows[0];
  const unallowedRes = await pool.query<{ concept_id: string }>(
    `SELECT concept_id::text FROM concepts
      WHERE concept_id NOT IN (SELECT concept_id FROM company_type_allowed_concepts WHERE company_type_id = $1)
      LIMIT 1`,
    [pairA.company_type_id]
  );
  const unallowedConceptId = unallowedRes.rows[0].concept_id;

  const createdCompanyIds: string[] = [];

  try {
    // ═══ M — SCHEMA (BEGIN/ROLLBACK, zero resíduo) ═══════════════════════════
    console.log('\n— M (schema) —');
    const mc = await getClientWithTenant(TENANT_ID);
    try {
      await mc.query('BEGIN');
      const ins = await mc.query<{ company_id: string }>(
        `INSERT INTO companies (tenant_id, company_name) VALUES ($1, 'M-test') RETURNING company_id::text`,
        [TENANT_ID]
      );
      const mCompanyId = ins.rows[0].company_id;
      record('M1 companies aceita Momento 1 (primary_* NULL)', true);

      // M4 — ambos preenchidos: aceita
      await mc.query('SAVEPOINT sp');
      try {
        await mc.query(
          `UPDATE companies SET primary_company_type_id=$1, primary_concept_id=$2 WHERE company_id=$3`,
          [pairA.company_type_id, pairA.concept_id, mCompanyId]
        );
        await mc.query('RELEASE SAVEPOINT sp');
        record('M4 CHECK aceita ambos preenchidos', true);
      } catch (e) {
        await mc.query('ROLLBACK TO SAVEPOINT sp');
        record('M4 CHECK aceita ambos preenchidos', false, (e as Error).message);
      }

      const expectSql = async (label: string, sql: string, params: unknown[], pgcode: string) => {
        await mc.query('SAVEPOINT sp');
        try {
          await mc.query(sql, params);
          await mc.query('RELEASE SAVEPOINT sp');
          record(label, false, `esperava ${pgcode}, mas passou`);
        } catch (e) {
          await mc.query('ROLLBACK TO SAVEPOINT sp');
          const c = (e as { code?: string }).code;
          record(label, c === pgcode, c === pgcode ? undefined : `code=${c}`);
        }
      };

      await expectSql('M2 CHECK bloqueia só company_type', `UPDATE companies SET primary_company_type_id=$1, primary_concept_id=NULL WHERE company_id=$2`, [pairA.company_type_id, mCompanyId], '23514');
      await expectSql('M3 CHECK bloqueia só concept', `UPDATE companies SET primary_company_type_id=NULL, primary_concept_id=$1 WHERE company_id=$2`, [pairA.concept_id, mCompanyId], '23514');
      await expectSql('M5 FK bloqueia company_type inexistente', `UPDATE companies SET primary_company_type_id='00000000-0000-0000-0000-000000000000', primary_concept_id=$1 WHERE company_id=$2`, [pairA.concept_id, mCompanyId], '23503');
      await expectSql('M6 FK bloqueia concept inexistente', `UPDATE companies SET primary_company_type_id=$1, primary_concept_id='00000000-0000-0000-0000-000000000000' WHERE company_id=$2`, [pairA.company_type_id, mCompanyId], '23503');

      // M7 — unique partial index: dois page-actors para a mesma company
      // (responsible_actor_id é exigido por trigger trg_actor_responsibility_check para page).
      await mc.query(`INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'m7-a',$3)`, [TENANT_ID, mCompanyId, devActorId]);
      await expectSql('M7 unique index bloqueia 2º page-actor', `INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'m7-b',$3)`, [TENANT_ID, mCompanyId, devActorId], '23505');

      await mc.query('ROLLBACK');
    } finally {
      mc.release();
    }

    // ═══ A — ATIVAÇÃO (real, commit; limpo no fim) ═══════════════════════════
    console.log('\n— A (ativação) —');
    const c1 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Two-Moments C1', role: 'owner', fetchFromRevenue: false, isPrimary: true },
      TENANT_ID
    );
    const c1Id = c1.company.companyId;
    createdCompanyIds.push(c1Id);

    // A2 — par não permitido → fail-closed
    await expectServiceError(
      'A2 ativação rejeita par inválido',
      () => companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId: c1Id, responsibleUserId: devUserId, primaryCompanyTypeId: pairA.company_type_id, primaryConceptId: unallowedConceptId }),
      'COMPANY_TYPE_CONCEPT_NOT_ALLOWED'
    );

    // A1/A3/A4 — ativação válida
    const act1 = await companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId: c1Id, responsibleUserId: devUserId, primaryCompanyTypeId: pairA.company_type_id, primaryConceptId: pairA.concept_id });
    record('A1 ativação valida par permitido', act1.alreadyActive === false);

    const pageCheck = await pool.query<{ actor_id: string; responsible_actor_id: string | null }>(
      `SELECT actor_id::text, responsible_actor_id::text FROM actors WHERE tenant_id=$1 AND company_id=$2 AND actor_type='page'`,
      [TENANT_ID, c1Id]
    );
    record('A3 ativação garante page-actor (1, com responsible)', pageCheck.rowCount === 1 && pageCheck.rows[0].responsible_actor_id !== null);
    const pageActorIdBefore = pageCheck.rows[0]?.actor_id;

    const cls = await pool.query<{ t: string | null; c: string | null }>(
      `SELECT primary_company_type_id::text AS t, primary_concept_id::text AS c FROM companies WHERE company_id=$1`,
      [c1Id]
    );
    record('A4 grava primary_company_type_id + primary_concept_id', cls.rows[0].t === pairA.company_type_id && cls.rows[0].c === pairA.concept_id);

    // A5 — idempotente mesmo par
    const act2 = await companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId: c1Id, responsibleUserId: devUserId, primaryCompanyTypeId: pairA.company_type_id, primaryConceptId: pairA.concept_id });
    record('A5 idempotente com o mesmo par (alreadyActive)', act2.alreadyActive === true);

    // A7 — page-actor reusado (mesmo actor_id)
    const pageCheck2 = await pool.query<{ actor_id: string }>(
      `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND company_id=$2 AND actor_type='page'`,
      [TENANT_ID, c1Id]
    );
    record('A7 page-actor reutilizado (mesmo actor_id)', pageCheck2.rowCount === 1 && pageCheck2.rows[0].actor_id === pageActorIdBefore);

    // A6 — par diferente em empresa já operacional → fail-closed
    await expectServiceError(
      'A6 rejeita par diferente em empresa já operacional',
      () => companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId: c1Id, responsibleUserId: devUserId, primaryCompanyTypeId: pairB.company_type_id, primaryConceptId: pairB.concept_id }),
      'COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION'
    );

    // A8 — capabilities NÃO gravadas: não existe tabela de capability e nada além de primary_* mudou
    const capTbl = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%capabilit%'`
    );
    record('A8 capabilities NÃO gravadas (sem tabela de capability)', capTbl.rows[0].n === '0');

    // ═══ R — RESOLVER (findAvailableActors) ══════════════════════════════════
    console.log('\n— R (resolver) —');
    const { actorRepository } = await import('../modules/social/actor.repository');

    // C2 — Momento 1 (não ativada)
    const c2 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Two-Moments C2', role: 'owner', fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    const c2Id = c2.company.companyId;
    createdCompanyIds.push(c2Id);

    const list1 = await actorRepository.findAvailableActors(TENANT_ID, devUserId);
    const hasC2 = list1.some((a) => (a as { company_id?: string }).company_id === c2Id);
    record('R1 empresa Momento 1 NÃO aparece no resolver', hasC2 === false);

    const humanRow = list1.find((a) => a.actor_type === 'user' && (a as { user_id?: string }).user_id === devUserId);
    record('R4 actor humano continua aparecendo', !!humanRow);

    const c1Row = list1.find((a) => (a as { company_id?: string }).company_id === c1Id) as unknown as (Record<string, unknown> | undefined);
    record('R2 empresa operacional aparece', !!c1Row);
    record('R3 JOIN usa companies.primary_* (slug por-empresa, tenant.company_type_id NULL)', !!c1Row && c1Row['company_type_slug'] === pairA.slug);

    // R5 — par inválido forçado (passa CHECK pois ambos NOT NULL; inválido por não estar em ctac)
    await pool.query(
      `UPDATE companies SET primary_company_type_id=$1, primary_concept_id=$2 WHERE company_id=$3`,
      [pairA.company_type_id, unallowedConceptId, c2Id]
    );
    const list2 = await actorRepository.findAvailableActors(TENANT_ID, devUserId);
    const hasC2Invalid = list2.some((a) => (a as { company_id?: string }).company_id === c2Id);
    record('R5 empresa com par inválido NÃO aparece (EXISTS no resolver)', hasC2Invalid === false);
  } finally {
    // ═══ CLEANUP — DEV intacto ═══════════════════════════════════════════════
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      const tables = ['company_opportunity_preferences', 'company_domains', 'company_users'];
      for (const t of tables) {
        try {
          await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]);
        } catch (e) {
          if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message);
        }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      const actorsLeft = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      console.log(`  companies restantes=${left.rows[0].n} · page-actors restantes=${actorsLeft.rows[0].n}`);
      record('CLEANUP DEV intacto (companies/page-actors de teste = 0)', left.rows[0].n === '0' && actorsLeft.rows[0].n === '0');
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
  console.log('✨ Todos os cenários M/A/R verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
