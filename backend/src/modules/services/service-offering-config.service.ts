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

// FATIA PREÇO — período do dia (pt-BR sem acento, CHECK-not-enum §4.9.7; espelha o CHECK físico da migration).
export type OfferingConfigPeriod = 'manha' | 'tarde' | 'noite';
const CONFIG_PERIODS: readonly OfferingConfigPeriod[] = ['manha', 'tarde', 'noite'];

/** Célula da grade de preço declarada: (dia-da-semana ISO 1-7, período) → price_cents. */
export interface OfferingConfigPriceCell {
  dayOfWeek: number;
  period: OfferingConfigPeriod;
  priceCents: number;
}

/** Nível resolvido da cascata "a partir de" (§2 — UMA verdade por célula). */
export type OfferingConfigPriceSource = 'cell' | 'config_default' | 'offering_base';
export interface OfferingConfigResolvedPrice {
  priceCents: number;
  source: OfferingConfigPriceSource;
}

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
  // FATIA PREÇO — base "a partir de" POR CONFIG (nível 2 da cascata §2); NULL = cai no nível 3 (offering base).
  defaultPriceCents: number | null;
}

interface ConfigRow {
  id: string;
  service_offering_id: string;
  label: string;
  team_size: number;
  requires_setup_crew: boolean;
  status: string;
  default_price_cents: string | number | null;
  retired_at: string | null;
}

const CONFIG_SELECT =
  'id::text AS id, service_offering_id::text AS service_offering_id, label, team_size, requires_setup_crew, status, ' +
  'default_price_cents::text AS default_price_cents, retired_at::text AS retired_at';

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

// FATIA PREÇO — validate-before-mutate (§4.9.5). Dia ISO 1-7, período governado, cents inteiro >= 0.
function assertDayOfWeek(dayOfWeek: number): void {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new ServiceOfferingError(400, 'CONFIG_PRICE_DAY_INVALID',
      'day_of_week deve ser inteiro 1-7 (ISO-8601: Segunda=1 .. Domingo=7).');
  }
}

function assertPeriod(period: string): asserts period is OfferingConfigPeriod {
  if (!CONFIG_PERIODS.includes(period as OfferingConfigPeriod)) {
    throw new ServiceOfferingError(400, 'CONFIG_PRICE_PERIOD_INVALID',
      "period deve ser 'manha', 'tarde' ou 'noite' (vocabulário pt-BR governado por CHECK).");
  }
}

