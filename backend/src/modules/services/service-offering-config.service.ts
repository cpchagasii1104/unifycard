// service-offering-config.service.ts
// FATIA 3 arco fundação eventos — CARDÁPIO DE CONFIGS da oferta do performer, com LINE-UP opcional.
// A banda (ou artista solo) monta o cardápio de formações na PRÓPRIA service_offering: rótulo AUTORAL
// livre + team_size DECLARADO + requires_setup_crew + situação ('disponivel' | 'sob_consulta', pt-BR,
// CHECK-not-enum). PREÇO FORA desta fatia. Bank-free (Δbank=0).
//
// DOIS EIXOS (§2, precedente audience_capacity × audience_min/max):
//   team_size = total DECLARADO (inclui contratados/roadies fora da plataforma);
//   line-up   = subconjunto de pessoas DA plataforma — count(line-up) é PISO de team_size, validado
//               nos DOIS lados (updateConfig E addConfigMember), com merge EFETIVO (§4.9.5).
//
// LINE-UP referencia a PESSOA (member_actor_id), NUNCA a linha de membership (doutrina selada
// DECISION-0188: episódio imutável; reentrada = NOVA linha; sair+voltar NÃO quebra configs).
// DERIVED-INCOMPLETE: o fn_leave selado NUNCA é bloqueado, NUNCA há auto-drop — a leitura DERIVA
// isActiveMember (join a group_actor_memberships.status='active') e lineupComplete por config.
// Inclusão no line-up = ato UNILATERAL do dono (consentimento bilateral já dado na entrada da banda
// via intent invite/accept; interesse do membro = notify F4). Solo (user-actor) usa as MESMAS tabelas,
// apenas sem linhas de line-up — tentar line-up em provider não-grupo → 409.
// Autoridade: canRepresentActor(provider) fail-closed (molde tagOfferingGenres). DELETE físico de
// config permitido NESTA fatia (nenhuma linha de preço/booking referencia configs ainda).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { serviceOfferingService, ServiceOfferingError, type ServiceOffering } from './service-offering.service';
import { groupActorMembershipRepository } from '../groups/group-actor-membership.repository';

export type OfferingConfigStatus = 'disponivel' | 'sob_consulta';

export interface OfferingConfigMemberView {
  memberActorId: string;
  // DERIVADO na leitura (nunca persistido): membership ATIVA no grupo do provider?
  isActiveMember: boolean;
}

export interface OfferingConfigView {
  id: string;
  serviceOfferingId: string;
  label: string;
  teamSize: number;
  requiresSetupCrew: boolean;
  status: OfferingConfigStatus;
  members: OfferingConfigMemberView[];
  // DERIVADO: todos os declarados no line-up seguem membros ATIVOS (vazio = completo por vacuidade).
  lineupComplete: boolean;
}

interface ConfigRow {
  id: string;
  service_offering_id: string;
  label: string;
  team_size: number;
  requires_setup_crew: boolean;
  status: string;
}

const CONFIG_SELECT =
  'id::text AS id, service_offering_id::text AS service_offering_id, label, team_size, requires_setup_crew, status';

function assertLabel(label: string): void {
  if (typeof label !== 'string' || label.trim() === '') {
    throw new ServiceOfferingError(400, 'CONFIG_LABEL_INVALID', 'label da config é texto autoral obrigatório (não-vazio).');
  }
}

function assertTeamSize(teamSize: number): void {
  if (!Number.isInteger(teamSize) || teamSize <= 0) {
    throw new ServiceOfferingError(400, 'CONFIG_TEAM_SIZE_INVALID', 'team_size deve ser inteiro > 0 (total declarado da equipe).');
  }
}

function assertStatus(status: string): void {
  if (status !== 'disponivel' && status !== 'sob_consulta') {
    throw new ServiceOfferingError(400, 'CONFIG_STATUS_INVALID',
      "status da config deve ser 'disponivel' ou 'sob_consulta' (vocabulário pt-BR governado por CHECK).");
  }
}

