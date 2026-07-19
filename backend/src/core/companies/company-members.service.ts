// src/core/companies/company-members.service.ts
// Service para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário
// 🔴 BLINDAGEM: Empresa apenas associa, agenda e alerta
//
// 🔒 DECISION-0189 (F2 — DUAL-WRITE TRANSITÓRIA): enquanto o cutover F4 não encerra as
// delegações de membership, TODO grant/re-grant/revoke de delegação empresarial escreve
// TAMBÉM a casa jurídica canônica (company_member_relationships) + evento append-only
// (company_member_events) NA MESMA TRANSAÇÃO (client único — repositories recebem o client
// do caller; nenhuma transação interna independente). Falha em qualquer lado → ROLLBACK.
// A AUTHORITY continua lendo a fonte ANTIGA (actor_delegations) até F3/F4.
// DELETE físico de membership MORREU nesta fatia (removeMember = revogação LÓGICA,
// member_status='revoked' + grants zerados + snapshot preservado no evento).

import { companyMembersRepository } from './company-members.repository';
import { companyMemberRelationshipsRepository } from './company-member-relationships.repository';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { actorRegistryService } from '../actor-registry/actor-registry.service';
import { actorDelegationRepository, type DelegationRelationshipType } from '../actor-delegation/actor-delegation.repository';
import { pilotEventsService } from '../pilot/pilot-events.service';
import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import type {
  CompanyMember,
  CreateCompanyMemberInput,
  UpdateCompanyMemberInput,
  CompanyMemberFilters,
} from './company-members.types';
import { CompanyMemberStatus } from './company-members.types';

/**
 * Service para Company Members
 * 🔴 BLINDAGEM: Service apenas gerencia membros, não decide comportamento
 * 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário
 */
class CompanyMembersService {
  /**
   * Cria um novo membro
   * 🔴 BLINDAGEM: companyId e actorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Actor deve ser do tipo 'user' (CPF)
   */
  async createMember(
    tenantId: string,
    userId: string,
    input: CreateCompanyMemberInput
  ): Promise<CompanyMember> {
    // 🔴 BLINDAGEM: Validar que companyId foi fornecido
    if (!input.companyId) {
      throw new BadRequestError('companyId é obrigatório para criar membro');
    }

    // 🔴 BLINDAGEM: Validar que actorId foi fornecido
    if (!input.actorId) {
      throw new BadRequestError('actorId é obrigatório para criar membro');
    }

    // 🔴 BLINDAGEM: Validar que actor existe e é do tipo 'user' (CPF)
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, input.actorId);
    if (!actor) {
      throw new NotFoundError('Actor não encontrado');
    }

    if (actor.actor_type !== 'user') {
      throw new BadRequestError('Actor deve ser do tipo "user" (CPF) para ser membro da empresa');
    }

    // 🔴 BLINDAGEM: Criar membro (empresa apenas associa, não edita agenda pessoal)
    const member = await companyMembersRepository.create(tenantId, input);

    // CONTINUOUS PRODUCTION: Criar delegação se membro está ativo.
    // R2.2 (Lote L2): `userId` é o actor que EXECUTA a associação (o concedente — quem passou pela
    // catraca canManageCompany da Fatia 2). Vira `grantedByActorId` na delegação governada (§4.9.9 autoria).
    if (member.status === CompanyMemberStatus.ACTIVE) {
      await this.createDelegationForMember(tenantId, member, userId, input.relationshipType);
    }

