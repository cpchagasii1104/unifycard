/**
 * E2E — DECISION-0118 D1 (F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE).
 * Vetor [B1] do reseal Yala (MEDIA-LOGICAL-CONTEXT-COLLAPSE) como prova permanente.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-media-contextual-identity-ephemeral.ps1.
 *
 * Prova (GO §6 cenários A/B/C/D + §5 idempotência):
 *   - mesmo humano H, mesmo tenant, MESMOS bytes X:
 *     A) empresa E1 business_media (licença privada) · B) empresa E2 business_media
 *     (licença própria) · C) E1 canonical_catalog (licença de curadoria) →
 *     1 blob físico, declarações A ≠ B ≠ C; D) repetição EXATA de A → idempotente;
 *   - licença divergente NUNCA é descartada (nova declaração, não reuso silencioso);
 *   - moderação por DECLARAÇÃO (aprovar C não aprova A/B; aprovar A não aprova B);
 *   - attach empresarial é por CONTEXTO: E2 não anexa declaração de E1 mesmo com o
 *     MESMO humano representando ambas; sugestão canônica não vira business media;
 *   - download por autoridade do CONTEXT_OWNER (estranho → 404; gestor → 200);
 *   - canônica pública publica SÓ a declaração aprovada/vinculada (mesmo blob);
 *   - Idempotency-Key: payload idêntico → reuso; divergente → 409 sem alterar nada;
 *   - zero Bank writer; storage sem resíduo.
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

const PNG_X = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('media-contextual-X')]);

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
  if (!/media|context|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const boundary = '----e2ectx' + Math.random().toString(16).slice(2);
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

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Media Contextual Test', slug: `media-ctx-${Date.now()}` });
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
    const ac = JSON.stringify({ actorId, intent: 'media_ctx_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const H1 = await mkHuman('E2E Ctx Founder H1');
  const H2 = await mkHuman('E2E Ctx Stranger H2');
  const CUR = await mkHuman('E2E Ctx Curator', 'admin');

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };
  // O MESMO humano H1 funda e representa E1 E E2 (o ponto do vetor [B1]).
  const E1 = await createCompany(H1, 84000001, 'E2E Ctx Empresa E1');
  const E2 = await createCompany(H1, 84000002, 'E2E Ctx Empresa E2');

  type UpBody = { ok?: boolean; data?: { mediaAssetId: string; moderationStatus: string; reusedExistingBlob: boolean; reusedExistingAsset: boolean }; code?: string };
  const upload = async (h: Human, q: Record<string, string>, buf: Buffer, filename: string): Promise<{ status: number; body: UpBody }> => {
    const mp = multipartBody([{ name: 'file', filename, contentType: 'image/png', value: buf }]);
    const qs = new URLSearchParams(q).toString();
    const r = await app.inject({
      method: 'POST', url: `/catalog/media/assets?${qs}`,
      headers: { ...h.headers, 'content-type': mp.contentType },
      payload: mp.payload,
    });
    return { status: r.statusCode, body: r.json() };
  };

  const bank0 = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
  const files0 = await storageFileCount();

  try {
    // ═══ CENÁRIOS A/B/C/D — mesmo humano, mesmo tenant, MESMOS bytes ══════════
    const a = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'privada-E1' }, PNG_X, 'a.png');
    const assetA = a.body?.data?.mediaAssetId as string;
    record('A: E1 business_media licença privada → 201 pending', a.status === 201 && a.body?.data?.moderationStatus === 'pending', `status=${a.status}`);

    const b = await upload(H1, { companyId: E2, purpose: 'business_media', license: 'propria-E2', provenance: 'acervo E2' }, PNG_X, 'b.png');
    const assetB = b.body?.data?.mediaAssetId as string;
    record('B: MESMO humano, MESMOS bytes, empresa E2 → declaração PRÓPRIA (id ≠ A; blob reutilizado)',
      b.status === 201 && !!assetB && assetB !== assetA && b.body?.data?.reusedExistingBlob === true, `status=${b.status}`);

    const c = await upload(H1, { companyId: E1, purpose: 'canonical_catalog', license: 'cc-curadoria' }, PNG_X, 'c.png');
    const assetC = c.body?.data?.mediaAssetId as string;
    record('C: mesmos bytes como SUGESTÃO CANÔNICA → declaração distinta (≠ A e ≠ B)',
      c.status === 201 && !!assetC && assetC !== assetA && assetC !== assetB, `status=${c.status}`);

    const d = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'privada-E1' }, PNG_X, 'd.png');
    record('D: repetição EXATA de A → idempotente (mesmo asset; nada novo)',
      d.status === 200 && d.body?.data?.mediaAssetId === assetA && d.body?.data?.reusedExistingAsset === true, `status=${d.status}`);

    record('1 blob físico, 3 declarações (A/B/C) — dedup física + contexto lógico',
      (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1 &&
      (await count(`SELECT count(*)::text n FROM media_assets`)) === 3);

    // ═══ DIMENSÃO DIVERGENTE NUNCA É DESCARTADA ═══════════════════════════════
    const a2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'OUTRA-licenca' }, PNG_X, 'a2.png');
    const assetA2 = a2.body?.data?.mediaAssetId as string;
    record('licença DIVERGENTE → declaração NOVA (intenção preservada, não reuso silencioso)',
      a2.status === 201 && !!assetA2 && assetA2 !== assetA, `status=${a2.status}`);
    const licA = await pool.query<{ license: string }>(`SELECT license FROM media_assets WHERE id=$1::uuid`, [assetA]);
    record('a declaração A permaneceu INTACTA (licença original)', licA.rows[0].license === 'privada-E1', licA.rows[0].license);

    // ═══ MODERAÇÃO POR DECLARAÇÃO ═════════════════════════════════════════════
    await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetC}/approve`, headers: CUR.headers });
    const mods = await pool.query<{ id: string; moderation_status: string }>(`SELECT id::text, moderation_status FROM media_assets`);
    const modOf = (id: string): string => mods.rows.find((r) => r.id === id)?.moderation_status ?? '?';
    record('aprovar C NÃO aprova A/B/A2 (moderação é da declaração, não do blob)',
      modOf(assetC) === 'approved' && modOf(assetA) === 'pending' && modOf(assetB) === 'pending' && modOf(assetA2) === 'pending',
      `C=${modOf(assetC)} A=${modOf(assetA)} B=${modOf(assetB)}`);

    // ═══ ATTACH POR CONTEXTO (mesmo humano, empresas distintas) ═══════════════
    const attE1 = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: H1.headers,
      payload: { ownerActorId: H1.actorId, attachedToType: 'company', attachedToId: E1, mediaAssetId: assetA, caption: 'fachada E1' },
    });
    record('E1 anexa a PRÓPRIA declaração (200)', attE1.statusCode === 200, `status=${attE1.statusCode}`);
    const attCross = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: H1.headers,
      payload: { ownerActorId: H1.actorId, attachedToType: 'company', attachedToId: E2, mediaAssetId: assetA },
    });
    record('E2 NÃO anexa a declaração privada de E1 — mesmo com o MESMO humano representando ambas (403 MEDIA_ASSET_FOREIGN)',
      attCross.statusCode === 403 && /MEDIA_ASSET_FOREIGN/.test(attCross.body), `status=${attCross.statusCode}`);
    const attSuggestion = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: H1.headers,
      payload: { ownerActorId: H1.actorId, attachedToType: 'company', attachedToId: E1, mediaAssetId: assetC },
    });
    record('sugestão canônica (pending) NÃO vira business media por atalho (403)',
      attSuggestion.statusCode === 403, `status=${attSuggestion.statusCode}`);
    record('business_media: só o vínculo legítimo de E1 existe',
      (await count(`SELECT count(*)::text n FROM business_media`)) === 1);

    // ═══ DOWNLOAD POR AUTORIDADE DO CONTEXT_OWNER ═════════════════════════════
    const readH1 = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: H1.headers });
    record('gestor de E1 lê o arquivo da declaração de E1 (200, bytes íntegros)',
      readH1.statusCode === 200 && Buffer.compare(readH1.rawPayload, PNG_X) === 0, `status=${readH1.statusCode}`);
    const readH2 = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: H2.headers });
    record('estranho (sem autoridade na empresa) NÃO lê (404 sem oráculo)', readH2.statusCode === 404, `status=${readH2.statusCode}`);

    // ═══ CANÔNICA PÚBLICA PUBLICA SÓ A DECLARAÇÃO APROVADA/VINCULADA ══════════
    const catId = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: H1.headers,
      payload: { companyId: E1, name: 'Produto Ctx Media', brand: 'CtxBrand', categoryId: catId },
    });
    const prodId = sug.json()?.data?.canonicalProductId as string;
    const attCan = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: CUR.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: assetC, mediaRole: 'primary' },
    });
    const readPubH2 = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetC}/file`, headers: H2.headers });
    const readPrivH2 = await app.inject({ method: 'GET', url: `/catalog/media/assets/${assetA}/file`, headers: H2.headers });
    record('curadoria publica a declaração C; estranho lê C (200) mas A do MESMO blob segue privada (404)',
      attCan.statusCode === 200 && readPubH2.statusCode === 200 && readPrivH2.statusCode === 404,
      `att=${attCan.statusCode} pub=${readPubH2.statusCode} priv=${readPrivH2.statusCode}`);

    // ═══ IDEMPOTENCY-KEY EXPLÍCITA ════════════════════════════════════════════
    const k1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic-k', idempotencyKey: 'K1' }, PNG_X, 'k1.png');
    const assetK = k1.body?.data?.mediaAssetId as string;
    record('Idempotency-Key K1 (payload novo) → 201', k1.status === 201 && !!assetK, `status=${k1.status}`);
    const k2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic-k', idempotencyKey: 'K1' }, PNG_X, 'k2.png');
    record('K1 com payload IDÊNTICO → idempotente (200, mesmo asset)',
      k2.status === 200 && k2.body?.data?.mediaAssetId === assetK && k2.body?.data?.reusedExistingAsset === true, `status=${k2.status}`);
    const assetsBefore409 = await count(`SELECT count(*)::text n FROM media_assets`);
    const k3 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic-DIVERGENTE', idempotencyKey: 'K1' }, PNG_X, 'k3.png');
    const licK = await pool.query<{ license: string }>(`SELECT license FROM media_assets WHERE id=$1::uuid`, [assetK]);
    record('K1 com payload DIVERGENTE → 409 MEDIA_IDEMPOTENCY_CONFLICT; nada alterado, nada criado',
      k3.status === 409 && k3.body?.code === 'MEDIA_IDEMPOTENCY_CONFLICT' &&
      licK.rows[0].license === 'lic-k' && (await count(`SELECT count(*)::text n FROM media_assets`)) === assetsBefore409,
      `status=${k3.status}`);

    // ═══ VETOR YALA EXATO (V2 collision-safe) — license='a'/prov='b|c' × 'a|b'/'c' ═
    // Na V1 (join '|' + md5) estes dois contextos tinham o MESMO preimage e a 2ª
    // declaração era descartada em silêncio. Na V2 são identidades DISTINTAS.
    const y1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'a', provenance: 'b|c' }, PNG_X, 'y1.png');
    const y2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'a|b', provenance: 'c' }, PNG_X, 'y2.png');
    const assetY1 = y1.body?.data?.mediaAssetId as string;
    const assetY2 = y2.body?.data?.mediaAssetId as string;
    record('VETOR YALA: license="a"/prov="b|c" e license="a|b"/prov="c" → declarações DISTINTAS (201/201)',
      y1.status === 201 && y2.status === 201 && !!assetY1 && !!assetY2 && assetY1 !== assetY2,
      `y1=${y1.status} y2=${y2.status}`);
    const yRows = await pool.query<{ id: string; license: string; origin_note: string; context_fingerprint: string; context_identity_version: number }>(
      `SELECT id::text, license, origin_note, context_fingerprint, context_identity_version FROM media_assets WHERE id = ANY($1::uuid[]) ORDER BY id = $2::uuid DESC`,
      [[assetY1, assetY2], assetY1]
    );
    record('VETOR YALA: licença/provenance corretas em CADA linha; fingerprints V2 distintos; version=2',
      yRows.rows[0].license === 'a' && yRows.rows[0].origin_note === 'b|c' &&
      yRows.rows[1].license === 'a|b' && yRows.rows[1].origin_note === 'c' &&
      yRows.rows[0].context_fingerprint !== yRows.rows[1].context_fingerprint &&
      yRows.rows[0].context_identity_version === 2 && yRows.rows[1].context_identity_version === 2,
      JSON.stringify(yRows.rows.map((r) => [r.license, r.origin_note])));
    const pre = await pool.query<{ p1: string; p2: string }>(
      `SELECT media_context_preimage_v2(ma1.media_blob_id, ma1.origin_tenant_id, ma1.created_by_actor_id, ma1.context_type, ma1.context_owner_id, ma1.source, ma1.purpose, ma1.license, ma1.origin_note) AS p1,
              media_context_preimage_v2(ma2.media_blob_id, ma2.origin_tenant_id, ma2.created_by_actor_id, ma2.context_type, ma2.context_owner_id, ma2.source, ma2.purpose, ma2.license, ma2.origin_note) AS p2
         FROM media_assets ma1, media_assets ma2 WHERE ma1.id=$1::uuid AND ma2.id=$2::uuid`,
      [assetY1, assetY2]
    );
    record('VETOR YALA: preimages V2 DIFERENTES e inequivocamente parseáveis (length-prefix: "b|c" é S3, um campo só)',
      pre.rows[0].p1 !== pre.rows[0].p2 &&
      pre.rows[0].p1.includes('LICENSE:S1:a;PROVENANCE:S3:b|c') &&
      pre.rows[0].p2.includes('LICENSE:S3:a|b;PROVENANCE:S1:c') &&
      pre.rows[0].p1.startsWith('MEDIA_CTX_V2;BLOB:S36:'));
    await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetY1}/approve`, headers: CUR.headers });
    const yMod = await pool.query<{ a: string; b: string }>(
      `SELECT (SELECT moderation_status FROM media_assets WHERE id=$1::uuid) a, (SELECT moderation_status FROM media_assets WHERE id=$2::uuid) b`, [assetY1, assetY2]);
    record('VETOR YALA: moderação independente (aprovar Y1 não aprova Y2); blob físico continua ÚNICO',
      yMod.rows[0].a === 'approved' && yMod.rows[0].b === 'pending' &&
      (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1);

    // ═══ NULL × EMPTY × TRIM × CASE (semântica normada, explícita) ════════════
    const n1 = await upload(H1, { companyId: E1, purpose: 'business_media' }, PNG_X, 'n1.png');
    const assetN1 = n1.body?.data?.mediaAssetId as string;
    const n2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: '' }, PNG_X, 'n2.png');
    const n3 = await upload(H1, { companyId: E1, purpose: 'business_media', license: '   ' }, PNG_X, 'n3.png');
    record('NULL ≡ ""(vazio) ≡ "   "(whitespace) por NORMALIZAÇÃO pré-persistência (reuso idempotente, license persistida NULL)',
      n1.status === 201 && n2.status === 200 && n3.status === 200 &&
      n2.body?.data?.mediaAssetId === assetN1 && n3.body?.data?.mediaAssetId === assetN1 &&
      (await count(`SELECT count(*)::text n FROM media_assets WHERE id=$1::uuid AND license IS NULL`, [assetN1])) === 1,
      `n1=${n1.status} n2=${n2.status} n3=${n3.status}`);
    const t1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: '  lic-trim  ' }, PNG_X, 't1.png');
    const t2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic-trim' }, PNG_X, 't2.png');
    record('TRIM: espaços de borda não criam identidade nova; persistência canônica sem bordas',
      t1.status === 201 && t2.status === 200 && t2.body?.data?.mediaAssetId === t1.body?.data?.mediaAssetId &&
      (await count(`SELECT count(*)::text n FROM media_assets WHERE id=$1::uuid AND license = 'lic-trim'`, [t1.body?.data?.mediaAssetId])) === 1,
      `t1=${t1.status} t2=${t2.status}`);
    const c1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'Case-MIT' }, PNG_X, 'c1.png');
    const c2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'case-mit' }, PNG_X, 'c2.png');
    record('CASE: identidade case-insensitive (DECISION-0118 D1) com case PRESERVADO na persistência',
      c1.status === 201 && c2.status === 200 && c2.body?.data?.mediaAssetId === c1.body?.data?.mediaAssetId &&
      (await count(`SELECT count(*)::text n FROM media_assets WHERE id=$1::uuid AND license = 'Case-MIT'`, [c1.body?.data?.mediaAssetId])) === 1,
      `c1=${c1.status} c2=${c2.status}`);
    // ESPAÇOS INTERNOS são significativos.
    const s1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic a b' }, PNG_X, 's1.png');
    const s2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'lic a  b' }, PNG_X, 's2.png');
    record('ESPAÇOS INTERNOS: "lic a b" ≠ "lic a  b" (declarações distintas)',
      s1.status === 201 && s2.status === 201 && s1.body?.data?.mediaAssetId !== s2.body?.data?.mediaAssetId,
      `s1=${s1.status} s2=${s2.status}`);

    // ═══ UNICODE / DELIMITADORES / INJEÇÃO DE ENCODING ════════════════════════
    const uNFC = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'café' }, PNG_X, 'u1.png');
    const uNFD = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'café' }, PNG_X, 'u2.png');
    record('UNICODE: NFC ≠ NFD = declarações DISTINTAS (byte-exato UTF-8; sem colisão, sem erro)',
      uNFC.status === 201 && uNFD.status === 201 && uNFC.body?.data?.mediaAssetId !== uNFD.body?.data?.mediaAssetId,
      `nfc=${uNFC.status} nfd=${uNFD.status}`);
    const uEmoji = await upload(H1, { companyId: E1, purpose: 'business_media', license: '🎨 arte própria' }, PNG_X, 'u3.png');
    record('UNICODE: emoji/acentos aceitos como dimensão (length-prefix em BYTES UTF-8)',
      uEmoji.status === 201, `status=${uEmoji.status}`);
    const dTorture = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'l1"q\'\\b;semi:colon', provenance: 'linha1\nlinha2' }, PNG_X, 'd1.png');
    record('DELIMITADORES: aspas/backslash/;/:/quebra-de-linha no conteúdo são INERTES (declaração válida)',
      dTorture.status === 201, `status=${dTorture.status}`);
    const inj1 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'x;PROVENANCE:S1:y' }, PNG_X, 'i1.png');
    const inj2 = await upload(H1, { companyId: E1, purpose: 'business_media', license: 'x', provenance: 'PROVENANCE:S1:y' }, PNG_X, 'i2.png');
    record('INJEÇÃO DE ENCODING: conteúdo imitando a gramática do preimage NÃO colide com campos reais',
      inj1.status === 201 && inj2.status === 201 && inj1.body?.data?.mediaAssetId !== inj2.body?.data?.mediaAssetId,
      `i1=${inj1.status} i2=${inj2.status}`);

    // ═══ COLISÃO FORÇADA — hash NUNCA é prova de igualdade (service-level) ════
    // Fixture controlada: o asset existente recebe (via SQL direto) o fingerprint
    // que a PRÓXIMA declaração materialmente DIFERENTE vai computar — simulando
    // colisão de sha256. A lógica REAL de comparação decide: 409, nada alterado.
    const { mediaAssetService: svc, MediaAssetError: SvcErr } = await import('../core/media-assets/media-asset.service');
    const colIngest = (license: string) => svc.ingest({
      tenantId: TENANT_ID, buffer: PNG_X, mimeType: 'image/png', originalFilename: 'col.png',
      license, source: 'company_suggestion', createdByActorId: H1.actorId,
      contextType: 'company', contextOwnerId: E1, purpose: 'business_media', provenance: 'col-prov',
    });
    const colA = (await colIngest('col-a')).asset;
    const blobIdCol = colA.mediaBlobId;
    const forgedFp = (await pool.query<{ fp: string }>(
      `SELECT media_context_fingerprint_v2($1::uuid, $2::uuid, $3::uuid, 'company', $4::uuid, 'company_suggestion', 'business_media', 'col-b', 'col-prov') AS fp`,
      [blobIdCol, TENANT_ID, H1.actorId, E1]
    )).rows[0].fp;
    await pool.query(`UPDATE media_assets SET context_fingerprint = $2 WHERE id = $1::uuid`, [colA.id, forgedFp]);
    const assetsBeforeCol = await count(`SELECT count(*)::text n FROM media_assets`);
    let colErr: unknown = null;
    try { await colIngest('col-b'); } catch (e) { colErr = e; }
    const colRow = await pool.query<{ license: string }>(`SELECT license FROM media_assets WHERE id=$1::uuid`, [colA.id]);
    record('COLISÃO FORÇADA: fingerprint igual + dimensão material diferente → 409 MEDIA_CONTEXT_FINGERPRINT_COLLISION (nunca devolve o anterior)',
      colErr instanceof SvcErr && colErr.statusCode === 409 && colErr.code === 'MEDIA_CONTEXT_FINGERPRINT_COLLISION',
      colErr instanceof SvcErr ? colErr.code : String(colErr));
    record('COLISÃO FORÇADA: linha existente INTACTA (license col-a), nenhuma criada, nenhuma metadata descartada',
      colRow.rows[0].license === 'col-a' && (await count(`SELECT count(*)::text n FROM media_assets`)) === assetsBeforeCol);
    // Restaura o fingerprint VERDADEIRO da fixture (recomputado pela fonte única).
    await pool.query(
      `UPDATE media_assets SET context_fingerprint = media_context_fingerprint_v2(media_blob_id, origin_tenant_id, created_by_actor_id, context_type, context_owner_id, source, purpose, license, origin_note) WHERE id = $1::uuid`,
      [colA.id]
    );

    // ═══ INTEGRIDADE FINAL ════════════════════════════════════════════════════
    record('integridade: 1 blob, 19 declarações, zero órfão, todas version=2, arquivos=blobs×2',
      (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1 &&
      (await count(`SELECT count(*)::text n FROM media_assets`)) === 19 &&
      (await count(`SELECT count(*)::text n FROM media_assets ma WHERE NOT EXISTS (SELECT 1 FROM media_blobs mb WHERE mb.id=ma.media_blob_id)`)) === 0 &&
      (await count(`SELECT count(*)::text n FROM media_assets WHERE context_identity_version IS DISTINCT FROM 2`)) === 0 &&
      (await storageFileCount()) - files0 === 2);
    record('zero Bank writer', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === bank0);

    // CLEANUP — storage local compartilhado com o dev.
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
  console.log('✨ Identidade contextual de mídia lógica — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
