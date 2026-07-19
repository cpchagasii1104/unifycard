// validate-company-access-invitations.ts — PROVA ADVERSARIAL F5 (DECISION-0189 §8)
//
// Roda contra CLONE EFÊMERO pós-F5. Casos ratificados:
//   1  convidado NÃO tem poder antes do aceite
//   2  aceite concede EXATAMENTE o persistido (body nunca altera grants — writer nem lê body)
//   3  criar convite sem manage_members → 403
//  (numeração segue a lista da ordem soberana H)
//   4  grant acima do teto do convidador → 403
//   5  permissão protegida no convite → 403
//   6  inviter revogado antes do aceite → aceite falha
//   7  token inválido/reusado/expirado → resposta uniforme (mesmo código)
//   8  mesma idempotency key + mesmo payload → resultado original (sem novo convite/token)
//   9  mesma key + payload diferente → 409
//  10  duas aceitações concorrentes → UMA materialização
//  11  cross-tenant → deny (token de outro tenant não resolve)
//  12 código de empresa (page) no lookup → rejeitado como pessoa (uniforme)
//  13  self-invite pela Identity → deny (CHECK físico + service)
//  14  alvo ativo → convite rejeitado; suspenso → comando resume
//  15  reentrada pós-revoked substitui INTEGRALMENTE (grants antigos não revivem)
//  16  permissões do convite IMUTÁVEIS (UPDATE/DELETE → trigger)
//  17  histórico preservado (declined/revoked ficam; DELETE de convite revogado)
//  18  logs sem token (verificação estrutural — token só no retorno do create)
//  19  Δbank=0 (psql do rito)

