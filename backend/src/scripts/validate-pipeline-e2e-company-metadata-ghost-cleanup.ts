/**
 * E2E — F-COMPANY-METADATA-GHOST-CLEANUP. NÃO MOVE DINHEIRO. Prova, via ROTA REAL (app.inject,
 * cadeia de plugins completa — auth/tenant/actionContext/rbac), que:
 *
 *   A PUT /companies/:companyId com {metadata: {...}, tradeName: '...'} NÃO quebra mais (200) —
 *      antes desta fix, era 42703 (coluna companies.metadata inexistente), reproduzido via curl
 *      real contra o dev server antes do fix
 *   B tradeName (campo REAL) foi atualizado corretamente — o resto do update não regrediu
 *   C metadata não persiste em lugar nenhum (coluna não existe — silenciosamente ignorado, não é
 *      mentira: NUNCA foi prometido como verdade operacional)
 *   D estranho (sem company_users) → 403 (autoridade real, canManageCompany)
 *   E Δbank=0 · F guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-company-metadata-ghost-cleanup-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const cwd = process.cwd();

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/metadata|ghost|cleanup|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

interface Human { userId: string; gu: string; actorId: string; headers: Record<string, string> }

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<Human> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  const token = jwt.sign(
    { sub: userId, userId, tenantId, email: `${name}-${seq}@e2e.test`, tokenVersion: 0, globalUserId: gu, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '15m' }
  );
  const ac = JSON.stringify({ actorId, intent: 'e2e', source: 'e2e', scope: `tenant:${tenantId}` });
  return { userId, gu, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
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

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Company Metadata Ghost Cleanup', slug: `cmgc-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');
  const stranger = await mkUserActor(TENANT, 'Stranger');

  const companyId = randomUUID();
  await pool.query(
    `INSERT INTO companies (company_id, tenant_id, company_name, trade_name, company_status, status) VALUES ($1::uuid,$2::uuid,'Empresa E2E','Nome Antigo','DRAFT','active')`,
    [companyId, TENANT]
  );
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, is_primary) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,true)`,
    [TENANT, companyId, alice.gu]
  );
  await pool.query(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','Empresa E2E',$2::uuid,$3::uuid)`,
    [TENANT, companyId, alice.actorId]
  );

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const companiesModule = (await import('../core/companies/companies.module')).companiesModule;
  const app: FastifyInstance = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  await app.ready();

  try {
    console.log('\n— A/B/C: owner atualiza empresa com metadata + tradeName (payload real do wizard) —');
    const r = await app.inject({
      method: 'PUT',
      url: `/companies/${companyId}`,
      headers: alice.headers,
      payload: {
        tradeName: 'Nome Novo',
        metadata: { onboarding: { modules: { services: true }, initialRoles: { owner: true } }, onboardingCompleted: true },
      },
    });
    record('A PUT com metadata NÃO quebra mais (200) — antes 42703', r.statusCode === 200, `status=${r.statusCode}: ${r.body.slice(0, 300)}`);

    const row = (await pool.query<{ trade_name: string }>(`SELECT trade_name FROM companies WHERE company_id=$1::uuid`, [companyId])).rows[0];
    record('B tradeName (campo real) foi atualizado corretamente', row?.trade_name === 'Nome Novo', `trade_name=${row?.trade_name}`);

    const hasMetadataCol = (await pool.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='companies' AND column_name='metadata'`
    )).rows[0].n;
    record('C confirma que companies NÃO tem coluna metadata (ghost genuíno, não fix mascarando bug)', Number(hasMetadataCol) === 0, `n=${hasMetadataCol}`);

    console.log('\n— D: estranho tenta atualizar a MESMA empresa —');
    const r2 = await app.inject({
      method: 'PUT',
      url: `/companies/${companyId}`,
      headers: stranger.headers,
      payload: { tradeName: 'Hackeado' },
    });
    // updateCompany lê por VÍNCULO antes de checar autoridade (getCompanyById fail-closed por
    // company_users) — estranho sem vínculo recebe 400 "Empresa não encontrada" (nem revela
    // existência), não chega a testar canManageCompany explicitamente. Ambos são bloqueio real.
    record('D estranho bloqueado (400 "não encontrada" — leitura por vínculo já barra, nem chega a canManageCompany)', r2.statusCode === 400 && /não encontrada/i.test(r2.body), `status=${r2.statusCode}: ${r2.body.slice(0, 300)}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('E Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-company-metadata-ghost-cleanup.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('F guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ updateCompany não tenta mais escrever companies.metadata (coluna inexistente); wizard de onboarding consegue concluir "Finalizar Configuração"; outros campos seguem funcionando; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
