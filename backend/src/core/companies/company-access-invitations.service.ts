// backend/src/core/companies/company-access-invitations.service.ts
// DECISION-0189 (F5) — CONVITE E ACEITE CANÔNICOS DE MEMBERSHIP (§8).
//
// O ACEITE deste serviço é (junto com o bootstrap da empresa) o ÚNICO caminho que cria
// membership 'active' (R17). Invariantes materializadas:
//   • convite vinculado IMUTAVELMENTE ao invitee pela IDENTITY (global_user_id — nunca actor);
//   • token 256-bit (randomBytes(32)), armazenado SÓ como SHA-256, USO ÚNICO, expiração por
//     NOW() DENTRO da tx (worker/lazy só materializa 'expired' — nunca é condição de segurança),
//     NUNCA logado em claro;
//   • idempotência R14: chave OPACA do cliente + request_hash canônico separado; mesma chave+
//     mesmo hash → resultado original (sem re-emitir token); mesma chave+hash≠ → 409;
//   • DOIS TETOS (§4): requested ⊆ convidáveis(catálogo VIGENTE) ⊆ grants do CONVIDADOR —
//     revalidados NA TRANSAÇÃO DO ACEITE (FOR UPDATE; convidador suspenso/revogado/rebaixado
//     → aceite falha); catálogo revalidado por versão (chave não-convidável → rejeita, reemitir);
//   • locks na ORDEM FIXA R13: empresa → convite → membership do convidador → membership do
//     convidado; reentrada SÓ de 'revoked' com SUBSTITUIÇÃO INTEGRAL do conjunto;
//   • permissões materializadas EXATAMENTE das linhas persistidas — o body do aceite NUNCA
//     altera grants; membership + vínculo jurídico + evento + consumo do token na MESMA tx;
//   • NENHUMA actor_delegation de membership (exclusividade §6.3 vigiada por trigger).

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getClientWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import {
  COMPANY_CATALOG_KEYS,
  COMPANY_PERMISSION_CATALOG_VERSION,
  companyCatalogRows,
  type CompanyGrantColumn,
} from '@core/authorization/company-policy-registry';
import type { PermissionKey } from '@core/authorization/permission-keys';
import { companyMemberRelationshipsRepository } from './company-member-relationships.repository';
import type { TxQueryClient } from '@core/social/ports';

const err = (statusCode: number, code: string, message: string) =>
  Object.assign(new Error(message), { statusCode, code });

const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