/** Resolve a oferta + prova autoridade do provider (canRepresentActor fail-closed — molde tagOfferingGenres). */
async function requireOwnedOffering(tenantId: string, userId: string, offeringId: string): Promise<ServiceOffering> {
  const offering = await serviceOfferingService.findById(tenantId, offeringId);
  if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
  const canRep = await authorizationService.canRepresentActor(tenantId, userId, offering.providerActorId);
  if (!canRep) {
    throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
      'Só o prestador (ou quem o representa) edita o cardápio de configs da própria oferta.');
  }
  return offering;
}

/** Config do cardápio, presa à oferta declarada (config de outra oferta → 404, sem vazamento). */
async function requireConfig(tenantId: string, offeringId: string, configId: string): Promise<ConfigRow> {
  const row = await runQueryWithTenant<ConfigRow>(
    tenantId,
    `SELECT ${CONFIG_SELECT} FROM service_offering_configs
      WHERE id = $1::uuid AND service_offering_id = $2::uuid AND tenant_id = $3::uuid`,
    [configId, offeringId, tenantId]
  );
  if (!row) throw new ServiceOfferingError(404, 'CONFIG_NOT_FOUND', 'Config inexistente nesta oferta.');
  return row;
}

async function countLineup(tenantId: string, configId: string): Promise<number> {
  const r = await runQueryWithTenant<{ n: string }>(
    tenantId,
    `SELECT COUNT(*)::text AS n FROM service_offering_config_members WHERE config_id = $1::uuid AND tenant_id = $2::uuid`,
    [configId, tenantId]
  );
  return Number(r?.n ?? 0);
}

