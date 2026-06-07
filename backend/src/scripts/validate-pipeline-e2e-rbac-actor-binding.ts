/**
 * E2E F-AUTHORIZATION-CAN-REPRESENT-ACTOR-PRIMITIVE + F-RBAC-PLUGIN-BIND-REQ-USER (DECISION-0113)
 *
 * Prova o primitivo de REPRESENTABILIDADE `authorizationService.canRepresentActor(tenantId, userId, actorId)`
 * — permission-agnóstico e registry-INDEPENDENTE — e o wiring do binding no `rbac.plugin` (estrutural).
 *
 * `userId` = `users.id` (= `req.user.id`); `actors.user_id` guarda `users.id`; `company_users` usa
 * `global_user_id` (resolvido por `resolveGlobalUserId`). canRepresentActor cobre: ownership direto,
 * empresa via `actors.company_id→company_users` (SEM actor_registry), grupo via `actors.group_id`,
 * registry-bônus, e delegação ativa.
 *
 * Casos:
 *   R1 ownership direto: user representa o próprio user-actor → true.
 *   R2 spoof (principal estranho/desconhecido) sobre user-actor alheio → false.
 *   R3 empresa LEGÍTIMA + REGISTRY-INDEPENDENTE: dono representa page-actor (e actor_registry SEM linha) → true.
 *   R4 empresa spoof: principal sem vínculo em company_users → false.
 *   R5 actor existente sem vínculo (page-actor com company_users removido, sem delegação) → false.
 *   R6 delegação ATIVA: user com actor_delegations ativa representa o actor → true.
 *   R7 delegação EXPIRADA → false. R8 delegação REVOGADA → false.
 *   R9 fail-closed: inputs vazios / actor inexistente → false.
 *   R10 estrutural: rbac.plugin chama assertActorRepresentable ANTES do lookup, em requireRole/
 *       requirePermission/requireAnyPermission; assertActorRepresentable usa canRepresentActor + forbidden.
 *
 * Base: tenant DEV + PF canônica (dev@unificard.local). LIMPO ao fim (DEV intacto).
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-rbac-actor-binding.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { authorizationService } from '../core/authorization/authorization.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ff'; // users.id inexistente (principal desconhecido)

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

function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

async function pageActorOf(companyId: string): Promise<string | null> {
  const r = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND company_id = $2::uuid LIMIT 1`,
    [TENANT_ID, companyId]
  );
  return r.rows[0]?.actor_id ?? null;
}

async function setDelegation(
  devUserActorId: string,
  institutionalActorId: string,
  variant: 'active' | 'expired' | 'revoked'
): Promise<void> {
  // Limpa qualquer delegação anterior do par e insere a variante (evita unique de "uma ativa").
  await pool.query(
    `DELETE FROM actor_delegations WHERE tenant_id = $1 AND user_actor_id = $2::uuid AND institutional_actor_id = $3::uuid`,
    [TENANT_ID, devUserActorId, institutionalActorId]
  );
  const status = variant === 'revoked' ? 'revoked' : 'active';
  const expiresAt = variant === 'expired' ? `NOW() - INTERVAL '1 day'` : 'NULL';
  const revokedAt = variant === 'revoked' ? 'NOW()' : 'NULL';
  await pool.query(
    `INSERT INTO actor_delegations
       (tenant_id, user_actor_id, institutional_actor_id, scopes_json, is_transitive, expires_at, status, revoked_at)
     VALUES ($1, $2::uuid, $3::uuid, $4::jsonb, false, ${expiresAt}, $5, ${revokedAt})`,
    [TENANT_ID, devUserActorId, institutionalActorId, JSON.stringify(['*']), status]
  );
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ id: string; global_user_id: string }>(
    `SELECT id::text AS id, global_user_id::text AS global_user_id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devUserId = dev.rows[0].id; // = req.user.id (users.id)
  const devGlobalUserId = dev.rows[0].global_user_id;

  // user-actor do dev (actors.user_id = users.id)
  const devActorRow = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2::uuid AND actor_type = 'user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devUserActorId = devActorRow.rows[0]?.actor_id;
  if (!devUserActorId) {
    console.error('❌ user-actor do dev não encontrado (actors.user_id = users.id).');
    process.exit(1);
  }

  const createdCompanyIds: string[] = [];
  async function newCompany(name: string): Promise<string> {
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: name, role: 'owner' as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    createdCompanyIds.push(c.company.companyId);
    return c.company.companyId;
  }

  try {
    console.log('\n— R (canRepresentActor + binding) —');

    // R1 ownership direto
    const r1 = await authorizationService.canRepresentActor(TENANT_ID, devUserId, devUserActorId);
    record('R1 ownership direto (user representa próprio actor) → true', r1 === true, `got=${r1}`);

    // R2 spoof: principal desconhecido sobre user-actor alheio
    const r2 = await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devUserActorId);
    record('R2 spoof (principal estranho) sobre user-actor → false', r2 === false, `got=${r2}`);

    // R3 empresa legítima + registry-independente
    const companyA = await newCompany('E2E RBAC Bind A');
    const pageA = await pageActorOf(companyA);
    const r3 = pageA ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageA) : false;
    const regCount = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM actor_registry WHERE tenant_id = $1 AND actor_id = $2::uuid`,
      [TENANT_ID, pageA]
    );
    record('R3 empresa legítima: dono representa page-actor → true', r3 === true, `pageA=${pageA} got=${r3}`);
    record('R3b REGISTRY-INDEPENDENTE: actor_registry sem linha para page-actor', regCount.rows[0].n === '0', `registry_rows=${regCount.rows[0].n}`);

    // R4 empresa spoof: principal desconhecido
    const r4 = pageA ? await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, pageA) : true;
    record('R4 empresa spoof (sem vínculo company_users) → false', r4 === false, `got=${r4}`);

    // R5 actor existente sem vínculo: page-actor de companyB com company_users removido, sem delegação
    const companyB = await newCompany('E2E RBAC Bind B');
    const pageB = await pageActorOf(companyB);
    await pool.query(`DELETE FROM company_users WHERE company_id = $1::uuid`, [companyB]);
    const r5 = pageB ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageB) : true;
    record('R5 actor sem vínculo (company_users removido, sem delegação) → false', r5 === false, `pageB=${pageB} got=${r5}`);

    // R6 delegação ATIVA dev→pageB
    if (pageB) await setDelegation(devUserActorId, pageB, 'active');
    const r6 = pageB ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageB) : false;
    record('R6 delegação ATIVA → true', r6 === true, `got=${r6}`);

    // R7 delegação EXPIRADA
    if (pageB) await setDelegation(devUserActorId, pageB, 'expired');
    const r7 = pageB ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageB) : true;
    record('R7 delegação EXPIRADA → false', r7 === false, `got=${r7}`);

    // R8 delegação REVOGADA
    if (pageB) await setDelegation(devUserActorId, pageB, 'revoked');
    const r8 = pageB ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageB) : true;
    record('R8 delegação REVOGADA → false', r8 === false, `got=${r8}`);

    // R9 fail-closed
    const fcEmptyTenant = await authorizationService.canRepresentActor('', devUserId, devUserActorId);
    const fcEmptyUser = await authorizationService.canRepresentActor(TENANT_ID, '', devUserActorId);
    const fcEmptyActor = await authorizationService.canRepresentActor(TENANT_ID, devUserId, '');
    const fcGhostActor = await authorizationService.canRepresentActor(TENANT_ID, devUserId, '00000000-0000-4000-8000-0000000000aa');
    record('R9 fail-closed (tenant/user/actor vazios + actor inexistente) → false',
      fcEmptyTenant === false && fcEmptyUser === false && fcEmptyActor === false && fcGhostActor === false,
      `t=${fcEmptyTenant} u=${fcEmptyUser} a=${fcEmptyActor} ghost=${fcGhostActor}`);

    // R10 estrutural (rbac.plugin)
    const src = readFileSync(join(process.cwd(), 'src/plugins/rbac.plugin.ts'), 'utf8');
    const hasHelper = /async function assertActorRepresentable\(/.test(src)
      && /authorizationService\.canRepresentActor\(/.test(src)
      && /httpErrors\.forbidden\(/.test(src);
    record('R10a assertActorRepresentable usa canRepresentActor + forbidden', hasHelper);
    const decorators = ['requirePermission', 'requireAnyPermission', 'requireRole'];
    let allBeforeLookup = true;
    const detail: string[] = [];
    for (const dec of decorators) {
      const decIdx = src.indexOf(`validateActionContext(req, '${dec}')`);
      const bindIdx = src.indexOf('assertActorRepresentable(req,', decIdx);
      // próximo lookup rbac após o decorator
      const lookupIdx = src.indexOf('rbacService.actorHas', decIdx);
      const ok = decIdx >= 0 && bindIdx > decIdx && lookupIdx > bindIdx;
      if (!ok) { allBeforeLookup = false; detail.push(`${dec}:dec=${decIdx},bind=${bindIdx},lookup=${lookupIdx}`); }
    }
    record('R10b binding roda ANTES do lookup nos 3 decorators', allBeforeLookup, detail.join(' '));
  } finally {
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      await pool.query(`DELETE FROM actor_delegations WHERE tenant_id = $1 AND institutional_actor_id IN (SELECT actor_id FROM actors WHERE company_id = ANY($2::uuid[]))`, [TENANT_ID, ids]);
      await pool.query(`DELETE FROM actor_registry WHERE tenant_id = $1 AND actor_id IN (SELECT actor_id FROM actors WHERE company_id = ANY($2::uuid[]))`, [TENANT_ID, ids]);
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
    }
    const left = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM companies WHERE company_name LIKE 'E2E RBAC Bind %'`
    );
    record('CLEANUP DEV intacto (companies de teste = 0)', left.rows[0].n === '0', `restantes=${left.rows[0].n}`);
  }

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
  console.log('✨ RBAC actor binding (canRepresentActor + wiring) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