/** hash canônico do payload (R14): campos ordenados, chaves de permissão ordenadas. */
export function canonicalInvitationRequestHash(input: {
  companyId: string;
  inviteeGlobalUserId: string;
  permissionKeys: string[];
}): string {
  return sha256(
    JSON.stringify({
      companyId: input.companyId,
      inviteeGlobalUserId: input.inviteeGlobalUserId,
      permissionKeys: [...input.permissionKeys].sort(),
    })
  );
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const MAX_PERMISSIONS_PER_INVITE = COMPANY_CATALOG_KEYS.length; // limite físico = catálogo

interface CallerMembership {
  id: string;
  member_status: string;
  can_manage_company: boolean;
  can_manage_members: boolean;
  grants: Record<string, boolean>;
}

const GRANT_COLUMNS_SQL = `can_manage_company, can_manage_members, can_manage_financial,
  can_view_financial, can_publish_feed, can_create_events, can_manage_employees,
  can_manage_services, can_view_reports`;

async function lockCompany(client: TxQueryClient, tenantId: string, companyId: string): Promise<void> {
  const res = await client.query(
    `SELECT company_id FROM companies WHERE tenant_id = $1 AND company_id = $2 FOR UPDATE`,
    [tenantId, companyId]
  );
  if (!res.rows[0]) throw err(404, 'COMPANY_NOT_FOUND', 'Empresa não encontrada');
}

async function lockCallerMembership(
  client: TxQueryClient,
  tenantId: string,
  companyId: string,
  userId: string
): Promise<{ globalUserId: string; membership: CallerMembership }> {
  const globalUserId = await resolveGlobalUserId(userId, tenantId, client).catch((e) => {
    if (e instanceof Error && /resolveGlobalUserId/.test(e.message)) return null;
    throw e;
  });
  if (!globalUserId) throw err(403, 'CALLER_IDENTITY_UNRESOLVED', 'Identidade do caller não resolvida');
  const res = await client.query(
    `SELECT id, member_status, ${GRANT_COLUMNS_SQL} FROM company_users
      WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid FOR UPDATE`,
    [tenantId, companyId, globalUserId]
  );
  const row = res.rows[0] as (Record<string, unknown> & { id: string; member_status: string }) | undefined;
  if (!row || row.member_status !== 'active') {
    throw err(403, 'CALLER_NOT_ACTIVE_MEMBER', 'Caller não é membro ativo da empresa');
  }
  return {
    globalUserId,
    membership: {
      id: row.id,
      member_status: row.member_status,
      can_manage_company: row.can_manage_company === true,
      can_manage_members: row.can_manage_members === true,
      grants: row as unknown as Record<string, boolean>,
    },
  };
}

/** teto de concessão (§4.1): requested ⊆ convidáveis do catálogo VIGENTE ⊆ grants do concedente. */
function assertGrantCeiling(
  permissionKeys: string[],
  caller: CallerMembership
): Array<{ key: PermissionKey; column: CompanyGrantColumn }> {
  if (permissionKeys.length === 0) return [];
  if (permissionKeys.length > MAX_PERMISSIONS_PER_INVITE) {
    throw err(400, 'TOO_MANY_PERMISSIONS', `máximo ${MAX_PERMISSIONS_PER_INVITE} permissões por convite`);
  }
  const rows = companyCatalogRows();
  const byKey = new Map(rows.map((r) => [r.permissionKey as string, r]));
  const out: Array<{ key: PermissionKey; column: CompanyGrantColumn }> = [];
  const seen = new Set<string>();
  for (const k of permissionKeys) {
    if (seen.has(k)) throw err(400, 'DUPLICATE_PERMISSION', `permissão duplicada: ${k}`);
    seen.add(k);
    const row = byKey.get(k);
    if (!row) throw err(400, 'UNKNOWN_PERMISSION', `permissão fora do catálogo: ${k}`);
    if (!row.invitable || row.protected) {
      throw err(403, 'PERMISSION_NOT_INVITABLE', `permissão não-convidável (protegida/fora do convite V1): ${k}`);
    }
    // grant ceiling: o convidador só concede o que POSSUI (governança não é bypass do convite —
    // até quem tem can_manage_company só convida com permissões que ele mesmo carrega)
    if (caller.grants[row.subjectGrantColumn] !== true) {
      throw err(403, 'GRANT_CEILING_EXCEEDED', `convidador não possui a permissão que tenta conceder: ${k}`);
    }
    out.push({ key: row.permissionKey, column: row.subjectGrantColumn });
  }
  return out;
}

class CompanyAccessInvitationsService {
  /**
   * Cria convite (manage_members + teto de concessão + idempotência R14 + unicidade de pendente).
   * Retorna o TOKEN EM CLARO UMA ÚNICA VEZ (nunca persistido/logado em claro).
   */
  async createInvitation(input: {
    tenantId: string;
    companyId: string;
    invokerUserId: string;
    invokerActorId: string | null;
    inviteeGlobalUserId: string;
    permissionKeys: string[];
    idempotencyKey: string;
  }): Promise<{
    invitationId: string;
    status: string;
    expiresAt: string;
    token: string | null;
    idempotentReplay: boolean;
  }> {
    if (!/^[\w.:-]{8,128}$/.test(input.idempotencyKey)) {
      throw err(400, 'INVALID_IDEMPOTENCY_KEY', 'idempotencyKey opaca de 8..128 chars é obrigatória (R14)');
    }
    const requestHash = canonicalInvitationRequestHash({
      companyId: input.companyId,
      inviteeGlobalUserId: input.inviteeGlobalUserId,
      permissionKeys: input.permissionKeys,
    });

    const client = await getClientWithTenant(input.tenantId);
    try {
      await client.query('BEGIN');
      await lockCompany(client, input.tenantId, input.companyId);
      const { globalUserId: inviterGlobal, membership: caller } = await lockCallerMembership(
        client, input.tenantId, input.companyId, input.invokerUserId
      );
      // 🔒 DECISION-0189D: gate EXATO manage_members (terminal) — SEM fallback de
      // can_manage_company/role/is_primary/representação. Convite = lifecycle de membership comum.
      if (!caller.can_manage_members) {
        throw err(403, 'MANAGE_MEMBERS_REQUIRED', 'Convidar exige manage_members (terminal — sem fallback de governança)');
      }
      // autoelevação: Identity, nunca actor (CHECK físico também protege)
      if (inviterGlobal === input.inviteeGlobalUserId) {
        throw err(403, 'SELF_INVITE_FORBIDDEN', 'Convidador e convidado são a MESMA Identity (R17)');
      }

      // idempotência R14 (dentro da tx, após o lock da empresa)
      const existing = await client.query(
        `SELECT id, status, request_hash, expires_at FROM company_access_invitations
          WHERE tenant_id = $1 AND inviter_global_user_id = $2::uuid AND idempotency_key = $3
          FOR UPDATE`,
        [input.tenantId, inviterGlobal, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        const row = existing.rows[0] as { id: string; status: string; request_hash: string; expires_at: Date };
        const same = timingSafeEqual(Buffer.from(row.request_hash, 'hex'), Buffer.from(requestHash, 'hex'));
        if (!same) {
          throw err(409, 'IDEMPOTENCY_KEY_REUSED', 'mesma idempotencyKey com payload DIFERENTE (R14)');
        }
        await client.query('COMMIT');
        return {
          invitationId: row.id,
          status: row.status,
          expiresAt: row.expires_at.toISOString(),
          token: null, // replay idempotente NUNCA re-emite o token (hash-only)
          idempotentReplay: true,
        };
      }

      // teto de concessão + resolução das colunas (allowlist tipada)
      const resolved = assertGrantCeiling(input.permissionKeys, caller);

      // estado do alvo (R17/§8.5) — sob lock
      const invitee = await client.query(
        `SELECT id, member_status FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid FOR UPDATE`,
        [input.tenantId, input.companyId, input.inviteeGlobalUserId]
      );
      const inviteeRow = invitee.rows[0] as { id: string; member_status: string } | undefined;
      if (inviteeRow?.member_status === 'active') {
        throw err(409, 'TARGET_ALREADY_ACTIVE', 'Alvo já é membro ativo — convite rejeitado (R17)');
      }
      if (inviteeRow?.member_status === 'suspended') {
        throw err(409, 'TARGET_SUSPENDED_USE_RESUME', 'Alvo suspenso — retomada é comando explícito, nunca convite (R17)');
      }
      // 'revoked' → reentrada governada via aceite (substituição integral)

      // Identity do convidado precisa existir (lookup público já validou; revalida server-side)
      const gu = await client.query(
        `SELECT global_user_id FROM global_users WHERE global_user_id = $1::uuid`,
        [input.inviteeGlobalUserId]
      );
      if (!gu.rows[0]) throw err(404, 'INVITEE_NOT_FOUND', 'Identity do convidado não encontrada');

      // token 256-bit — em claro SÓ no retorno; NUNCA em log
      const token = randomBytes(32).toString('hex');
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

      let invitationId: string;
      try {
        const ins = await client.query(
          `INSERT INTO company_access_invitations
             (tenant_id, company_id, inviter_global_user_id, invitee_global_user_id,
              token_hash, idempotency_key, request_hash, catalog_version, status, expires_at,
              created_by_user_id, created_by_actor_id)
           VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6,$7,$8,'pending',$9,$10,$11)
           RETURNING id`,
          [
            input.tenantId, input.companyId, inviterGlobal, input.inviteeGlobalUserId,
            tokenHash, input.idempotencyKey, requestHash, COMPANY_PERMISSION_CATALOG_VERSION,
            expiresAt, input.invokerUserId, input.invokerActorId,
          ]
        );
        invitationId = (ins.rows[0] as { id: string }).id;
      } catch (e) {
        if ((e as { code?: string }).code === '23505') {
          throw err(409, 'PENDING_INVITATION_EXISTS', 'Já existe convite pendente para este convidado nesta empresa');
        }
        throw e;
      }
      for (const p of resolved) {
        await client.query(
          `INSERT INTO company_access_invitation_permissions
             (tenant_id, invitation_id, permission_key, catalog_version)
           VALUES ($1,$2,$3,$4)`,
          [input.tenantId, invitationId, p.key, COMPANY_PERMISSION_CATALOG_VERSION]
        );
      }

      await client.query('COMMIT');
      return {
        invitationId,
        status: 'pending',
        expiresAt: expiresAt.toISOString(),
        token,
        idempotentReplay: false,
      };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * ACEITE CANÔNICO (R17 — único criador de 'active' fora do bootstrap).
   * Locks R13: empresa → convite → membership do CONVIDADOR → membership do CONVIDADO.
   */
  async acceptInvitation(input: {
    tenantId: string;
    token: string;
    accepterUserId: string;
  }): Promise<{ companyId: string; memberId: string; reentry: boolean; grantedKeys: string[] }> {
    if (!/^[0-9a-f]{64}$/.test(input.token)) {
      throw err(400, 'INVALID_TOKEN_FORMAT', 'token inválido');
    }
    const tokenHash = sha256(input.token);
    const client = await getClientWithTenant(input.tenantId);
    try {
      await client.query('BEGIN');

      // localizar o convite pelo hash (índice único) — depois travar na ORDEM fixa
      const pre = await client.query(
        `SELECT id, company_id FROM company_access_invitations
          WHERE tenant_id = $1 AND token_hash = $2 LIMIT 1`,
        [input.tenantId, tokenHash]
      );
      const preRow = pre.rows[0] as { id: string; company_id: string } | undefined;
      // resposta UNIFORME (não distinguir inexistente/expirado/revogado/reusado — anti-oráculo)
      const UNIFORM = () => err(404, 'INVITATION_NOT_FOUND', 'Convite não encontrado ou não aceitável');
      if (!preRow) throw UNIFORM();

      // (1) empresa
      await lockCompany(client, input.tenantId, preRow.company_id);
      // (2) convite
      const inv = await client.query(
        `SELECT id, company_id, inviter_global_user_id, invitee_global_user_id, status,
                expires_at, catalog_version
           FROM company_access_invitations
          WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [input.tenantId, preRow.id]
      );
      const invitation = inv.rows[0] as {
        id: string; company_id: string; inviter_global_user_id: string;
        invitee_global_user_id: string; status: string; expires_at: Date; catalog_version: number;
      };
      if (invitation.status !== 'pending') throw UNIFORM();
      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        // lazy-expire materializa o estado; a SEGURANÇA é este NOW() na tx, não worker
        await client.query(
          `UPDATE company_access_invitations SET status='expired', updated_at=now() WHERE tenant_id=$1 AND id=$2`,
          [input.tenantId, invitation.id]
        );
        await client.query('COMMIT');
        throw UNIFORM();
      }

      // caller ≡ invitee pela IDENTITY
      const accepterGlobal = await resolveGlobalUserId(input.accepterUserId, input.tenantId, client).catch((e) => {
        if (e instanceof Error && /resolveGlobalUserId/.test(e.message)) return null;
        throw e;
      });
      if (!accepterGlobal || accepterGlobal !== invitation.invitee_global_user_id) {
        throw err(403, 'NOT_THE_INVITEE', 'O aceite é exclusivo da Identity convidada');
      }

      // (3) membership do CONVIDADOR — precisa seguir ATIVO com poder de conceder (tetos REVALIDADOS)
      const inviterRes = await client.query(
        `SELECT id, member_status, ${GRANT_COLUMNS_SQL} FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid FOR UPDATE`,
        [input.tenantId, invitation.company_id, invitation.inviter_global_user_id]
      );
      const inviter = inviterRes.rows[0] as (Record<string, unknown> & { member_status: string }) | undefined;
      if (!inviter || inviter.member_status !== 'active') {
        throw err(409, 'INVITER_NO_LONGER_ACTIVE', 'Convidador não é mais membro ativo — aceite falha (§4.1)');
      }
      // 🔒 DECISION-0189D: revalidação EXATA por manage_members — sem fallback de can_manage_company.
      if (inviter.can_manage_members !== true) {
        throw err(409, 'INVITER_LOST_AUTHORITY', 'Convidador perdeu manage_members — aceite falha (§4.1)');
      }

      // permissões persistidas (IMUTÁVEIS) + revalidação de catálogo (R16)
      const perms = await client.query(
        `SELECT p.permission_key, p.catalog_version, c.subject_grant_column, c.invitable, c.protected, c.status AS catalog_status
           FROM company_access_invitation_permissions p
           JOIN company_permission_catalog c
             ON c.permission_key = p.permission_key AND c.catalog_version = p.catalog_version
          WHERE p.tenant_id = $1 AND p.invitation_id = $2
          ORDER BY p.permission_key`,
        [input.tenantId, invitation.id]
      );
      const permRows = perms.rows as Array<{
        permission_key: string; catalog_version: number; subject_grant_column: string;
        invitable: boolean; protected: boolean; catalog_status: string;
      }>;
      if (invitation.catalog_version !== COMPANY_PERMISSION_CATALOG_VERSION) {
        throw err(409, 'CATALOG_VERSION_CHANGED', 'Catálogo mudou desde a emissão — convite deve ser reemitido (R16)');
      }
      const columns: string[] = [];
      for (const p of permRows) {
        if (!p.invitable || p.protected || p.catalog_status !== 'active') {
          throw err(409, 'PERMISSION_NO_LONGER_INVITABLE', `permissão deixou de ser convidável: ${p.permission_key} (R16)`);
        }
        // teto do convidador REVALIDADO agora
        if ((inviter as Record<string, unknown>)[p.subject_grant_column] !== true) {
          throw err(409, 'INVITER_CEILING_LOST', `convidador não possui mais: ${p.permission_key} (§4.1)`);
        }
        if (!/^can_[a-z_]+$/.test(p.subject_grant_column)) {
          throw err(500, 'CATALOG_CORRUPTED', 'coluna de grant inválida no catálogo');
        }
        columns.push(p.subject_grant_column);
      }

      // (4) membership do CONVIDADO
      const tgtRes = await client.query(
        `SELECT id, member_status, ${GRANT_COLUMNS_SQL} FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid FOR UPDATE`,
        [input.tenantId, invitation.company_id, invitation.invitee_global_user_id]
      );
      const target = tgtRes.rows[0] as (Record<string, unknown> & { id: string; member_status: string }) | undefined;
      if (target && target.member_status === 'active') {
        throw err(409, 'TARGET_ALREADY_ACTIVE', 'Já é membro ativo (R17)');
      }
      if (target && target.member_status === 'suspended') {
        throw err(409, 'TARGET_SUSPENDED_USE_RESUME', 'Membro suspenso — retomada é comando, não aceite (R17)');
      }

      const ALL_GRANTS: readonly string[] = [
        'can_manage_company', 'can_manage_members', 'can_manage_financial', 'can_view_financial',
        'can_publish_feed', 'can_create_events', 'can_manage_employees', 'can_manage_services',
        'can_view_reports', 'can_view_consolidated_inventory',
      ];
      let memberId: string;
      let reentry = false;
      if (!target) {
        const setCols = columns.length ? ', ' + columns.join(', ') : '';
        const setVals = columns.length ? ', ' + columns.map(() => 'true').join(', ') : '';
        const ins = await client.query(
          `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status${setCols})
           VALUES ($1,$2,$3::uuid,'member','active'${setVals})
           RETURNING id`,
          [input.tenantId, invitation.company_id, invitation.invitee_global_user_id]
        );
        memberId = (ins.rows[0] as { id: string }).id;
      } else {
        // REENTRADA governada: EXCLUSIVAMENTE de 'revoked', com SUBSTITUIÇÃO INTEGRAL (R17)
        reentry = true;
        const zero = ALL_GRANTS.filter((g) => !columns.includes(g)).map((g) => `${g} = false`).join(', ');
        const grantSet = columns.length ? ', ' + columns.map((c) => `${c} = true`).join(', ') : '';
        const upd = await client.query(
          `UPDATE company_users
              SET member_status = 'active', role = 'member', ${zero}${grantSet}, updated_at = now()
            WHERE tenant_id = $1 AND id = $2 AND member_status = 'revoked'
            RETURNING id`,
          [input.tenantId, target.id]
        );
        if (!upd.rows[0]) {
          throw err(409, 'REENTRY_ONLY_FROM_REVOKED', 'Reentrada só de revoked (R17)');
        }
        memberId = target.id;
      }

      // vínculo jurídico + evento na MESMA tx (autoria dupla = convidado que aceita)
      await companyMemberRelationshipsRepository.openRelationshipOnClient(client, {
        tenantId: input.tenantId,
        companyId: invitation.company_id,
        companyUserId: memberId,
        relationshipType: null,
        source: 'invite_accept',
        declaredByUserId: input.accepterUserId,
      });
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId: input.tenantId,
        companyId: invitation.company_id,
        companyUserId: memberId,
        eventType: reentry ? 'reentered' : 'invited_accepted',
        snapshot: reentry && target ? { before: target } : null,
        details: {
          invitation_id: invitation.id,
          permission_keys: permRows.map((p) => p.permission_key),
          catalog_version: invitation.catalog_version,
        },
        actedByUserId: input.accepterUserId,
      });

      // consumo do token na MESMA tx (single-use)
      await client.query(
        `UPDATE company_access_invitations
            SET status = 'accepted', accepted_at = now(), updated_at = now()
          WHERE tenant_id = $1 AND id = $2 AND status = 'pending'`,
        [input.tenantId, invitation.id]
      );

      await client.query('COMMIT');
      return {
        companyId: invitation.company_id,
        memberId,
        reentry,
        grantedKeys: permRows.map((p) => p.permission_key),
      };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw e;
    } finally {
      client.release();
    }
  }

  /** Recusa pelo CONVIDADO (histórico preservado; nunca cria autoridade). */
  async declineInvitation(input: { tenantId: string; token: string; userId: string }): Promise<void> {
    if (!/^[0-9a-f]{64}$/.test(input.token)) throw err(400, 'INVALID_TOKEN_FORMAT', 'token inválido');
    const tokenHash = sha256(input.token);
    const client = await getClientWithTenant(input.tenantId);
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT id, invitee_global_user_id, status FROM company_access_invitations
          WHERE tenant_id = $1 AND token_hash = $2 FOR UPDATE`,
        [input.tenantId, tokenHash]
      );
      const row = res.rows[0] as { id: string; invitee_global_user_id: string; status: string } | undefined;
      const UNIFORM = () => err(404, 'INVITATION_NOT_FOUND', 'Convite não encontrado ou não aceitável');
      if (!row || row.status !== 'pending') throw UNIFORM();
      const g = await resolveGlobalUserId(input.userId, input.tenantId, client).catch(() => null);
      if (!g || g !== row.invitee_global_user_id) throw err(403, 'NOT_THE_INVITEE', 'Recusa é exclusiva da Identity convidada');
      await client.query(
        `UPDATE company_access_invitations SET status='declined', declined_at=now(), updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [input.tenantId, row.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw e;
    } finally {
      client.release();
    }
  }

  /** Revogação pelo gestor (manage_members) — histórico preservado. */
  async revokeInvitation(input: {
    tenantId: string; companyId: string; invitationId: string; invokerUserId: string;
  }): Promise<void> {
    const client = await getClientWithTenant(input.tenantId);
    try {
      await client.query('BEGIN');
      await lockCompany(client, input.tenantId, input.companyId);
      const { membership: caller } = await lockCallerMembership(client, input.tenantId, input.companyId, input.invokerUserId);
      // 🔒 DECISION-0189D: gate EXATO manage_members — sem fallback de can_manage_company.
      if (!caller.can_manage_members) {
        throw err(403, 'MANAGE_MEMBERS_REQUIRED', 'Revogar convite exige manage_members (terminal — sem fallback de governança)');
      }
      const res = await client.query(
        `UPDATE company_access_invitations SET status='revoked', revoked_at=now(), updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND company_id=$3 AND status='pending'
          RETURNING id`,
        [input.tenantId, input.invitationId, input.companyId]
      );
      if (!res.rows[0]) throw err(404, 'INVITATION_NOT_FOUND', 'Convite não encontrado ou não pendente');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw e;
    } finally {
      client.release();
    }
  }

  /** Lista convites da empresa (gestão). Nunca expõe token_hash. */
  async listInvitations(tenantId: string, companyId: string): Promise<Array<Record<string, unknown>>> {
    return runQueriesWithTenant(
      tenantId,
      `SELECT i.id, i.company_id, i.invitee_global_user_id, i.status, i.catalog_version,
              i.expires_at, i.created_at, i.accepted_at, i.declined_at, i.revoked_at,
              COALESCE(json_agg(p.permission_key ORDER BY p.permission_key)
                       FILTER (WHERE p.permission_key IS NOT NULL), '[]') AS permission_keys
         FROM company_access_invitations i
         LEFT JOIN company_access_invitation_permissions p
           ON p.invitation_id = i.id AND p.tenant_id = i.tenant_id
        WHERE i.tenant_id = $1 AND i.company_id = $2
        GROUP BY i.id
        ORDER BY i.created_at DESC`,
      [tenantId, companyId]
    );
  }
}

export const companyAccessInvitationsService = new CompanyAccessInvitationsService();
