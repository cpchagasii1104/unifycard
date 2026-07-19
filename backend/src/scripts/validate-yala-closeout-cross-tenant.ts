// validate-yala-closeout-cross-tenant.ts — PROVA Etapa E.A + E.E (DECISION-0189A)
//
// Roda contra CLONE EFÊMERO do dev. Constrói o TENANT B COMPLETO (tenant, Identity, user,
// actors, company, membership gestora com SET_V1, registry) ao lado do tenant A existente e
// prova as pernas que a YALA anterior não conseguiu executar:
//   E1  convite criado no tenant A NÃO opera no tenant B (token uniforme INVITATION_NOT_FOUND)
//   E2  Identity B não aceita convite A (mesmo com o token correto — NOT_THE_INVITEE/uniforme)
//   E3  create/list/revoke não cruzam tenant (service tenant-scoped)
//   E4  lookup por código de indicação não cruza tenant
//   E5  RLS com o ROLE REAL da aplicação (SET ROLE unificard_app + app.current_tenant):
//      tenant A não lê convites/memberships do tenant B e vice-versa
//   E6  catálogo/FKs/uniques tenant-safe (convite B não referencia empresa A — FK composta)
//   E7  CONCORRÊNCIA aceite×aceite → 1 materialização (re-execução em ambiente E)
//   E8  CONCORRÊNCIA aceite×revogação do convite → exatamente UM estado terminal consistente

import { randomUUID, createHash } from 'crypto';
import pg from 'pg';
import { pool } from '@core/database/pool';
import { companyAccessInvitationsService } from '@core/companies/company-access-invitations.service';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const codeOf = (e: unknown) => (e as { code?: string }).code ?? (e as Error).message;

interface TenantFixture {
  tenantId: string; companyId: string; pageActorId: string;
  mgr: { g: string; u: string; ua: string; cu: string };
  invitee: { g: string; u: string; ua: string };
}

