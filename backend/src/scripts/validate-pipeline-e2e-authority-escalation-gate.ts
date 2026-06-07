/**
 * E2E F-AUTHORITY-ESCALATION-GATE (DECISION-0113 fatia 2/6)
 *
 * Fecha a "fábrica de crachá falso": rotas que criam/alteram membros, convites, roles e delegações
 * (mint de `actor_delegations`, inclusive escopo `['*']`) passam a provar autoridade server-side
 * antes de qualquer mutação. Gates:
 *   - company-members (POST/PUT/DELETE): `companiesService.canManageCompany(req.user)`;
 *   - organization (invites create/accept/revoke + members role/remove): `canRepresentActor(req.user, actorId)`
 *     antes dos checks OWNER/ADMIN já existentes (`validateCanInvite`/`validateCanManageMembers`).
 *
 * Os gates vivem nas ROTAS (não nos services) → este e2e prova (a) a DECISÃO dos gates behavioralmente
 * (`canManageCompany` owner vs estranho; `canRepresentActor`) + (b) o WIRING estrutural (gate antes da
 * mutação nas 8 rotas) + (c) a autoridade OWNER/ADMIN intacta nos services + (d) o primitivo de escalação `['*']`.
 *
 * Casos:
 *   A1 canManageCompany(dono)→true · A2 canManageCompany(estranho)→false (não cria/altera membro).
 *   A3 canRepresentActor(dono, page-actor)→true · A4 (estranho)→false (org gate).
 *   B1 company-members.routes: POST gateia requireCompanyManage antes de createMember; PUT antes de
 *      updateMember; DELETE antes de removeMember.
 *   B2 organization.routes: invites(create/accept/revoke) + members(role/remove) gateiam requireRepresentable
 *      antes do service.
 *   C1 autoridade OWNER/ADMIN intacta: organization-invite.service tem validateCanInvite; member tem
 *      validateCanManageMembers.
 *   C2 escalação documentada: company-members.service `getScopesForRole('admin')` → `['*']` (mint amplo)
 *      — agora inalcançável por estranho (gate de rota antes do createMember).
 *
 * Base: tenant DEV + PF canônica. LIMPO ao fim. Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-authority-escalation-gate.ts
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
const STRANGER_GLOBAL = '00000000-0000-4000-8000-0000000000ee';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ff';

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

/** Verifica que o gate (idx do gate) aparece ANTES da chamada do service (idx do service) após a âncora da rota. */
function gateBeforeService(src: string, routeAnchor: string, gateToken: string, serviceToken: string): boolean {
  const a = src.indexOf(routeAnchor);
  if (a < 0) return false;
  const g = src.indexOf(gateToken, a);
  const s = src.indexOf(serviceToken, a);
  return g > a && s > g;
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ id: string; global_user_id: string }>(
    `SELECT id::text AS id, global_user_id::text AS global_user_id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devGlobalUserId = dev.rows[0].global_user_id;

  const createdCompanyIds: string[] = [];

  try {
    console.log('\n— A (decisão dos gates) —');
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: 'E2E Esc Gate A', role: 'owner' as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    const companyId = c.company.companyId;
    createdCompanyIds.push(companyId);
    const pageActor = (await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM actors WHERE tenant_id = $1 AND company_id = $2::uuid LIMIT 1`, [TENANT_ID, companyId]
    )).rows[0]?.actor_id;

    const a1 = await companiesService.canManageCompany(TENANT_ID, companyId, devGlobalUserId);
    record('A1 canManageCompany(dono) → true', a1 === true, `got=${a1}`);
    const a2 = await companiesService.canManageCompany(TENANT_ID, companyId, STRANGER_GLOBAL);
    record('A2 canManageCompany(estranho) → false (não pode gerir membro)', a2 === false, `got=${a2}`);

    const a3 = pageActor ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, pageActor) : false;
    record('A3 canRepresentActor(dono, page-actor) → true (org gate)', a3 === true, `got=${a3}`);
    const a4 = pageActor ? await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, pageActor) : true;
    record('A4 canRepresentActor(estranho, page-actor) → false', a4 === false, `got=${a4}`);

    console.log('\n— B (wiring estrutural: gate ANTES da mutação) —');
    const cm = readFileSync(join(process.cwd(), 'src/core/companies/company-members.routes.ts'), 'utf8');
    record('B1a POST membro: requireCompanyManage antes de createMember',
      gateBeforeService(cm, "'/:companyId/members',", 'requireCompanyManage(req, reply, req.params.companyId)', 'companyMembersService') &&
      /requireCompanyManage\(req, reply, req\.params\.companyId\)/.test(cm));
    record('B1b PUT membro: requireCompanyManage antes de updateMember',
      gateBeforeService(cm, 'updateMemberSchema = z.object', 'requireCompanyManage(req, reply, target.companyId)', 'companyMembersService.updateMember'));
    record('B1c DELETE membro: requireCompanyManage antes de removeMember',
      gateBeforeService(cm, 'fastify.delete', 'requireCompanyManage(req, reply, target.companyId)', 'companyMembersService.removeMember'));

    const org = readFileSync(join(process.cwd(), 'src/modules/organization/organization.routes.ts'), 'utf8');
    record('B2a POST /invites: requireRepresentable antes de inviteUser',
      gateBeforeService(org, "'/invites'", 'requireRepresentable(req, reply, actionContext.actorId)', 'organizationInviteService.inviteUser'));
    record('B2b accept: requireRepresentable(req.body.actorId) antes de acceptInvite',
      gateBeforeService(org, "'/invites/:id/accept'", 'requireRepresentable(req, reply, req.body.actorId)', 'organizationInviteService.acceptInvite'));
    record('B2c revoke: requireRepresentable antes de revokeInvite',
      gateBeforeService(org, "'/invites/:id/revoke'", 'requireRepresentable(req, reply, actionContext.actorId)', 'organizationInviteService.revokeInvite'));
    record('B2d role: requireRepresentable antes de changeRole',
      gateBeforeService(org, "'/members/:id/role'", 'requireRepresentable(req, reply, actionContext.actorId)', 'organizationMemberService.changeRole'));
    record('B2e remove: requireRepresentable antes de removeMember',
      gateBeforeService(org, "'/members/:id/remove'", 'requireRepresentable(req, reply, actionContext.actorId)', 'organizationMemberService.removeMember'));

    console.log('\n— C (autoridade intacta + escalação documentada) —');
    const invSrc = readFileSync(join(process.cwd(), 'src/modules/organization/organization-invite.service.ts'), 'utf8');
    const memSrc = readFileSync(join(process.cwd(), 'src/modules/organization/organization-member.service.ts'), 'utf8');
    record('C1a invite.service mantém validateCanInvite (OWNER/ADMIN)',
      /validateCanInvite/.test(invSrc) && /'OWNER'|"OWNER"/.test(invSrc) && /'ADMIN'|"ADMIN"/.test(invSrc));
    record('C1b member.service mantém validateCanManageMembers (OWNER/ADMIN)',
      /validateCanManageMembers/.test(memSrc) && /'OWNER'|"OWNER"/.test(memSrc) && /'ADMIN'|"ADMIN"/.test(memSrc));
    const cmSvc = readFileSync(join(process.cwd(), 'src/core/companies/company-members.service.ts'), 'utf8');
    record("C2 escalação `['*']` existe (admin) e fica atrás do gate de rota",
      /case 'admin':\s*\n\s*return \['\*'\]/.test(cmSvc) && /createDelegationForMember/.test(cmSvc));
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
      `SELECT count(*)::text AS n FROM companies WHERE company_name LIKE 'E2E Esc Gate %'`
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
  console.log('✨ Authority escalation gate (company-members + organization) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
