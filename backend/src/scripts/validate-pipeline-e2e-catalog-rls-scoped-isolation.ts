/**
 * E2E — F-CATALOG-RLS-SCOPED-ISOLATION (DT-CATALOG-RLS-SCOPED-NO-ISOLATION). NÃO MOVE DINHEIRO.
 *
 * DUAS PARTES:
 *
 * PARTE A — prova de isolamento REAL (mesmo padrão de validate-rls-tenant-isolation.ts): a
 * conexão de admin (postgres) é superuser e SEMPRE bypassa RLS — chamar os métodos do serviço
 * diretamente NÃO prova isolamento (rodariam como superuser). Por isso a Parte A usa
 * `SET ROLE unificard_app` explícito + `set_config` manual do GUC, no nível SQL cru, para provar
 * que a policy realmente MORDE sob a role de aplicação real.
 *   A1. admin (superuser) vê as 3 linhas (global + scoped-A + scoped-B) — bypass = "teatro"
 *   A2. unificard_app + tenant=A → vê global+scoped-A (2), NÃO scoped-B
 *   A3. unificard_app + tenant=B → vê global+scoped-B (2), NÃO scoped-A
 *   A4. cross-tenant INSERT (contexto=A, tenant_id=B) bloqueado por WITH CHECK
 *   A5. unificard_app + app.is_platform_admin=true → vê as 3 (curadoria cross-tenant)
 *   A6. canonical_catalog_events: leitura isola por tenant; admin-bypass vê tudo; escrita
 *      permanece permissiva (cross-tenant INSERT sucede — desenho documentado, não regressão)
 *
 * PARTE B — prova funcional (via os métodos REAIS do serviço refatorado, roda como postgres/
 * superuser — não prova isolamento, prova que o refactor não quebrou nada):
 *   B1. suggest() cria scoped p/ tenant A
 *   B3. listPending() (admin) vê o pendente
 *   B4. approve() (admin) ativa
 *   B4b. searchVisible(A) acha; searchVisible(B) NÃO acha (roda DEPOIS do approve — filtra
 *      status='active'; CS_VISIBLE em app-code, defesa em profundidade independente da RLS)
 *   B5. requireActiveForTenant(A,id) sucede; requireActiveForTenant(B,id) lança NOT_VISIBLE
 *   B6. Δbank=0
 *
 * 🔒 DB EFÊMERA (run-catalog-rls-scoped-isolation-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
let passed = 0;
let failed = 0;
function ok(name: string, detail = ''): void { passed++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name: string, detail: string): void { failed++; console.error(`  ❌ ${name} — ${detail}`); }
const cwd = process.cwd();

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/rls|catalog|isolation|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E CATALOG RLS SCOPED ISOLATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const tenantA = uuidv4();
  const tenantB = uuidv4();
  const conceptSlug = `rls-e2e-concept-${Date.now()}`;
  let concept: string;

  // concepts é GOVERNADO (0075_concept_governance_trigger): INSERT exige app.concept_governance
  // ='true' NUMA TRANSAÇÃO (is_local=true) — conexão curta e descartada, separada do client
  // principal (que usa set_config is_local=false para SET ROLE/tenant-context mais abaixo).
  { const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      concept = (await gc.query<{ concept_id: string }>(
        `INSERT INTO concepts (domain, slug) VALUES ('servicos',$1) RETURNING concept_id`,
        [conceptSlug]
      )).rows[0].concept_id;
      await gc.query('COMMIT');
    } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); }
  }

  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'RLS Catalog A',$2),($3,'RLS Catalog B',$4)`,
      [tenantA, `rls-catalog-a-${tenantA.slice(0, 8)}`, tenantB, `rls-catalog-b-${tenantB.slice(0, 8)}`]);

    // 3 canonical_services: global + scoped-A + scoped-B.
    const globalCsId = (await client.query<{ id: string }>(
      `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES (NULL,'global',$1,'RLS E2E Global','rls-e2e-global','active') RETURNING id`,
      [concept]
    )).rows[0].id;
    const scopedAId = (await client.query<{ id: string }>(
      `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES ($1,'scoped',$2,'RLS E2E Scoped A','rls-e2e-scoped-a','active') RETURNING id`,
      [tenantA, concept]
    )).rows[0].id;
    const scopedBId = (await client.query<{ id: string }>(
      `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES ($1,'scoped',$2,'RLS E2E Scoped B','rls-e2e-scoped-b','active') RETURNING id`,
      [tenantB, concept]
    )).rows[0].id;

    console.log('\n— PARTE A: isolamento real (SET ROLE unificard_app) —');

    // A1. admin (superuser) vê tudo.
    const adminCount = await count(`SELECT count(*)::int AS n FROM canonical_services WHERE id = ANY($1::uuid[])`, [[globalCsId, scopedAId, scopedBId]]);
    if (adminCount === 3) ok('A1 admin SELECT vê as 3 linhas (bypass = teatro)', `count=${adminCount}`);
    else fail('A1 admin vê 3', `count=${adminCount}`);

    await client.query('SET ROLE unificard_app');
    try {
      // A2. tenant=A vê global+scoped-A (2), não scoped-B.
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantA]);
      const seenA = (await client.query<{ id: string }>(`SELECT id FROM canonical_services WHERE id = ANY($1::uuid[])`, [[globalCsId, scopedAId, scopedBId]])).rows.map(r => r.id);
      const aOk = seenA.includes(globalCsId) && seenA.includes(scopedAId) && !seenA.includes(scopedBId);
      if (aOk) ok('A2 unificard_app+tenant=A vê global+scoped-A, NÃO scoped-B', `seen=${seenA.length}`);
      else fail('A2 isolamento tenant=A', `seen=${JSON.stringify(seenA)}`);

      // A3. tenant=B vê global+scoped-B (2), não scoped-A.
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantB]);
      const seenB = (await client.query<{ id: string }>(`SELECT id FROM canonical_services WHERE id = ANY($1::uuid[])`, [[globalCsId, scopedAId, scopedBId]])).rows.map(r => r.id);
      const bOk = seenB.includes(globalCsId) && seenB.includes(scopedBId) && !seenB.includes(scopedAId);
      if (bOk) ok('A3 unificard_app+tenant=B vê global+scoped-B, NÃO scoped-A', `seen=${seenB.length}`);
      else fail('A3 isolamento tenant=B', `seen=${JSON.stringify(seenB)}`);

      // A4. cross-tenant INSERT bloqueado.
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantA]);
      try {
        await client.query(
          `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES ($1,'scoped',$2,'Cross Tenant Attempt','rls-e2e-cross-attempt','active')`,
          [tenantB, concept]
        );
        fail('A4 cross-tenant INSERT bloqueado', 'INSERT tenant=B sob contexto A deveria violar WITH CHECK');
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const isRls = err.code === '42501' || /row-level security|violates row-level|nível de linha|política de segurança/i.test(String(err.message));
        if (isRls) ok('A4 cross-tenant INSERT bloqueado por WITH CHECK', err.code || 'RLS');
        else fail('A4 cross-tenant INSERT bloqueado', `erro inesperado: ${err.message}`);
      }

      // A5. admin-bypass vê as 3 (curadoria cross-tenant).
      await client.query(`SELECT set_config('app.current_tenant', '', false)`);
      await client.query(`SELECT set_config('app.is_platform_admin', 'true', false)`);
      const seenAdmin = (await client.query<{ id: string }>(`SELECT id FROM canonical_services WHERE id = ANY($1::uuid[])`, [[globalCsId, scopedAId, scopedBId]])).rows.map(r => r.id);
      if (seenAdmin.length === 3) ok('A5 unificard_app+is_platform_admin vê as 3 (curadoria cross-tenant preservada)', `seen=${seenAdmin.length}`);
      else fail('A5 admin-bypass', `seen=${JSON.stringify(seenAdmin)}`);
      await client.query(`SELECT set_config('app.is_platform_admin', 'false', false)`);

      // A6. canonical_catalog_events: leitura isola; escrita permanece permissiva.
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantA]);
      await client.query(
        `INSERT INTO canonical_catalog_events (entity_type, entity_id, event_type, payload, tenant_id) VALUES ('canonical_service',$1,'e2e_probe_a','{}'::jsonb,$2)`,
        [scopedAId, tenantA]
      );
      // escrita cross-tenant (contexto=A, evento marcado tenant=B) — permanece permissiva por desenho.
      let crossWriteOk = false;
      try {
        await client.query(
          `INSERT INTO canonical_catalog_events (entity_type, entity_id, event_type, payload, tenant_id) VALUES ('canonical_service',$1,'e2e_probe_cross','{}'::jsonb,$2)`,
          [scopedBId, tenantB]
        );
        crossWriteOk = true;
      } catch { crossWriteOk = false; }
      if (crossWriteOk) ok('A6a canonical_catalog_events escrita cross-tenant SUCEDE (permissiva por desenho, não regressão)');
      else fail('A6a escrita cross-tenant deveria suceder (permissiva)', 'INSERT falhou inesperadamente');

      // 🔴 usa client.query (SESSÃO com SET ROLE unificard_app + contexto), NUNCA o helper count()
      // genérico (que usa pool.query cru = conexão nova = postgres/superuser = sempre bypassa RLS).
      const eventsSeenA = Number((await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM canonical_catalog_events WHERE entity_id = ANY($1::uuid[])`, [[scopedAId, scopedBId]])).rows[0].n);
      if (eventsSeenA === 1) ok('A6b canonical_catalog_events LEITURA isola por tenant (tenant=A só vê seu próprio evento)', `count=${eventsSeenA}`);
      else fail('A6b leitura isolada', `count=${eventsSeenA} (esperado 1)`);

      await client.query(`SELECT set_config('app.is_platform_admin', 'true', false)`);
      const eventsSeenAdmin = Number((await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM canonical_catalog_events WHERE entity_id = ANY($1::uuid[])`, [[scopedAId, scopedBId]])).rows[0].n);
      if (eventsSeenAdmin === 2) ok('A6c canonical_catalog_events admin-bypass vê os 2 eventos', `count=${eventsSeenAdmin}`);
      else fail('A6c admin-bypass eventos', `count=${eventsSeenAdmin} (esperado 2)`);
      await client.query(`SELECT set_config('app.is_platform_admin', 'false', false)`);
    } finally {
      await client.query('RESET ROLE');
    }
  } finally {
    await client.query(`DELETE FROM canonical_catalog_events WHERE entity_id IN (SELECT id FROM canonical_services WHERE tenant_id = ANY($1::uuid[]) OR tenant_id IS NULL AND slug LIKE 'rls-e2e-%')`, [[tenantA, tenantB]]).catch(() => {});
    client.release();
  }

  console.log('\n— PARTE B: prova funcional (métodos reais do serviço refatorado) —');

  const { canonicalServiceService, CanonicalServiceError } = await import('../core/catalog/canonical/canonical-service.service');
  const { catalogCurationService } = await import('../core/catalog/curation/catalog-curation.service');

  // B1. suggest() cria scoped p/ tenant A.
  const suggestResult = await canonicalServiceService.suggest({
    tenantId: tenantA,
    name: 'RLS E2E Suggested Service',
    conceptId: concept,
    createdByActorId: null,
  });
  ok('B1 suggest() cria scoped p/ tenant A', `id=${suggestResult.canonicalService.id} created=${suggestResult.created}`);

  // B3. listPending() (admin) vê o pendente.
  const pending = await catalogCurationService.listPending();
  if (pending.services.some(s => s.canonicalServiceId === suggestResult.canonicalService.id)) {
    ok('B3 listPending() (admin, cross-tenant) vê o serviço pendente de tenant A');
  } else {
    fail('B3 listPending', `não encontrou id=${suggestResult.canonicalService.id}`);
  }

  // B4. approve() (admin) ativa.
  const approved = await canonicalServiceService.approve({ canonicalServiceId: suggestResult.canonicalService.id, actorId: uuidv4() });
  if (approved.status === 'active') ok('B4 approve() (admin) ativa o serviço');
  else fail('B4 approve status', approved.status);

  // B4b. searchVisible isola por tenant (defesa em profundidade, app-level) — só filtra status=
  // 'active', por isso roda DEPOIS do approve() (antes disso, o item é 'pending_curation').
  const visibleA = await canonicalServiceService.searchVisible(tenantA, 'RLS E2E Suggested');
  const visibleB = await canonicalServiceService.searchVisible(tenantB, 'RLS E2E Suggested');
  if (visibleA.some(c => c.id === suggestResult.canonicalService.id) && !visibleB.some(c => c.id === suggestResult.canonicalService.id)) {
    ok('B4b searchVisible(A) acha, searchVisible(B) NÃO acha');
  } else {
    fail('B4b searchVisible isolamento', `A=${visibleA.length} B=${visibleB.length}`);
  }

  // B5. requireActiveForTenant isola.
  const activeForA = await canonicalServiceService.requireActiveForTenant(tenantA, suggestResult.canonicalService.id);
  ok('B5a requireActiveForTenant(A, id) sucede', activeForA.id);
  try {
    await canonicalServiceService.requireActiveForTenant(tenantB, suggestResult.canonicalService.id);
    fail('B5b requireActiveForTenant(B, id) deveria lançar', 'não lançou');
  } catch (e: unknown) {
    const err = e as InstanceType<typeof CanonicalServiceError>;
    if (err.code === 'CANONICAL_SERVICE_NOT_VISIBLE') ok('B5b requireActiveForTenant(B, id) lança NOT_VISIBLE (isolamento app-level preservado)');
    else fail('B5b código de erro inesperado', String(err.code ?? err));
  }

  // B6. Δbank=0.
  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  if (bankAfter === bankBefore) ok('B6 Δbank=0', `before=${bankBefore} after=${bankAfter}`);
  else fail('B6 Δbank=0', `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-catalog-rls-scoped-isolation.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  if (g === 0) ok('guard estrutural verde'); else fail('guard estrutural', 'FAIL');

  await pool.end();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} verdes`);
  if (failed > 0) { console.error(`FALHOU: ${failed}`); process.exit(1); }
  console.log('✨ canonical_services/canonical_catalog_events isolados por tenant sob unificard_app real; curadoria admin cross-tenant preservada; refactor funcional intacto; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