async function mkIdentityUser(T: string) {
  const g = randomUUID(); const u = randomUUID(); const ua = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [g, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [g, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`, [u, T, g, `ct-${u.slice(0, 8)}@proof.local`]);
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','CT')`, [ua, T, u, g]);
  return { g, u, ua };
}

async function mkTenantFixture(name: string): Promise<TenantFixture> {
  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [T, name, `${name}-${T.slice(0, 6)}`]);
  const mgrIds = await mkIdentityUser(T);
  const companyId = randomUUID();
  await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, global_user_id) VALUES ($1,$2,$3,$4)`, [companyId, T, `${name} LTDA`, mgrIds.g]);
  const pageActorId = randomUUID();
  await pool.query(
    `INSERT INTO actors (id, actor_id, tenant_id, company_id, actor_type, display_name, responsible_actor_id)
     VALUES ($1,$1,$2,$3,'page',$4,$5)`,
    [pageActorId, T, companyId, `${name} Page`, mgrIds.ua]
  );
  const cu = (await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status,
        can_manage_company, can_manage_members, can_manage_financial, can_view_financial,
        can_publish_feed, can_create_events, can_manage_employees, can_manage_services, can_view_reports)
     VALUES ($1,$2,$3,'owner','active',true,true,true,true,true,true,true,true,true) RETURNING id`,
    [T, companyId, mgrIds.g]
  )).rows[0].id as string;
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(T, pageActorId, 'company', 'companies', companyId);
  const invitee = await mkIdentityUser(T);
  return { tenantId: T, companyId, pageActorId, mgr: { ...mgrIds, cu }, invitee };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const A = await mkTenantFixture('ct-alpha');
  const B = await mkTenantFixture('ct-beta');

  const invite = (fx: TenantFixture, inviteeG: string, keys: string[] = ['publish_feed']) =>
    companyAccessInvitationsService.createInvitation({
      tenantId: fx.tenantId, companyId: fx.companyId,
      invokerUserId: fx.mgr.u, invokerActorId: fx.mgr.ua,
      inviteeGlobalUserId: inviteeG, permissionKeys: keys,
      idempotencyKey: `ct-${randomUUID()}`,
    });

  // E1 — token do tenant A não opera no tenant B
  const invA = await invite(A, A.invitee.g);
  try {
    await companyAccessInvitationsService.acceptInvitation({ tenantId: B.tenantId, token: invA.token!, accepterUserId: B.invitee.u });
    check('E1 token A no tenant B → uniforme', false, 'aceitou!');
  } catch (e) {
    check('E1 token A no tenant B → uniforme INVITATION_NOT_FOUND', codeOf(e) === 'INVITATION_NOT_FOUND');
  }

  // E2 — Identity B (no próprio tenant A? B não existe no tenant A) → uniforme/deny
  try {
    await companyAccessInvitationsService.acceptInvitation({ tenantId: A.tenantId, token: invA.token!, accepterUserId: B.invitee.u });
    check('E2 Identity B não aceita convite A', false, 'aceitou!');
  } catch (e) {
    const c = codeOf(e);
    check('E2 Identity B não aceita convite A (NOT_THE_INVITEE/identidade não resolvida)', c === 'NOT_THE_INVITEE' || c === 'CALLER_IDENTITY_UNRESOLVED' || /não resolvida|não encontrado/i.test(String(c)));
  }

  // E3 — list/revoke tenant-scoped
  const listB = await companyAccessInvitationsService.listInvitations(B.tenantId, A.companyId);
  check('E3a list no tenant B com companyId de A → vazio (tenant-scoped)', Array.isArray(listB) && listB.length === 0);
  try {
    await companyAccessInvitationsService.revokeInvitation({ tenantId: B.tenantId, companyId: A.companyId, invitationId: invA.invitationId, invokerUserId: B.mgr.u });
    check('E3b revoke cross-tenant', false, 'revogou!');
  } catch (e) {
    check('E3b revoke cross-tenant → deny (empresa não encontrada no tenant B)', ['COMPANY_NOT_FOUND', 'INVITATION_NOT_FOUND', 'CALLER_NOT_ACTIVE_MEMBER'].includes(String(codeOf(e))));
  }

  // E4 — lookup por código não cruza tenant: código criado no A, buscado no B
  await pool.query(
    `INSERT INTO actor_referral_codes (tenant_id, owner_actor_id, code, code_status, created_by_actor_id) VALUES ($1,$2,'CTALPHA1','active',$2)`,
    [A.tenantId, A.invitee.ua]
  );
  const lookB = await pool.query(
    `SELECT a.global_user_id FROM actor_referral_codes rc
       JOIN actors a ON a.tenant_id = rc.tenant_id AND a.id = rc.owner_actor_id
      WHERE rc.tenant_id = $1 AND UPPER(rc.code)='CTALPHA1' AND rc.code_status='active'`,
    [B.tenantId]
  );
  check('E4 lookup de código do tenant A a partir do B → vazio', lookB.rows.length === 0);

  // E5 — RLS com o ROLE REAL da aplicação (SET ROLE unificard_app)
  {
    const raw = new pg.Client({ connectionString: dbUrl });
    await raw.connect();
    await raw.query(`SET ROLE unificard_app`);
    await raw.query(`SELECT set_config('app.current_tenant', $1, false)`, [A.tenantId]);
    const invFromA = await raw.query(`SELECT count(*)::int AS n FROM company_access_invitations WHERE tenant_id = $1`, [B.tenantId]);
    const relFromA = await raw.query(`SELECT count(*)::int AS n FROM company_member_relationships WHERE tenant_id = $1`, [B.tenantId]);
    const ownInv = await raw.query(`SELECT count(*)::int AS n FROM company_access_invitations WHERE tenant_id = $1`, [A.tenantId]);
    check('E5 RLS (unificard_app + GUC A): convites/vínculos do tenant B INVISÍVEIS; os próprios visíveis',
      Number(invFromA.rows[0].n) === 0 && Number(relFromA.rows[0].n) === 0 && Number(ownInv.rows[0].n) >= 1,
      `crossInv=${invFromA.rows[0].n} crossRel=${relFromA.rows[0].n} own=${ownInv.rows[0].n}`);
    await raw.end();
  }

  // E6 — FK composta tenant-safe: convite no tenant B referenciando empresa do A → FK explode
  {
    let fkBlocked = false;
    try {
      await pool.query(
        `INSERT INTO company_access_invitations
           (tenant_id, company_id, inviter_global_user_id, invitee_global_user_id, token_hash, idempotency_key, request_hash, catalog_version, expires_at)
         VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6,$7,1, now() + interval '1 day')`,
        [B.tenantId, A.companyId, B.mgr.g, B.invitee.g, createHash('sha256').update(randomUUID()).digest('hex'), `fk-${randomUUID()}`, createHash('sha256').update('x').digest('hex')]
      );
    } catch (e) {
      fkBlocked = /foreign key|viola/i.test((e as Error).message);
    }
    check('E6 FK composta tenant-safe: convite B → empresa A EXPLODE no schema', fkBlocked);
  }

  // E7 — aceite×aceite concorrente → 1 materialização (tenant B)
  {
    const invB = await invite(B, B.invitee.g, ['publish_feed']);
    const r1 = companyAccessInvitationsService.acceptInvitation({ tenantId: B.tenantId, token: invB.token!, accepterUserId: B.invitee.u });
    const r2 = companyAccessInvitationsService.acceptInvitation({ tenantId: B.tenantId, token: invB.token!, accepterUserId: B.invitee.u });
    const rr = await Promise.allSettled([r1, r2]);
    const ok = rr.filter((x) => x.status === 'fulfilled').length;
    const rows = (await pool.query(`SELECT count(*)::int AS n FROM company_users WHERE tenant_id=$1 AND company_id=$2 AND global_user_id=$3::uuid`, [B.tenantId, B.companyId, B.invitee.g])).rows[0].n;
    check('E7 aceite×aceite concorrente → exatamente 1 materialização', ok === 1 && Number(rows) === 1, `ok=${ok} rows=${rows}`);
  }

  // E8 — aceite×revogação concorrente → UM estado terminal consistente (tenant A)
  {
    // limpa o pendente remanescente de E1/E2 (revogação LEGÍTIMA no próprio tenant)
    await companyAccessInvitationsService.revokeInvitation({
      tenantId: A.tenantId, companyId: A.companyId, invitationId: invA.invitationId, invokerUserId: A.mgr.u,
    });
    const inv8 = await invite(A, A.invitee.g, []);
    const acc = companyAccessInvitationsService.acceptInvitation({ tenantId: A.tenantId, token: inv8.token!, accepterUserId: A.invitee.u });
    const rev = companyAccessInvitationsService.revokeInvitation({ tenantId: A.tenantId, companyId: A.companyId, invitationId: inv8.invitationId, invokerUserId: A.mgr.u });
    const rr = await Promise.allSettled([acc, rev]);
    const st = (await pool.query(`SELECT status FROM company_access_invitations WHERE tenant_id=$1 AND id=$2`, [A.tenantId, inv8.invitationId])).rows[0].status as string;
    const member = (await pool.query(`SELECT count(*)::int AS n FROM company_users WHERE tenant_id=$1 AND company_id=$2 AND global_user_id=$3::uuid AND member_status='active'`, [A.tenantId, A.companyId, A.invitee.g])).rows[0].n;
    const consistent = (st === 'accepted' && Number(member) === 1) || (st === 'revoked' && Number(member) === 0);
    const oneWon = rr.filter((x) => x.status === 'fulfilled').length === 1;
    check('E8 aceite×revogação concorrente → 1 vencedor e estado consistente (accepted+membro XOR revoked+sem-membro)',
      oneWon && consistent, `status=${st} member=${member} results=${rr.map((x) => x.status).join(',')}`);
  }

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA ETAPA E (cross-tenant + concorrência): ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova cross-tenant falhou:', err?.message ?? err); process.exit(1); });