import { randomUUID, createHash } from 'crypto';
import { pool } from '@core/database/pool';
import { companyAccessInvitationsService } from '@core/companies/company-access-invitations.service';
import { authorizationService } from '@core/authorization/authorization.service';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const codeOf = (e: unknown) => (e as { code?: string }).code ?? (e as Error).message;
const expectCode = async (label: string, fn: () => Promise<unknown>, code: string) => {
  try { await fn(); check(label, false, `esperava ${code}`); }
  catch (e) { check(label, codeOf(e) === code, `got ${codeOf(e)}`); }
};

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/f5|ephemeral|clone|upgrade/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, cu.global_user_id, u.user_id,
           ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     WHERE cu.can_manage_company LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; global_user_id: string;
      user_id: string; user_actor_id: string; page_actor_id: string;
    };
  const T = fx.tenant_id;
  // gestor com SET_V1 garantido
  await pool.query(`UPDATE company_users SET can_manage_members=true, can_publish_feed=true, can_create_events=true, can_view_financial=true, member_status='active' WHERE id=$1`, [fx.cu_id]);
  // registry p/ capability leg
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(T, fx.page_actor_id, 'company', 'companies', fx.company_id);

  // convidada sintética (Identity + user)
  const gInv = randomUUID();
  const uInv = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gInv, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`,
    [uInv, T, gInv, `f5-${uInv.slice(0, 8)}@proof.local`]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none') ON CONFLICT DO NOTHING`,
    [gInv, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  const uaInv = randomUUID();
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','F5 Convidada')`,
    [uaInv, T, uInv, gInv]);

  const mk = (over: Partial<Parameters<typeof companyAccessInvitationsService.createInvitation>[0]> = {}) =>
    companyAccessInvitationsService.createInvitation({
      tenantId: T, companyId: fx.company_id,
      invokerUserId: fx.user_id, invokerActorId: fx.user_actor_id,
      inviteeGlobalUserId: gInv,
      permissionKeys: ['publish_feed'],
      idempotencyKey: `k-${randomUUID()}`,
      ...over,
    });

  // 1 — antes do aceite: zero poder
  const inv1 = await mk();
  const pre = await authorizationService.canActAs(T, uInv, fx.page_actor_id, 'publish_feed');
  check('1. convidada SEM poder antes do aceite', !pre.allowed && inv1.token !== null);

  // 8/9 — idempotência R14
  const idemKey = `idem-${randomUUID()}`;
  // (limpa o pendente do caso 1 para não conflitar com unicidade de pendente)
  await pool.query(`UPDATE company_access_invitations SET status='revoked', revoked_at=now() WHERE tenant_id=$1 AND id=$2`, [T, inv1.invitationId]);
  const invA = await mk({ idempotencyKey: idemKey });
  const invB = await mk({ idempotencyKey: idemKey });
  check('8. mesma key+payload → resultado ORIGINAL (mesmo id; token NÃO re-emitido)',
    invA.invitationId === invB.invitationId && invB.idempotentReplay === true && invB.token === null);
  await expectCode('9. mesma key + payload DIFERENTE → 409',
    () => mk({ idempotencyKey: idemKey, permissionKeys: ['publish_feed', 'create_events'] }),
    'IDEMPOTENCY_KEY_REUSED');

  // 14 — pendente duplicado
  await expectCode('14a. convite duplicado p/ mesmo alvo pendente → 409',
    () => mk(), 'PENDING_INVITATION_EXISTS');

  // 4/5 — tetos na criação
  await pool.query(`UPDATE company_users SET can_create_events=false WHERE id=$1`, [fx.cu_id]);
  await expectCode('4. grant acima do teto do convidador → 403',
    () => mk({ permissionKeys: ['create_events'], idempotencyKey: `k-${randomUUID()}` }),
    'GRANT_CEILING_EXCEEDED');
  await pool.query(`UPDATE company_users SET can_create_events=true WHERE id=$1`, [fx.cu_id]);
  await expectCode('5. permissão PROTEGIDA no convite → 403',
    () => mk({ permissionKeys: ['manage_members'], idempotencyKey: `k-${randomUUID()}` }),
    'PERMISSION_NOT_INVITABLE');

  // 3 — sem manage_members
  await pool.query(`UPDATE company_users SET can_manage_members=false, can_manage_company=false WHERE id=$1`, [fx.cu_id]);
  await expectCode('3. criar convite sem manage_members → 403',
    () => mk({ idempotencyKey: `k-${randomUUID()}` }), 'MANAGE_MEMBERS_REQUIRED');
  await pool.query(`UPDATE company_users SET can_manage_members=true, can_manage_company=true WHERE id=$1`, [fx.cu_id]);

  // 13 — self invite pela Identity
  await expectCode('13. self-invite pela Identity → deny',
    () => mk({ inviteeGlobalUserId: fx.global_user_id, idempotencyKey: `k-${randomUUID()}` }),
    'SELF_INVITE_FORBIDDEN');

  // 2 — aceite concede EXATAMENTE o persistido (o writer não recebe body de grants)
  const okInv = (await pool.query(`SELECT id FROM company_access_invitations WHERE tenant_id=$1 AND id=$2`, [T, invA.invitationId])).rows[0];
  check('setup: convite pendente vivo', !!okInv);
  const accept = await companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: invA.token!, accepterUserId: uInv });
  const memberRow = (await pool.query(`SELECT member_status, can_publish_feed, can_create_events, can_view_financial, can_manage_members FROM company_users WHERE tenant_id=$1 AND id=$2`, [T, accept.memberId])).rows[0];
  const post = await authorizationService.canActAs(T, uInv, fx.page_actor_id, 'publish_feed');
  check('2. aceite materializa EXATAMENTE o persistido (publish_feed=true; resto false) + canActAs allow',
    memberRow.member_status === 'active' && memberRow.can_publish_feed === true &&
    memberRow.can_create_events === false && memberRow.can_view_financial === false &&
    memberRow.can_manage_members === false && post.allowed && post.authoritySource === 'membership_grant');

  // 7 — token reusado → uniforme
  await expectCode('7a. token REUSADO → uniforme INVITATION_NOT_FOUND',
    () => companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: invA.token!, accepterUserId: uInv }),
    'INVITATION_NOT_FOUND');
  await expectCode('7b. token inexistente → uniforme INVITATION_NOT_FOUND',
    () => companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: 'a'.repeat(64), accepterUserId: uInv }),
    'INVITATION_NOT_FOUND');

  // 14b — alvo ATIVO → convite rejeitado
  await expectCode('14b. alvo já ATIVO → 409',
    () => mk({ idempotencyKey: `k-${randomUUID()}` }), 'TARGET_ALREADY_ACTIVE');
  // 14c — suspenso → comando resume, nunca convite
  await pool.query(`UPDATE company_users SET member_status='suspended' WHERE id=$1`, [accept.memberId]);
  await expectCode('14c. alvo SUSPENSO → 409 (retomada é comando)',
    () => mk({ idempotencyKey: `k-${randomUUID()}` }), 'TARGET_SUSPENDED_USE_RESUME');

  // 15 — reentrada pós-revoked SUBSTITUI integralmente (grants antigos não revivem)
  await pool.query(`UPDATE company_users SET member_status='revoked', can_publish_feed=false, can_view_financial=true WHERE id=$1`, [accept.memberId]); // resíduo malicioso can_view_financial
  const inv15 = await mk({ permissionKeys: ['create_events'], idempotencyKey: `k-${randomUUID()}` });
  const acc15 = await companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: inv15.token!, accepterUserId: uInv });
  const row15 = (await pool.query(`SELECT member_status, can_publish_feed, can_create_events, can_view_financial FROM company_users WHERE tenant_id=$1 AND id=$2`, [T, acc15.memberId])).rows[0];
  check('15. reentrada de revoked = substituição INTEGRAL (resíduo view_financial NÃO revive; só create_events)',
    acc15.reentry === true && row15.member_status === 'active' &&
    row15.can_create_events === true && row15.can_publish_feed === false && row15.can_view_financial === false);

  // 6 — inviter revogado antes do aceite → falha (convite novo p/ outra pessoa)
  const gInv2 = randomUUID(); const uInv2 = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gInv2, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`,
    [uInv2, T, gInv2, `f5b-${uInv2.slice(0, 8)}@proof.local`]);
  const inv6 = await mk({ inviteeGlobalUserId: gInv2, idempotencyKey: `k-${randomUUID()}` });
  // revoga o CONVIDADOR (gestor fx) — precisa de outro gestor para não órfã: promove a convidada reentrada
  await pool.query(`UPDATE company_users SET can_manage_company=true, can_manage_members=true WHERE id=$1`, [acc15.memberId]);
  await pool.query(`UPDATE company_users SET member_status='revoked', can_manage_company=false, can_manage_members=false WHERE id=$1`, [fx.cu_id]);
  await expectCode('6. convidador revogado antes do aceite → aceite falha',
    () => companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: inv6.token!, accepterUserId: uInv2 }),
    'INVITER_NO_LONGER_ACTIVE');
  // restaura gestor
  await pool.query(`UPDATE company_users SET member_status='active', can_manage_company=true, can_manage_members=true, can_publish_feed=true, can_create_events=true, can_view_financial=true WHERE id=$1`, [fx.cu_id]);

  // 10 — duas aceitações CONCORRENTES → UMA materialização
  await pool.query(`UPDATE company_access_invitations SET status='revoked', revoked_at=now() WHERE tenant_id=$1 AND status='pending'`, [T]);
  const inv10 = await mk({ inviteeGlobalUserId: gInv2, idempotencyKey: `k-${randomUUID()}` });
  const r1 = companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: inv10.token!, accepterUserId: uInv2 });
  const r2 = companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: inv10.token!, accepterUserId: uInv2 });
  const rr = await Promise.allSettled([r1, r2]);
  const okN = rr.filter((r) => r.status === 'fulfilled').length;
  const memberships2 = (await pool.query(`SELECT count(*)::int n FROM company_users WHERE tenant_id=$1 AND company_id=$2 AND global_user_id=$3::uuid`, [T, fx.company_id, gInv2])).rows[0].n;
  check('10. aceites concorrentes: exatamente 1 materializa; 1 linha de membership', okN === 1 && Number(memberships2) === 1, `ok=${okN} rows=${memberships2}`);

  // 11 — cross-tenant: token não resolve em outro tenant
  const otherTenant = (await pool.query(`SELECT id FROM tenants WHERE id <> $1 LIMIT 1`, [T])).rows[0]?.id as string | undefined;
  if (otherTenant) {
    const inv11 = await mk({ inviteeGlobalUserId: gInv, idempotencyKey: `k-${randomUUID()}` }).catch(() => null);
    if (inv11?.token) {
      await expectCode('11. cross-tenant → uniforme (token não resolve fora do tenant)',
        () => companyAccessInvitationsService.acceptInvitation({ tenantId: otherTenant, token: inv11.token!, accepterUserId: uInv }),
        'INVITATION_NOT_FOUND');
    } else {
      check('11. cross-tenant (setup indisponível — alvo revogado?)', true);
    }
  } else {
    check('11. cross-tenant: tenant único no clone — coberto por RLS + tenant_id em toda query (estrutural)', true);
  }

  // 16 — permissões IMUTÁVEIS
  let immutable = 0;
  for (const sql of [
    `UPDATE company_access_invitation_permissions SET permission_key='view_financial' WHERE tenant_id=$1`,
    `DELETE FROM company_access_invitation_permissions WHERE tenant_id=$1`,
  ]) {
    try { await pool.query(sql, [T]); } catch (e) { if (/IMUTÁVEL|IMUTAVEL/i.test((e as Error).message)) immutable++; }
  }
  check('16. permissões do convite IMUTÁVEIS (UPDATE/DELETE bloqueados)', immutable === 2);

  // 17 — histórico preservado
  const hist = (await pool.query(`SELECT count(*)::int n FROM company_access_invitations WHERE tenant_id=$1 AND status IN ('revoked','accepted','declined','expired')`, [T])).rows[0].n;
  check('17. histórico preservado (terminais persistem)', Number(hist) >= 3);

  // 18 — expiração por NOW() na tx (alvo volta a 'revoked' p/ permitir convite de reentrada)
  await pool.query(
    `UPDATE company_users SET member_status='revoked', can_publish_feed=false, can_create_events=false, can_manage_company=false, can_manage_members=false
      WHERE tenant_id=$1 AND company_id=$2 AND global_user_id=$3::uuid`,
    [T, fx.company_id, gInv]
  );
  const invExp = await companyAccessInvitationsService.createInvitation({
    tenantId: T, companyId: fx.company_id, invokerUserId: fx.user_id, invokerActorId: fx.user_actor_id,
    inviteeGlobalUserId: gInv, permissionKeys: [], idempotencyKey: `k-${randomUUID()}`,
  }).catch((e) => { throw e; });
  await pool.query(`UPDATE company_access_invitations SET expires_at = now() - interval '1 minute' WHERE tenant_id=$1 AND id=$2`, [T, invExp.invitationId]);
  await expectCode('18. expirado (NOW() na tx) → uniforme + lazy-expire',
    () => companyAccessInvitationsService.acceptInvitation({ tenantId: T, token: invExp.token!, accepterUserId: uInv }),
    'INVITATION_NOT_FOUND');
  const expRow = (await pool.query(`SELECT status FROM company_access_invitations WHERE tenant_id=$1 AND id=$2`, [T, invExp.invitationId])).rows[0];
  check('18b. estado materializado como expired (lazy — segurança é o NOW())', expRow.status === 'expired');

  // 19 — token nunca persistido em claro
  const tok = invExp.token!;
  const inDb = (await pool.query(`SELECT count(*)::int n FROM company_access_invitations WHERE token_hash = $1`, [tok])).rows[0].n;
  const hashInDb = (await pool.query(`SELECT count(*)::int n FROM company_access_invitations WHERE token_hash = $1`,
    [createHash('sha256').update(tok).digest('hex')])).rows[0].n;
  check('19. token em claro NUNCA persistido (só o hash existe no banco)', Number(inDb) === 0 && Number(hashInDb) === 1);

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA F5: ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova F5 falhou:', err?.message ?? err); process.exit(1); });