    return member;
  }

  /**
   * Cria delegação para membro ativo + DUAL-WRITE da casa jurídica (DECISION-0189 F2).
   * R2.2 + FIX RN2/R2.2: grava relationship_type + granted_by_actor_id (o concedente). O vínculo jurídico
   * vem de `explicitRelationshipType` quando o gestor o DECLARA (fonte governada — alcança os 7 valores,
   * inclui owner); só cai na derivação do role como FALLBACK de compat (que só alcançava 3 valores).
   *
   * ATÔMICO: delegação (fonte antiga) + vínculo jurídico + evento nascem na MESMA transação
   * (client único deste método; repositórios NÃO abrem transação própria neste caminho).
   */
  private async createDelegationForMember(
    tenantId: string,
    member: CompanyMember,
    grantedByActorId?: string | null,
    explicitRelationshipType?: DelegationRelationshipType | null
  ): Promise<void> {
    // Buscar actor da company
    const actorRepository = socialPortsRegistry.getActorRepository();
    const companyActor = await actorRepository.findByCompanyId(tenantId, member.companyId);
    if (!companyActor) {
      return; // Company não tem actor ainda
    }

    // Registrar company no Actor Registry se não estiver
    await actorRegistryService.register(
      tenantId,
      companyActor.actor_id,
      'company',
      'companies',
      member.companyId
    );

    // Determinar scopes baseado no role
    const scopes = this.getScopesForRole(member.role);

    // Vínculo jurídico: EXPLÍCITO (gestor declarou — fonte governada) tem precedência; senão FALLBACK
    // derivado do role (compat). `explicitRelationshipType === undefined` = não declarado → fallback;
    // `=== null` = declarado explicitamente como "não classificado" → respeitado.
    const relationshipType =
      explicitRelationshipType !== undefined
        ? explicitRelationshipType
        : this.getRelationshipTypeForRole(member.role);

    // 🔒 DUAL-WRITE ATÔMICA (DECISION-0189 F2): delegação governada (R2.2) + casa jurídica +
    // evento na MESMA transação. Falha em qualquer um → ROLLBACK de tudo.
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      await actorDelegationRepository.create(
        tenantId,
        {
          userActorId: member.actorId,
          institutionalActorId: companyActor.actor_id,
          scopes,
          isTransitive: false,
          relationshipType,
          grantedByActorId: grantedByActorId ?? null,
        },
        client
      );

      const rel = await companyMemberRelationshipsRepository.openRelationshipOnClient(client, {
        tenantId,
        companyId: member.companyId,
        companyUserId: member.memberId,
        relationshipType,
        source: 'declared',
        declaredByActorId: grantedByActorId ?? null,
      });

      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId,
        companyId: member.companyId,
        companyUserId: member.memberId,
        eventType: 'relationship_declared',
        details: {
          relationship_id: rel.relationshipId,
          relationship_type: relationshipType,
          replaced_relationship_id: rel.replacedId,
          via: 'company-members.createDelegationForMember (dual-write F2; fonte de authority ainda = actor_delegations)',
        },
        actedByActorId: grantedByActorId ?? null,
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw err;
    } finally {
      client.release();
    }

    // SPRINT 13: Observar primeira delegação (assíncrono, não bloqueia)
    pilotEventsService.recordEvent(tenantId, {
      eventType: 'first_delegation',
      actorId: member.actorId,
      actorType: 'user',
      metadata: {
        companyId: member.companyId,
        role: member.role,
      },
    }).catch((err) => {
      // Erro silencioso - não quebrar fluxo
      console.warn('[PilotObserver] Erro ao registrar evento de delegação:', err);
    });
  }

  /**
   * Obtém scopes baseado no role
   * ⚠️ CONDENADO (DECISION-0189 §12): wildcard '*' e permissões funcionais em scopes morrem
   * no cutover F4 (destino explícito = subject grants can_publish_feed/can_create_events).
   * Mantido inalterado nesta fatia (authority ainda lê a fonte antiga).
   */
  private getScopesForRole(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['*']; // Admin tem todas as permissões
      case 'staff':
        return ['publish_feed', 'create_events'];
      case 'contractor':
        return ['publish_feed'];
      default:
        return [];
    }
  }

  /**
   * R2.2 — deriva o VÍNCULO JURÍDICO governado (D2 eixo 1) do role operacional. O role de
   * company_users é o cargo/scope; o relationship_type é o tipo de vínculo institucional (vocabulário
   * governado por CHECK). Mapeamento MVP dos 3 roles atuais; vínculos mais ricos (partner/director/
   * attorney/legal_representative) entram quando o writer ganhar seleção explícita de vínculo.
   */
  private getRelationshipTypeForRole(role: string): DelegationRelationshipType | null {
    switch (role) {
      case 'admin':
        return 'administrator';
      case 'staff':
        return 'employee';
      case 'contractor':
        return 'contractor';
      default:
        return null;
    }
  }

  /**
   * Busca membro por ID
   */
  async getMember(tenantId: string, memberId: string): Promise<CompanyMember> {
    const member = await companyMembersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError('Membro não encontrado');
    }
    return member;
  }

  /**
   * Lista membros com filtros
   */
  async listMembers(
    tenantId: string,
    filters: CompanyMemberFilters
  ): Promise<CompanyMember[]> {
    return await companyMembersRepository.find(tenantId, filters);
  }

  /**
   * Atualiza membro
   * 🔴 BLINDAGEM: Empresa pode atualizar role/status, mas NÃO agenda pessoal
   */
  async updateMember(
    tenantId: string,
    memberId: string,
    userId: string,
    input: UpdateCompanyMemberInput
  ): Promise<CompanyMember> {
    // 🔴 BLINDAGEM: Validar que membro existe
    const existing = await companyMembersRepository.findById(tenantId, memberId);
    if (!existing) {
      throw new NotFoundError('Membro não encontrado');
    }

    // 🔴 BLINDAGEM: Atualizar membro (apenas role/status, não agenda pessoal)
    const updated = await companyMembersRepository.update(tenantId, memberId, input);

    // 🔴 R2.3 (fecha DT-R2-DELEGATION-UPDATE-MEMBER-STALE-RELATIONSHIP, nota do re-selo Yala): se o ROLE
    // mudou e o membro está ATIVO, a delegação viva ficaria com relationship_type/scopes ANTIGOS até um
    // novo grant. Re-derivamos: createDelegationForMember auto-revoga a anterior (com evento 'revoked') e
    // cria a nova governada (relationship_type derivado do novo role + evento 'granted'). `userId` = actor
    // que executa a atualização (o concedente — a rota já valida canRepresentActor sobre ele: R2.2 FIX-Q3).
    const roleChanged = input.role !== undefined && input.role !== existing.role;
    if (roleChanged && updated.status === CompanyMemberStatus.ACTIVE) {
      await this.createDelegationForMember(tenantId, updated, userId);
    }

    return updated;
  }

  /**
   * Revoga membro (DECISION-0189: revogação LÓGICA — DELETE físico MORREU).
   * ATÔMICO: revoga delegações da relação + member_status='revoked' + grants ZERADOS
   * (snapshot anterior preservado no evento 'revoked') + vínculo jurídico encerrado —
   * tudo na MESMA transação.
   */
  async removeMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<void> {
    // 🔴 BLINDAGEM: Validar que membro existe
    const existing = await companyMembersRepository.findById(tenantId, memberId);
    if (!existing) {
      throw new NotFoundError('Membro não encontrado');
    }

    const actorRepository = socialPortsRegistry.getActorRepository();
    const companyActor = await actorRepository.findByCompanyId(tenantId, existing.companyId);

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // 1. Revogar delegações vivas da relação (fonte antiga — dual-write transitória)
      if (companyActor) {
        const delegations = await actorDelegationRepository.findActiveByUserActor(
          tenantId,
          existing.actorId
        );
        for (const delegation of delegations) {
          if (delegation.institutionalActorId === companyActor.actor_id) {
            // R2.2: `userId` = actor que executa a remoção (o revogador — autoria da revogação, §4.9.9).
            await actorDelegationRepository.revoke(tenantId, delegation.delegationId, userId, client);
          }
        }
      }

      // 2. Snapshot dos grants ANTES de zerar (preservação de histórico — R17)
      const snapRes = await client.query(
        `SELECT role, member_status, can_manage_company, can_manage_financial, can_manage_employees,
                can_view_reports, can_manage_services, can_view_financial, can_manage_members,
                can_publish_feed, can_create_events
           FROM company_users WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [tenantId, memberId]
      );
      const snapshot = snapRes.rows[0] ?? null;

      // 3. Revogação lógica: status terminal + grants ZERADOS (is_active sincronizado até F4)
      await client.query(
        `UPDATE company_users
            SET member_status = 'revoked', is_active = false,
                can_manage_company = false, can_manage_financial = false, can_manage_employees = false,
                can_view_reports = false, can_manage_services = false,
                can_view_financial = false, can_manage_members = false,
                can_publish_feed = false, can_create_events = false,
                updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, memberId]
      );

      // 4. Encerrar vínculo jurídico vigente (histórico preservado — nunca DELETE)
      await client.query(
        `UPDATE company_member_relationships SET valid_to = now()
          WHERE tenant_id = $1 AND company_user_id = $2 AND valid_to IS NULL`,
        [tenantId, memberId]
      );

      // 5. Evento append-only com snapshot anterior
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId,
        companyId: existing.companyId,
        companyUserId: memberId,
        eventType: 'revoked',
        snapshot: snapshot ? { before: snapshot } : null,
        details: { via: 'company-members.removeMember (revogação lógica DECISION-0189; DELETE físico condenado)' },
        actedByActorId: userId,
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Ativa membro (muda status de 'invited' para 'active')
   * 🔴 BLINDAGEM: Ativação é apenas mudança de status, não edita agenda
   * CONTINUOUS PRODUCTION: Cria delegação quando ativado
   */
  async activateMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<CompanyMember> {
    const member = await this.updateMember(tenantId, memberId, userId, {
      status: CompanyMemberStatus.ACTIVE,
    });

    // Criar delegação quando membro é ativado
    if (member.status === CompanyMemberStatus.ACTIVE) {
      await this.createDelegationForMember(tenantId, member);
    }

    return member;
  }

  /**
   * Suspende membro (muda status para 'suspended')
   * 🔴 BLINDAGEM: Suspensão é apenas mudança de status, não edita agenda
   * DECISION-0189 R17: suspensão CONGELA grants (colunas intactas); status nega autoridade.
   */
  async suspendMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<CompanyMember> {
    const member = await this.updateMember(tenantId, memberId, userId, {
      status: CompanyMemberStatus.SUSPENDED,
    });
    // Evento append-only (fora de tx crítica — status já persistido pelo update acima;
    // trilha completa vira comando governado único na F4)
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      await companyMemberRelationshipsRepository.appendMemberEventOnClient(client, {
        tenantId,
        companyId: member.companyId,
        companyUserId: memberId,
        eventType: 'suspended',
        details: { via: 'company-members.suspendMember' },
        actedByActorId: userId,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw err;
    } finally {
      client.release();
    }
    return member;
  }

  /**
   * Leitura pura: membro existe e está ativo? (usado por superfícies de projeção)
   */
  async isActiveMember(tenantId: string, companyId: string, globalUserId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT true AS ok FROM company_users
        WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid
          AND member_status = 'active' LIMIT 1`,
      [tenantId, companyId, globalUserId]
    );
    return row?.ok === true;
  }
}

export const companyMembersService = new CompanyMembersService();
