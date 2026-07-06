// backend/src/core/actor-capabilities/actor-capabilities.service.ts
// 2026-05-18 P1 — Capability Resolver MVP (read-only aggregation)
//
// Resolve capabilities efetivas de um actor compondo:
//   - actor_type (tipo soberano)
//   - company_users.role + permissions (quando actor é page)
//   - actor_delegations ativas
//
// Princípio operacional: NÃO altera soberania. Apenas agrega.
// Resultado é input UX para frontend priorizar, não para esconder authority.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { actorDelegationRepository } from '@core/actor-delegation/actor-delegation.repository';
import type {
  ActorCapabilitiesResponse,
  ActorCapabilitiesDelegation,
  CapabilityKey,
} from './actor-capabilities.types';

/**
 * Capabilities base por actor_type. Lista declarativa pequena — não inflar.
 * Convenção: `<domain>.<action>`. Lowercase. Sem espaços.
 */
const BASE_CAPABILITIES_BY_TYPE: Record<string, CapabilityKey[]> = {
  user: [
    'actor.read',
    'actor.post',
    'profile.edit',
    'bank.transfer_p2p',
    'bank.view_balance',
    'event.rsvp',
    'event.create',
    'group.join',
    'group.contribute',
    'marketplace.buy',
    'service.book',
  ],
  page: [
    'actor.read',
    'actor.post',
    'bank.view_balance',
    'event.create',
    'marketplace.sell',
    'marketplace.buy',
    'service.offer',
  ],
  group: [
    'actor.read',
    'group.contribute',
    'group.vote',
    'event.attend',
    'event.create',
  ],
  channel: [
    'actor.read',
    'channel.publish',
    'event.create',
    'marketplace.promote',
  ],
};

/**
 * Mapeamento de coluna SSOT `company_users.can_*` (BOOLEAN) → capability key.
 *
 * IMPORTANTE — Soberania: `company_users.can_*` é SSOT material das permissões
 * de empresa (migration 20260530520500_add_company_users_rbac_columns.sql).
 * Este resolver LÊ o SSOT, nunca infere via `role`. Role é apenas label
 * descritivo (owner/director/manager/employee).
 *
 * Capability base `company.post` é sempre incluída para qualquer member ativo
 * (post em nome da empresa é direito básico de vínculo).
 */
const COMPANY_PERMISSION_TO_CAPABILITY: Array<{ column: string; capability: CapabilityKey }> = [
  { column: 'can_manage_company', capability: 'company.manage_company' },
  { column: 'can_manage_financial', capability: 'company.manage_financial' },
  { column: 'can_manage_employees', capability: 'company.manage_employees' },
  { column: 'can_view_reports', capability: 'company.view_reports' },
  { column: 'can_manage_services', capability: 'company.manage_services' },
];

interface ActorRow {
  actor_id: string;
  actor_type: string;
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
}

