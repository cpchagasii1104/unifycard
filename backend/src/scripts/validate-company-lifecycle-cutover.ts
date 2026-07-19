// validate-company-lifecycle-cutover.ts — PROVA ADVERSARIAL F4 (DECISION-0189)
//
// Roda contra CLONE EFÊMERO pós-migration F4 (recusa DB não-efêmero). Prova o cutover de
// lifecycle/authority: role/is_primary mortos, comandos governados (tetos + último gestor +
// transferência atômica), exclusividade membership×delegação nas 2 direções, representante
// externo preservado, DELETE físico bloqueado pelo substrato, eventos com snapshot.

import { randomUUID } from 'crypto';
import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { actorDelegationRepository } from '@core/actor-delegation/actor-delegation.repository';
import { companyMembershipCommandsService } from '@core/companies/company-membership-commands.service';

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const expectCode = async (label: string, fn: () => Promise<unknown>, code: string) => {
  try {
    await fn();
    check(label, false, `esperava erro ${code}, passou`);
  } catch (e) {
    const c = (e as { code?: string }).code ?? (e as Error).message;
    check(label, c === code || (e as Error).message.includes(code), `got ${c}`);
  }
};

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/f4|ephemeral|clone|upgrade/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, cu.global_user_id,
           u.user_id, ua.id AS user_actor_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors ua ON ua.user_id = u.user_id AND ua.tenant_id = cu.tenant_id AND ua.actor_type = 'user'
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as {
      cu_id: string; tenant_id: string; company_id: string; global_user_id: string;
      user_id: string; user_actor_id: string; page_actor_id: string;
    } | undefined;
  if (!fx) { console.error('fixture ausente'); process.exit(1); }
  const T = fx.tenant_id;
  const acted = { userId: fx.user_id, actorId: fx.user_actor_id };

  // registry (capability leg) — como o writer real faz
  {
    const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
    await actorRegistryService.register(T, fx.page_actor_id, 'company', 'companies', fx.company_id);
  }
  // estado base: gestor com SET_V1
  const SETV1 = `can_manage_company=true, can_manage_members=true, can_manage_financial=true,
    can_view_financial=true, can_publish_feed=true, can_create_events=true,
    can_manage_employees=true, can_manage_services=true, can_view_reports=true`;
  await pool.query(`UPDATE company_users SET ${SETV1}, member_status='active', role='owner' WHERE id=$1`, [fx.cu_id]);

  // ── 1. role/is_primary mortos: rótulos NÃO autorizam chave empresarial ──
  await pool.query(`UPDATE company_users SET can_publish_feed=false WHERE id=$1`, [fx.cu_id]);
  const d1 = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'publish_feed');
  check('1. gestor (role=owner, can_manage_company) SEM can_publish_feed → deny (fallback de ownership MORTO)', !d1.allowed);
  await pool.query(`UPDATE company_users SET can_publish_feed=true WHERE id=$1`, [fx.cu_id]);
  const d1b = await authorizationService.canActAs(T, fx.user_id, fx.page_actor_id, 'publish_feed');
  check('1b. com grant → allow membership_grant', d1b.allowed && d1b.authoritySource === 'membership_grant');

  // ── 2. segundo membro sintético (comum) p/ tetos ──
  const g2 = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1, $2)`, [g2, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  const m2 = (await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status, can_publish_feed)
     VALUES ($1,$2,$3,'staff','active',true) RETURNING id`,
    [T, fx.company_id, g2]
  )).rows[0].id as string;

  // ── 3. comandos: suspend congela grants; resume; revoke zera + snapshot ──
  await companyMembershipCommandsService.suspendMember(T, fx.company_id, m2, acted);
  let row2 = (await pool.query(`SELECT member_status, can_publish_feed FROM company_users WHERE id=$1`, [m2])).rows[0];
  check('3. suspend: status=suspended, grants CONGELADOS', row2.member_status === 'suspended' && row2.can_publish_feed === true);
  await companyMembershipCommandsService.resumeMember(T, fx.company_id, m2, acted);
  row2 = (await pool.query(`SELECT member_status FROM company_users WHERE id=$1`, [m2])).rows[0];
  check('3b. resume: status=active', row2.member_status === 'active');
  await companyMembershipCommandsService.revokeMember(T, fx.company_id, m2, acted);
  row2 = (await pool.query(`SELECT member_status, can_publish_feed FROM company_users WHERE id=$1`, [m2])).rows[0];
  const snap = (await pool.query(
    `SELECT snapshot FROM company_member_events WHERE tenant_id=$1 AND company_user_id=$2 AND event_type='revoked' ORDER BY created_at DESC LIMIT 1`,
    [T, m2]
  )).rows[0];
  check('3c. revoke: grants ZERADOS + snapshot anterior preservado no evento',
    row2.member_status === 'revoked' && row2.can_publish_feed === false &&
    snap?.snapshot?.before?.can_publish_feed === true);

  // ── 4. último gestor: revogar o único gestor → bloqueado ──
  await expectCode('4. revogar o ÚNICO gestor → COMPANY_WOULD_BE_ORPHANED',
    () => companyMembershipCommandsService.revokeMember(T, fx.company_id, fx.cu_id, acted),
    'COMPANY_WOULD_BE_ORPHANED');
  await expectCode('4b. remover can_manage_company do único gestor → COMPANY_WOULD_BE_ORPHANED',
    () => companyMembershipCommandsService.alterGrants(T, fx.company_id, fx.cu_id, acted, { can_manage_company: false }),
    'COMPANY_WOULD_BE_ORPHANED');

  // ── 5. tetos: reentrada do m2 como manage_members SEM governança; ele não toca protegidos ──
  await pool.query(`UPDATE company_users SET member_status='active', can_manage_members=true, can_publish_feed=true WHERE id=$1`, [m2]);
  const u2 = randomUUID();
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`,
    [u2, T, g2, `f4-${u2.slice(0, 8)}@proof.local`]).catch(async () => {
    // shape alternativo de users (colunas NOT NULL diferentes) — resolve dinamicamente
    const cols = (await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND is_nullable='NO' AND column_default IS NULL`)).rows.map((r: { column_name: string }) => r.column_name);
    throw new Error('users insert falhou — colunas NOT NULL: ' + cols.join(','));
  });
  const acted2 = { userId: u2, actorId: null };
  // alvo COMUM (m3, zero grants) — para isolar cada teto do caso "alvo com grant protegido"
  const g3 = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1, $2)`, [g3, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  const m3 = (await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status)
     VALUES ($1,$2,$3,'member','active') RETURNING id`,
    [T, fx.company_id, g3]
  )).rows[0].id as string;
  await expectCode('5. manage_members NÃO concede grant protegido (can_manage_financial em alvo comum)',
    () => companyMembershipCommandsService.alterGrants(T, fx.company_id, m3, acted2, { can_manage_financial: true }),
    'PROTECTED_GRANT_REQUIRES_GOVERNANCE');
  await expectCode('5b. manage_members NÃO administra detentor de grant protegido (gestor)',
    () => companyMembershipCommandsService.suspendMember(T, fx.company_id, fx.cu_id, acted2),
    'ADMIN_CEILING_PROTECTED_TARGET');
  await expectCode('5c. grant ceiling: não concede o que não possui (can_create_events em alvo comum)',
    () => companyMembershipCommandsService.alterGrants(T, fx.company_id, m3, acted2, { can_create_events: true }),
    'GRANT_CEILING_EXCEEDED');

  // ── 6. transferência ATÔMICA de governança ──
  await companyMembershipCommandsService.transferGovernance(T, fx.company_id, m2, acted);
  const after6 = await pool.query(
    `SELECT id, can_manage_company FROM company_users WHERE tenant_id=$1 AND company_id=$2 ORDER BY created_at`, [T, fx.company_id]);
  const mgr = (after6.rows as Array<{ id: string; can_manage_company: boolean }>);
  check('6. transferGovernance: destinatário ganhou, cedente perdeu, empresa nunca órfã',
    mgr.find((r) => r.id === m2)?.can_manage_company === true &&
    mgr.find((r) => r.id === fx.cu_id)?.can_manage_company === false);
  // devolve a governança ao gestor original (fixture estável para o resto)
  await pool.query(`UPDATE company_users SET ${SETV1} WHERE id=$1`, [fx.cu_id]);
  await pool.query(`UPDATE company_users SET can_manage_company=false, can_manage_members=true WHERE id=$1`, [m2]);

  // ── 7. exclusividade: delegação empresarial ativa p/ Identity com membership ATIVA → trigger ──
  let trigFired = false;
  try {
    await actorDelegationRepository.create(T, {
      userActorId: fx.user_actor_id,
      institutionalActorId: fx.page_actor_id,
      scopes: ['publish_feed'],
      relationshipType: 'employee',
    });
  } catch (e) {
    trigFired = /EXCLUSIVITY_VIOLATION/.test((e as Error).message);
  }
  check('7. delegação p/ membro ATIVO → EXCLUSIVITY_VIOLATION (trigger delegations)', trigFired);

  // ── 8. representante EXTERNO preservado: m2 revogado + delegação → publish_feed via delegation ──
  await companyMembershipCommandsService.revokeMember(T, fx.company_id, m2, acted);
  const ua2 = randomUUID();
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
     VALUES ($1, $2, 'cpf', 'pending', 'none')
     ON CONFLICT (global_user_id) DO NOTHING`,
    [g2, String(Math.floor(1e10 + Math.random() * 8.9e10))]
  );
  await pool.query(
    `INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name)
     VALUES ($1,$1,$2,$3,$4,'user','F4 Rep Externo')`,
    [ua2, T, u2, g2]
  );
  const dExt = await actorDelegationRepository.create(T, {
    userActorId: ua2,
    institutionalActorId: fx.page_actor_id,
    scopes: ['publish_feed'],
    relationshipType: 'attorney',
  });
  const d8 = await authorizationService.canActAs(T, u2, fx.page_actor_id, 'publish_feed');
  check('8. representante externo (revogado como membro; delegação ativa) → allow via delegation',
    d8.allowed && d8.authoritySource === 'delegation');
  // 8b. reverso: reativar membership com delegação ativa → trigger company_users
  let trig2 = false;
  try {
    await pool.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [m2]);
  } catch (e) {
    trig2 = /EXCLUSIVITY_VIOLATION/.test((e as Error).message);
  }
  check('8b. membership→active com delegação empresarial ativa → EXCLUSIVITY_VIOLATION (trigger company_users)', trig2);
  await actorDelegationRepository.revoke(T, dExt.delegationId);

  // ── 9. DELETE físico bloqueado pelo SUBSTRATO (FK da casa jurídica/eventos) ──
  let delBlocked = false;
  try {
    await pool.query(`DELETE FROM company_users WHERE id=$1`, [fx.cu_id]);
  } catch (e) {
    delBlocked = /foreign key|viola|violates/.test((e as Error).message);
  }
  check('9. DELETE físico de membership → bloqueado por FK (histórico jurídico intocável)', delBlocked);

  // ── 10. revogação concorrente ×2 gestores → exatamente UMA falha (nunca órfã) ──
  await pool.query(`UPDATE company_users SET member_status='active', can_manage_company=true, can_manage_members=true WHERE id=$1`, [m2]);
  const r1 = companyMembershipCommandsService.revokeMember(T, fx.company_id, fx.cu_id, { userId: u2, actorId: null });
  const r2 = companyMembershipCommandsService.revokeMember(T, fx.company_id, m2, acted);
  const results = await Promise.allSettled([r1, r2]);
  const okCount = results.filter((r) => r.status === 'fulfilled').length;
  // Sob o lock da empresa, a 2ª revogação serializa e falha por UMA das proteções legítimas:
  // COMPANY_WOULD_BE_ORPHANED (viu o outro gestor sumir) OU CALLER_NOT_ACTIVE_MEMBER
  // (o próprio caller foi revogado primeiro). Ambas provam a linearização.
  const orphanBlocked = results.some((r) => {
    if (r.status !== 'rejected') return false;
    const reason = (r as PromiseRejectedResult).reason as { code?: string; message?: string };
    return /COMPANY_WOULD_BE_ORPHANED|CALLER_NOT_ACTIVE_MEMBER/.test(`${reason?.code ?? ''} ${reason?.message ?? ''}`);
  });
  const mgrsLeft = Number((await pool.query(
    `SELECT count(*)::int n FROM company_users WHERE tenant_id=$1 AND company_id=$2 AND member_status='active' AND can_manage_company=true`,
    [T, fx.company_id])).rows[0].n);
  check('10. dupla revogação concorrente: 1 passa, 1 bloqueia — empresa NUNCA órfã (lock da empresa)',
    okCount === 1 && orphanBlocked && mgrsLeft >= 1, `ok=${okCount} orphanBlocked=${orphanBlocked} mgrs=${mgrsLeft}`);

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA F4: ${passed} verdes, ${failed} vermelhos`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova F4 falhou:', err); process.exit(1); });
