// backend/src/core/companies/company-membership-commands.service.ts
// DECISION-0189 (F4) — COMANDOS GOVERNADOS DE LIFECYCLE/GRANTS DE MEMBERSHIP.
//
// Substitui as mutações genéricas (PUT/DELETE /members) por comandos explícitos:
//   suspend · resume · revoke · alterGrants · transferGovernance · declareRelationship
//
// INVARIANTES (§4 da DECISION — anti-takeover):
//   • TODA operação serializa pelo LOCK da linha da EMPRESA (companies FOR UPDATE) — ordem
//     fixa de locks: (1) companies → (2) alvo company_users → (3) caller company_users;
//   • DOIS TETOS: grant ceiling (só concede grant que POSSUI) + administration ceiling
//     (só administra alvo cujo conjunto de grants ⊆ o seu; grants PROTEGIDOS exigem
//     company:manage_governance = can_manage_company);
//   • PROTEÇÃO DO ÚLTIMO GESTOR: a empresa NUNCA fica sem membro ATIVO com
//     can_manage_company — checada DENTRO da tx sob o lock (duas revogações concorrentes
//     não enxergam ambas "outro gestor");
//   • transferência de governança é ATÔMICA (concede ao novo + rebaixa o anterior na
//     MESMA tx, evento 'governance_transferred');
//   • suspensão CONGELA grants (status nega); revogação ZERA grants com snapshot no evento;
//   • DELETE físico inexiste; eventos append-only na MESMA tx; autoria dupla (user+actor).

import { getClientWithTenant } from '@core/database/pool';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { BadRequestError, NotFoundError } from '@core/errors';
import {
  COMPANY_GRANT_COLUMNS,
  PROTECTED_GRANT_COLUMNS,
  type CompanyGrantColumn,
} from '@core/authorization/company-policy-registry';
import { companyMemberRelationshipsRepository } from './company-member-relationships.repository';
import type { DelegationRelationshipType } from '@core/actor-delegation/actor-delegation.repository';
import type { TxQueryClient } from '@core/social/ports';

export interface CommandActor {
  /** principal humano autenticado (users.user_id) */
  userId: string;
  /** actor em cujo nome age (autoria dupla; representação já validada pela rota) */
  actorId: string | null;
}

interface MemberRow {
  id: string;
  company_id: string;
  global_user_id: string;
  member_status: string;
  role: string;
  can_manage_company: boolean;
  can_manage_financial: boolean;
  can_manage_members: boolean;
  can_manage_employees: boolean;
  can_manage_services: boolean;
  can_view_reports: boolean;
  can_view_financial: boolean;
  can_publish_feed: boolean;
  can_create_events: boolean;
  can_view_consolidated_inventory: boolean;
}

const GRANTS: readonly CompanyGrantColumn[] = COMPANY_GRANT_COLUMNS;

const err = (statusCode: number, code: string, message: string) =>
  Object.assign(new Error(message), { statusCode, code });

function grantSet(row: MemberRow): Set<CompanyGrantColumn> {
  return new Set(GRANTS.filter((g) => (row as unknown as Record<string, boolean>)[g] === true));
}

