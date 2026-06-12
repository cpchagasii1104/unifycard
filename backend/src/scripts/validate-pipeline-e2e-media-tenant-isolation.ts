/**
 * E2E ADVERSARIAL — F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE.
 * Vetor do FAIL Yala (DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK)
 * transformado em prova permanente, por HTTP real (app.inject).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-media-tenant-isolation-ephemeral.ps1.
 *
 * Prova (GO §11/§12/§13):
 *   - tenant A envia mídia privada pending; tenant B envia os MESMOS bytes:
 *     1 blob físico, 2 assets lógicos, IDs distintos, tenants/autores corretos;
 *   - B NÃO herda metadata/moderação de A (asset de B nasce pending mesmo com o de A aprovado);
 *   - B não baixa arquivo de A (404 sem oráculo); B não anexa asset de A em business_media;
 *     A idem sobre B; B anexa/lê o PRÓPRIO asset;
 *   - mídia canônica PÚBLICA: curador aprova + liga ao canônico → arquivo lê por contrato
 *     público (inclusive cross-tenant); o OUTRO asset do mesmo blob permanece privado;
 *     payload público sem autoria/origem/storage;
 *   - corrida: 2 tenants enviam os mesmos bytes simultaneamente → 1 blob, 2 assets, sem 500;
 *     mesmo contexto 2× concorrente → 1 asset (idempotente);
 *   - DB failure pós-blob: blob COMPARTILHADO jamais é apagado; blob exclusivo é compensado;
 *   - zero blob duplicado, zero asset/arquivo órfão; zero Bank writer.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { promises as fsp } from 'fs';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;

const PNG = (tag: string): Buffer =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`media-isolation-${tag}`)]);
const PNG_X = PNG('X-privada');
const PNG_Y = PNG('Y-corrida');
const PNG_Z = PNG('Z-idempotente');
const PNG_W = PNG('W-compensacao');

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/media|isolation|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  const mediaAssetsRoutes = (await import('../core/media-assets/media-assets.routes')).default;
  await app.register(mediaAssetsRoutes, { prefix: '/catalog/media' });
  const catalogGovernanceRoutes = (await import('../core/catalog/catalog-governance.routes')).default;
  await app.register(catalogGovernanceRoutes, { prefix: '/catalog/governance' });
  await app.ready();
  return app;
}

function makeValidCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const calc = (nums: string): number => {
    const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base);
  const d2 = calc(base + String(d1));
  return base + String(d1) + String(d2);
}

interface Human { tenantId: string; globalId: string; userId: string; actorId: string; headers: Record<string, string> }

function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; value: Buffer | string }>): { payload: Buffer; contentType: string } {
  const boundary = '----e2eiso' + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const p of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename) head += `; filename="${p.filename}"`;
    head += '\r\n';
    if (p.contentType) head += `Content-Type: ${p.contentType}\r\n`;
    head += '\r\n';
    chunks.push(Buffer.from(head), Buffer.isBuffer(p.value) ? p.value : Buffer.from(p.value), Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function storageFileCount(): Promise<number> {
  try {
    return (await fsp.readdir(join(process.cwd(), '.private', 'document-storage'))).length;
  } catch {
    return 0;
  }
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  // ── DOIS TENANTS REAIS (o vetor da Yala é cross-tenant) ────────────────────
  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'Media Iso Tenant A', slug: `media-iso-a-${Date.now()}` });
  await tenantService.createTenant({ id: TENANT_B, name: 'Media Iso Tenant B', slug: `media-iso-b-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_A);
  await rbacService.seedDefaultRBAC(TENANT_B);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (tenantId: string, name: string, role?: 'admin'): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, tenantId, globalId, `${userId}@e2e.local`]);
    const actorId = (await actorRepo.findOrCreateUserActor(tenantId, userId)).actor_id;
    if (role === 'admin') await rbacService.assignRoleByName(tenantId, userId, 'admin');
    const token = jwt.sign(
      { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'media_isolation_e2e', source: 'e2e', scope: `tenant:${tenantId}` });
    return { tenantId, globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const UA = await mkHuman(TENANT_A, 'E2E Iso Founder A');
  const UB = await mkHuman(TENANT_B, 'E2E Iso Founder B');
  const CUR_A = await mkHuman(TENANT_A, 'E2E Iso Curator A', 'admin');

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };
  const companyA = await createCompany(UA, 83000001, 'E2E Iso Co A');
  const companyB = await createCompany(UB, 83000002, 'E2E Iso Co B');

  const upload = async (h: Human, companyId: string, buf: Buffer, filename: string): Promise<{ status: number; body: { ok?: boolean; data?: { mediaAssetId: string; moderationStatus: string; reusedExistingBlob: boolean; reusedExistingAsset: boolean }; code?: string } }> => {
    const mp = multipartBody([{ name: 'file', filename, contentType: 'image/png', value: buf }]);
    const r = await app.inject({
      method: 'POST', url: `/catalog/media/assets?companyId=${companyId}`,
      headers: { ...h.headers, 'content-type': mp.contentType },
      payload: mp.payload,
    });
    return { status: r.statusCode, body: r.json() };
  };

  const bankSnapshot = async (): Promise<number> =>
    count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  const bank0 = await bankSnapshot();
  const files0 = await storageFileCount();

  try {
    // ═══ §11 — VETOR ADVERSARIAL PRINCIPAL ═══════════════════════════════════
    // A envia mídia privada (pending); curador de A aprova (SEM attach canônico
    // → segue privada ao contexto de A); B envia os MESMOS bytes.
    const u1 = await upload(UA, companyA, PNG_X, 'privada-a.png');
    const assetA = u1.body?.data?.mediaAssetId as string;
    record('T1 tenant A envia mídia privada → 201 pending', u1.status === 201 && u1.body?.data?.moderationStatus === 'pending', `status=${u1.status}`);
    const apprA = await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetA}/approve`, headers: CUR_A.headers });
    record('T1b curador de A aprova o asset de A', apprA.statusCode === 200, `status=${apprA.statusCode}`);

    const filesAfterA = await storageFileCount();
    const u2 = await upload(UB, companyB, PNG_X, 'privada-b.png');
    const assetB = u2.body?.data?.mediaAssetId as string;
    const filesAfterB = await storageFileCount();
    record('T2 tenant B envia MESMOS bytes → asset lógico PRÓPRIO (id ≠ A), blob físico reutilizado',
      u2.status === 201 && !!assetB && assetB !== assetA && u2.body?.data?.reusedExistingBlob === true && filesAfterB === filesAfterA,
      `status=${u2.status} files ${filesAfterA}→${filesAfterB}`);
    record('T2b B NÃO herda a moderação de A (asset de B nasce pending; o de A está approved)',
      u2.body?.data?.moderationStatus === 'pending', `moderation=${u2.body?.data?.moderationStatus}`);
    record('T2c response de B não expõe autoria/origem/hash de terceiro',
      !JSON.stringify(u2.body?.data ?? {}).match(/createdByActorId|originTenantId|contentHash|storageReference/), JSON.stringify(u2.body?.data ?? {}));

    record('T3 blob_count=1, asset_count=2 (dedup física global + separação lógica)',
      (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1 &&
      (await count(`SELECT count(*)::text n FROM media_assets`)) === 2,
      `blobs=${await count(`SELECT count(*)::text n FROM media_blobs`)} assets=${await count(`SELECT count(*)::text n FROM media_assets`)}`);

    const rows = await pool.query<{ id: string; origin_tenant_id: string; created_by_actor_id: string; moderation_status: string }>(
      `SELECT id::text, origin_tenant_id::text, created_by_actor_id::text, moderation_status FROM media_assets ORDER BY created_at`
    );
    const rowA = rows.rows.find((r) => r.id === assetA);
    const rowB = rows.rows.find((r) => r.id === assetB);
    record('T4 tenants e autores ISOLADOS (assetA: tenant/actor A; assetB: tenant/actor B)',
      rowA?.origin_tenant_id === TENANT_A && rowA?.created_by_actor_id === UA.actorId &&
      rowB?.origin_tenant_id === TENANT_B && rowB?.created_by_actor_id === UB.actorId);
    record('T5 moderação isolada: A=approved não contaminou B=pending',
      rowA?.moderation_status === 'approved' && rowB?.moderation_status === 'pending',
      `A=${rowA?.moderation_status} B=${rowB?.moderation_status}`);

    // arquivo e metadata cross-tenant privados: INACESSÍVEIS mesmo com o ID
    const bReadsA = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: UB.headers });
    record('T6 B não baixa arquivo privado de A (404 sem oráculo)', bReadsA.statusCode === 404, `status=${bReadsA.statusCode}`);
    const aReadsB = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetB}/file`, headers: UA.headers });
    record('T6b A não baixa arquivo privado de B (404)', aReadsB.statusCode === 404, `status=${aReadsB.statusCode}`);

    const bAttachA = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: UB.headers,
      payload: { ownerActorId: UB.actorId, attachedToType: 'company', attachedToId: companyB, mediaAssetId: assetA },
    });
    record('T7 B não anexa o asset privado de A em business_media (404 + zero linha)',
      bAttachA.statusCode === 404 && (await count(`SELECT count(*)::text n FROM business_media`)) === 0, `status=${bAttachA.statusCode}`);
    const aAttachB = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: UA.headers,
      payload: { ownerActorId: UA.actorId, attachedToType: 'company', attachedToId: companyA, mediaAssetId: assetB },
    });
    record('T7b A não anexa o asset privado de B (404)', aAttachB.statusCode === 404, `status=${aAttachB.statusCode}`);

    const bAttachOwn = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: UB.headers,
      payload: { ownerActorId: UB.actorId, attachedToType: 'company', attachedToId: companyB, mediaAssetId: assetB, caption: 'fachada B' },
    });
    record('T8 B anexa o PRÓPRIO asset (200) — blob compartilhado internamente',
      bAttachOwn.statusCode === 200 && (await count(`SELECT count(*)::text n FROM business_media WHERE tenant_id=$1`, [TENANT_B])) === 1,
      `status=${bAttachOwn.statusCode}`);
    const bReadsOwn = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetB}/file`, headers: UB.headers });
    record('T8b B lê o PRÓPRIO arquivo (round-trip íntegro do blob compartilhado)',
      bReadsOwn.statusCode === 200 && Buffer.compare(bReadsOwn.rawPayload, PNG_X) === 0, `status=${bReadsOwn.statusCode}`);

    // ═══ §12 — MÍDIA CANÔNICA PÚBLICA ════════════════════════════════════════
    const catId = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: UA.headers,
      payload: { companyId: companyA, name: 'Produto Iso Media', brand: 'IsoBrand', categoryId: catId },
    });
    const prodId = sug.json()?.data?.canonicalProductId as string;
    const att = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: CUR_A.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: assetA, mediaRole: 'primary' },
    });
    record('T9 curadoria liga o asset APROVADO de A ao canônico (ato explícito)', sug.statusCode === 201 && att.statusCode === 200, `sug=${sug.statusCode} att=${att.statusCode}`);

    const bReadsPublic = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: UB.headers });
    record('T9b mídia canônica PÚBLICA: B (outro tenant) agora lê o arquivo pelo contrato público',
      bReadsPublic.statusCode === 200 && Buffer.compare(bReadsPublic.rawPayload, PNG_X) === 0, `status=${bReadsPublic.statusCode}`);
    const pubList = await app.inject({ method: 'GET', url: `/catalog/media/canonical/product/${prodId}`, headers: UB.headers });
    const pubItems = (pubList.json()?.data ?? []) as Array<Record<string, unknown>>;
    record('T9c payload público traz o asset canônico SEM metadata privada (autoria/origem/storage/hash)',
      pubList.statusCode === 200 && pubItems.some((i) => i.id === assetA) &&
      !JSON.stringify(pubItems).match(/createdByActorId|originTenantId|storageReference|contentHash/), JSON.stringify(pubItems).slice(0, 200));
    const aReadsBStill = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetB}/file`, headers: UA.headers });
    record('T9d o OUTRO asset do MESMO blob permanece privado (publicidade é do ASSET, não do blob)',
      aReadsBStill.statusCode === 404 && (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1, `status=${aReadsBStill.statusCode}`);

    // ═══ §13 — CORRIDA E IDEMPOTÊNCIA ════════════════════════════════════════
    const filesBeforeRace = await storageFileCount();
    const [rA, rB] = await Promise.all([
      upload(UA, companyA, PNG_Y, 'corrida-a.png'),
      upload(UB, companyB, PNG_Y, 'corrida-b.png'),
    ]);
    const yBlobN = await count(`SELECT count(*)::text n FROM media_blobs`);
    const yAssetsDistinct = rA.body?.data?.mediaAssetId !== rB.body?.data?.mediaAssetId;
    record('T10 corrida cross-tenant (mesmos bytes simultâneos): sem 500, 1 blob novo, 2 assets distintos',
      rA.status < 500 && rB.status < 500 && yBlobN === 2 && yAssetsDistinct &&
      (await storageFileCount()) === filesBeforeRace + 2,
      `sA=${rA.status} sB=${rB.status} blobs=${yBlobN}`);

    const [z1, z2] = await Promise.all([
      upload(UA, companyA, PNG_Z, 'z1.png'),
      upload(UA, companyA, PNG_Z, 'z2.png'),
    ]);
    record('T11 corrida no MESMO contexto: idempotente (1 asset, mesmo id, sem 500)',
      z1.status < 500 && z2.status < 500 && z1.body?.data?.mediaAssetId === z2.body?.data?.mediaAssetId &&
      (await count(`SELECT count(*)::text n FROM media_assets WHERE origin_tenant_id=$1 AND created_by_actor_id=$2`, [TENANT_A, UA.actorId])) === 3,
      `s1=${z1.status} s2=${z2.status}`);

    // DB failure PÓS-blob: blob EXCLUSIVO é compensado; blob COMPARTILHADO sobrevive.
    const { mediaAssetService } = await import('../core/media-assets/media-asset.service');
    const filesBeforeW = await storageFileCount();
    let wErr = false;
    try {
      await mediaAssetService.ingest(
        { tenantId: TENANT_B, buffer: PNG_W, mimeType: 'image/png', createdByActorId: UB.actorId },
        { persistAssetRow: async () => { throw new Error('E2E_DB_DOWN'); } }
      );
    } catch (e) { wErr = /E2E_DB_DOWN/.test((e as Error).message); }
    record('T12 blob EXCLUSIVO criado na chamada falha → compensado (zero linha, zero arquivo)',
      wErr && (await count(`SELECT count(*)::text n FROM media_blobs WHERE mime_type='image/png'`)) === 3 &&
      (await storageFileCount()) === filesBeforeW, `files=${await storageFileCount()} vs ${filesBeforeW}`);

    let xErr = false;
    try {
      await mediaAssetService.ingest(
        { tenantId: TENANT_B, buffer: PNG_X, mimeType: 'image/png', createdByActorId: CUR_A.actorId },
        { persistAssetRow: async () => { throw new Error('E2E_DB_DOWN_SHARED'); } }
      );
    } catch (e) { xErr = /E2E_DB_DOWN_SHARED/.test((e as Error).message); }
    const sharedBlobAlive = await count(`SELECT count(*)::text n FROM media_blobs mb WHERE EXISTS (SELECT 1 FROM media_assets ma WHERE ma.media_blob_id=mb.id AND ma.id=$1::uuid)`, [assetA]);
    const aStillReads = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: UA.headers });
    record('T13 falha sobre blob COMPARTILHADO → blob/arquivo de terceiros INTACTOS (compensação nunca apaga blob usado)',
      xErr && sharedBlobAlive === 1 && aStillReads.statusCode === 200 && Buffer.compare(aStillReads.rawPayload, PNG_X) === 0,
      `blobAlive=${sharedBlobAlive} read=${aStillReads.statusCode}`);

    // ═══ INTEGRIDADE FINAL ═══════════════════════════════════════════════════
    const blobsEnd = await count(`SELECT count(*)::text n FROM media_blobs`);
    const assetsEnd = await count(`SELECT count(*)::text n FROM media_assets`);
    const orphanAssets = await count(`SELECT count(*)::text n FROM media_assets ma WHERE NOT EXISTS (SELECT 1 FROM media_blobs mb WHERE mb.id=ma.media_blob_id)`);
    record('T14 integridade: blobs=3 (X,Y,Z), assets=5, zero asset órfão, arquivos=blobs×2',
      blobsEnd === 3 && assetsEnd === 5 && orphanAssets === 0 && (await storageFileCount()) - files0 === blobsEnd * 2,
      `blobs=${blobsEnd} assets=${assetsEnd} órfãos=${orphanAssets} delta=${(await storageFileCount()) - files0}`);
    record('T15 zero Bank writer na jornada inteira', (await bankSnapshot()) === bank0);

    // CLEANUP — storage local compartilhado com o dev: remove os blobs da run.
    const { resolveDocumentStorageProvider } = await import('../core/document-storage/document-storage.provider');
    const storage = resolveDocumentStorageProvider();
    const refs = await pool.query<{ storage_reference: string }>(`SELECT storage_reference FROM media_blobs`);
    for (const ref of refs.rows) {
      try { await storage.deleteDocument(ref.storage_reference); } catch { /* best-effort */ }
    }
    record('CLEANUP storage local sem resíduo da run', (await storageFileCount()) === files0, `${files0}→${await storageFileCount()}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Isolamento blob físico × asset lógico cross-tenant — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
