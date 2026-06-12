/**
 * E2E — BACKFILL LEGADO REAL das migrations de identidade de mídia
 * (374 contextual / 375 temporal-check / 376 identidade V2).
 * F-CANONICAL-MEDIA-CONTEXT-IDENTITY-V2-COLLISION-SAFE-CLOSURE (GO §6).
 *
 * O dev vivo tinha media_assets=0 — o backfill nunca tinha sido provado sobre
 * dados reais. Este e2e prova as DUAS rotas:
 *
 *  FASE A (DB efêmera 1 — caminho feliz):
 *    migra até ANTES da 374 (MIGRATION_STOP_BEFORE) → semeia dados VÁLIDOS no
 *    schema legado (asset empresarial pending + asset canônico approved +
 *    business_media + canonical_service_media + licença com bordas/case +
 *    provenance contendo '|') → aplica 374/375/376 normalmente → prova:
 *    IDs/blobs/relações/moderação/licença/source/provenance/tenant/actor
 *    PRESERVADOS byte-exatos; context_type/purpose inferidos pela regra da 374;
 *    context_identity_version=2; context_fingerprint == função SQL V2 (fonte
 *    única); context_fingerprint_v1 == fórmula V1 (arqueologia); índice V1
 *    retirado e UNIQUE V2 vivo; nenhuma linha descartada/fundida/órfã.
 *
 *  FASE B (DB efêmera 2 — fail-closed):
 *    semeia cenário legado IMPOSSÍVEL (source='company_suggestion' SEM tenant
 *    e SEM actor declarante — contexto não inferível) → migração V2 ABORTA
 *    fail-closed (376 NÃO aplicada; nenhuma inferência silenciosa; nenhuma
 *    linha descartada; 374/375 commitadas, 376 revertida).
 *
 * 🔒 DBs EFÊMERAS. Orquestrado por scripts/run-media-migration-backfill-ephemeral.ps1.
 * Zero Bank.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const URL_A = process.env.DATABASE_URL || '';
const NAME_A = process.env.EXPECTED_DATABASE_NAME || '';
const URL_B = process.env.BACKFILL_FC_DATABASE_URL || '';
const NAME_B = process.env.BACKFILL_FC_DATABASE_NAME || '';

const STOP_BEFORE = '20260612100000';
const MIG_374 = '20260612100000_media_asset_contextual_identity.sql';
const MIG_375 = '20260612110000_availability_owner_type_check.sql';
const MIG_376 = '20260612120000_media_context_identity_v2.sql';

// IDs determinísticos (fases assertam sem estado compartilhado).
const TENANT = 'aaaa1111-0000-4000-8000-000000000001';
const USER = 'aaaa1111-0000-4000-8000-000000000002';
const GLOBAL = 'aaaa1111-0000-4000-8000-000000000003';
const BLOB_1 = 'aaaa1111-0000-4000-8000-000000000011';
const BLOB_2 = 'aaaa1111-0000-4000-8000-000000000012';
const ASSET_EMP = 'aaaa1111-0000-4000-8000-000000000021';
const ASSET_CAN = 'aaaa1111-0000-4000-8000-000000000022';
const ATTACH_TARGET = 'aaaa1111-0000-4000-8000-000000000031';
const BLOB_3 = 'bbbb2222-0000-4000-8000-000000000011';
const ASSET_IMPOSSIBLE = 'bbbb2222-0000-4000-8000-000000000021';

// Licença legada com bordas + case e provenance com '|' (vetor Yala em dado VIVO):
// a migração deve PRESERVAR ambos byte-exatos (preservação ≠ normalização de novos writes).
const LEGACY_LICENSE = '  MIT-Legacy  ';
const LEGACY_PROVENANCE = 'b|c';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function assertEphemeralNames(): void {
  for (const [name, url] of [[NAME_A, URL_A], [NAME_B, URL_B]] as const) {
    if (!name || !url) throw new Error('ABORT: DATABASE_URL/EXPECTED_DATABASE_NAME e BACKFILL_FC_* são obrigatórios.');
    if (name === 'unificard_dev' || /unificard_dev/.test(url)) throw new Error('ABORT: alvo é unificard_dev.');
    if (!/backfill|media|test|ephemeral/i.test(name)) throw new Error(`ABORT: nome "${name}" não parece efêmero.`);
  }
  console.log(`🔒 DBs efêmeras confirmadas: ${NAME_A} (fase A) · ${NAME_B} (fase B)`);
}

function runMigrate(url: string, dbName: string, stopBefore?: string): { status: number; out: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    EXPECTED_DATABASE_NAME: dbName,
    MIGRATION_PROFILE: 'FULL',
  };
  delete env.MIGRATION_STOP_BEFORE;
  if (stopBefore) env.MIGRATION_STOP_BEFORE = stopBefore;
  const r = spawnSync('npx', ['tsx', 'src/core/db/migrate.ts'], {
    cwd: process.cwd(), env, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status ?? 99, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

async function main(): Promise<void> {
  assertEphemeralNames();
  const poolA = new Pool({ connectionString: URL_A, max: 4 });
  const poolB = new Pool({ connectionString: URL_B, max: 4 });
  const count = async (p: Pool, sql: string, params: unknown[] = []): Promise<number> =>
    Number((await p.query<{ n: string }>(sql, params)).rows[0].n);

  try {
    // ════ FASE A — caminho feliz ═══════════════════════════════════════════
    console.log('\n— FASE A: migra até ANTES da 374 —');
    const mA1 = runMigrate(URL_A, NAME_A, STOP_BEFORE);
    record('A1 migrate parcial (stop-before 374) → exit 0', mA1.status === 0, mA1.out.slice(-400));
    const applied374 = await count(poolA, `SELECT count(*)::text n FROM schema_migrations WHERE filename = $1`, [MIG_374]);
    const hasCtxCol = await count(poolA, `SELECT count(*)::text n FROM information_schema.columns WHERE table_name='media_assets' AND column_name='context_type'`);
    record('A2 schema LEGADO confirmado (374 não aplicada; media_assets sem context_type)', applied374 === 0 && hasCtxCol === 0);

    console.log('\n— FASE A: seed de dados legados REAIS —');
    // tenantService usa o pool singleton (DATABASE_URL = DB A).
    const { tenantService } = await import('../core/tenants/tenant.service');
    await tenantService.createTenant({ id: TENANT, name: 'Backfill Legacy Tenant', slug: 'backfill-legacy' });
    await poolA.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1, '39053344705', 'Legacy Human', '{}'::jsonb)`, [GLOBAL]);
    await poolA.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1, '39053344705', 'cpf', 'pending', 'none')`, [GLOBAL]);
    await poolA.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1, $1, $2, $3, 'legacy@e2e.local', 'x', 0)`, [USER, TENANT, GLOBAL]);
    const { socialPortsRegistry } = await import('../core/social/ports-registry');
    const adapters = await import('../modules/social/adapters');
    socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
    socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
    socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
    socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
    socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
    // O pool singleton dos services aponta para a DB A (DATABASE_URL).
    const ACTOR = (await socialPortsRegistry.getActorRepository().findOrCreateUserActor(TENANT, USER)).actor_id;

    await poolA.query(
      `INSERT INTO media_blobs (id, content_hash, mime_type, size_bytes, storage_reference)
       VALUES ($1, 'e2e-legacy-hash-1', 'image/png', 100, 'e2e-legacy-ref-1'),
              ($2, 'e2e-legacy-hash-2', 'image/png', 200, 'e2e-legacy-ref-2')`, [BLOB_1, BLOB_2]);
    // Asset EMPRESARIAL pending (licença com bordas/case; provenance com '|').
    await poolA.query(
      `INSERT INTO media_assets (id, media_blob_id, source, license, origin_note, moderation_status, created_by_actor_id, origin_tenant_id)
       VALUES ($1, $2, 'company_suggestion', $3, $4, 'pending', $5, $6)`,
      [ASSET_EMP, BLOB_1, LEGACY_LICENSE, LEGACY_PROVENANCE, ACTOR, TENANT]);
    // Asset CANÔNICO approved de plataforma (seed global, sem tenant/actor).
    await poolA.query(
      `INSERT INTO media_assets (id, media_blob_id, source, license, moderation_status)
       VALUES ($1, $2, 'seed', 'CC0', 'approved')`, [ASSET_CAN, BLOB_2]);
    const svcRow = await poolA.query<{ id: string }>(`SELECT id::text FROM canonical_services LIMIT 1`);
    const SVC = svcRow.rows[0]?.id;
    record('A3 entidade canônica viva disponível no ponto legado (seed das migrations ≤373)', !!SVC);
    await poolA.query(
      `INSERT INTO canonical_service_media (canonical_service_id, media_asset_id, media_role) VALUES ($1::uuid, $2::uuid, 'primary')`,
      [SVC, ASSET_CAN]);
    await poolA.query(
      `INSERT INTO business_media (tenant_id, owner_actor_id, attached_to_type, attached_to_id, media_asset_id)
       VALUES ($1, $2, 'company', $3, $4)`, [TENANT, ACTOR, ATTACH_TARGET, ASSET_EMP]);
    record('A4 seed legado: 2 blobs, 2 assets, 1 business_media, 1 canonical_service_media',
      (await count(poolA, `SELECT count(*)::text n FROM media_assets`)) === 2 &&
      (await count(poolA, `SELECT count(*)::text n FROM media_blobs`)) === 2 &&
      (await count(poolA, `SELECT count(*)::text n FROM business_media`)) === 1 &&
      (await count(poolA, `SELECT count(*)::text n FROM canonical_service_media WHERE media_asset_id=$1::uuid`, [ASSET_CAN])) === 1);

    console.log('\n— FASE A: aplica 374/375/376 normalmente —');
    const mA2 = runMigrate(URL_A, NAME_A);
    record('A5 migrate completo (374+375+376) → exit 0', mA2.status === 0, mA2.out.slice(-600));
    record('A6 schema_migrations registra 374/375/376',
      (await count(poolA, `SELECT count(*)::text n FROM schema_migrations WHERE filename = ANY($1)`, [[MIG_374, MIG_375, MIG_376]])) === 3);

    console.log('\n— FASE A: preservação + inferência + identidade V2 —');
    const emp = (await poolA.query<{
      id: string; media_blob_id: string; source: string; license: string; origin_note: string;
      moderation_status: string; created_by_actor_id: string; origin_tenant_id: string;
      context_type: string; context_owner_id: string | null; purpose: string;
      context_identity_version: number; context_fingerprint: string; context_fingerprint_v1: string;
      fp_v2_expected: string; fp_v1_expected: string;
    }>(
      `SELECT ma.id::text, ma.media_blob_id::text, ma.source, ma.license, ma.origin_note,
              ma.moderation_status, ma.created_by_actor_id::text, ma.origin_tenant_id::text,
              ma.context_type, ma.context_owner_id::text, ma.purpose,
              ma.context_identity_version, ma.context_fingerprint, ma.context_fingerprint_v1,
              media_context_fingerprint_v2(ma.media_blob_id, ma.origin_tenant_id, ma.created_by_actor_id,
                ma.context_type, ma.context_owner_id, ma.source, ma.purpose, ma.license, ma.origin_note) AS fp_v2_expected,
              md5(ma.media_blob_id::text || '|' || COALESCE(ma.origin_tenant_id::text,'') || '|' ||
                  COALESCE(ma.created_by_actor_id::text,'') || '|' || ma.context_type || '|' ||
                  COALESCE(ma.context_owner_id::text,'') || '|' || ma.source || '|' || ma.purpose || '|' ||
                  lower(btrim(COALESCE(ma.license,''))) || '|' || lower(btrim(COALESCE(ma.origin_note,'')))) AS fp_v1_expected
         FROM media_assets ma WHERE ma.id = $1::uuid`, [ASSET_EMP])).rows[0];
    record('A7 asset empresarial: ID/blob/tenant/actor/moderação PRESERVADOS',
      !!emp && emp.id === ASSET_EMP && emp.media_blob_id === BLOB_1 && emp.origin_tenant_id === TENANT &&
      emp.created_by_actor_id === ACTOR && emp.moderation_status === 'pending');
    record('A8 licença/source/provenance PRESERVADAS byte-exatas (bordas/case/"|" intactos — migração não normaliza dado legado)',
      emp.license === LEGACY_LICENSE && emp.source === 'company_suggestion' && emp.origin_note === LEGACY_PROVENANCE,
      JSON.stringify([emp.license, emp.origin_note]));
    record('A9 contexto inferido pela regra da 374: canonical_suggestion/canonical_catalog (owner NULL)',
      emp.context_type === 'canonical_suggestion' && emp.purpose === 'canonical_catalog' && emp.context_owner_id === null);
    record('A10 identidade V2: version=2; fingerprint == função SQL canônica (fonte única)',
      emp.context_identity_version === 2 && emp.context_fingerprint === emp.fp_v2_expected &&
      /^[0-9a-f]{64}$/.test(emp.context_fingerprint));
    record('A11 arqueologia V1: context_fingerprint_v1 == fórmula V1 (md5) — histórico preservado, não soberano',
      emp.context_fingerprint_v1 === emp.fp_v1_expected && /^[0-9a-f]{32}$/.test(emp.context_fingerprint_v1));

    const can = (await poolA.query<{ moderation_status: string; license: string; context_type: string; purpose: string; context_identity_version: number }>(
      `SELECT moderation_status, license, context_type, purpose, context_identity_version FROM media_assets WHERE id=$1::uuid`, [ASSET_CAN])).rows[0];
    record('A12 asset canônico: approved/CC0 preservados; contexto platform/platform_curation; version=2',
      !!can && can.moderation_status === 'approved' && can.license === 'CC0' &&
      can.context_type === 'platform' && can.purpose === 'platform_curation' && can.context_identity_version === 2);

    record('A13 relações preservadas (business_media + canonical_service_media), nenhuma linha descartada/fundida, zero órfão',
      (await count(poolA, `SELECT count(*)::text n FROM media_assets`)) === 2 &&
      (await count(poolA, `SELECT count(*)::text n FROM business_media WHERE media_asset_id=$1::uuid`, [ASSET_EMP])) === 1 &&
      (await count(poolA, `SELECT count(*)::text n FROM canonical_service_media WHERE media_asset_id=$1::uuid`, [ASSET_CAN])) === 1 &&
      (await count(poolA, `SELECT count(*)::text n FROM media_assets ma WHERE NOT EXISTS (SELECT 1 FROM media_blobs mb WHERE mb.id=ma.media_blob_id)`)) === 0);
    const idxV2 = await count(poolA, `SELECT count(*)::text n FROM pg_indexes WHERE tablename='media_assets' AND indexname='uidx_media_assets_context_fingerprint_v2'`);
    const idxV1 = await count(poolA, `SELECT count(*)::text n FROM pg_indexes WHERE tablename='media_assets' AND indexname='uidx_media_assets_context_fingerprint'`);
    record('A14 unicidade: índice V2 vivo; índice da fórmula V1 RETIRADO', idxV2 === 1 && idxV1 === 0);
    record('A15 zero Bank', (await count(poolA, `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === 0);

    // ════ FASE B — fail-closed (contexto não inferível) ════════════════════
    console.log('\n— FASE B: cenário legado IMPOSSÍVEL → migração V2 aborta —');
    const mB1 = runMigrate(URL_B, NAME_B, STOP_BEFORE);
    record('B1 migrate parcial (stop-before 374) → exit 0', mB1.status === 0, mB1.out.slice(-300));
    await poolB.query(
      `INSERT INTO media_blobs (id, content_hash, mime_type, size_bytes, storage_reference)
       VALUES ($1, 'e2e-legacy-hash-3', 'image/png', 300, 'e2e-legacy-ref-3')`, [BLOB_3]);
    // Sugestão empresarial SEM tenant e SEM actor declarante: legal no schema
    // legado (colunas nullable), mas contexto NÃO inferível — ninguém declara.
    await poolB.query(
      `INSERT INTO media_assets (id, media_blob_id, source, license, moderation_status)
       VALUES ($1, $2, 'company_suggestion', 'lost-context', 'pending')`, [ASSET_IMPOSSIBLE, BLOB_3]);

    const mB2 = runMigrate(URL_B, NAME_B);
    record('B2 migrate completo ABORTA fail-closed na V2 (exit ≠ 0; mensagem nomeia contexto não inferível)',
      mB2.status !== 0 && /media_context_identity_v2/.test(mB2.out) && /infer/i.test(mB2.out),
      `exit=${mB2.status}`);
    record('B3 376 NÃO aplicada (revertida); 374/375 commitadas — nenhuma inferência silenciosa virou verdade',
      (await count(poolB, `SELECT count(*)::text n FROM schema_migrations WHERE filename=$1`, [MIG_376])) === 0 &&
      (await count(poolB, `SELECT count(*)::text n FROM schema_migrations WHERE filename = ANY($1)`, [[MIG_374, MIG_375]])) === 2);
    record('B4 coluna context_identity_version NÃO existe (transação da 376 revertida por inteiro)',
      (await count(poolB, `SELECT count(*)::text n FROM information_schema.columns WHERE table_name='media_assets' AND column_name='context_identity_version'`)) === 0);
    const imp = (await poolB.query<{ license: string; moderation_status: string }>(
      `SELECT license, moderation_status FROM media_assets WHERE id=$1::uuid`, [ASSET_IMPOSSIBLE])).rows[0];
    record('B5 nenhuma linha descartada/classificada à força: asset impossível INTACTO aguardando decisão humana',
      (await count(poolB, `SELECT count(*)::text n FROM media_assets`)) === 1 &&
      !!imp && imp.license === 'lost-context' && imp.moderation_status === 'pending');
  } finally {
    await poolA.end().catch(() => undefined);
    await poolB.end().catch(() => undefined);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ Backfill legado de identidade de mídia (feliz + fail-closed) — verde.');
  process.exit(0);
}

main().catch((e) => {
  console.error('💥 Erro não tratado:', e);
  process.exit(1);
});