class ActorCapabilitiesService {
  /**
   * Resolve capabilities efetivas para um actor.
   *
   * Valida que o user autenticado tem authority sobre o actor:
   *   - actor.user_id === authenticatedUserId  (self)
   *   - OU exists company_users row para (authenticatedUserId, actor.company_id)
   *   - OU exists actor_delegation ativa (user_actor_id do auth → institutional)
   *
   * Se não autorizado, retorna null (caller responde 403).
   */
  async resolveForUser(
    tenantId: string,
    actorId: string,
    authenticatedUserId: string
  ): Promise<ActorCapabilitiesResponse | null> {
    // 1. Carregar actor
    const actor = await runQueryWithTenant<ActorRow>(
      tenantId,
      `
      SELECT actor_id, actor_type, user_id, company_id, group_id
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!actor) {
      return null;
    }

    // 2. Verificar autorização do user sobre este actor
    const authorized = await this.isAuthorizedOver(
      tenantId,
      actor,
      authenticatedUserId
    );
    if (!authorized) {
      return null;
    }

    // 3. Compor capabilities base por actor_type
    const baseCapabilities = [
      ...(BASE_CAPABILITIES_BY_TYPE[actor.actor_type] ?? []),
    ];

    // 4. Adicionar capabilities lendo company_users.can_* (SSOT) — apenas para page
    let roleOnActor: string | null = null;
    if (actor.actor_type === 'page' && actor.company_id) {
      const membership = await this.resolveCompanyMembershipForUser(
        tenantId,
        actor.company_id,
        authenticatedUserId
      );
      if (membership) {
        roleOnActor = membership.role;
        // company.post é direito base de qualquer vínculo ativo
        if (!baseCapabilities.includes('company.post')) {
          baseCapabilities.push('company.post');
        }
        // Lê SSOT can_* fields, não infere via role
        for (const { column, capability } of COMPANY_PERMISSION_TO_CAPABILITY) {
          if ((membership as any)[column] === true && !baseCapabilities.includes(capability)) {
            baseCapabilities.push(capability);
          }
        }
      }
    } else if (actor.actor_type === 'user' && actor.user_id === authenticatedUserId) {
      roleOnActor = 'self';
    }

    // 5. Buscar delegações ativas
    // Para 'user': delegações em que este actor é user_actor_id (delega para institucionais)
    // Para 'page'/'group'/'channel': delegações em que este actor é institutional_actor_id
    let delegations: ActorCapabilitiesDelegation[] = [];
    if (actor.actor_type === 'user') {
      const dels = await actorDelegationRepository.findActiveByUserActor(
        tenantId,
        actorId
      );
      delegations = dels.map((d) => ({
        institutionalActorId: d.institutionalActorId,
        scopes: d.scopes,
        isTransitive: d.isTransitive,
        expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
        relationshipType: d.relationshipType ?? null, // R2.3 — projeta o vínculo jurídico governado
      }));
    } else {
      // Para institucional: listar delegações received (user_actor_ids que delegaram a ele)
      const received = await runQueriesWithTenant<{
        user_actor_id: string;
        scopes_json: any;
        is_transitive: boolean;
        expires_at: Date | null;
        relationship_type: string | null;
      }>(
        tenantId,
        `
        SELECT user_actor_id, scopes_json, is_transitive, expires_at, relationship_type
        FROM actor_delegations
        WHERE tenant_id = $1
          AND institutional_actor_id = $2
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        `,
        [tenantId, actorId]
      );
      delegations = received.map((r) => ({
        institutionalActorId: r.user_actor_id, // inverte: quem delegou
        scopes: r.scopes_json || [],
        isTransitive: r.is_transitive,
        expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
        relationshipType: r.relationship_type ?? null, // R2.3 — projeta o vínculo jurídico governado
      }));
    }

    return {
      actorId,
      actorType: actor.actor_type as 'user' | 'page' | 'group' | 'channel',
      capabilities: baseCapabilities,
      roleOnActor,
      delegations,
      resolvedAt: new Date().toISOString(),
      source: 'mvp-readonly-aggregation',
    };
  }

  /**
   * Verifica se o user autenticado tem authority sobre o actor.
   * Retorna true se:
   *   - actor é user e actor.user_id === authenticatedUserId
   *   - actor é page e existe company_users.is_active para (user, company)
   *   - actor é group e (futuro: group_members) — hoje só via delegation
   *   - existe actor_delegation ativa para o user
   */
  private async isAuthorizedOver(
    tenantId: string,
    actor: ActorRow,
    authenticatedUserId: string
  ): Promise<boolean> {
    // Self
    if (actor.actor_type === 'user' && actor.user_id === authenticatedUserId) {
      return true;
    }

    // Page (empresa): via company_users
    if (actor.actor_type === 'page' && actor.company_id) {
      const membership = await this.resolveCompanyMembershipForUser(
        tenantId,
        actor.company_id,
        authenticatedUserId
      );
      if (membership) return true;
    }

    // Delegation (para qualquer tipo institucional)
    if (actor.actor_type !== 'user') {
      const userActor = await runQueryWithTenant<{ actor_id: string }>(
        tenantId,
        `
        SELECT actor_id
        FROM actors
        WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
        LIMIT 1
        `,
        [tenantId, authenticatedUserId]
      );
      if (userActor) {
        const delegation = await runQueryWithTenant<{ delegation_id: string }>(
          tenantId,
          `
          SELECT delegation_id
          FROM actor_delegations
          WHERE tenant_id = $1
            AND user_actor_id = $2
            AND institutional_actor_id = $3
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1
          `,
          [tenantId, userActor.actor_id, actor.actor_id]
        );
        if (delegation) return true;
      }
    }

    return false;
  }

  /**
   * Resolve membership do user em company_users (para uma empresa).
   * Retorna row inteiro com role + can_* flags (SSOT permissions).
   * Retorna null se não houver vínculo ativo.
   */
  private async resolveCompanyMembershipForUser(
    tenantId: string,
    companyId: string,
    authenticatedUserId: string
  ): Promise<{
    role: string;
    can_manage_company: boolean;
    can_manage_financial: boolean;
    can_manage_employees: boolean;
    can_view_reports: boolean;
    can_manage_services: boolean;
  } | null> {
    const row = await runQueryWithTenant<{
      role: string;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
    }>(
      tenantId,
      `
      SELECT
        cu.role,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services
      FROM company_users cu
      INNER JOIN users u ON cu.global_user_id = u.global_user_id
      WHERE cu.company_id = $1
        AND u.user_id = $2
        AND u.tenant_id = $3
        AND cu.is_active = true
      LIMIT 1
      `,
      [companyId, authenticatedUserId, tenantId]
    );
    return row ?? null;
  }
}

export const actorCapabilitiesService = new ActorCapabilitiesService();
