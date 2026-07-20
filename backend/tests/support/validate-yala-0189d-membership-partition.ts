// validate-yala-0189d-membership-partition.ts — PROVA MATERIAL DECISION-0189D
//
// Roda contra CLONE EFÊMERO. Prova a partição EXATA manage_members (membro comum) ×
// manage_governance (alvo/grant protegido) nos 4 sites, mais o §1.3 (autoria ≠ autoridade).
//
//   A  convite (createInvitation): governance-only NEGA · manage_members-only PERMITE
//   B  revogação (revokeInvitation): governance-only NEGA · manage_members-only PERMITE
//   C  revalidação do convidador no aceite: convidador que perde SÓ manage_members (mantendo
//      can_manage_company) → aceite falha INVITER_LOST_AUTHORITY
//   D  ceiling (suspendMember): governance-only NÃO administra membro COMUM · manage_members SIM ·
//      manage_members NÃO administra PROTEGIDO · governança administra PROTEGIDO
//   E  §1.3 HTTP: membro fino (manage_members, sem manage_company) passa autoria+autoridade;
//      governance-only recebe deny de AUTORIDADE (autoria passou) — canRepresentActor não decide
//   F  não-regressão: is_active inexistente · catálogo digest byte-intacto · Δbank=0

import { pool } from '@core/database/pool';
import { companyAccessInvitationsService } from '@core/companies/company-access-invitations.service';
import { companyMembershipCommandsService } from '@core/companies/company-membership-commands.service';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const cpf = () => String(Math.floor(1e10 + Math.random() * 8.9e10));
const ALLF = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_interact_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports','is_primary'];

