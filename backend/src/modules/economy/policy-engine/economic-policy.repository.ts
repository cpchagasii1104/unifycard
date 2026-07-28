// backend/src/modules/economy/policy-engine/economic-policy.repository.ts
//
// Repository minimal do Economic Policy Engine (PE-1, 2026-05-26).
// Apenas reads + creates necessários para a fatia substrate.
// Sem updates/deletes nesta fase (gestão admin é PE-Painel futuro).

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type {
  EconomicPolicy,
  EconomicPolicyLine,
  AccessPassProduct,
  ActorAccessPass,
  PolicyResolutionInput,
  CreateEconomicPolicyInput,
  CreateEconomicPolicyLineInput,
  CreateAccessPassProductInput,
  CreateActorAccessPassInput,
  InsertResolutionLogInput,
} from './economic-policy.types';
// FISCAL 4D-2 (DECISION-0178 D2/D13): a base é intenção explícita do caller governado — o writer
// valida (não faz cast cego) e rejeita ausência e legados gross|net. Sem fallback silencioso.
import { assertWritableAppliesTo } from './economic-policy.types';

interface EconomicPolicyRow {
  id: string;
  tenant_id: string;
  policy_code: string;
  version: number;
  policy_type: string;
  module_context: string;
  vertical: string | null;
  actor_type: string | null;
  service_type: string | null;
  pricing_model: string | null;
  settlement_flow: string | null;
  // DEPRECATED (FATIA 0, 2026-07-27) — substituídos por country_id/state_id/city_id abaixo.
  country: string | null;
  region: string | null;
  city: string | null;
  country_id: string | null;
  state_id: string | null;
  city_id: string | null;
  category_id: string | null;
  channel: string | null;
  campaign_id: string | null;
  priority: number;
  status: string;
  effective_from: Date;
  effective_until: Date | null;
  metadata: any;
  created_by_actor_id: string | null;
  // FATIA 2 (2026-07-27) — ARTIGO XI. Ver migration 20260727110000.
  change_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface EconomicPolicyLineRow {
  id: string;
  policy_id: string;
  line_type: string;
  destination_type: string;
  destination_key: string | null;
  regional_origin_basis: string | null;
  regional_level: string | null;
  bps: number | null;
  fixed_amount_cents: string | null;
  applies_to: string;
  condition_type: string | null;
  condition_json: any;
  priority: number;
  metadata: any;
  created_at: Date;
}

interface AccessPassProductRow {
  id: string;
  tenant_id: string;
  product_code: string;
  version: number;
  vertical: string;
  module_context: string;
  actor_type: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  duration_seconds: number;
  price_cents: string;
  currency: string;
  commission_override_bps: number | null;
  status: string;
  effective_from: Date;
  effective_until: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface ActorAccessPassRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  product_id: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  paid_payment_intent_id: string | null;
  paid_bank_transaction_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

function toEconomicPolicy(row: EconomicPolicyRow): EconomicPolicy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    policyCode: row.policy_code,
    version: row.version,
    policyType: row.policy_type as any,
    moduleContext: row.module_context,
    vertical: row.vertical,
    actorType: row.actor_type,
    serviceType: row.service_type,
    pricingModel: row.pricing_model,
    settlementFlow: row.settlement_flow,
    country: row.country,
    region: row.region,
    city: row.city,
    countryId: row.country_id,
    stateId: row.state_id,
    cityId: row.city_id,
    categoryId: row.category_id,
    channel: row.channel,
    campaignId: row.campaign_id,
    priority: row.priority,
    status: row.status as any,
    effectiveFrom: row.effective_from.toISOString(),
    effectiveUntil: row.effective_until?.toISOString() ?? null,
    metadata: row.metadata ?? {},
    createdByActorId: row.created_by_actor_id,
    changeReason: row.change_reason ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toEconomicPolicyLine(row: EconomicPolicyLineRow): EconomicPolicyLine {
  return {
    id: row.id,
    policyId: row.policy_id,
    lineType: row.line_type as any,
    destinationType: row.destination_type as any,
    destinationKey: row.destination_key,
    regionalOriginBasis: row.regional_origin_basis as any,
    regionalLevel: row.regional_level as any,
    bps: row.bps,
    fixedAmountCents: row.fixed_amount_cents != null ? parseInt(String(row.fixed_amount_cents), 10) : null,
    appliesTo: row.applies_to as any,
    conditionType: row.condition_type,
    conditionJson: row.condition_json ?? {},
    priority: row.priority,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

function toAccessPassProduct(row: AccessPassProductRow): AccessPassProduct {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productCode: row.product_code,
    version: row.version,
    vertical: row.vertical,
    moduleContext: row.module_context,
    actorType: row.actor_type,
    country: row.country,
    region: row.region,
    city: row.city,
    durationSeconds: row.duration_seconds,
    priceCents: parseInt(String(row.price_cents), 10),
    currency: row.currency,
    commissionOverrideBps: row.commission_override_bps,
    status: row.status as any,
    effectiveFrom: row.effective_from.toISOString(),
    effectiveUntil: row.effective_until?.toISOString() ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toActorAccessPass(row: ActorAccessPassRow): ActorAccessPass {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    productId: row.product_id,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    status: row.status as any,
    paidPaymentIntentId: row.paid_payment_intent_id,
    paidBankTransactionId: row.paid_bank_transaction_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

class EconomicPolicyRepository {
  /**
   * Lista policies ELEGÍVEIS para o contexto fornecido.
   *
   * Filtros aplicados:
   *   - tenant_id (RLS aplica também)
   *   - module_context obrigatório
   *   - status='active'
   *   - effective_from <= now AND (effective_until IS NULL OR > now)
   *   - cada seletor: NULL ou = input correspondente.
   *
   * Sem ORDER BY — service resolver ordena por specificity + priority.
   */
  async findEligiblePolicies(
    input: PolicyResolutionInput,
    transactionTime: Date
  ): Promise<EconomicPolicy[]> {
    const rows = await runQueriesWithTenant<EconomicPolicyRow>(
      input.tenantId,
      `
      SELECT id, tenant_id, policy_code, version, policy_type, module_context,
             vertical, actor_type, service_type, pricing_model, settlement_flow,
             country, region, city, country_id, state_id, city_id,
             category_id, channel, campaign_id,
             priority, status, effective_from, effective_until,
             metadata, created_by_actor_id, change_reason, created_at, updated_at
        FROM economic_policies
       WHERE tenant_id = $1::uuid
         AND module_context = $2
         AND status = 'active'
         AND effective_from <= $3
         AND (effective_until IS NULL OR effective_until > $3)
         AND (vertical IS NULL OR vertical = $4)
         AND (actor_type IS NULL OR actor_type = $5)
         AND (service_type IS NULL OR service_type = $6)
         AND (pricing_model IS NULL OR pricing_model = $7)
         AND (settlement_flow IS NULL OR settlement_flow = $8)
         AND (country_id IS NULL OR country_id = $9::uuid)
         AND (state_id IS NULL OR state_id = $10::uuid)
         AND (city_id IS NULL OR city_id = $11::uuid)
         AND (category_id IS NULL OR category_id = $12::uuid)
         AND (channel IS NULL OR channel = $13)
         AND (campaign_id IS NULL OR campaign_id = $14::uuid)
      `,
      [
        input.tenantId,
        input.moduleContext,
        transactionTime,
        input.vertical ?? null,
        input.actorType ?? null,
        input.serviceType ?? null,
        input.pricingModel ?? null,
        input.settlementFlow ?? null,
        input.countryId ?? null,
        input.stateId ?? null,
        input.cityId ?? null,
        input.categoryId ?? null,
        input.channel ?? null,
        input.campaignId ?? null,
      ]
    );
    return rows.map(toEconomicPolicy);
  }

  /**
   * ADMIN READ-ONLY (F-ECONOMIC-POLICY-ADMIN-FRONT Fatia 1, 2026-07-27): lista TODAS as
   * economic_policies do tenant, qualquer status (inclui draft/deprecated) — a tela admin
   * precisa enxergar regra ainda não ativa, não só a elegível-agora. Diferente de
   * findEligiblePolicies (que exige moduleContext + status='active' + janela de vigência —
   * é o resolver de RUNTIME, não a listagem administrativa).
   *
   * tenantId SEMPRE server-side (`req.tenant.id`, nunca query/body do cliente) — ver
   * economic-policy-admin.routes.ts. Read-only: nenhum write nesta fatia.
   *
   * F-CENT-CONSERVATION-GUARD TASK 2 (legibilidade do painel, 2026-07-27): `opts.includeDeprecated`
   * é OPCIONAL e por padrão `true` — chamador que não passa `opts` continua vendo exatamente o que
   * via antes (seed-economic-policies-legacy-baseline.ts depende disso para idempotência: precisa
   * enxergar QUALQUER status já semeado, inclusive deprecated). Só o caller que passar
   * `{ includeDeprecated: false }` explicitamente (a rota admin, quando `?includeDeprecated=false`)
   * deixa de ver `deprecated` — filtro de leitura, não deleção (nenhuma linha é tocada).
   */
  async listPoliciesForTenant(
    tenantId: string,
    opts: { includeDeprecated?: boolean } = {}
  ): Promise<EconomicPolicy[]> {
    const includeDeprecated = opts.includeDeprecated ?? true;
    const rows = await runQueriesWithTenant<EconomicPolicyRow>(
      tenantId,
      `
      SELECT id, tenant_id, policy_code, version, policy_type, module_context,
             vertical, actor_type, service_type, pricing_model, settlement_flow,
             country, region, city, country_id, state_id, city_id,
             category_id, channel, campaign_id,
             priority, status, effective_from, effective_until,
             metadata, created_by_actor_id, change_reason, created_at, updated_at
        FROM economic_policies
       WHERE tenant_id = $1::uuid
         AND ($2::boolean OR status <> 'deprecated')
       ORDER BY created_at DESC
      `,
      [tenantId, includeDeprecated]
    );
    return rows.map(toEconomicPolicy);
  }

  /**
   * Carrega linhas de uma policy ordenadas por priority asc.
   */
  async findPolicyLines(tenantId: string, policyId: string): Promise<EconomicPolicyLine[]> {
    const rows = await runQueriesWithTenant<EconomicPolicyLineRow>(
      tenantId,
      `
      SELECT id, policy_id, line_type, destination_type, destination_key,
             regional_origin_basis, regional_level,
             bps, fixed_amount_cents::text AS fixed_amount_cents, applies_to,
             condition_type, condition_json, priority, metadata, created_at
        FROM economic_policy_lines
       WHERE policy_id = $1::uuid
       ORDER BY priority ASC, created_at ASC
      `,
      [policyId]
    );
    return rows.map(toEconomicPolicyLine);
  }

  /**
   * Lista access passes ATIVOS de um actor cobrindo o contexto.
   *
   * Filtra por (vertical, moduleContext) do produto; geo do produto
   * (country/region/city) com NULL=any.
   */
  async findActiveAccessPasses(
    tenantId: string,
    actorId: string,
    moduleContext: string,
    vertical: string | undefined,
    country: string | undefined,
    region: string | undefined,
    city: string | undefined,
    transactionTime: Date
  ): Promise<Array<{ pass: ActorAccessPass; product: AccessPassProduct }>> {
    const rows = await runQueriesWithTenant<ActorAccessPassRow & AccessPassProductRow>(
      tenantId,
      `
      SELECT
        ap.id, ap.tenant_id, ap.actor_id, ap.product_id, ap.starts_at, ap.ends_at,
        ap.status, ap.paid_payment_intent_id, ap.paid_bank_transaction_id,
        ap.metadata AS metadata, ap.created_at, ap.updated_at,
        prod.id AS p_id, prod.product_code, prod.version, prod.vertical,
        prod.module_context, prod.actor_type, prod.country, prod.region, prod.city,
        prod.duration_seconds, prod.price_cents::text AS price_cents,
        prod.currency, prod.commission_override_bps, prod.status AS p_status,
        prod.effective_from AS p_effective_from, prod.effective_until AS p_effective_until,
        prod.metadata AS p_metadata, prod.created_at AS p_created_at,
        prod.updated_at AS p_updated_at
        FROM actor_access_passes ap
        JOIN access_pass_products prod ON prod.id = ap.product_id
       WHERE ap.tenant_id = $1::uuid
         AND ap.actor_id = $2::uuid
         AND ap.status = 'active'
         AND ap.starts_at <= $3
         AND ap.ends_at > $3
         AND prod.module_context = $4
         AND (prod.vertical = $5 OR $5 IS NULL)
         AND (prod.country IS NULL OR prod.country = $6)
         AND (prod.region IS NULL OR prod.region = $7)
         AND (prod.city IS NULL OR prod.city = $8)
       ORDER BY ap.ends_at DESC
      `,
      [tenantId, actorId, transactionTime, moduleContext, vertical ?? null, country ?? null, region ?? null, city ?? null]
    );
    return rows.map((row: any) => ({
      pass: toActorAccessPass({
        id: row.id,
        tenant_id: row.tenant_id,
        actor_id: row.actor_id,
        product_id: row.product_id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        status: row.status,
        paid_payment_intent_id: row.paid_payment_intent_id,
        paid_bank_transaction_id: row.paid_bank_transaction_id,
        metadata: row.metadata,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }),
      product: toAccessPassProduct({
        id: row.p_id,
        tenant_id: row.tenant_id,
        product_code: row.product_code,
        version: row.version,
        vertical: row.vertical,
        module_context: row.module_context,
        actor_type: row.actor_type,
        country: row.country,
        region: row.region,
        city: row.city,
        duration_seconds: row.duration_seconds,
        price_cents: row.price_cents,
        currency: row.currency,
        commission_override_bps: row.commission_override_bps,
        status: row.p_status,
        effective_from: row.p_effective_from,
        effective_until: row.p_effective_until,
        metadata: row.p_metadata,
        created_at: row.p_created_at,
        updated_at: row.p_updated_at,
      }),
    }));
  }

  async createPolicy(input: CreateEconomicPolicyInput): Promise<EconomicPolicy> {
    const row = await runQueryWithTenant<EconomicPolicyRow>(
      input.tenantId,
      `
      INSERT INTO economic_policies (
        tenant_id, policy_code, version, policy_type, module_context,
        vertical, actor_type, service_type, pricing_model, settlement_flow,
        country, region, city, country_id, state_id, city_id,
        category_id, channel, campaign_id,
        priority, status, effective_from, effective_until,
        metadata, created_by_actor_id, change_reason
      ) VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14::uuid, $15::uuid, $16::uuid,
        $17::uuid, $18, $19::uuid,
        $20, $21, $22, $23,
        $24::jsonb, $25::uuid, $26
      )
      RETURNING id, tenant_id, policy_code, version, policy_type, module_context,
                vertical, actor_type, service_type, pricing_model, settlement_flow,
                country, region, city, country_id, state_id, city_id,
                category_id, channel, campaign_id,
                priority, status, effective_from, effective_until,
                metadata, created_by_actor_id, change_reason, created_at, updated_at
      `,
      [
        input.tenantId,
        input.policyCode,
        input.version ?? 1,
        input.policyType,
        input.moduleContext,
        input.vertical ?? null,
        input.actorType ?? null,
        input.serviceType ?? null,
        input.pricingModel ?? null,
        input.settlementFlow ?? null,
        // DEPRECATED (FATIA 0): country/region/city TEXT mantidos graváveis apenas para não
        // quebrar callers históricos ainda não migrados; NÃO participam da specificity do
        // resolver (ver SELECTOR_FIELDS em economic-policy-engine.service.ts).
        input.country ?? null,
        input.region ?? null,
        input.city ?? null,
        input.countryId ?? null,
        input.stateId ?? null,
        input.cityId ?? null,
        input.categoryId ?? null,
        input.channel ?? null,
        input.campaignId ?? null,
        input.priority ?? 0,
        input.status ?? 'active',
        input.effectiveFrom,
        input.effectiveUntil ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdByActorId ?? null,
        // FATIA 2 (2026-07-27) — ver EconomicPolicy.changeReason; opcional aqui só para não
        // quebrar chamadores pré-existentes fora do write API admin (ver types.ts).
        input.changeReason ?? null,
      ]
    );
    if (!row) throw new Error('createPolicy: insert failed');
    return toEconomicPolicy(row);
  }

  /**
   * FATIA 2 (F-ECONOMIC-POLICY-ADMIN-FRONT) — cria uma NOVA VERSÃO de policy + suas linhas,
   * ATOMICAMENTE (uma transação: falha em qualquer INSERT desfaz tudo). Artigo V ("não existe
   * ajuste administrativo"): esta é a ÚNICA forma de gravar uma regra nova — nunca edita uma
   * policy existente.
   *
   * `version` é SEMPRE calculado aqui (nunca aceito do caller) — MAX(version) do mesmo
   * (tenant_id, policy_code) + 1, sob `pg_advisory_xact_lock` para serializar publicações
   * concorrentes do MESMO policy_code no MESMO tenant (o UNIQUE (tenant_id, policy_code, version)
   * continua como rede de segurança final — ver translatePolicyWriteError na rota).
   *
   * `status` sempre nasce 'draft' aqui — ativação é uma transição EXPLÍCITA separada
   * (ver activatePolicy) e nunca acontece implicitamente na criação.
   */
  async createPolicyVersionWithLines(
    tenantId: string,
    policyInput: Omit<CreateEconomicPolicyInput, 'tenantId' | 'version' | 'status' | 'country' | 'region' | 'city'> & {
      changeReason: string;
    },
    linesInput: Array<Omit<CreateEconomicPolicyLineInput, 'policyId'>>
  ): Promise<{ policy: EconomicPolicy; lines: EconomicPolicyLine[] }> {
    const client: PoolClient = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // Serializa por (tenant, policy_code) — o GUC de tenant já isola por tenant; o lock aqui
      // evita que duas publicações concorrentes do MESMO policy_code calculem a MESMA próxima
      // versão antes de qualquer uma delas commitar.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `economic_policy_version:${tenantId}:${policyInput.policyCode}`,
      ]);

      const versionRes = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
           FROM economic_policies
          WHERE tenant_id = $1::uuid AND policy_code = $2`,
        [tenantId, policyInput.policyCode]
      );
      const version = versionRes.rows[0]?.next_version ?? 1;

      const policyRes = await client.query<EconomicPolicyRow>(
        `
        INSERT INTO economic_policies (
          tenant_id, policy_code, version, policy_type, module_context,
          vertical, actor_type, service_type, pricing_model, settlement_flow,
          country_id, state_id, city_id, category_id, channel, campaign_id,
          priority, status, effective_from, effective_until,
          metadata, created_by_actor_id, change_reason
        ) VALUES (
          $1::uuid, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11::uuid, $12::uuid, $13::uuid, $14::uuid, $15, $16::uuid,
          $17, 'draft', $18, $19,
          $20::jsonb, $21::uuid, $22
        )
        RETURNING id, tenant_id, policy_code, version, policy_type, module_context,
                  vertical, actor_type, service_type, pricing_model, settlement_flow,
                  country, region, city, country_id, state_id, city_id,
                  category_id, channel, campaign_id,
                  priority, status, effective_from, effective_until,
                  metadata, created_by_actor_id, change_reason, created_at, updated_at
        `,
        [
          tenantId,
          policyInput.policyCode,
          version,
          policyInput.policyType,
          policyInput.moduleContext,
          policyInput.vertical ?? null,
          policyInput.actorType ?? null,
          policyInput.serviceType ?? null,
          policyInput.pricingModel ?? null,
          policyInput.settlementFlow ?? null,
          policyInput.countryId ?? null,
          policyInput.stateId ?? null,
          policyInput.cityId ?? null,
          policyInput.categoryId ?? null,
          policyInput.channel ?? null,
          policyInput.campaignId ?? null,
          policyInput.priority ?? 0,
          policyInput.effectiveFrom,
          policyInput.effectiveUntil ?? null,
          JSON.stringify(policyInput.metadata ?? {}),
          policyInput.createdByActorId ?? null,
          policyInput.changeReason,
        ]
      );
      const policyRow = policyRes.rows[0];
      if (!policyRow) throw new Error('createPolicyVersionWithLines: policy insert failed');

      const lineRows: EconomicPolicyLineRow[] = [];
      for (const line of linesInput) {
        const lineRes = await client.query<EconomicPolicyLineRow>(
          `
          INSERT INTO economic_policy_lines (
            policy_id, line_type, destination_type, destination_key,
            regional_origin_basis, regional_level,
            bps, fixed_amount_cents, applies_to,
            condition_type, condition_json, priority, metadata
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb
          )
          RETURNING id, policy_id, line_type, destination_type, destination_key,
                    regional_origin_basis, regional_level,
                    bps, fixed_amount_cents::text AS fixed_amount_cents, applies_to,
                    condition_type, condition_json, priority, metadata, created_at
          `,
          [
            policyRow.id,
            line.lineType,
            line.destinationType,
            line.destinationKey ?? null,
            line.regionalOriginBasis ?? null,
            line.regionalLevel ?? null,
            line.bps ?? null,
            line.fixedAmountCents ?? null,
            assertWritableAppliesTo(line.appliesTo),
            line.conditionType ?? null,
            JSON.stringify(line.conditionJson ?? {}),
            line.priority ?? 0,
            JSON.stringify(line.metadata ?? {}),
          ]
        );
        const lineRow = lineRes.rows[0];
        if (!lineRow) throw new Error('createPolicyVersionWithLines: line insert failed');
        lineRows.push(lineRow);
      }

      await client.query('COMMIT');
      return { policy: toEconomicPolicy(policyRow), lines: lineRows.map(toEconomicPolicyLine) };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* noop — a conexão já está inválida; o erro original é o que importa. */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * FATIA 2 — carrega uma policy por id (qualquer status), para a rota de ativação decidir a
   * mensagem de erro certa (não encontrada vs. status incompatível) sem deixar o erro cru do
   * banco vazar.
   */
  async findPolicyById(tenantId: string, policyId: string): Promise<EconomicPolicy | undefined> {
    const row = await runQueryWithTenant<EconomicPolicyRow>(
      tenantId,
      `
      SELECT id, tenant_id, policy_code, version, policy_type, module_context,
             vertical, actor_type, service_type, pricing_model, settlement_flow,
             country, region, city, country_id, state_id, city_id,
             category_id, channel, campaign_id,
             priority, status, effective_from, effective_until,
             metadata, created_by_actor_id, change_reason, created_at, updated_at
        FROM economic_policies
       WHERE id = $1::uuid AND tenant_id = $2::uuid
      `,
      [policyId, tenantId]
    );
    return row ? toEconomicPolicy(row) : undefined;
  }

  /**
   * FATIA 2 — a ÚNICA transição de status que este write API executa: draft → active. Não é uma
   * edição de campo genérica (Artigo V: não existe ajuste administrativo) — é uma ação de ciclo
   * de vida própria, condicionada por WHERE status='draft'. Se 0 linhas forem afetadas, a rota
   * consulta findPolicyById para compor uma mensagem 4xx honesta (não encontrada vs. já não é
   * mais draft) — o trigger de imutabilidade nunca chega a ser acionado por esta rota.
   */
  async activatePolicy(tenantId: string, policyId: string): Promise<EconomicPolicy | undefined> {
    const row = await runQueryWithTenant<EconomicPolicyRow>(
      tenantId,
      `
      UPDATE economic_policies
         SET status = 'active'
       WHERE id = $1::uuid AND tenant_id = $2::uuid AND status = 'draft'
      RETURNING id, tenant_id, policy_code, version, policy_type, module_context,
                vertical, actor_type, service_type, pricing_model, settlement_flow,
                country, region, city, country_id, state_id, city_id,
                category_id, channel, campaign_id,
                priority, status, effective_from, effective_until,
                metadata, created_by_actor_id, change_reason, created_at, updated_at
      `,
      [policyId, tenantId]
    );
    return row ? toEconomicPolicy(row) : undefined;
  }

  async createPolicyLine(
    tenantId: string,
    input: CreateEconomicPolicyLineInput
  ): Promise<EconomicPolicyLine> {
    const row = await runQueryWithTenant<EconomicPolicyLineRow>(
      tenantId,
      `
      INSERT INTO economic_policy_lines (
        policy_id, line_type, destination_type, destination_key,
        regional_origin_basis, regional_level,
        bps, fixed_amount_cents, applies_to,
        condition_type, condition_json, priority, metadata
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb
      )
      RETURNING id, policy_id, line_type, destination_type, destination_key,
                regional_origin_basis, regional_level,
                bps, fixed_amount_cents::text AS fixed_amount_cents, applies_to,
                condition_type, condition_json, priority, metadata, created_at
      `,
      [
        input.policyId,
        input.lineType,
        input.destinationType,
        input.destinationKey ?? null,
        input.regionalOriginBasis ?? null,
        input.regionalLevel ?? null,
        input.bps ?? null,
        input.fixedAmountCents ?? null,
        assertWritableAppliesTo(input.appliesTo),
        input.conditionType ?? null,
        JSON.stringify(input.conditionJson ?? {}),
        input.priority ?? 0,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('createPolicyLine: insert failed');
    return toEconomicPolicyLine(row);
  }

  async createAccessPassProduct(input: CreateAccessPassProductInput): Promise<AccessPassProduct> {
    const row = await runQueryWithTenant<AccessPassProductRow>(
      input.tenantId,
      `
      INSERT INTO access_pass_products (
        tenant_id, product_code, version, vertical, module_context,
        actor_type, country, region, city,
        duration_seconds, price_cents, currency, commission_override_bps,
        status, effective_from, effective_until, metadata
      ) VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17::jsonb
      )
      RETURNING id, tenant_id, product_code, version, vertical, module_context,
                actor_type, country, region, city,
                duration_seconds, price_cents::text AS price_cents, currency,
                commission_override_bps, status, effective_from, effective_until,
                metadata, created_at, updated_at
      `,
      [
        input.tenantId,
        input.productCode,
        input.version ?? 1,
        input.vertical,
        input.moduleContext,
        input.actorType ?? null,
        input.country ?? null,
        input.region ?? null,
        input.city ?? null,
        input.durationSeconds,
        input.priceCents,
        input.currency ?? 'BRL',
        input.commissionOverrideBps ?? null,
        input.status ?? 'active',
        input.effectiveFrom,
        input.effectiveUntil ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('createAccessPassProduct: insert failed');
    return toAccessPassProduct(row);
  }

  async createActorAccessPass(input: CreateActorAccessPassInput): Promise<ActorAccessPass> {
    const row = await runQueryWithTenant<ActorAccessPassRow>(
      input.tenantId,
      `
      INSERT INTO actor_access_passes (
        tenant_id, actor_id, product_id, starts_at, ends_at,
        status, paid_payment_intent_id, paid_bank_transaction_id, metadata
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::uuid, $8::uuid, $9::jsonb
      )
      RETURNING id, tenant_id, actor_id, product_id, starts_at, ends_at,
                status, paid_payment_intent_id, paid_bank_transaction_id,
                metadata, created_at, updated_at
      `,
      [
        input.tenantId,
        input.actorId,
        input.productId,
        input.startsAt,
        input.endsAt,
        input.status ?? 'active',
        input.paidPaymentIntentId ?? null,
        input.paidBankTransactionId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('createActorAccessPass: insert failed');
    return toActorAccessPass(row);
  }

  async insertResolutionLog(input: InsertResolutionLogInput): Promise<void> {
    try {
      await runQueryWithTenant(
        input.tenantId,
        `
        INSERT INTO economic_policy_resolution_logs (
          tenant_id, policy_id, actor_id, module_context, resolution_status,
          input_json, selected_policy_json, calculated_splits_json,
          access_pass_id, error_code
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5,
          $6::jsonb, $7::jsonb, $8::jsonb, $9::uuid, $10
        )
        `,
        [
          input.tenantId,
          input.policyId ?? null,
          input.actorId ?? null,
          input.moduleContext,
          input.resolutionStatus,
          JSON.stringify(input.inputJson),
          input.selectedPolicyJson != null ? JSON.stringify(input.selectedPolicyJson) : null,
          input.calculatedSplitsJson != null ? JSON.stringify(input.calculatedSplitsJson) : null,
          input.accessPassId ?? null,
          input.errorCode ?? null,
        ]
      );
    } catch (err) {
      // Log é best-effort — não trava a resolução.
      // eslint-disable-next-line no-console
      console.warn('[EconomicPolicyEngine] resolution_log insert failed:', err);
    }
  }
}

export const economicPolicyRepository = new EconomicPolicyRepository();
