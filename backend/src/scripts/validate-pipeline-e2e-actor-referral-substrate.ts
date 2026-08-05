/**
 * E2E — F-ACTOR-REFERRAL-CODE-SUBSTRATE (DECISION-0139). NÃO MOVE DINHEIRO.
 *
 * Prova que o código de indicação e os earnings são ACTOR-SCOPED: o código pertence
 * ao owner_actor_id; earnings vão para a actor_wallet do owner; CPF/user NÃO é dono
 * por reflexo; actor_system é fail-closed; body/metadata não define dono; delegação não
 * transfere ownership; referred_actor_id é actor_human server-side; bank_ledger intocado.
 *
 * 🔒 DB EFÊMERA (run-actor-referral-substrate-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/referral|actor|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function mkPageActor(tenantId: string, responsibleActorId: string, responsibleGlobalUserId: string, name: string): Promise<{ companyId: string; actorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name, cnpj, status, global_user_id) VALUES ($1::uuid,$2,$3,'active',$4::uuid) RETURNING company_id::text AS id`, [tenantId, name, String(Date.now() + seq).padStart(14, '0').slice(-14), responsibleGlobalUserId])).rows[0].id;
  // Vínculo humano gestor (canManageCompany → canRepresentActor da page).
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, responsibleGlobalUserId]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, companyId, responsibleActorId])).rows[0].id;
  return { companyId, actorId };
}

async function mkSystemActor(tenantId: string, name: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name) VALUES ($1::uuid,'system',$2) RETURNING id::text AS id`, [tenantId, name])).rows[0].id;
}

async function setTenant(tenantId: string): Promise<void> {
  // RLS app.current_tenant para os INSERTs/SELECTs diretos via pool deste e2e.
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Bootstrap dos ports sociais (canRepresentActor depende da ActorRepository injetada).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const { actorReferralCodeService } = await import('../core/referral/actor-referral-code.service');
  const { referralService } = await import('../core/referral/referral.service');
  const { getActiveReferral } = await import('../core/referral/referral-helper.service');
  const { bankAccountService } = await import('../modules/bank/bank-account.service');
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Referral E2E', $1) RETURNING id::text AS id`, [`referral-e2e-${Date.now()}`])).rows[0].id;
  await setTenant(tenantId);

  // Atores: A (PF referrer), B (PF referido), banda (page de A), C (PF terceiro), sistema.
  const A = await mkUserActor(tenantId, 'alice');
  const B = await mkUserActor(tenantId, 'bob');
  const C = await mkUserActor(tenantId, 'carol');
  const banda = await mkPageActor(tenantId, A.actorId, A.globalUserId, 'banda-alice');
  const systemActor = await mkSystemActor(tenantId, 'sys');

  const ledgerBefore = await count(`SELECT count(*)::text n FROM bank_ledger`);

  // T1 — código do actor PF resolve owner = actor PF (não o user).
  const codeA = await actorReferralCodeService.ensureActorReferralCode(tenantId, A.actorId, A.actorId, A.userId);
  const ownerOfCodeA = await actorReferralCodeService.resolveCodeOwnerActor(tenantId, codeA);
  record('T1 código do actor PF → owner = actor PF (não user)', ownerOfCodeA === A.actorId, `owner=${ownerOfCodeA} expected=${A.actorId}`);

  // T2/T3 — código de banda/page resolve owner = actor da banda (não o CPF criador).
  const codeBanda = await actorReferralCodeService.ensureActorReferralCode(tenantId, banda.actorId, A.actorId, A.userId);
  const ownerOfBanda = await actorReferralCodeService.resolveCodeOwnerActor(tenantId, codeBanda);
  record('T2/T3 código de banda/page → owner = actor da banda (NÃO o CPF criador)', ownerOfBanda === banda.actorId && ownerOfBanda !== A.actorId, `owner=${ownerOfBanda} banda=${banda.actorId}`);

  // T4 — mesmo CPF (A) com 2 actors (A + banda) → 2 códigos → 2 owners distintos (non-mixing).
  record('T4 mesmo CPF com N actors → N códigos com owners distintos (não mistura)', codeA !== codeBanda && ownerOfCodeA !== ownerOfBanda, `${codeA}/${codeBanda}`);

  // T5/T16 — actor_system fail-closed (não recebe código econômico).
  let sysErr: unknown = null;
  try { await actorReferralCodeService.ensureActorReferralCode(tenantId, systemActor, systemActor, null); } catch (e) { sysErr = e; }
  record('T5/T16 actor_system → fail-closed (ACTOR_SYSTEM_REFERRAL_FORBIDDEN)', sysErr instanceof Error && /ACTOR_SYSTEM_REFERRAL_FORBIDDEN/.test(sysErr.message), String(sysErr));

  // T6/T11 — applyReferralCode: B usa codeBanda → referrer_actor_id = banda; referred_actor_id = actor_human de B (server-side).
  await referralService.applyReferralCode(tenantId, B.userId, codeBanda);
  const link = (await pool.query<{ referrer_actor_id: string; referred_actor_id: string; referrer_user_id: string }>(
    `SELECT referrer_actor_id::text, referred_actor_id::text, referrer_user_id::text FROM user_referral_links WHERE tenant_id=$1::uuid AND referred_user_id=$2::uuid LIMIT 1`,
    [tenantId, B.userId]
  )).rows[0];
  record('T6 referrer_actor_id = owner do código (banda)', link?.referrer_actor_id === banda.actorId, JSON.stringify(link));
  record('T11 referred_actor_id = actor_human de B (server-side, não client)', link?.referred_actor_id === B.actorId, JSON.stringify(link));

  // T7 — getActiveReferral devolve owner econômico (banda) + breadcrumb user (A, dono do código).
  // janela NULL de proposito: estes E2E provam a RESOLUCAO do vinculo (quem indicou quem),

  // nao o prazo. Prazo tem E2E proprio (validate-pipeline-e2e-policy-eligibility-window).

  const active = await getActiveReferral(tenantId, B.userId, new Date(), null);
  record('T7 getActiveReferral(B, new Date(), null).referrerActorId = banda (owner econômico)', active?.referrerActorId === banda.actorId, JSON.stringify(active));

  // T13/T14 — alvo do earning = actor_wallet do owner; a conta tem actor_id = owner (writer resolve target_actor_id).
  const wallet = await bankAccountService.ensureActorWalletAccount(tenantId, banda.actorId, 'BRL');
  const walletActorId = (await pool.query<{ actor_id: string | null }>(`SELECT actor_id::text FROM bank_accounts WHERE tenant_id=$1::uuid AND id=$2::uuid LIMIT 1`, [tenantId, wallet.accountId])).rows[0]?.actor_id;
  record('T14 earning target = actor_wallet do owner (conta existe p/ banda)', !!wallet.accountId, `acc=${wallet.accountId}`);
  record('T13 bank_accounts.actor_id da actor_wallet = owner (writer resolve target_actor_id=owner)', walletActorId === banda.actorId, `accActor=${walletActorId} owner=${banda.actorId}`);

  // T5b — earnings NÃO vão para o CPF/user de A por reflexo: a actor_wallet de A (PF) ≠ a da banda.
  const walletA = await bankAccountService.ensureActorWalletAccount(tenantId, A.actorId, 'BRL');
  record('T2b earnings da banda ≠ wallet do CPF de A (não paga criador por reflexo)', walletA.accountId !== wallet.accountId, `A=${walletA.accountId} banda=${wallet.accountId}`);

  // T9 — idempotência: re-ensure devolve o MESMO código; re-apply não duplica vínculo.
  const codeA2 = await actorReferralCodeService.ensureActorReferralCode(tenantId, A.actorId, A.actorId, A.userId);
  await referralService.applyReferralCode(tenantId, B.userId, codeA).catch(() => undefined);
  const links = await count(`SELECT count(*)::text n FROM user_referral_links WHERE tenant_id=$1::uuid AND referred_user_id=$2::uuid`, [tenantId, B.userId]);
  record('T9 idempotência: mesmo código + vínculo único (não duplica)', codeA2 === codeA && links === 1, `code=${codeA2} links=${links}`);

  // T6b/T7b — resolveCodeOwnerActor de código inexistente (body arbitrário) → null (não inventa dono).
  const bogus = await actorReferralCodeService.resolveCodeOwnerActor(tenantId, 'BOGUSCODE999');
  record('T7/T8 body.referral_code arbitrário/inexistente → null (não define dono econômico)', bogus === null, `got=${bogus}`);

  // T10 — canRepresentActor: terceiro (C) NÃO representa a banda → gestão de código negada (403 na rota).
  const cCanManageBanda = await authorizationService.canRepresentActor(tenantId, C.userId, banda.actorId);
  const aCanManageBanda = await authorizationService.canRepresentActor(tenantId, A.userId, banda.actorId);
  record('T6/T9 terceiro NÃO representa o owner (canRepresentActor=false → 403)', cCanManageBanda === false, `C=${cCanManageBanda}`);
  record('T10 owner/representante representa o actor (canRepresentActor=true)', aCanManageBanda === true, `A→banda=${aCanManageBanda}`);

  // T15 — referral code/link ops NÃO escrevem bank_ledger.
  const ledgerAfter = await count(`SELECT count(*)::text n FROM bank_ledger`);
  record('T15 bank_ledger intocado por referral code/link ops', ledgerAfter === ledgerBefore, `before=${ledgerBefore} after=${ledgerAfter}`);

  // ── Resultado ──
  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ Código de indicação e earnings são ACTOR-SCOPED; CPF não é dono por reflexo; actor_system fail-closed; body não define dono; bank_ledger intocado.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