function assertPriceCents(priceCents: number): void {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new ServiceOfferingError(400, 'CONFIG_PRICE_INVALID',
      'price_cents deve ser inteiro >= 0 (dinheiro em cents; valor DECLARADO de catálogo, não cobrança).');
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
    // FATIA PREÇO — base "a partir de" POR CONFIG: undefined = campo AUSENTE (não mexe); null = limpa (cai no
    // nível 3); número = define. Distinção null-vs-ausente preservada pela rota ('defaultPriceCents' in body).
    defaultPriceCents?: number | null;
  }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    const current = await requireConfig(input.tenantId, input.offeringId, input.configId);
    if (input.label !== undefined) assertLabel(input.label);
    if (input.teamSize !== undefined) assertTeamSize(input.teamSize);
    if (input.status !== undefined) assertStatus(input.status);
    if (input.defaultPriceCents !== undefined && input.defaultPriceCents !== null) assertPriceCents(input.defaultPriceCents);
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
    // FATIA PREÇO — base "a partir de" POR CONFIG (nível 2). UPDATE explícito (não COALESCE) para distinguir
    // null-limpa de ausente: só toca a coluna quando o campo veio no body.
    if (input.defaultPriceCents !== undefined) {
      await runQueryWithTenant(
        input.tenantId,
        `UPDATE service_offering_configs SET default_price_cents = $3, updated_at = NOW()
          WHERE id = $1::uuid AND tenant_id = $2::uuid`,
        [input.configId, input.tenantId, input.defaultPriceCents]
      );
    }
  },

  /**
   * Dono RETIRA um item do cardápio. FATIA PREÇO fecha a promessa selada da F3 (20260723170000:18-20): se a
   * config está REFERENCIADA por preço (qualquer célula da grade OU default_price_cents definido), o DELETE
   * físico é PROIBIDO (FK ON DELETE RESTRICT é o backstop) — faz-se SOFT-RETIRE (retired_at) GRACIOSO: sai do
   * cardápio ATIVO (listConfigs), mas os preços já declarados seguem RESOLVÍVEIS. Config SEM preço ainda pode
   * ser deletada fisicamente nesta fatia (line-up cai junto por ON DELETE CASCADE físico).
   */
  async deleteConfig(input: { tenantId: string; userId: string; offeringId: string; configId: string }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    const current = await requireConfig(input.tenantId, input.offeringId, input.configId);
    const pricedCell = await runQueryWithTenant<{ x: number }>(
      input.tenantId,
      `SELECT 1 AS x FROM service_offering_config_prices
        WHERE config_id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [input.configId, input.tenantId]
    );
    const isReferenced = !!pricedCell || current.default_price_cents !== null;
    if (isReferenced) {
      // SOFT-RETIRE: nunca bate no RESTRICT; idempotente (retired_at IS NULL).
      await runQueryWithTenant(
        input.tenantId,
        `UPDATE service_offering_configs SET retired_at = NOW(), updated_at = NOW()
          WHERE id = $1::uuid AND tenant_id = $2::uuid AND retired_at IS NULL`,
        [input.configId, input.tenantId]
      );
      return;
    }
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
      // FATIA PREÇO — cardápio ATIVO exclui configs soft-retired (retired_at IS NULL); os preços da config
      // retirada seguem RESOLVÍVEIS via resolveConfigPrice (retirada ORTOGONAL a disponivel/sob_consulta).
      `SELECT ${CONFIG_SELECT} FROM service_offering_configs
        WHERE service_offering_id = $1::uuid AND tenant_id = $2::uuid AND retired_at IS NULL
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
      defaultPriceCents: row.default_price_cents === null || row.default_price_cents === undefined
        ? null : Number(row.default_price_cents),
    };
  },

  // ══════════ FATIA PREÇO — grade de preço por CONFIG (dia-da-semana × período), owner-gated ══════════
  // Preço = valor DECLARADO de catálogo ("a partir de"), NUNCA cobrança/movimento de dinheiro (Δbank=0;
  // porta-01 FORA; BRL implícito). §2 — UMA verdade por célula via cascata de 3 níveis (ver resolveConfigPrice).

  /** Dono DEFINE/atualiza a célula (dia,período) da grade — UPSERT em uq_socp_cell. Owner-gated fail-closed. */
  async setConfigPrice(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
    dayOfWeek: number;
    period: OfferingConfigPeriod;
    priceCents: number;
  }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    await requireConfig(input.tenantId, input.offeringId, input.configId);
    assertDayOfWeek(input.dayOfWeek);
    assertPeriod(input.period);
    assertPriceCents(input.priceCents);
    await runQueryWithTenant(
      input.tenantId,
      `INSERT INTO service_offering_config_prices (tenant_id, config_id, day_of_week, period, price_cents)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)
       ON CONFLICT (config_id, day_of_week, period)
         DO UPDATE SET price_cents = EXCLUDED.price_cents, updated_at = NOW()`,
      [input.tenantId, input.configId, input.dayOfWeek, input.period, input.priceCents]
    );
  },

  /** Dono REMOVE uma célula da grade (volta a resolver pelo nível 2/3 da cascata). Owner-gated fail-closed. */
  async removeConfigPrice(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
    dayOfWeek: number;
    period: OfferingConfigPeriod;
  }): Promise<void> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    await requireConfig(input.tenantId, input.offeringId, input.configId);
    assertDayOfWeek(input.dayOfWeek);
    assertPeriod(input.period);
    await runQueryWithTenant(
      input.tenantId,
      `DELETE FROM service_offering_config_prices
        WHERE config_id = $1::uuid AND day_of_week = $2 AND period = $3 AND tenant_id = $4::uuid`,
      [input.configId, input.dayOfWeek, input.period, input.tenantId]
    );
  },

  /** Read model da config precificada: base "a partir de" + células ESPARSAS da grade. Owner-gated fail-closed. */
  async listConfigPrices(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    configId: string;
  }): Promise<{ defaultPriceCents: number | null; cells: OfferingConfigPriceCell[] }> {
    await requireOwnedOffering(input.tenantId, input.userId, input.offeringId);
    const config = await requireConfig(input.tenantId, input.offeringId, input.configId);
    const cells = await runQueriesWithTenant<{ day_of_week: number; period: string; price_cents: string }>(
      input.tenantId,
      `SELECT day_of_week, period, price_cents::text AS price_cents
         FROM service_offering_config_prices
        WHERE config_id = $1::uuid AND tenant_id = $2::uuid
        ORDER BY day_of_week ASC, period ASC`,
      [input.configId, input.tenantId]
    );
    return {
      defaultPriceCents: config.default_price_cents === null || config.default_price_cents === undefined
        ? null : Number(config.default_price_cents),
      cells: cells.map((c) => ({
        dayOfWeek: Number(c.day_of_week),
        period: (c.period === 'tarde' ? 'tarde' : c.period === 'noite' ? 'noite' : 'manha'),
        priceCents: Number(c.price_cents),
      })),
    };
  },

  /**
   * COTAÇÃO — resolve o preço DECLARADO de uma célula (dia,período) pela cascata "a partir de" de 3 níveis
   * (§2, UMA verdade por célula): (1) célula da grade → (2) service_offering_configs.default_price_cents →
   * (3) service_offerings.price_cents (base SELADA da oferta). Leitura de catálogo (não owner-gated); tenant-scoped.
   * Config RETIRADA (soft-retire) segue resolvível. NUNCA há 4ª verdade nem dois valores para a mesma célula.
   */
  async resolveConfigPrice(
    tenantId: string,
    offeringId: string,
    configId: string,
    dayOfWeek: number,
    period: OfferingConfigPeriod
  ): Promise<OfferingConfigResolvedPrice> {
    assertDayOfWeek(dayOfWeek);
    assertPeriod(period);
    const config = await requireConfig(tenantId, offeringId, configId);
    // nível 1 — célula da grade (mais específica).
    const cell = await runQueryWithTenant<{ price_cents: string }>(
      tenantId,
      `SELECT price_cents::text AS price_cents FROM service_offering_config_prices
        WHERE config_id = $1::uuid AND day_of_week = $2 AND period = $3 AND tenant_id = $4::uuid`,
      [configId, dayOfWeek, period, tenantId]
    );
    if (cell) return { priceCents: Number(cell.price_cents), source: 'cell' };
    // nível 2 — base "a partir de" POR CONFIG.
    if (config.default_price_cents !== null && config.default_price_cents !== undefined) {
      return { priceCents: Number(config.default_price_cents), source: 'config_default' };
    }
    // nível 3 — base DA OFERTA (coluna SELADA service_offerings.price_cents).
    const offering = await serviceOfferingService.findById(tenantId, offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    return { priceCents: offering.priceCents, source: 'offering_base' };
  },
};
