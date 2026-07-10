/**
 * F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — E2E de SERVICE_USE (substrato mínimo). Funções REAIS
 * (assetServiceUseService via repository/service), fixture existente do tenant (asset já cadastrado) +
 * teardown do que foi criado nesta corrida. Prova: fail-closed sem habilitação, autoridade, gate de
 * offer_kind=service, ativação idempotente (upsert), read-model countActiveServiceUses.
 * Uso: pnpm exec tsx src/scripts/e2e-asset-service-use-fatia-4b.ts
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };
const threw = async (fn: () => Promise<any>, codeRe: RegExp): Promise<string> => {
  try { await fn(); return ''; } catch (e: any) { return `${e?.statusCode ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`.match(codeRe) ? 'OK' : `WRONG:${e?.message}`; }
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter, socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter); socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter); socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);

  const { assetServiceUseService } = await import('../modules/asset-service-use/asset-service-use.service');
  const { actorPageRepository } = await import('../modules/actor-page/actor-page.repository');

  const c = await pool.connect();

  try {
    // Fixture: ASSET real já cadastrado do tenant (PF, actor_type='user') + service concept ofertável.
    const assetRow = await c.query<{ asset_id: string; tenant_id: string; owner_actor_id: string; user_id: string }>(
      `SELECT a.id AS asset_id, a.tenant_id, a.owner_actor_id, act.user_id
         FROM actor_assets a JOIN actors act ON act.id = a.owner_actor_id
        WHERE act.actor_type = 'user' AND act.user_id IS NOT NULL LIMIT 1`);
    if (assetRow.rows.length < 1) { console.error('sem actor_assets de fixture (PF) no ambiente'); process.exit(1); }
    const { asset_id: ASSET, tenant_id: TENANT, owner_actor_id: OWNER, user_id: USER } = assetRow.rows[0];

    const conceptRow = await c.query<{ concept_id: string }>(
      `SELECT concept_id FROM concept_offer_kinds WHERE offer_kind = 'service' LIMIT 1`);
    const SERVICE_CONCEPT = conceptRow.rows[0].concept_id;
    const nonServiceConceptRow = await c.query<{ concept_id: string }>(
      `SELECT concept_id FROM concepts WHERE concept_id NOT IN (SELECT concept_id FROM concept_offer_kinds WHERE offer_kind = 'service') LIMIT 1`);
    const NON_SERVICE_CONCEPT = nonServiceConceptRow.rows[0]?.concept_id;

    // outro user-actor qualquer do tenant, DIFERENTE do owner, p/ provar autoridade fail-closed.
    const strangerRow = await c.query<{ user_id: string | null }>(
      `SELECT user_id FROM actors WHERE tenant_id = $1 AND actor_type = 'user' AND id <> $2 AND user_id IS NOT NULL LIMIT 1`,
      [TENANT, OWNER]);
    const STRANGER_USER = strangerRow.rows[0]?.user_id ?? null;

    console.log(`    fixture asset=${ASSET} owner=${OWNER} serviceConcept=${SERVICE_CONCEPT} tenant=${TENANT}`);

    // teardown de qualquer resíduo de corridas anteriores
    await c.query(`DELETE FROM actor_asset_service_usages WHERE asset_id = $1 AND service_concept_id = $2`, [ASSET, SERVICE_CONCEPT]);
    await c.query(`DELETE FROM actor_asset_modes WHERE asset_id = $1 AND activation_mode = 'service_use'`, [ASSET]);
    await c.query(`UPDATE actor_professional_concepts SET is_active = false, retired_at = now() WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3`, [TENANT, OWNER, SERVICE_CONCEPT]);

    // 1) SEM autoridade (stranger) → NOT_REPRESENTABLE (se houver stranger no ambiente).
    if (STRANGER_USER) {
      ok((await threw(() => assetServiceUseService.activateOnExisting(TENANT, ASSET, STRANGER_USER, {
        assetId: ASSET, serviceConceptId: SERVICE_CONCEPT, arrangementType: 'daily_fee',
      }), /NOT_REPRESENTABLE/)) === 'OK', '1. sem autoridade (stranger) → ASSET_SERVICE_USE_NOT_REPRESENTABLE');
    } else {
      console.log('    (pulado 1: sem 2º user-actor no tenant p/ provar stranger)');
    }

    // 2) concept NÃO offer_kind=service → CONCEPT_NOT_SERVICE (se houver concept não-service no ambiente).
    if (NON_SERVICE_CONCEPT) {
      ok((await threw(() => assetServiceUseService.activateOnExisting(TENANT, ASSET, USER, {
        assetId: ASSET, serviceConceptId: NON_SERVICE_CONCEPT, arrangementType: 'daily_fee',
      }), /CONCEPT_NOT_SERVICE/)) === 'OK', '2. concept sem offer_kind=service → ASSET_SERVICE_USE_CONCEPT_NOT_SERVICE');
    } else {
      console.log('    (pulado 2: todo concept do ambiente já é offer_kind=service)');
    }

    // 3) dono-operador SEM declaração profissional ativa → OPERATOR_NOT_ELIGIBLE (fail-closed).
    ok((await threw(() => assetServiceUseService.activateOnExisting(TENANT, ASSET, USER, {
      assetId: ASSET, serviceConceptId: SERVICE_CONCEPT, arrangementType: 'daily_fee',
    }), /OPERATOR_NOT_ELIGIBLE/)) === 'OK', '3. dono sem declaração profissional ativa → ASSET_SERVICE_USE_OPERATOR_NOT_ELIGIBLE');

    // 4) declara profissional ATIVO no concept → ativação passa.
    await c.query(
      `INSERT INTO actor_professional_concepts (tenant_id, actor_id, concept_id, skill_level, is_active, declared_at)
       VALUES ($1, $2, $3, 3, true, now())
         ON CONFLICT (tenant_id, actor_id, concept_id) DO UPDATE SET is_active = true, retired_at = NULL`,
      [TENANT, OWNER, SERVICE_CONCEPT]);
    const usage1 = await assetServiceUseService.activateOnExisting(TENANT, ASSET, USER, {
      assetId: ASSET, serviceConceptId: SERVICE_CONCEPT, arrangementType: 'daily_fee',
    });
    ok(!!usage1.id && usage1.operatorActorId === OWNER && usage1.status === 'active', '4. ativação passa com declaração ativa (dono-operador, status=active)');

    // 5) actor_asset_modes ganhou 'service_use' habilitado.
    const modeRow = await c.query<{ enabled: boolean }>(
      `SELECT enabled FROM actor_asset_modes WHERE asset_id = $1 AND activation_mode = 'service_use'`, [ASSET]);
    ok(modeRow.rows[0]?.enabled === true, "5. actor_asset_modes.activation_mode='service_use' enabled=true");

    // 6) reativar (mesma combinação asset+concept+operador) é UPSERT — não duplica linha (D-A idempotente).
    const usage2 = await assetServiceUseService.activateOnExisting(TENANT, ASSET, USER, {
      assetId: ASSET, serviceConceptId: SERVICE_CONCEPT, arrangementType: 'commission',
    });
    ok(usage2.id === usage1.id && usage2.arrangementType === 'commission', '6. reativação é UPDATE idempotente (mesmo id, arrangement_type atualizado)');
    const dupCount = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM actor_asset_service_usages WHERE asset_id = $1 AND service_concept_id = $2 AND operator_actor_id = $3`,
      [ASSET, SERVICE_CONCEPT, OWNER]);
    ok(dupCount.rows[0].n === '1', '6b. exatamente 1 linha na junção (sem duplicação)');

    // 7) countActiveServiceUses (read-model dedicado, D-G) reflete o vínculo ativo.
    await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);
    const n = await actorPageRepository.countActiveServiceUses(TENANT, OWNER);
    ok(n >= 1, `7. countActiveServiceUses(owner) >= 1 (leu ${n})`);

    // 8) pausar via updateStatus (owner-only) reflete no read-model (is_active=false).
    await assetServiceUseService.updateStatus(TENANT, usage1.id, USER, 'paused');
    const nAfterPause = await actorPageRepository.countActiveServiceUses(TENANT, OWNER);
    ok(nAfterPause === n - 1, `8. pausar reduz countActiveServiceUses em 1 (antes=${n}, depois=${nAfterPause})`);

    // teardown final
    await c.query(`DELETE FROM actor_asset_service_usages WHERE asset_id = $1 AND service_concept_id = $2`, [ASSET, SERVICE_CONCEPT]);
    await c.query(`DELETE FROM actor_asset_modes WHERE asset_id = $1 AND activation_mode = 'service_use'`, [ASSET]);
    await c.query(`UPDATE actor_professional_concepts SET is_active = false, retired_at = now() WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3`, [TENANT, OWNER, SERVICE_CONCEPT]);
    console.log('\n=== TEARDOWN OK (DB restaurado) ===\n');
  } finally {
    c.release();
    await pool.end();
  }

  console.log(`\n${fails.length === 0 ? '✅ TODOS OS TESTES PASSARAM' : `❌ ${fails.length} FALHA(S)`}`);
  if (fails.length > 0) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