async function setFlags(cuId: string, patch: Record<string, boolean>, status = 'active') {
  const reset = ALLF.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status=$2 WHERE id=$1`, [cuId, status]);
  const k = Object.keys(patch);
  if (k.length) await pool.query(`UPDATE company_users SET ${k.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id=$1`, [cuId, ...k.map((c) => patch[c])]);
}

async function mkPerson(T: string): Promise<{ g: string; u: string; ua: string }> {
  const g = randomUUID(); const u = randomUUID(); const ua = randomUUID();
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [g, cpf()]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [g, cpf()]);
  await pool.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`, [u, T, g, `p-${u.slice(0, 8)}@0189d.local`]);
  await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','P')`, [ua, T, u, g]);
  return { g, u, ua };
}
async function mkMember(T: string, companyId: string, flags: Record<string, boolean>): Promise<{ id: string; g: string; u: string }> {
  const p = await mkPerson(T);
  const cols = Object.keys(flags);
  const r = await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status${cols.length ? ', ' + cols.join(', ') : ''})
       VALUES ($1,$2,$3,'member','active'${cols.map((_, i) => `, $${i + 4}`).join('')}) RETURNING id`,
    [T, companyId, p.g, ...cols.map((c) => flags[c])]
  );
  return { id: r.rows[0].id, g: p.g, u: p.u };
}
const caught = async (fn: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; code?: string; msg: string }> => {
  try { await fn(); return { ok: true }; }
  catch (e) { const err = e as { code?: string; message: string }; return { ok: false, code: err.code, msg: err.message }; }
};

async function main() {
  const db = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final|ratchet|0189d/i.test(db)) { console.error(`recusado: DB não-efêmero (${db.split('/').pop()})`); process.exit(1); }
  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const a = await import('@modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, u.user_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; company_id: string; user_id: string; page_actor_id: string };
  const T = fx.tenant_id; const CO = fx.company_id;
  const inv = companyAccessInvitationsService; const cmd = companyMembershipCommandsService;

  // ── A — CONVITE (caller = base member) ──────────────────────────────────────
  const invitee1 = await mkPerson(T);
  await setFlags(fx.cu_id, { can_manage_company: true, can_publish_feed: true }); // governance-only, SEM manage_members
  const a1 = await caught(() => inv.createInvitation({ tenantId: T, companyId: CO, invokerUserId: fx.user_id, inviteeGlobalUserId: invitee1.g, permissionKeys: ['publish_feed'], idempotencyKey: `idem-${randomUUID()}` } as never));
  check('A1 governance-only (can_manage_company, SEM manage_members) → NEGA convite (MANAGE_MEMBERS_REQUIRED)', !a1.ok && (a1 as { code?: string }).code === 'MANAGE_MEMBERS_REQUIRED', JSON.stringify(a1));

  await setFlags(fx.cu_id, { can_manage_members: true, can_publish_feed: true }); // manage_members-only
  const a2 = await caught(() => inv.createInvitation({ tenantId: T, companyId: CO, invokerUserId: fx.user_id, inviteeGlobalUserId: invitee1.g, permissionKeys: ['publish_feed'], idempotencyKey: `idem-${randomUUID()}` } as never));
  check('A2 manage_members-only → PERMITE convite', a2.ok, JSON.stringify(a2));

  // ── B — REVOGAÇÃO ───────────────────────────────────────────────────────────
  const invitee2 = await mkPerson(T);
  await setFlags(fx.cu_id, { can_manage_members: true, can_publish_feed: true });
  const created = (await inv.createInvitation({ tenantId: T, companyId: CO, invokerUserId: fx.user_id, inviteeGlobalUserId: invitee2.g, permissionKeys: ['publish_feed'], idempotencyKey: `idem-${randomUUID()}` } as never)) as { invitationId: string };
  await setFlags(fx.cu_id, { can_manage_company: true }); // governance-only
  const b1 = await caught(() => inv.revokeInvitation({ tenantId: T, companyId: CO, invitationId: created.invitationId, invokerUserId: fx.user_id } as never));
  check('B1 governance-only → NEGA revogação (MANAGE_MEMBERS_REQUIRED)', !b1.ok && (b1 as { code?: string }).code === 'MANAGE_MEMBERS_REQUIRED', JSON.stringify(b1));
  await setFlags(fx.cu_id, { can_manage_members: true });
  const b2 = await caught(() => inv.revokeInvitation({ tenantId: T, companyId: CO, invitationId: created.invitationId, invokerUserId: fx.user_id } as never));
  check('B2 manage_members-only → PERMITE revogação', b2.ok, JSON.stringify(b2));

  // ── C — REVALIDAÇÃO DO CONVIDADOR NO ACEITE ─────────────────────────────────
  const invitee3 = await mkPerson(T);
  await setFlags(fx.cu_id, { can_manage_members: true, can_publish_feed: true });
  const inv3 = (await inv.createInvitation({ tenantId: T, companyId: CO, invokerUserId: fx.user_id, inviteeGlobalUserId: invitee3.g, permissionKeys: ['publish_feed'], idempotencyKey: `idem-${randomUUID()}` } as never)) as { invitationId: string; token: string };
  await setFlags(fx.cu_id, { can_manage_company: true }); // convidador PERDE manage_members, mantém governança
  const c1 = await caught(() => inv.acceptInvitation({ tenantId: T, token: inv3.token, accepterUserId: invitee3.u } as never));
  check('C convidador que perde SÓ manage_members (mantém can_manage_company) → aceite FALHA (INVITER_LOST_AUTHORITY)', !c1.ok && (c1 as { code?: string }).code === 'INVITER_LOST_AUTHORITY', JSON.stringify(c1));

  // ── D — CEILING (suspendMember): caller = base member; targets separados ────
  const targetCommon = await mkMember(T, CO, { can_publish_feed: true });      // sem grant protegido
  const targetProt = await mkMember(T, CO, { can_manage_financial: true });    // grant PROTEGIDO
  const acted = { userId: fx.user_id, actorId: fx.page_actor_id };

  await setFlags(fx.cu_id, { can_manage_company: true }); // governance-only
  const d1 = await caught(() => cmd.suspendMember(T, CO, targetCommon.id, acted as never));
  check('D1 governance-only → NÃO administra membro COMUM (MANAGE_MEMBERS_REQUIRED)', !d1.ok && (d1 as { code?: string }).code === 'MANAGE_MEMBERS_REQUIRED', JSON.stringify(d1));

  await setFlags(fx.cu_id, { can_manage_members: true, can_publish_feed: true }); // manage_members (ceiling: target ⊆ caller)
  const d2 = await caught(() => cmd.suspendMember(T, CO, targetCommon.id, acted as never));
  check('D2 manage_members → administra membro COMUM (dentro do ceiling)', d2.ok, JSON.stringify(d2));

  await setFlags(fx.cu_id, { can_manage_members: true });
  const d3 = await caught(() => cmd.suspendMember(T, CO, targetProt.id, acted as never));
  check('D3 manage_members → NÃO administra alvo PROTEGIDO (ADMIN_CEILING_PROTECTED_TARGET)', !d3.ok && (d3 as { code?: string }).code === 'ADMIN_CEILING_PROTECTED_TARGET', JSON.stringify(d3));

  await setFlags(fx.cu_id, { can_manage_company: true });
  const d4 = await caught(() => cmd.suspendMember(T, CO, targetProt.id, acted as never));
  check('D4 governança → administra alvo PROTEGIDO (sem exigir manage_members)', d4.ok, JSON.stringify(d4));

  // ── E — §1.3 HTTP: autoria (canRepresentActor) ≠ autoridade (manage_members) ─
  const invitee4 = await mkPerson(T);
  const routes = (await import('@core/companies/company-access-invitations.routes')).default;
  async function inject(flags: Record<string, boolean>) {
    await setFlags(fx.cu_id, { ...flags, can_publish_feed: true });
    const app = Fastify();
    app.addHook('onRequest', async (req) => {
      (req as { user?: unknown }).user = { id: fx.user_id };
      (req as { tenant?: unknown }).tenant = { id: T };
      (req as { actionContext?: unknown }).actionContext = { actorId: fx.page_actor_id };
    });
    await app.register(routes as never, { prefix: '/companies' });
    await app.ready();
    const r = await app.inject({ method: 'POST', url: `/companies/${CO}/invitations`, payload: { inviteeGlobalUserId: invitee4.g, permissionKeys: ['publish_feed'], idempotencyKey: `idem-${randomUUID()}` } });
    await app.close();
    return r;
  }
  const eMM = await inject({ can_manage_members: true }); // membro fino
  const body = (() => { try { return eMM.json() as { code?: string }; } catch { return {}; } })();
  check('E membro fino (manage_members, sem manage_company): autoria PASSA e autoridade PASSA (não 403 authorship nem MANAGE_MEMBERS_REQUIRED)',
    body.code !== 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE' && body.code !== 'MANAGE_MEMBERS_REQUIRED' && eMM.statusCode < 500, `${eMM.statusCode} ${JSON.stringify(body)}`);
  const eGov = await inject({ can_manage_company: true }); // governance-only
  const bodyG = (() => { try { return eGov.json() as { code?: string }; } catch { return {}; } })();
  check('E governance-only: autoria PASSA (canRepresentActor true p/ membro ativo) mas autoridade NEGA (MANAGE_MEMBERS_REQUIRED)',
    bodyG.code === 'MANAGE_MEMBERS_REQUIRED', `${eGov.statusCode} ${JSON.stringify(bodyG)}`);

  // ── F — NÃO-REGRESSÃO ───────────────────────────────────────────────────────
  const isActive = Number((await pool.query(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='company_users' AND column_name='is_active'`)).rows[0].n);
  check('F1 is_active fisicamente inexistente em company_users', isActive === 0);
  const bank = (await pool.query(`SELECT (SELECT count(*) FROM bank_ledger)::int l,(SELECT count(*) FROM bank_transactions)::int t,(SELECT count(*) FROM bank_splits)::int s`)).rows[0] as { l: number; t: number; s: number };
  check('F2 Δbank=0 (ledger/tx/splits=0)', bank.l === 0 && bank.t === 0 && bank.s === 0, JSON.stringify(bank));
  const cat = Number((await pool.query(`SELECT count(*)::int n FROM company_permission_catalog WHERE permission_key IN ('manage_access','view_fiscal') OR subject_grant_column IN ('can_manage_access','can_view_fiscal')`)).rows[0].n);
  check('F3 catálogo NÃO contém manage_access/view_fiscal (não promulgados)', cat === 0);

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
