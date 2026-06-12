/**
 * E2E CP2 F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE — mídia canônica
 * content-addressed (DECISION-0117 C), HTTP real via app.inject.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-canonical-media-ephemeral.ps1.
 *
 * Prova (GO §8.4):
 *   - upload válido (multipart real) → asset pending + blob no storage privado;
 *   - MIME inválido / magic mismatch / scanner não-clean / arquivo vazio → fail-closed, ZERO efeito;
 *   - storage failure → erro, zero registro; DB failure PÓS-storage → blob COMPENSADO (zero órfão);
 *   - mesmo arquivo 2× → 1 blob (reusedExistingBlob; contagem de arquivos não cresce);
 *   - duas empresas reutilizam o MESMO asset canônico (attach curatorial; sem cópia);
 *   - complemento empresarial isolado (sem canRepresentActor do owner → 403);
 *   - detach canônico não apaga asset/blob referenciado;
 *   - mídia canônica exige moderação (attach de pending → 422); admin aprova;
 *   - zero arquivo órfão ao fim; zero Bank writer.
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

// PNG mínimo válido pelos magic bytes (89 50 4E 47 0D 0A 1A 0A) + payload distinto.
const PNG_A = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('e2e-media-A')]);
const PNG_B = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('e2e-media-B-distinto')]);
const JPEG_C = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('e2e-media-C-jpeg')]);

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

interface Human { globalId: string; userId: string; actorId: string; headers: Record<string, string> }

function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; value: Buffer | string }>): { payload: Buffer; contentType: string } {
  const boundary = '----e2emedia' + Math.random().toString(16).slice(2);
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

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Canonical Media Test', slug: `canonical-media-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string, role?: 'admin'): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;
    if (role === 'admin') await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'media_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const FA = await mkHuman('E2E Media Founder A');
  const FB = await mkHuman('E2E Media Founder B');
  const CUR = await mkHuman('E2E Media Curator', 'admin');

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };
  const companyA = await createCompany(FA, 82000001, 'E2E Media Co A');
  const companyB = await createCompany(FB, 82000002, 'E2E Media Co B');

  const upload = async (h: Human, companyId: string, buf: Buffer, mime: string, filename: string): Promise<{ status: number; body: { ok?: boolean; data?: { mediaAssetId: string; contentHash: string; moderationStatus: string; reusedExistingBlob: boolean }; code?: string } }> => {
    const mp = multipartBody([{ name: 'file', filename, contentType: mime, value: buf }]);
    const r = await app.inject({
      method: 'POST', url: `/catalog/media/assets?companyId=${companyId}`,
      headers: { ...h.headers, 'content-type': mp.contentType },
      payload: mp.payload,
    });
    return { status: r.statusCode, body: r.json() };
  };

  const econ0 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
  const files0 = await storageFileCount();

  try {
    // M1 — upload válido (multipart REAL) → 201 pending + blob persistido
    const m1 = await upload(FA, companyA, PNG_A, 'image/png', 'coca.png');
    const assetA = m1.body?.data?.mediaAssetId as string;
    record('M1 upload válido → 201 asset pending', m1.status === 201 && m1.body?.data?.moderationStatus === 'pending', `status=${m1.status}`);
    const files1 = await storageFileCount();
    record('M1b blob no storage privado (+sidecar)', files1 > files0, `${files0}→${files1}`);

    // M2 — mesmo arquivo 2× (outra empresa) → MESMO asset, ZERO blob novo
    const m2 = await upload(FB, companyB, PNG_A, 'image/png', 'coca-copia.png');
    const files2 = await storageFileCount();
    record('M2 mesmo conteúdo não duplica blob (reuso content-addressed)',
      m2.status === 200 && m2.body?.data?.mediaAssetId === assetA && m2.body?.data?.reusedExistingBlob === true && files2 === files1,
      `status=${m2.status} files ${files1}→${files2}`);

    // M3 — MIME inválido → 400, zero efeito
    const m3 = await upload(FA, companyA, Buffer.from('GIF89a-fake'), 'image/gif', 'x.gif');
    record('M3 MIME fora da allowlist → 400', m3.status === 400 && m3.body?.code === 'MEDIA_MIME_NOT_ALLOWED', `status=${m3.status}`);

    // M4 — magic mismatch (PNG declarado, conteúdo texto) → 400
    const m4 = await upload(FA, companyA, Buffer.from('isto nao e png'), 'image/png', 'fake.png');
    record('M4 magic mismatch → 400', m4.status === 400 && m4.body?.code === 'MEDIA_MAGIC_MISMATCH', `status=${m4.status}`);

    // M5 — scanner não-clean → 422, NADA armazenado (service com fake scanner)
    const { mediaAssetService } = await import('../core/media-assets/media-asset.service');
    const filesBefore5 = await storageFileCount();
    let m5ok = false;
    try {
      await mediaAssetService.ingest(
        { tenantId: TENANT_ID, buffer: PNG_B, mimeType: 'image/png', createdByActorId: FA.actorId },
        { scanner: { scanDocument: async () => ({ status: 'infected' as const, scanner: 'e2e-fake' }) } }
      );
    } catch (e) {
      m5ok = (e as { code?: string }).code === 'MEDIA_SCAN_NOT_CLEAN';
    }
    const files5 = await storageFileCount();
    record('M5 scanner não-clean → bloqueado, zero blob', m5ok && files5 === filesBefore5, `files ${filesBefore5}→${files5}`);

    // M6 — storage failure → erro, zero registro
    let m6ok = false;
    try {
      await mediaAssetService.ingest(
        { tenantId: TENANT_ID, buffer: PNG_B, mimeType: 'image/png', createdByActorId: FA.actorId },
        { storage: { storeDocument: async () => { throw new Error('E2E_STORAGE_DOWN'); }, readDocument: async () => { throw new Error('x'); }, deleteDocument: async () => {} } }
      );
    } catch (e) {
      m6ok = /E2E_STORAGE_DOWN/.test((e as Error).message);
    }
    const reg6 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM media_assets WHERE origin_tenant_id=$1`, [TENANT_ID]);
    record('M6 storage failure → erro sem registro fantasma', m6ok && reg6.rows[0].n === '1', `assets=${reg6.rows[0].n}`);

    // M7 — DB failure PÓS-storage → COMPENSAÇÃO (blob removido; zero órfão)
    const filesBefore7 = await storageFileCount();
    let m7ok = false;
    try {
      await mediaAssetService.ingest(
        { tenantId: TENANT_ID, buffer: PNG_B, mimeType: 'image/png', createdByActorId: FA.actorId },
        { persistAssetRow: async () => { throw new Error('E2E_DB_DOWN_AFTER_STORAGE'); } }
      );
    } catch (e) {
      m7ok = /E2E_DB_DOWN_AFTER_STORAGE/.test((e as Error).message);
    }
    const files7 = await storageFileCount();
    record('M7 INSERT falho pós-storage → blob compensado (zero órfão)', m7ok && files7 === filesBefore7, `files ${filesBefore7}→${files7}`);

    // M8 — attach canônico exige asset APROVADO (pending → 422); admin aprova; attach OK
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: FA.headers,
      payload: { companyId: companyA, name: 'Coca-Cola Original Media', brand: 'Coca-Cola', categoryId: (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id },
    });
    const prodId = sug.json()?.data?.canonicalProductId as string;
    const att0 = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: CUR.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: assetA },
    });
    record('M8a attach de asset PENDING → 422 (moderação obrigatória)', att0.statusCode === 422 && /MEDIA_NOT_APPROVED/.test(att0.body), `status=${att0.statusCode}`);
    const appr = await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetA}/approve`, headers: CUR.headers });
    record('M8b admin aprova asset', appr.statusCode === 200 && appr.json()?.data?.moderationStatus === 'approved', `status=${appr.statusCode}`);
    const apprByFounder = await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetA}/approve`, headers: FA.headers });
    record('M8c moderação é curatorial (não-admin → 403)', apprByFounder.statusCode === 403, `status=${apprByFounder.statusCode}`);
    const att1 = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: CUR.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: assetA, mediaRole: 'primary' },
    });
    record('M8d attach canônico (curatorial) OK', att1.statusCode === 200, `status=${att1.statusCode}`);

    // M9 — duas empresas REUTILIZAM o mesmo asset canônico (lista pública da entidade)
    const list9 = await app.inject({ method: 'GET', url: `/catalog/media/canonical/product/${prodId}`, headers: FB.headers });
    const items9 = (list9.json()?.data ?? []) as Array<{ id: string }>;
    record('M9 mídia canônica reutilizável (B lê o mesmo asset; zero cópia)', list9.statusCode === 200 && items9.some((i) => i.id === assetA), `n=${items9.length}`);

    // M10 — complemento empresarial isolado: B com owner actor de A → 403
    const att10 = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: FB.headers,
      payload: { ownerActorId: FA.actorId, attachedToType: 'company', attachedToId: companyA, mediaAssetId: assetA },
    });
    record('M10a mídia empresarial: sem canRepresentActor do owner → 403', att10.statusCode === 403 && /NOT_REPRESENTABLE/.test(att10.body), `status=${att10.statusCode}`);
    const att10b = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: FA.headers,
      payload: { ownerActorId: FA.actorId, attachedToType: 'company', attachedToId: companyA, mediaAssetId: assetA, caption: 'fachada' },
    });
    record('M10b owner anexa complemento empresarial próprio (200)', att10b.statusCode === 200, `status=${att10b.statusCode}`);

    // M11 — detach canônico NÃO apaga asset/blob (content-addressed, referenciado)
    const filesBefore11 = await storageFileCount();
    const det = await app.inject({
      method: 'POST', url: '/catalog/media/detach/canonical', headers: CUR.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: assetA },
    });
    const stillAsset = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM media_assets WHERE id=$1::uuid`, [assetA]);
    const files11 = await storageFileCount();
    record('M11 detach remove vínculo, preserva asset+blob', det.statusCode === 200 && stillAsset.rows[0].n === '1' && files11 === filesBefore11, `files ${filesBefore11}→${files11}`);

    // M12 — leitura do conteúdo (round-trip do blob)
    const read12 = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: FA.headers });
    record('M12 conteúdo round-trip íntegro', read12.statusCode === 200 && Buffer.compare(read12.rawPayload, PNG_A) === 0, `status=${read12.statusCode} bytes=${read12.rawPayload.length}`);

    // M13 — zero órfão: nº de blobs novos == nº de assets persistidos (×2 com sidecar .meta.json)
    const assetsN = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM media_assets`);
    const filesEnd = await storageFileCount();
    record('M13 zero arquivo órfão (blobs novos = assets × 2 [blob+sidecar])',
      filesEnd - files0 === Number(assetsN.rows[0].n) * 2, `delta=${filesEnd - files0} assets=${assetsN.rows[0].n}`);

    // M14 — zero Bank writer
    const econ1 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
    record('M14 zero Bank writer', econ0.rows[0].n === econ1.rows[0].n, `${econ0.rows[0].n} vs ${econ1.rows[0].n}`);

    // CLEANUP — a DB é efêmera, mas o storage local é compartilhado com o dev:
    // remove os blobs criados nesta run (delete idempotente do provider).
    const { resolveDocumentStorageProvider } = await import('../core/document-storage/document-storage.provider');
    const storage = resolveDocumentStorageProvider();
    const refs = await pool.query<{ storage_reference: string }>(`SELECT storage_reference FROM media_assets`);
    for (const ref of refs.rows) {
      try { await storage.deleteDocument(ref.storage_reference); } catch { /* best-effort */ }
    }
    const filesFinal = await storageFileCount();
    record('CLEANUP storage local sem resíduo da run', filesFinal === files0, `${files0}→${filesFinal}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Mídia canônica content-addressed — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
