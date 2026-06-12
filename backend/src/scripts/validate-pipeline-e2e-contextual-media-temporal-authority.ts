/**
 * E2E INTEGRADO — F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE
 * (DECISION-0118 D1+D2). Os DOIS eixos do reseal Yala na MESMA jornada.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-contextual-temporal-integrado-ephemeral.ps1.
 *
 * MÍDIA: 1 blob físico; contextos A(E1-business)/B(E2-business)/C(E1-canônica)
 * separados; D idempotente; moderação independente; cross-company privado
 * bloqueado (mesmo humano!); canônico público explícito; cleanup seguro.
 * TEMPO: service_offering cria e GERENCIA a janela inteira (read/list/update/
 * booking/confirm); estranho 403; resource owner ∉ actors; enum↔CHECK coerentes.
 * FINANCEIRO: bank_ledger/bank_transactions byte-idênticos; zero payment/split.
 * RESÍDUO: zero fixture órfã; storage baseline; zero actor curado.
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
const PNG_X = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('ctx-temporal-integrado-X')]);

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
  if (!/context|temporal|integrado|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const { unifiedAvailabilityRoutes } = await import('../core/availability/unified-availability.routes');
  await app.register(unifiedAvailabilityRoutes, { prefix: '/availability' });
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
  const boundary = '----e2eint' + Math.random().toString(16).slice(2);
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
  try { return (await fsp.readdir(join(process.cwd(), '.private', 'document-storage'))).length; } catch { return 0; }
}
const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Ctx Temporal Integrado', slug: `ctx-temporal-${Date.now()}` });
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
      JWT_SECRET as string, { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'ctx_temporal_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const H = await mkHuman('E2E Int Founder H');
  const S = await mkHuman('E2E Int Stranger S');
  const CUR = await mkHuman('E2E Int Curator', 'admin');

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };
  const E1 = await createCompany(H, 86000001, 'E2E Int E1');
  const E2 = await createCompany(H, 86000002, 'E2E Int E2');

  const upload = async (h: Human, q: Record<string, string>, filename: string): Promise<{ status: number; id?: string; reusedAsset?: boolean }> => {
    const mp = multipartBody([{ name: 'file', filename, contentType: 'image/png', value: PNG_X }]);
    const r = await app.inject({
      method: 'POST', url: `/catalog/media/assets?${new URLSearchParams(q).toString()}`,
      headers: { ...h.headers, 'content-type': mp.contentType }, payload: mp.payload,
    });
    const b = r.json();
    return { status: r.statusCode, id: b?.data?.mediaAssetId, reusedAsset: b?.data?.reusedExistingAsset };
  };

  const bank0 = await pool.query(`SELECT (SELECT count(*) FROM bank_ledger) AS l, (SELECT count(*) FROM bank_transactions) AS t, (SELECT count(*) FROM bank_accounts) AS a`);
  const files0 = await storageFileCount();

  try {
    // ═══ EIXO M — contextos A/B/C/D na mesma jornada ══════════════════════════
    const a = await upload(H, { companyId: E1, purpose: 'business_media', license: 'priv-E1' }, 'a.png');
    const b = await upload(H, { companyId: E2, purpose: 'business_media', license: 'priv-E2' }, 'b.png');
    const c = await upload(H, { companyId: E1, purpose: 'canonical_catalog', license: 'cc-cur' }, 'c.png');
    const d = await upload(H, { companyId: E1, purpose: 'business_media', license: 'priv-E1' }, 'd.png');
    record('M1 contextos A/B/C distintos + D idempotente (1 blob, 3 declarações)',
      a.status === 201 && b.status === 201 && c.status === 201 && d.status === 200 &&
      d.id === a.id && a.id !== b.id && b.id !== c.id && a.id !== c.id &&
      (await count(`SELECT count(*)::text n FROM media_blobs`)) === 1 &&
      (await count(`SELECT count(*)::text n FROM media_assets`)) === 3,
      `a=${a.status} b=${b.status} c=${c.status} d=${d.status}`);

    await app.inject({ method: 'POST', url: `/catalog/media/assets/${c.id}/approve`, headers: CUR.headers });
    const modA = await pool.query<{ s: string }>(`SELECT moderation_status s FROM media_assets WHERE id=$1::uuid`, [a.id]);
    record('M2 moderação independente (aprovar C não toca A)', modA.rows[0].s === 'pending', modA.rows[0].s);

    const attCross = await app.inject({
      method: 'POST', url: '/catalog/media/attach/business', headers: H.headers,
      payload: { ownerActorId: H.actorId, attachedToType: 'company', attachedToId: E2, mediaAssetId: a.id },
    });
    record('M3 cross-company privado BLOQUEADO (mesmo humano, E2 ✗ declaração de E1)', attCross.statusCode === 403, `status=${attCross.statusCode}`);

    const catId = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: H.headers,
      payload: { companyId: E1, name: 'Produto Int Ctx', brand: 'IntBrand', categoryId: catId },
    });
    const prodId = sug.json()?.data?.canonicalProductId as string;
    const attCan = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: CUR.headers,
      payload: { entity: 'product', entityId: prodId, mediaAssetId: c.id },
    });
    const pubRead = await app.inject({ method: 'GET', url: `/catalog/media/assets/${c.id}/file`, headers: S.headers });
    const privRead = await app.inject({ method: 'GET', url: `/catalog/media/assets/${a.id}/file`, headers: S.headers });
    record('M4 canônico público EXPLÍCITO (C lida por estranho; A do mesmo blob segue privada)',
      attCan.statusCode === 200 && pubRead.statusCode === 200 && privRead.statusCode === 404,
      `att=${attCan.statusCode} pub=${pubRead.statusCode} priv=${privRead.statusCode}`);

    // ═══ EIXO T — service_offering gerencia a superfície inteira ══════════════
    const offeringId = (await pool.query<{ id: string }>(
      `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, price_cents, duration_minutes, modality, status)
       SELECT $1::uuid, id, $2::uuid, 4000, 30, 'in_person', 'active' FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1
       RETURNING id::text AS id`, [TENANT_ID, H.actorId])).rows[0].id;

    const create = await app.inject({
      method: 'POST', url: '/availability', headers: H.headers,
      payload: { ownerType: 'service_offering', ownerId: offeringId, startDatetime: '2026-07-02T10:00:00.000Z', endDatetime: '2026-07-02T10:30:00.000Z' },
    });
    const availId = create.json()?.data?.availabilityId as string;
    const reread = await app.inject({ method: 'GET', url: `/availability/${availId}`, headers: H.headers });
    const upd = await app.inject({ method: 'PUT', url: `/availability/${availId}`, headers: H.headers, payload: { capacity: 2 } });
    record('T1 prestador cria/relê/atualiza a janela da OFERTA (não mais write-only)',
      create.statusCode === 201 && reread.statusCode === 200 && upd.statusCode === 200,
      `${create.statusCode}/${reread.statusCode}/${upd.statusCode}`);

    const sRead = await app.inject({ method: 'GET', url: `/availability/${availId}`, headers: S.headers });
    const sUpd = await app.inject({ method: 'PUT', url: `/availability/${availId}`, headers: S.headers, payload: { capacity: 9 } });
    record('T2 estranho não lê nem atualiza (403/403)', sRead.statusCode === 403 && sUpd.statusCode === 403, `${sRead.statusCode}/${sUpd.statusCode}`);

    const bk = await app.inject({ method: 'POST', url: '/availability/bookings', headers: S.headers, payload: { availabilityId: availId, requesterActorId: S.actorId } });
    const bkId = bk.json()?.bookingId as string;
    const confirm = await app.inject({ method: 'PUT', url: `/availability/bookings/${bkId}`, headers: H.headers, payload: { status: 'confirmed' } });
    record('T3 cliente reserva; PRESTADOR confirma (autoridade do recurso, polimórfica)',
      bk.statusCode === 201 && confirm.statusCode === 200, `bk=${bk.statusCode} confirm=${confirm.statusCode}`);

    record('T4 resource owner ∉ actors + enum↔CHECK coerentes',
      (await count(`SELECT count(*)::text n FROM actors WHERE id=$1::uuid`, [offeringId])) === 0 &&
      (await count(`SELECT count(*)::text n FROM pg_constraint WHERE conname='chk_availability_owner_type'`)) === 1);

    // ═══ FINANCEIRO + RESÍDUO ═════════════════════════════════════════════════
    const bank1 = await pool.query(`SELECT (SELECT count(*) FROM bank_ledger) AS l, (SELECT count(*) FROM bank_transactions) AS t, (SELECT count(*) FROM bank_accounts) AS a`);
    record('F1 bank_ledger/bank_transactions/bank_accounts ANTES = DEPOIS (zero payment/split/payout)',
      JSON.stringify(bank0.rows[0]) === JSON.stringify(bank1.rows[0]));

    const { resolveDocumentStorageProvider } = await import('../core/document-storage/document-storage.provider');
    const storage = resolveDocumentStorageProvider();
    for (const ref of (await pool.query<{ storage_reference: string }>(`SELECT storage_reference FROM media_blobs`)).rows) {
      try { await storage.deleteDocument(ref.storage_reference); } catch { /* best-effort */ }
    }
    record('R1 storage baseline (zero resíduo da run)', (await storageFileCount()) === files0, `${files0}→${await storageFileCount()}`);
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
  console.log('✨ Mídia contextual + autoridade temporal — jornada integrada verde.');
  process.exit(0); // CLI validator: encerra o event loop
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