function isSubset(a: Set<CompanyGrantColumn>, b: Set<CompanyGrantColumn>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function hasProtected(row: MemberRow): boolean {
  return PROTECTED_GRANT_COLUMNS.some((g) => (row as unknown as Record<string, boolean>)[g] === true);
}

class CompanyMembershipCommandsService {
  /**
   * Núcleo transacional: locks na ORDEM FIXA (empresa → alvo → caller), autoridade do caller
   * resolvida DENTRO da tx (estado travado — R13), tetos, execução, evento, COMMIT.
   */
  private async withGovernanceTx<T>(
    tenantId: string,
    companyId: string,
    targetCompanyUserId: string | null,
    acted: CommandActor,
    fn: (ctx: {
      client: TxQueryClient;
      caller: MemberRow;
      target: MemberRow | null;
      callerGrants: Set<CompanyGrantColumn>;
    }) => Promise<T>
  ): Promise<T> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // (1) lock da EMPRESA — serializa TODA governança desta empresa
      const comp = await client.query(
        `SELECT company_id FROM companies WHERE tenant_id = $1 AND company_id = $2 FOR UPDATE`,
        [tenantId, companyId]
      );
      if (!comp.rows[0]) throw err(404, 'COMPANY_NOT_FOUND', 'Empresa não encontrada');

      const memberCols = `id, company_id, global_user_id, member_status, role,
        can_manage_company, can_manage_financial, can_manage_members, can_manage_employees,
        can_manage_services, can_view_reports, can_view_financial, can_publish_feed,
        can_create_events, can_view_consolidated_inventory`;

      // (2) lock do ALVO (quando houver)
      let target: MemberRow | null = null;
      if (targetCompanyUserId) {
        const t = await client.query(
          `SELECT ${memberCols} FROM company_users
            WHERE tenant_id = $1 AND id = $2 AND company_id = $3 FOR UPDATE`,
          [tenantId, targetCompanyUserId, companyId]
        );
        target = (t.rows[0] as MemberRow | undefined) ?? null;
        if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado nesta empresa');
      }

      // (3) lock do CALLER (membership do principal — autoridade travada na mesma tx)
      const callerGlobal = await resolveGlobalUserId(acted.userId, tenantId, client).catch((e) => {
        if (e instanceof Error && /resolveGlobalUserId/.test(e.message)) return null;
        throw e;
      });
      if (!callerGlobal) throw err(403, 'CALLER_IDENTITY_UNRESOLVED', 'Identidade do caller não resolvida');
      const c = await client.query(
        `SELECT ${memberCols} FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid FOR UPDATE`,
        [tenantId, companyId, callerGlobal]
      );
      const caller = (c.rows[0] as MemberRow | undefined) ?? null;
      if (!caller || caller.member_status !== 'active') {
        throw err(403, 'CALLER_NOT_ACTIVE_MEMBER', 'Caller não é membro ativo da empresa');
      }

      const result = await fn({ client, caller, target, callerGrants: grantSet(caller) });
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw e;
    } finally {
      client.release();
    }
  }

  /** teto de administração: quem pode ADMINISTRAR este alvo? */
  private assertAdministrationCeiling(caller: MemberRow, target: MemberRow): void {
    if (target && hasProtected(target)) {
      // detentor de grant protegido só é administrado por governança
      if (!caller.can_manage_company) {
        throw err(403, 'ADMIN_CEILING_PROTECTED_TARGET',
          'Administrar detentor de grant protegido exige company:manage_governance (DECISION-0189 §4.2)');
      }
      return;
    }
    if (caller.can_manage_company) return; // governança administra membros comuns
    if (!caller.can_manage_members) {
      throw err(403, 'MANAGE_MEMBERS_REQUIRED', 'Comando exige manage_members (terminal — sem fallback de role/ownership)');
    }
    // manage_members: alvo precisa caber no conjunto administrável do caller
    if (!isSubset(grantSet(target), grantSet(caller))) {
      throw err(403, 'ADMIN_CEILING_EXCEEDED',
        'Alvo possui grants fora do conjunto administrável do caller (target ⊆ caller — DECISION-0189 §4.2)');
    }
  }

  /** proteção do último gestor — roda SOB o lock da empresa */
  private async assertNotLastManager(
    client: TxQueryClient,
    tenantId: string,
    companyId: string,
    excludingCompanyUserId: string
  ): Promise<void> {
    const res = await client.query(
      `SELECT COUNT(*)::int AS n FROM company_users
        WHERE tenant_id = $1 AND company_id = $2 AND member_status = 'active'
          AND can_manage_company = true AND id <> $3`,
      [tenantId, companyId, excludingCompanyUserId]
    );
    if (Number((res.rows[0] as { n: number }).n) === 0) {
      throw err(409, 'COMPANY_WOULD_BE_ORPHANED',
        'A empresa não pode ficar sem gestor ativo (can_manage_company) — transfira a governança primeiro (DECISION-0189 §4.2)');
    }
  }

  private snapshotOf(row: MemberRow): Record<string, unknown> {
    const snap: Record<string, unknown> = { member_status: row.member_status, role: row.role };
    for (const g of GRANTS) snap[g] = (row as unknown as Record<string, boolean>)[g];
    return snap;
  }

  async suspendMember(
    tenantId: string, companyId: string, targetId: string, acted: CommandActor
  ): Promise<void> {
    await this.withGovernanceTx(tenantId, companyId, targetId, acted, async ({ client, caller, target }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'alvo ausente');
      if (target.member_status !== 'active') {
        throw err(409, 'MEMBER_NOT_ACTIVE', `Suspensão exige membro ativo (atual: ${target.member_status})`);
      }
      this.assertAdministrationCeiling(caller, target);
      if (target.can_manage_company) {
        await this.assertNotLastManager(client, tenantId, companyId, target.id);
      }
      // suspensão CONGELA grants (colunas intactas) — status nega toda autoridade (R17)
      await client.query(
        `UPDATE company_users SET member_status = 'suspended', updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, target.id]
      );
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId, companyId, companyUserId: target.id, eventType: 'suspended',
        snapshot: { before: this.snapshotOf(target) },
        actedByUserId: acted.userId, actedByActorId: acted.actorId,
      });
    });
  }

  async resumeMember(
    tenantId: string, companyId: string, targetId: string, acted: CommandActor
  ): Promise<void> {
    await this.withGovernanceTx(tenantId, companyId, targetId, acted, async ({ client, caller, target }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'alvo ausente');
      if (target.member_status !== 'suspended') {
        throw err(409, 'MEMBER_NOT_SUSPENDED', `Retomada exige membro suspenso (atual: ${target.member_status}) — revogado reentra por convite governado (R17)`);
      }
      this.assertAdministrationCeiling(caller, target);
      await client.query(
        `UPDATE company_users SET member_status = 'active', updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, target.id]
      );
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId, companyId, companyUserId: target.id, eventType: 'resumed',
        snapshot: { before: this.snapshotOf(target) },
        actedByUserId: acted.userId, actedByActorId: acted.actorId,
      });
    });
  }

  async revokeMember(
    tenantId: string, companyId: string, targetId: string, acted: CommandActor
  ): Promise<void> {
    await this.withGovernanceTx(tenantId, companyId, targetId, acted, async ({ client, caller, target }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'alvo ausente');
      if (target.member_status === 'revoked') {
        throw err(409, 'MEMBER_ALREADY_REVOKED', 'Membro já revogado');
      }
      this.assertAdministrationCeiling(caller, target);
      if (target.can_manage_company) {
        await this.assertNotLastManager(client, tenantId, companyId, target.id);
      }
      const zeroed = GRANTS.map((g) => `${g} = false`).join(', ');
      await client.query(
        `UPDATE company_users SET member_status = 'revoked', ${zeroed}, updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, target.id]
      );
      await client.query(
        `UPDATE company_member_relationships SET valid_to = now()
          WHERE tenant_id = $1 AND company_user_id = $2 AND valid_to IS NULL`,
        [tenantId, target.id]
      );
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId, companyId, companyUserId: target.id, eventType: 'revoked',
        snapshot: { before: this.snapshotOf(target) },
        actedByUserId: acted.userId, actedByActorId: acted.actorId,
      });
    });
  }

  /**
   * Altera grants do alvo — DOIS TETOS:
   *   • grants PROTEGIDOS: só governança concede/revoga;
   *   • caller manage_members: além do administration ceiling, só CONCEDE grant que POSSUI
   *     (grant ceiling) e só toca grants NÃO-protegidos.
   */
  async alterGrants(
    tenantId: string, companyId: string, targetId: string, acted: CommandActor,
    changes: Partial<Record<CompanyGrantColumn, boolean>>
  ): Promise<void> {
    const keys = Object.keys(changes) as CompanyGrantColumn[];
    if (keys.length === 0) throw err(400, 'NO_CHANGES', 'nenhum grant informado');
    for (const k of keys) {
      if (!GRANTS.includes(k)) throw err(400, 'UNKNOWN_GRANT', `grant fora da allowlist: ${k}`);
      if (typeof changes[k] !== 'boolean') throw err(400, 'INVALID_GRANT_VALUE', `valor não-booleano: ${k}`);
    }
    await this.withGovernanceTx(tenantId, companyId, targetId, acted, async ({ client, caller, target, callerGrants }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'alvo ausente');
      if (target.member_status !== 'active' && target.member_status !== 'suspended') {
        throw err(409, 'MEMBER_NOT_ALTERABLE', 'Grants só são alteráveis em membro ativo/suspenso — revogado reentra por convite (substituição integral)');
      }
      this.assertAdministrationCeiling(caller, target);

      const touchesProtected = keys.some((k) => PROTECTED_GRANT_COLUMNS.includes(k));
      if (touchesProtected && !caller.can_manage_company) {
        throw err(403, 'PROTECTED_GRANT_REQUIRES_GOVERNANCE',
          'Grants protegidos (governança/membros/financeiro-gestão) exigem company:manage_governance');
      }
      if (!caller.can_manage_company) {
        // grant ceiling: só concede o que possui
        for (const k of keys) {
          if (changes[k] === true && !callerGrants.has(k)) {
            throw err(403, 'GRANT_CEILING_EXCEEDED', `Caller não possui o grant que tenta conceder: ${k}`);
          }
        }
      }
      // último gestor: remover can_manage_company do alvo não pode órfã-la
      if (changes.can_manage_company === false && target.can_manage_company) {
        await this.assertNotLastManager(client, tenantId, companyId, target.id);
      }

      const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
      await client.query(
        `UPDATE company_users SET ${sets}, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, target.id, ...keys.map((k) => changes[k])]
      );
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId, companyId, companyUserId: target.id, eventType: 'grants_changed',
        snapshot: { before: this.snapshotOf(target) },
        details: { changes },
        actedByUserId: acted.userId, actedByActorId: acted.actorId,
      });
    });
  }

  /**
   * Transferência ATÔMICA de governança: destinatário ganha can_manage_company (e
   * can_manage_members); o cedente (caller) perde can_manage_company na MESMA tx.
   */
  async transferGovernance(
    tenantId: string, companyId: string, toCompanyUserId: string, acted: CommandActor
  ): Promise<void> {
    await this.withGovernanceTx(tenantId, companyId, toCompanyUserId, acted, async ({ client, caller, target }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'destinatário ausente');
      if (!caller.can_manage_company) {
        throw err(403, 'GOVERNANCE_REQUIRED', 'Só quem detém company:manage_governance transfere governança');
      }
      if (target.id === caller.id) throw err(400, 'SELF_TRANSFER', 'Transferência para si mesmo é no-op proibido');
      if (target.member_status !== 'active') {
        throw err(409, 'TARGET_NOT_ACTIVE', 'Destinatário precisa ser membro ATIVO');
      }
      await client.query(
        `UPDATE company_users SET can_manage_company = true, can_manage_members = true, updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, target.id]
      );
      await client.query(
        `UPDATE company_users SET can_manage_company = false, updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, caller.id]
      );
      // pós-condição sob o lock: segue existindo gestor ativo (o destinatário)
      const check = await client.query(
        `SELECT COUNT(*)::int AS n FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND member_status = 'active' AND can_manage_company = true`,
        [tenantId, companyId]
      );
      if (Number((check.rows[0] as { n: number }).n) === 0) {
        throw err(409, 'COMPANY_WOULD_BE_ORPHANED', 'transferência deixaria a empresa sem gestor');
      }
      for (const [cuId, dir] of [[target.id, 'received'], [caller.id, 'ceded']] as const) {
        await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
          tenantId, companyId, companyUserId: cuId, eventType: 'governance_transferred',
          snapshot: { before: this.snapshotOf(cuId === target.id ? target : caller) },
          details: { direction: dir, from: caller.id, to: target.id },
          actedByUserId: acted.userId, actedByActorId: acted.actorId,
        });
      }
    });
  }

  /** Declara o vínculo jurídico do membro (casa canônica) — manage_members/tetos. */
  async declareRelationship(
    tenantId: string, companyId: string, targetId: string, acted: CommandActor,
    relationshipType: DelegationRelationshipType | null,
    departmentKey?: string | null
  ): Promise<void> {
    await this.withGovernanceTx(tenantId, companyId, targetId, acted, async ({ client, caller, target }) => {
      if (!target) throw err(404, 'MEMBER_NOT_FOUND', 'alvo ausente');
      this.assertAdministrationCeiling(caller, target);
      const rel = await companyMemberRelationshipsRepository.openRelationshipOnClient(client, {
        tenantId, companyId, companyUserId: target.id,
        relationshipType, departmentKey: departmentKey ?? null,
        source: 'declared',
        declaredByUserId: acted.userId, declaredByActorId: acted.actorId,
      });
      if (rel.changed) {
        await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
          tenantId, companyId, companyUserId: target.id, eventType: 'relationship_declared',
          details: { relationship_id: rel.relationshipId, relationship_type: relationshipType, department_key: departmentKey ?? null },
          actedByUserId: acted.userId, actedByActorId: acted.actorId,
        });
      }
    });
  }
}

export const companyMembershipCommandsService = new CompanyMembershipCommandsService();
export { err as membershipCommandError };
export type { MemberRow };

// util exportado para a F5 (aceite): checagem de "não deixa órfã" reutilizável
export async function activeManagerCountOnClient(
  client: TxQueryClient,
  tenantId: string,
  companyId: string
): Promise<number> {
  const res = await client.query(
    `SELECT COUNT(*)::int AS n FROM company_users
      WHERE tenant_id = $1 AND company_id = $2 AND member_status = 'active' AND can_manage_company = true`,
    [tenantId, companyId]
  );
  return Number((res.rows[0] as { n: number }).n);
}