export const serviceOfferingConfigService = {
  /** Dono CRIA um item do cardápio. Rótulo autoral único por oferta (UNIQUE físico → 409 controlado). */
  async createConfig(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    label: string;
    teamSize: number;
    requiresSetupCrew?: boolean | null;
    status?: OfferingConfigStatus | null;
  }): Promise<OfferingConfigView> {
    const offering = await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    // validação-antes-de-escrever (§4.9.5)
    assertLabel(input.label);
    assertTeamSize(input.teamSize);
    const status = input.status ?? 'disponivel';
    assertStatus(status);
    const dup = await runQueryWithTenant<{ id: string }>(
      input.tenantId,
      `SELECT id::text AS id FROM service_offering_configs
        WHERE service_offering_id = $1::uuid AND label = $2 AND tenant_id = $3::uuid`,
      [offering.id, input.label.trim(), input.tenantId]
    );
    if (dup) {
      throw new ServiceOfferingError(409, 'CONFIG_LABEL_DUPLICATE',
        'Já existe config com este rótulo nesta oferta (rótulo autoral é único por oferta).');
    }
    const row = await runQueryWithTenant<ConfigRow>(
      input.tenantId,
      `INSERT INTO service_offering_configs (tenant_id, service_offering_id, label, team_size, requires_setup_crew, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
       RETURNING ${CONFIG_SELECT}`,
      [input.tenantId, offering.id, input.label.trim(), input.teamSize, input.requiresSetupCrew ?? false, status]
    );
    return this.toView(row!, []);
  },

  /**
   * Dono ATUALIZA um item do cardápio. PISO do team_size validado no valor EFETIVO (merge input×estado,
   * molde updateOwnOffering): team_size nunca fica abaixo do count(line-up) já declarado.
   */
  async updateConfig(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
    label?: string;
    teamSize?: number;
    requiresSetupCrew?: boolean;
    status?: OfferingConfigStatus;
  }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    const current = await requireConfig(input.tenantId, input.offeringId, input.configId);
    if (input.label !== undefined) assertLabel(input.label);
    if (input.teamSize !== undefined) assertTeamSize(input.teamSize);
    if (input.status !== undefined) assertStatus(input.status);
    // PISO (lado config): valor EFETIVO de team_size >= line-up declarado (validate-before-mutate §4.9.5).
    if (input.teamSize !== undefined) {
      const lineup = await countLineup(input.tenantId, input.configId);
      if (input.teamSize < lineup) {
        throw new ServiceOfferingError(400, 'CONFIG_TEAM_SIZE_BELOW_LINEUP',
          `team_size (${input.teamSize}) não pode ficar abaixo do line-up declarado (${lineup}) — o line-up é o piso derivado do total declarado.`);
      }
    }
    if (input.label !== undefined && input.label.trim() !== current.label) {
      const dup = await runQueryWithTenant<{ id: string }>(
        input.tenantId,
        `SELECT id::text AS id FROM service_offering_configs
          WHERE service_offering_id = $1::uuid AND label = $2 AND tenant_id = $3::uuid AND id <> $4::uuid`,
        [input.offeringId, input.label.trim(), input.tenantId, input.configId]
      );
      if (dup) {
        throw new ServiceOfferingError(409, 'CONFIG_LABEL_DUPLICATE',
          'Já existe config com este rótulo nesta oferta (rótulo autoral é único por oferta).');
      }
    }
    await runQueryWithTenant(
      input.tenantId,
      `UPDATE service_offering_configs SET
         label = COALESCE($3, label),
         team_size = COALESCE($4, team_size),
         requires_setup_crew = COALESCE($5, requires_setup_crew),
         status = COALESCE($6, status),
         updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [
        input.configId, input.tenantId,
        input.label !== undefined ? input.label.trim() : null,
        input.teamSize ?? null,
        input.requiresSetupCrew ?? null,
        input.status ?? null,
      ]
    );
  },

  /**
   * Dono APAGA um item do cardápio (DELETE físico PERMITIDO NESTA fatia — nenhuma linha de preço/booking
   * referencia configs ainda; quando referenciar, este caminho vira soft-retire por decisão própria).
   * Line-up cai junto (ON DELETE CASCADE físico).
   */
  async deleteConfig(input: { tenantId: string; userId: string; offeringId: string; configId: string }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    await requireConfig(input.tenantId, input.offeringId, input.configId);
    await runQueryWithTenant(
      input.tenantId,
      `DELETE FROM service_offering_configs WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [input.configId, input.tenantId]
    );
  },

  /**
   * Dono INCLUI uma PESSOA no line-up (ato UNILATERAL — consentimento bilateral já dado na entrada da
   * banda; notify = F4). Cadeia fail-closed: provider é grupo-actor (409) → membership ATIVA no grupo do
   * provider (422, leitor selado findActiveByGroupAndMember) → PISO team_size (400). Idempotente por PK.
   */
  async addConfigMember(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
    memberActorId: string;
  }): Promise<void> {
    const offering = await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    const config = await requireConfig(input.tenantId, input.offeringId, input.configId);

    // provider DEVE ser grupo-actor (solo = mesmas tabelas, SEM line-up). actors tem RLS+FORCE → tenant-context.
    const provider = await runQueryWithTenant<{ actor_type: string; group_id: string | null }>(
      input.tenantId,
      `SELECT actor_type, group_id::text AS group_id FROM actors WHERE id = $1::uuid LIMIT 1`,
      [offering.providerActorId]
    );
    if (provider?.actor_type !== 'group' || !provider.group_id) {
      throw new ServiceOfferingError(409, 'CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER',
        'Line-up só existe em oferta de provider grupo-actor (artista solo declara apenas team_size).');
    }

    // membership ATIVA da PESSOA no grupo do provider (leitor selado do cutover D9.2-B — verdade na casa nova).
    const active = await groupActorMembershipRepository.findActiveByGroupAndMember(
      input.tenantId, provider.group_id, input.memberActorId
    );
    if (!active) {
      throw new ServiceOfferingError(422, 'CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP',
        'A pessoa não tem membership ATIVA no grupo do provider — line-up só declara quem está na banda hoje.');
    }

    // PISO (lado membro): line-up EFETIVO pós-inclusão não pode ultrapassar o team_size declarado (§4.9.5).
    const already = await runQueryWithTenant<{ n: string }>(
      input.tenantId,
      `SELECT COUNT(*)::text AS n FROM service_offering_config_members
        WHERE config_id = $1::uuid AND member_actor_id = $2::uuid AND tenant_id = $3::uuid`,
      [input.configId, input.memberActorId, input.tenantId]
    );
    const isNew = Number(already?.n ?? 0) === 0;
    if (isNew) {
      const lineup = await countLineup(input.tenantId, input.configId);
      if (lineup + 1 > config.team_size) {
        throw new ServiceOfferingError(400, 'CONFIG_TEAM_SIZE_BELOW_LINEUP',
          `incluir este membro deixaria o line-up (${lineup + 1}) acima do team_size declarado (${config.team_size}) — aumente o team_size antes.`);
      }
    }

    await runQueryWithTenant(
      input.tenantId,
      `INSERT INTO service_offering_config_members (tenant_id, config_id, member_actor_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid)
       ON CONFLICT (config_id, member_actor_id) DO NOTHING`,
      [input.tenantId, input.configId, input.memberActorId]
    );
  },

  /** Dono REMOVE uma pessoa do line-up (edição do cardápio — nunca mexe na membership). */
  async removeConfigMember(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
    memberActorId: string;
  }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    await requireConfig(input.tenantId, input.offeringId, input.configId);
    await runQueryWithTenant(
      input.tenantId,
      `DELETE FROM service_offering_config_members
        WHERE config_id = $1::uuid AND member_actor_id = $2::uuid AND tenant_id = $3::uuid`,
      [input.configId, input.memberActorId, input.tenantId]
    );
  },

  /**
   * Read model do cardápio: TODAS as configs da oferta ('sob_consulta' INCLUSA) + line-up com
   * isActiveMember DERIVADO (join à casa nova; DERIVED-INCOMPLETE — linha do line-up fica INTACTA
   * quando a pessoa sai do grupo) e lineupComplete por config (vazio = completo por vacuidade).
   */
  async listConfigs(tenantId: string, offeringId: string): Promise<OfferingConfigView[]> {
    const configs = await runQueriesWithTenant<ConfigRow>(
      tenantId,
      `SELECT ${CONFIG_SELECT} FROM service_offering_configs
        WHERE service_offering_id = $1::uuid AND tenant_id = $2::uuid
        ORDER BY created_at ASC, id ASC`,
      [offeringId, tenantId]
    );
    if (configs.length === 0) return [];
    // grupo do provider (se houver) para derivar a atividade da membership; solo → sem join possível.
    const grp = await runQueryWithTenant<{ group_id: string | null }>(
      tenantId,
      `SELECT a.group_id::text AS group_id
         FROM service_offerings so JOIN actors a ON a.id = so.provider_actor_id
        WHERE so.id = $1::uuid AND so.tenant_id = $2::uuid`,
      [offeringId, tenantId]
    );
    const groupId = grp?.group_id ?? null;
    const members = await runQueriesWithTenant<{ config_id: string; member_actor_id: string; is_active_member: boolean }>(
      tenantId,
      `SELECT m.config_id::text AS config_id, m.member_actor_id::text AS member_actor_id,
              ($3::uuid IS NOT NULL AND EXISTS (
                 SELECT 1 FROM group_actor_memberships gam
                  WHERE gam.tenant_id = m.tenant_id AND gam.group_id = $3::uuid
                    AND gam.member_actor_id = m.member_actor_id AND gam.status = 'active'
              )) AS is_active_member
         FROM service_offering_config_members m
        WHERE m.tenant_id = $1::uuid
          AND m.config_id IN (SELECT c.id FROM service_offering_configs c
                               WHERE c.service_offering_id = $2::uuid AND c.tenant_id = $1::uuid)
        ORDER BY m.created_at ASC`,
      [tenantId, offeringId, groupId]
    );
    const byConfig = new Map<string, OfferingConfigMemberView[]>();
    for (const m of members) {
      const list = byConfig.get(m.config_id) ?? [];
      list.push({ memberActorId: m.member_actor_id, isActiveMember: m.is_active_member === true });
      byConfig.set(m.config_id, list);
    }
    return configs.map((c) => this.toView(c, byConfig.get(c.id) ?? []));
  },

  toView(row: ConfigRow, members: OfferingConfigMemberView[]): OfferingConfigView {
    return {
      id: row.id,
      serviceOfferingId: row.service_offering_id,
      label: row.label,
      teamSize: Number(row.team_size),
      requiresSetupCrew: row.requires_setup_crew === true,
      status: (row.status === 'sob_consulta' ? 'sob_consulta' : 'disponivel'),
      members,
      lineupComplete: members.every((m) => m.isActiveMember),
    };
  },
};
