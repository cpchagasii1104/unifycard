// src/modules/services/service-payment-execution.service.ts
// SPRINT 3: INTEGRATED WITH UNIFY BANK
// Service do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
// 🔴 BLINDAGEM: Execução é explícita, nunca automática
// 🔴 CRÍTICO: Toda execução cria transação no Unify Bank

import type { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant, pool, runQueryWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { servicePaymentExecutionRepository } from './service-payment-execution.repository';
import { servicePaymentRequestRepository } from './service-payment-request.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { ActorEffect } from '@modules/social/actor-effects.types';
import { BadRequestError } from '@core/errors';
import { bankIntegrationService } from '../bank/bank-integration.service';
import { bankAccountService } from '../bank/bank-account.service';
import { createPaymentIntentWithClient } from '@modules/payments/payment-intent-repository';
import { economicPolicyEngineService } from '@modules/economy/policy-engine/economic-policy-engine.service';
import { operationalAddressHelper } from '@core/location/operational-address.helper';
import { resolveActorTerritory } from '@core/location/actor-territorial-resolver';
import { isRegionalFundCityEnabled } from '../bank/regional-fund-city-activation';
import type { BankSplitType } from '../bank/bank-split.types';
import type {
  CalculatedEconomicSplit,
  EconomicPolicyLineType,
  EconomicPolicyDestinationType,
} from '@modules/economy/policy-engine/economic-policy.types';
import type {
  ServicePaymentExecution,
  PaymentSplit,
  CreateServicePaymentExecutionInput,
  CreatePaymentSplitInput,
} from './service-payment-execution.types';
import { PaymentRequestStatus } from './service-payment-request.types';

/**
 * PE-3 (DECISION-0048, 2026-05-26): mapeamento canônico de
 * `EconomicPolicyDestinationType` → bank `splitType` (universo BankSplitType).
 *
 * MVP suporta 4 papéis principais; outros line types (referral / group /
 * channel / custom) ficam FAIL-CLOSED enquanto não houver resolver dedicado
 * (frente PE-4+). Policy que exija destinos não-suportados quebra com
 * mensagem explícita no resolver de destinos.
 */
const SUPPORTED_DESTINATION_TYPES: ReadonlySet<EconomicPolicyDestinationType> = new Set([
  'receiver_actor',
  'actor_wallet',
  'platform_fees',
  'risk_reserve',
  'escrow_payments',
  // PE-5-RESOLVER-MVP (DECISION-0051, 2026-05-26): regional_fund habilitado
  // para PJ via address_assignments → ensureRegionalFundAccount (FK, Fase 2c).
  // PE-5-RESOLVER-V2 (Fatia 9 passo 3, 2026-07-05): PF (payer_identity_residence /
  // receiver_identity_residence) TAMBÉM habilitado — resolve via
  // address_assignments(owner_type='profile', role='RESIDENCE'), o mesmo SSOT
  // canônico já usado por profile-residence-address.service.ts (DECISION-0074).
  // Fecha DT-PE5-PF-RESOLVER-PENDING.
  'regional_fund',
] as const);

type ResolvedSplitDestination = {
  destinationAccountId: string;
  splitType: BankSplitType;
  /**
   * Indica se este split deve ser repassado depois para `actor_wallet` via
   * D-money (`releaseFundsToActorWalletForOrder`). Apenas `revenue_share`
   * em `escrow_payments` recebe `true`; demais splits já caem nos destinos
   * finais (system accounts) e NÃO são tocados pelo D-money.
   */
  releaseToActorWallet: boolean;
  /**
   * DECISION-0166 D5 (Fase 2c): jurisdição resolvida por FK canônica no momento da
   * transação — gravada em bank_splits.jurisdiction_snapshot da LINHA regional_fund.
   * Preenchida SOMENTE pelo resolver regional (IDs do Location Core + basis usado);
   * demais destinos ficam null (não têm jurisdição — honesto).
   */
  jurisdictionSnapshot?: Record<string, unknown> | null;
  /**
   * receiverActorId só faz sentido em revenue_share (worker). Para system
   * destinations (platform_fee, regional_fund, reserve) vem como ''.
   */
  receiverActorId: string;
};

/**
 * Resolve destino canônico de cada `CalculatedEconomicSplit` para
 * (bankAccountId + splitType + releaseToActorWallet). Fail-closed em
 * destination_types não suportados no MVP de PE-3 (DECISION-0048).
 *
 * IMPORTANTE: ensurePlatformAccounts deve ter sido chamado antes para o
 * tenant — `processServicePaymentExecutionCanonical` faz isso na entrada.
 */
async function resolveSplitDestinationFromPolicy(
  tenantId: string,
  payerActorId: string,
  receiverActorId: string,
  calcSplit: CalculatedEconomicSplit,
  currency: 'BRL'
): Promise<ResolvedSplitDestination> {
  if (!SUPPORTED_DESTINATION_TYPES.has(calcSplit.destinationType)) {
    throw new BadRequestError(
      `POLICY_DESTINATION_UNSUPPORTED: destination_type='${calcSplit.destinationType}' ` +
        `não suportado no MVP de PE-3 (DECISION-0048). Suportados: ${[...SUPPORTED_DESTINATION_TYPES].join(', ')}. ` +
        `Frente futura habilita referral / group_allocation / channel_commission / custom.`
    );
  }

  // revenue_share / receiver_actor / actor_wallet → escrow_payments
  // (D-money libera depois para actor_wallet do worker).
  if (
    calcSplit.destinationType === 'receiver_actor' ||
    calcSplit.destinationType === 'actor_wallet' ||
    calcSplit.destinationType === 'escrow_payments'
  ) {
    const escrow = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'escrow_payments',
      currency
    );
    if (!escrow) {
      throw new Error(
        'PE-3: conta escrow_payments do tenant não encontrada — ensurePlatformAccounts esperado'
      );
    }
    return {
      destinationAccountId: escrow.accountId,
      splitType: calcSplit.destinationType === 'escrow_payments' ? 'escrow' : 'revenue_share',
      releaseToActorWallet: calcSplit.destinationType !== 'escrow_payments',
      receiverActorId,
    };
  }

  // platform_fees → conta system platform_fees do tenant.
  if (calcSplit.destinationType === 'platform_fees') {
    const acc = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'platform_fees',
      currency
    );
    if (!acc) {
      throw new Error('PE-3: conta system platform_fees do tenant não encontrada');
    }
    return {
      destinationAccountId: acc.accountId,
      splitType: 'fee',
      releaseToActorWallet: false,
      receiverActorId: '',
    };
  }

  // risk_reserve → conta system risk_reserve do tenant.
  if (calcSplit.destinationType === 'risk_reserve') {
    const acc = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'risk_reserve',
      currency
    );
    if (!acc) {
      throw new Error('PE-3: conta system risk_reserve do tenant não encontrada');
    }
    return {
      destinationAccountId: acc.accountId,
      splitType: 'reserve',
      releaseToActorWallet: false,
      receiverActorId: '',
    };
  }

  // regional_fund (DECISION-0051 PE-5-RESOLVER-MVP, PJ-only):
  //   - Lê regionalOriginBasis OBRIGATÓRIO (CHECK Postgres garante presença
  //     quando destination_key IS NULL — DECISION-0049).
  //   - Resolve endereço material conforme basis declarado.
  //   - Resolve country/state/city desse endereço.
  //   - Resolve bank_account via ensureRegionalFundAccount (FK canônica, Fase 2c).
  //   - releaseToActorWallet=false (regional_fund NUNCA entra em
  //     metadata.splits liberável para actor_wallet).
  //
  // Suporte MVP (PJ):
  //   - receiver_company_operational → address_assignments(owner_type=
  //     'service_provider', owner_id=<receiverActorId>, role='OPERATIONAL')
  //     via operationalAddressHelper.getOperationalAddressForActor.
  //   - receiver_company_hq → address_assignments(owner_type='company',
  //     owner_id=<receiverActor.company_id>, role='HQ').
  //
  // Suporte V2 (PF, Fatia 9 passo 3 — fecha DT-PE5-PF-RESOLVER-PENDING):
  //   - payer_identity_residence / receiver_identity_residence →
  //     address_assignments(owner_type='profile', owner_id=<actor_id da PONTA
  //     declarada pelo basis>, role='RESIDENCE') — mesmo SSOT de
  //     profile-residence-address.service.ts (DECISION-0074).
  //
  // FAIL-CLOSED (sem fallback):
  //   - service_location / transaction_location / explicit_economic_region:
  //     sem fonte material; vide DECISION-0049.
  //   - basis ausente quando destination_key é null: CHECK Postgres já
  //     bloqueia na escrita; resolver só é chamado com basis válido.
  //   - HQ NÃO é fallback automático de OPERATIONAL; residência ausente NÃO
  //     cai pra endereço de outra ponta (payer≠receiver sempre).
  if (calcSplit.destinationType === 'regional_fund') {
    return await resolveRegionalFundDestination(
      tenantId,
      payerActorId,
      receiverActorId,
      calcSplit
    );
  }

  throw new Error(
    `PE-3: destination_type não tratado mesmo após filtro de SUPPORTED — bug: ${calcSplit.destinationType}`
  );
}

/**
 * PE-5-RESOLVER-V2 (DECISION-0051 + Fatia 9 passo 3, 2026-07-05) — resolver
 * dinâmico de regional_fund PJ+PF.
 *
 * Lê `regional_origin_basis` da policy line, resolve a jurisdição canônica (PF via
 * resolveActorTerritory(ACTOR_RESIDENCE), PJ via address_assignments) e resolve a conta por
 * `lookupRegionalFundAccount` (FK, LOOKUP-ONLY — DECISION-0177 D4: o pagamento nunca cria conta).
 *
 * NÃO faz fallback automático entre basis. Se basis pedido não tiver
 * endereço material, falha `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE`.
 */
// Exportada para prova direta sob teste/ROLLBACK (B-CITY-1); o caller de produção continua
// sendo resolveSplitDestinationFromPolicy (mesmo módulo).
export async function resolveRegionalFundDestination(
  tenantId: string,
  payerActorId: string,
  receiverActorId: string,
  calcSplit: CalculatedEconomicSplit
): Promise<ResolvedSplitDestination> {
  const basis = calcSplit.regionalOriginBasis;
  if (!basis) {
    // CHECK Postgres já garante; defesa extra em runtime.
    throw new BadRequestError(
      `POLICY_REGIONAL_ORIGIN_BASIS_REQUIRED: line regional_fund sem ` +
        `destination_key explícito DEVE declarar regional_origin_basis (DECISION-0049).`
    );
  }

  // Fase 2c (DECISION-0166 D3): a resolução carrega os IDs CANÔNICOS do Location Core até o
  // fim — a degradação FK→string (iso/abbreviation/nome) morreu aqui. Geografia por FK.
  let countryId: string | null = null;
  let stateId: string | null = null;
  let cityId: string | null = null;

  // PF — B-CITY-1 (DECISION-0177 D2, fecha DT-BANK-REGIONAL-ORIGIN-PROFILE-ACTOR-DIVERGENCE):
  // resolve via a residência ACTOR-SCOPED VIGENTE da ponta declarada pelo basis (payer OU
  // receiver — nunca a outra ponta como fallback), pela casa canônica selada
  // resolveActorTerritory(ACTOR_RESIDENCE). PROIBIDO: profile/RESIDENCE (legado preservado,
  // fora do money path), actor_active_location, CEP, texto, sessão, cidade do cliente.
  // Erro de infraestrutura PROPAGA (o resolver lança; nunca vira ausência silenciosa).
  if (basis === 'payer_identity_residence' || basis === 'receiver_identity_residence') {
    const residenceActorId = basis === 'payer_identity_residence' ? payerActorId : receiverActorId;
    const territory = await resolveActorTerritory(tenantId, residenceActorId, 'ACTOR_RESIDENCE');
    if (!territory.cityId) {
      throw new BadRequestError(
        `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: actor ${residenceActorId} (${basis === 'payer_identity_residence' ? 'payer' : 'receiver'}) ` +
          `sem residência actor-scoped vigente (address_assignments owner_type='actor', role='RESIDENCE', ` +
          `state=${territory.state}). Cadastre a residência canônica (DECISION-0177 D2) antes de ` +
          `policy line com basis='${basis}'. Fallback profile/RESIDENCE é PROIBIDO.`
      );
    }
    // Cadeia territorial derivada por FK do Location Core (city → state → country); nunca texto.
    const chain = await runQueryWithTenant<{ state_id: string; country_id: string }>(
      tenantId,
      `SELECT c.state_id::text, s.country_id::text
         FROM cities c JOIN states s ON s.state_id = c.state_id
        WHERE c.city_id = $1::uuid LIMIT 1`,
      [territory.cityId]
    );
    if (!chain) {
      throw new BadRequestError(
        `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: city ${territory.cityId} sem cadeia territorial ` +
          `canônica (Location Core) — inconsistência material.`
      );
    }
    cityId = territory.cityId;
    stateId = chain.state_id;
    countryId = chain.country_id;
  } else if (basis === 'service_location' || basis === 'transaction_location') {
    // sem fonte material no schema.
    throw new BadRequestError(
      `POLICY_BASIS_UNSUPPORTED_MVP: basis='${basis}' não suportado em ` +
        `PE-5-RESOLVER-V2 (sem services.primary_address_id no schema).`
    );
  } else if (basis === 'explicit_economic_region') {
    // bloqueado por economic_regions não materializada.
    throw new BadRequestError(
      `POLICY_BASIS_UNSUPPORTED_MVP: basis='explicit_economic_region' ` +
        `bloqueado — economic_regions não materializada ` +
        `(DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING).`
    );
  } else if (basis === 'receiver_company_operational') {
    // Helper canônico do PE-5-CARTÓRIO. Já tenant-safe + valida ativo.
    const op = await operationalAddressHelper.getOperationalAddressForActor(
      tenantId,
      receiverActorId
    );
    if (!op) {
      throw new BadRequestError(
        `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: receiver actor ${receiverActorId} ` +
          `sem address_assignments(role='OPERATIONAL') ativo. ` +
          `Cadastre endereço operacional da unidade (DECISION-0050) antes de ` +
          `policy line com basis='receiver_company_operational'.`
      );
    }
    countryId = op.address.countryId;
    stateId = op.address.stateId;
    cityId = op.address.cityId;
  } else if (basis === 'receiver_company_hq') {
    // 1. Resolve company_id do receiver.
    const actorRow = await runQueryWithTenant<{ company_id: string | null }>(
      tenantId,
      `SELECT company_id::text FROM actors
        WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
      [tenantId, receiverActorId]
    );
    if (!actorRow || !actorRow.company_id) {
      throw new BadRequestError(
        `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: receiver actor ${receiverActorId} ` +
          `sem company_id; basis='receiver_company_hq' exige actor PJ vinculado a company.`
      );
    }
    // 2. Resolve HQ assignment ativo via address_assignments(owner_type='company',
    //    owner_id=company_id, role='HQ', valid_until_at IS NULL).
    const hqRow = await pool.query<{
      address_id: string;
      country_id: string;
      state_id: string | null;
      city_id: string | null;
    }>(
      `SELECT aa.address_id::text, a.country_id::text,
              a.state_id::text, a.city_id::text
         FROM address_assignments aa
         JOIN addresses a ON a.address_id = aa.address_id
        WHERE aa.owner_type = 'company'
          AND aa.owner_id = $1::uuid
          AND aa.role = 'HQ'
          AND aa.valid_until_at IS NULL
        LIMIT 1`,
      [actorRow.company_id]
    );
    if (hqRow.rows.length === 0) {
      throw new BadRequestError(
        `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: company ${actorRow.company_id} ` +
          `(receiver) sem address_assignments(role='HQ') ativo.`
      );
    }
    countryId = hqRow.rows[0]!.country_id;
    stateId = hqRow.rows[0]!.state_id;
    cityId = hqRow.rows[0]!.city_id;
  } else {
    throw new BadRequestError(
      `POLICY_BASIS_UNKNOWN: basis='${basis}' fora do enum canônico (DECISION-0049).`
    );
  }

  // Fase 3b (DECISION-0166 D2): o NÍVEL vem da LINHA da policy — o resolver não inventa nível.
  // Defesa em profundidade: o CHECK chk_regional_level_required_for_regional_fund já garante
  // presença na escrita; aqui fail-closed contra linha legada/anômala.
  const level = calcSplit.regionalLevel;
  if (!level) {
    throw new BadRequestError(
      `POLICY_REGIONAL_LEVEL_REQUIRED: linha regional_fund sem regional_level ` +
        `(DECISION-0166 D2). Recrie a policy (nova versão) declarando o nível.`
    );
  }
  if (level === 'neighborhood') {
    // D4: HOLD fail-closed — catálogo de bairros não governado; ativação = decisão soberana.
    const err = new BadRequestError(
      `REGIONAL_FUND_NEIGHBORHOOD_HOLD: nível neighborhood em HOLD (DECISION-0166 D4) — ` +
        `catálogo de bairros não governado.`
    ) as BadRequestError & { statusCode?: number };
    err.statusCode = 501;
    throw err;
  }

  // A origem cadastral é exigida para QUALQUER nível (D0: sem jurisdição cadastral resolvida,
  // não há fatia regional — planet incluído). Os IDs exigidos são truncados AO NÍVEL da linha.
  const requiredIds: Record<string, string | null> =
    level === 'planet' ? {}
    : level === 'country' ? { countryId }
    : level === 'state' ? { countryId, stateId }
    : { countryId, stateId, cityId };
  const missing = Object.entries(requiredIds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new BadRequestError(
      `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE: address resolvido mas faltam IDs (${missing.join(', ')}) ` +
        `para basis='${basis}' level='${level}'. Endereço precisa estar ` +
        `normalizado em Location Core (DECISION-0020).`
    );
  }

  // B-CITY-1 (DECISION-0177 D7 — fecha DT-BANK-CITY-CURITIBA-ACTIVATION-MISSING): piloto
  // Curitiba-only por UUID canônico server-side. Cidade não habilitada = fail-closed ANTES de
  // qualquer lookup/write. Sem env, sem nome, sem "qualquer cidade com mapping/residência".
  if (level === 'city' && !isRegionalFundCityEnabled(cityId)) {
    throw new BadRequestError(
      `REGIONAL_FUND_CITY_NOT_ENABLED: city ${cityId} não habilitada para o fundo municipal ` +
        `(piloto Curitiba-only, DECISION-0177 D7). Ativação de outra cidade = decisão soberana.`
    );
  }

  // B-CITY-1 (DECISION-0177 D4 — fecha DT-BANK-REGIONAL-FUND-AUTOPROVISION-IN-MONEY-PATH):
  // resolução LOOKUP-ONLY por FK canônica (regional_fund_accounts, DECISION-0166 D3). O money
  // path NÃO cria conta: ausência de mapping = provisionamento prévio ausente = fail-closed
  // ANTES de bank_transactions/bank_ledger/bank_splits.
  const scope =
    level === 'planet' ? ({ level: 'planet' } as const)
    : level === 'country' ? ({ level: 'country', countryId: countryId! } as const)
    : level === 'state' ? ({ level: 'state', countryId: countryId!, stateId: stateId! } as const)
    : ({ level: 'city', countryId: countryId!, stateId: stateId!, cityId: cityId! } as const);
  const fundAccount = await bankAccountService.lookupRegionalFundAccount(tenantId, scope);
  if (!fundAccount) {
    throw new BadRequestError(
      `REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED: nenhum mapping em regional_fund_accounts para ` +
        `scope='${level}' (tenant ${tenantId}). O fundo deve ser PRÉ-provisionado por rito ` +
        `governado (DECISION-0177 D4/D6) — o pagamento nunca cria conta.`
    );
  }

  // Snapshot LEGÍTIMO (não fabricado), TRUNCADO ao nível: só os IDs que definem o escopo.
  const jurisdictionSnapshot: Record<string, unknown> = { basis, level };
  if (level !== 'planet') jurisdictionSnapshot.countryId = countryId;
  if (level === 'state' || level === 'city') jurisdictionSnapshot.stateId = stateId;
  if (level === 'city') jurisdictionSnapshot.cityId = cityId;

  return {
    destinationAccountId: fundAccount.accountId,
    splitType: 'regional_fund',
    releaseToActorWallet: false,
    receiverActorId: '',
    jurisdictionSnapshot,
  };
}

function deterministicServicePaymentExecutedOutboxEventId(tenantId: string, executionId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_EXECUTED:${tenantId}:${executionId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function deterministicServicePaymentSplitAppliedOutboxEventId(tenantId: string, splitId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_SPLIT_APPLIED:${tenantId}:${splitId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

class ServicePaymentExecutionService {
  /**
   * Cria uma nova execução de pagamento
   * 🔴 BLINDAGEM: paymentRequestId é OBRIGATÓRIO
   * 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
   * 🔴 BLINDAGEM: Execução é explícita, nunca automática
   */
  async createExecution(
    tenantId: string,
    userId: string,
    input: CreateServicePaymentExecutionInput,
    /**
     * Pattern existingClient (convergência arquitetural — espelha
     * bankTransactionService.createTransactionWithExplicitSplitLines
     * L262-263, bankIntegrationService.processServicePaymentExecutionCanonical
     * L474, servicePaymentExecutionRepository.create L193,
     * createPaymentIntentWithClient).
     *
     * - Modo DONO (sem existingClient): comportamento inalterado.
     *   Auto-cria client via getClientWithTenant, faz BEGIN/COMMIT/
     *   ROLLBACK/release internamente.
     * - Modo CONVIDADO (com existingClient): tx pertence ao caller.
     *   NÃO faz BEGIN, NÃO COMMIT, NÃO ROLLBACK, NÃO release.
     *   As 4 escritas (bank + execution + intent + outbox) continuam
     *   no MESMO client. Atomicidade material — a tx do caller decide
     *   se as 4 persistem ou são descartadas.
     *
     * Habilita prova de rollback do payment_intent escrowed no caminho
     * REAL (B7.b em validate-pipeline-e2e-transversal.ts).
     */
    existingClient?: PoolClient
  ): Promise<{ execution: ServicePaymentExecution; splits: PaymentSplit[] }> {
    // 🔴 BLINDAGEM: Validar que paymentRequestId foi fornecido
    if (!input.paymentRequestId) {
      throw new BadRequestError('paymentRequestId é obrigatório para criar execução');
    }

    // 🔴 BLINDAGEM: Validar que payment request existe e está pendente
    const paymentRequest = await servicePaymentRequestRepository.findById(tenantId, input.paymentRequestId);
    if (!paymentRequest) {
      throw new BadRequestError('Payment request não encontrado');
    }
    if (paymentRequest.paymentRequestStatus !== PaymentRequestStatus.PENDING) {
      throw new BadRequestError('Só é possível executar payment request com status pending');
    }

    // 🔴 BLINDAGEM: Validar que payer_actor existe
    const payerActor = await actorRepository.findById(tenantId, paymentRequest.payerActorId);
    if (!payerActor) {
      throw new BadRequestError('Actor pagador não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que receiver_actor existe
    const receiverActor = await actorRepository.findById(tenantId, paymentRequest.receiverActorId);
    if (!receiverActor) {
      throw new BadRequestError('Actor receptor não encontrado');
    }

    if (paymentRequest.currency !== 'BRL' || payerActor.actor_type !== 'user' || !payerActor.user_id) {
      throw new BadRequestError(
        'Execução canónica exige moeda BRL e pagador usuário com user_id (bank_splits).'
      );
    }

    const payerUserId = payerActor.user_id;

    // C4b-2 lazy (DECISION-0057): garante user_wallet do payer antes de abrir transação.
    // Idempotente — sem efeito se já existir. user_id validado acima (nunca lança USER_WALLET_REQUIRES_USER_ID aqui).
    await bankAccountService.ensureUserWalletForActor(tenantId, paymentRequest.payerActorId);

    // ============================================================
    // PE-3 (2026-05-26 — DECISION-0048) — RESOLUÇÃO DE POLICY
    // ============================================================
    // Dois caminhos:
    //
    // (1) LEGACY — caller passa `input.splits` explícitos. Cada split vai
    //     para escrow_payments como revenue_share (compat com E2Es e
    //     fluxos pré-PE-3). Path mantido até cutover completo.
    //
    // (2) CANÔNICO — caller NÃO passa `input.splits`. service_execution
    //     resolve `economic_policy_engine`, calcula splits via BPS integer
    //     e mapeia cada destination_type para a bank_account correta:
    //       revenue_share/receiver_actor → escrow_payments (D-money libera)
    //       platform_fee                → conta system platform_fees
    //       regional_fund               → conta system regional_fund
    //       reserve / risk_reserve      → conta system risk_reserve
    //       escrow_payments             → escrow_payments direto
    //     FAIL-CLOSED em POLICY_NOT_FOUND / POLICY_AMBIGUITY / destino
    //     não suportado (referral / group_allocation / channel_commission
    //     / custom — frente PE-4+).
    //
    // metadata.splits do payment_intent guarda APENAS os splits que devem
    // ser liberados depois para actor_wallet via D-money — i.e., apenas
    // revenue_share em escrow_payments. Demais splits caem nos destinos
    // finais (system accounts) na MESMA bank_transaction e NÃO são
    // tocados pelo D-money.
    // ============================================================
    type LocalSplitRecipient = {
      receiverActorId: string;
      amountCents: number;
      percentage: number | null;
      destinationAccountId?: string;
      splitType?: BankSplitType;
      lineType?: EconomicPolicyLineType;
      releaseToActorWallet: boolean;
      /** Fase 2c: jurisdição por FK da linha regional_fund (demais linhas: null). */
      jurisdictionSnapshot?: Record<string, unknown> | null;
    };

    let splitRecipients: LocalSplitRecipient[];
    let policyAuditMetadata: Record<string, any> = {};
    // DECISION-0166 D5 (F1-c): versão de policy que decidiu os splits — gravada por
    // split em bank_splits.policy_version_id. Permanece null no caminho legado.
    let policyVersionIdForSplits: string | null = null;

    if (input.splits && input.splits.length > 0) {
      // LEGACY: splits explícitos do caller (E2E/teste antigo).
      // Todos vão para escrow_payments + splitType='revenue_share' por
      // padrão (omissão de destinationAccountId/splitType no envio ao
      // bank força fallback compat).
      splitRecipients = input.splits.map((s) => ({
        receiverActorId: s.receiverActorId,
        amountCents: s.amountCents,
        percentage: s.percentage ?? null,
        releaseToActorWallet: true,
      }));
    } else {
      // PE-3 CANÔNICO: resolver policy + calcular + mapear.
      await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');

      const policyResult = await economicPolicyEngineService.resolveEconomicPolicy({
        tenantId,
        moduleContext: 'service_execution',
        vertical: 'services',
        actorId: paymentRequest.receiverActorId,
        actorType: receiverActor.actor_type,
        pricingModel: 'fixed',
        settlementFlow: 'fixed_price_escrow',
        transactionTime: new Date(),
      });

      if (policyResult.status !== 'resolved') {
        throw new BadRequestError(
          `POLICY_${policyResult.errorCode ?? policyResult.status.toUpperCase()}: ` +
            `${policyResult.errorMessage ?? 'service_execution fail-closed (sem policy aplicável)'}`
        );
      }

      // Base DECLARADA: amountCents do payment request é o BRUTO do pagamento do serviço. A policy
      // viva deste contexto (legacy_baseline_service_execution) mede gross_transaction — medido
      // no banco, nao deduzido. Divergencia futura vira erro, nunca calculo sobre regua errada.
      const calc = economicPolicyEngineService.calculatePolicySplits(
        paymentRequest.amountCents,
        policyResult.lines,
        'gross_transaction'
      );

      splitRecipients = [];
      for (const calcSplit of calc.splits) {
        // Descartar splits que arredondaram para 0 (bps muito pequeno *
        // amount pequeno). O bank rejeita amount=0 por linha; o drift já
        // foi corretamente absorvido por revenue_share[0] no
        // calculatePolicySplits do PE-1.
        if (calcSplit.amountCents === 0) continue;
        const dest = await resolveSplitDestinationFromPolicy(
          tenantId,
          paymentRequest.payerActorId,
          paymentRequest.receiverActorId,
          calcSplit,
          'BRL'
        );
        splitRecipients.push({
          receiverActorId: dest.receiverActorId,
          amountCents: calcSplit.amountCents,
          percentage: null,
          destinationAccountId: dest.destinationAccountId,
          splitType: dest.splitType,
          lineType: calcSplit.lineType,
          releaseToActorWallet: dest.releaseToActorWallet,
          jurisdictionSnapshot: dest.jurisdictionSnapshot ?? null,
        });
      }

      policyVersionIdForSplits = policyResult.policy!.id;
      policyAuditMetadata = {
        policyId: policyResult.policy!.id,
        policyCode: policyResult.policy!.policyCode,
        policyVersion: policyResult.policy!.version,
        appliedAccessPassId: policyResult.appliedAccessPass?.id ?? null,
        grossAmountCents: paymentRequest.amountCents,
        calculatedSplits: calc.splits.map((s) => ({
          lineType: s.lineType,
          destinationType: s.destinationType,
          bps: s.bps,
          amountCents: s.amountCents,
        })),
      };
    }

    const splitsSum = splitRecipients.reduce((sum, s) => sum + s.amountCents, 0);
    if (splitsSum !== paymentRequest.amountCents) {
      throw new BadRequestError(
        `Soma dos splits (${splitsSum}) deve ser igual ao amountCents (${paymentRequest.amountCents})`
      );
    }

    // Validar receiverActorId apenas quando fornecido — system splits
    // (platform_fee, regional_fund, reserve) usam '' como receiverActorId.
    for (const r of splitRecipients) {
      if (r.receiverActorId) {
        const a = await actorRepository.findById(tenantId, r.receiverActorId);
        if (!a) {
          throw new BadRequestError(`Actor receptor do split não encontrado: ${r.receiverActorId}`);
        }
      }
    }

    const executionId = uuidv4();

    // ============================================================
    // OUTBOX_ATOMICITY_HARDENING (Opção A) — 1 transação cobrindo
    // bank + execution row + outbox. Eliminação do "dinheiro sem
    // evento": se qualquer escrita falhar, ROLLBACK reverte tudo.
    // O catch externo antigo (L222-225 pré-fatia) que engolia falhas
    // de outbox como "não crítico" foi REMOVIDO — agora a falha do
    // outbox DEVE quebrar a transação inteira. DT-OUTBOX-ATOMICITY
    // RESOLVED via este caminho.
    // ============================================================
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;
    let execution: ServicePaymentExecution;
    let bankSplitsForOutbox: Array<{
      splitId: string;
      receiverActorId: string;
      amountCents: number;
      percentage: number | null;
    }>;

    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      // 1) BANK — escreve bank_transactions + bank_ledger entries + bank_splits
      //    NO MESMO client. Retorna splits agregados (splitId + receiverActorId
      //    + amountCents + percentage) prontos para emissão do outbox sem
      //    releitura de banco. PE-3: splitRecipients agora carrega
      //    destinationAccountId/splitType opcionais — bank respeita ambos
      //    quando fornecidos.
      const bankResult = await bankIntegrationService.processServicePaymentExecutionCanonical(
        tenantId,
        {
          paymentRequestId: paymentRequest.paymentRequestId,
          executionId,
          payerUserId,
          payerActorId: paymentRequest.payerActorId,
          amountCents: paymentRequest.amountCents,
          currency: 'BRL',
          splitRecipients: splitRecipients.map((r) => ({
            receiverActorId: r.receiverActorId,
            amountCents: r.amountCents,
            percentage: r.percentage,
            destinationAccountId: r.destinationAccountId,
            splitType: r.splitType,
            jurisdictionSnapshot: r.jurisdictionSnapshot ?? null,
          })),
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            bookingId: paymentRequest.bookingId,
            serviceId: paymentRequest.serviceId,
          },
          policyVersionId: policyVersionIdForSplits,
        },
        client
      );
      const bankTransactionId = bankResult.transactionId;
      bankSplitsForOutbox = bankResult.splits;

      // 2) EXECUTION row — INSERT service_payment_executions no MESMO client.
      execution = await servicePaymentExecutionRepository.create(
        tenantId,
        paymentRequest.paymentRequestId,
        paymentRequest.payerActorId,
        paymentRequest.receiverActorId,
        paymentRequest.amountCents,
        paymentRequest.currency,
        bankTransactionId,
        executionId,
        client
      );

      // 3) PAYMENT INTENT — INSERT payment_intents status='escrowed' no MESMO
      //    client. Fecha o vínculo execução↔intent que destrava a Camada 1.
      //
      //    CAMADA 1 — ENTRADA EM ESCROW (Decisão Clayton D1'/D1''/D1'''):
      //    sem este intent, o settlement-worker NÃO tem fila para consumir
      //    e o dinheiro recém-creditado em escrow_payments fica preso. O par
      //    (crédito escrow + intent escrowed) acontece JUNTO ou nenhum
      //    acontece — atomicidade preservada pela mesma transação BEGIN/COMMIT.
      //
      //    Rastreabilidade do escrow agregado (D1''): metadata carrega
      //    receiverActorId, executionId, splits agregados — suficiente para
      //    o release alimentar seller_pending por receiver na próxima fatia.
      //
      //    UNIQUE (tenant_id, reference_id) em payment_intents: o
      //    referenceId = paymentRequestId é UNIQUE no payment_request (1
      //    request por booking), logo a constraint protege contra criação
      //    duplicada de intent para a mesma execução.
      // PE-3 (DECISION-0048): metadata.splits guarda APENAS os splits que
      // devem ser repassados ao actor_wallet pelo D-money (= linhas com
      // releaseToActorWallet=true, i.e. revenue_share em escrow_payments).
      // Splits direct-to-system (platform_fee, regional_fund, reserve) já
      // caíram nos destinos finais na MESMA bank_transaction e NÃO são
      // tocados pelo D-money — não vão em metadata.splits.
      //
      // Compat legacy: quando input.splits foi fornecido, todos têm
      // releaseToActorWallet=true → comportamento inalterado para fluxos
      // antigos.
      const releaseSplits = bankSplitsForOutbox
        .map((bankSplit, idx) => ({
          bankSplit,
          releaseToActorWallet: splitRecipients[idx]!.releaseToActorWallet,
        }))
        .filter(({ releaseToActorWallet }) => releaseToActorWallet)
        .map(({ bankSplit }) => ({
          splitId: bankSplit.splitId,
          receiverActorId: bankSplit.receiverActorId,
          amountCents: bankSplit.amountCents,
          percentage: bankSplit.percentage,
        }));

      await createPaymentIntentWithClient(client, tenantId, {
        referenceId: paymentRequest.paymentRequestId,
        gateway: 'unify_bank',
        actorId: paymentRequest.payerActorId,
        amountCents: paymentRequest.amountCents,
        currency: paymentRequest.currency,
        status: 'escrowed',
        source: 'service_execution',
        intentType: 'payment',
        metadata: {
          executionId: execution.executionId,
          paymentRequestId: paymentRequest.paymentRequestId,
          bookingId: paymentRequest.bookingId,
          serviceId: paymentRequest.serviceId,
          receiverActorId: paymentRequest.receiverActorId,
          bankTransactionId,
          splits: releaseSplits,
          // PE-3 audit trail
          ...policyAuditMetadata,
        },
      });

      // 4) OUTBOX — INSERTs event_outbox no MESMO client. Atomicidade
      //    completa: bank + execution + intent + outbox commitam ou rollback juntos.
      await insertEventOutboxRow(client, {
        tenantId,
        eventId: deterministicServicePaymentExecutedOutboxEventId(tenantId, execution.executionId),
        eventType: ActorEffect.SERVICE_PAYMENT_EXECUTED,
        eventVersion: 1,
        payload: {
          actorId: paymentRequest.payerActorId,
          actorType: payerActor.actor_type as any,
          intent: 'EXECUTE_PAYMENT',
          sourceId: execution.executionId,
          sourceType: 'service_payment_execution',
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            amountCents: execution.amountCents,
            currency: execution.currency,
            splitsCount: bankSplitsForOutbox.length,
          },
        },
        metadata: {
          userId: userId,
          paymentRequestId: paymentRequest.paymentRequestId,
          executionId: execution.executionId,
        },
      });
      for (const split of bankSplitsForOutbox) {
        await insertEventOutboxRow(client, {
          tenantId,
          eventId: deterministicServicePaymentSplitAppliedOutboxEventId(tenantId, split.splitId),
          eventType: ActorEffect.SERVICE_PAYMENT_SPLIT_APPLIED,
          eventVersion: 1,
          payload: {
            actorId: split.receiverActorId,
            actorType: 'user' as any, // Será resolvido pelo effect handler
            intent: 'EXECUTE_PAYMENT',
            sourceId: split.splitId,
            sourceType: 'payment_split',
            metadata: {
              executionId: execution.executionId,
              amountCents: split.amountCents,
              percentage: split.percentage,
            },
          },
          metadata: {
            userId: userId,
            executionId: execution.executionId,
            splitId: split.splitId,
          },
        });
      }

      // COMMIT único — ou tudo grava, ou nada grava.
      // Modo CONVIDADO: NÃO commitamos — a tx é do caller.
      if (ownClient) {
        await client.query('COMMIT');
      }
    } catch (error) {
      if (ownClient) {
        try {
          await client.query('ROLLBACK');
        } catch (_rollbackErr) {
          // ROLLBACK falhou (conexão perdida) — propaga erro original.
        }
      }
      // Modo CONVIDADO: NÃO rollbackamos — a tx é do caller. O caller
      // observa o throw e decide se ROLLBACK ou outras escritas seguem.
      throw error;
    } finally {
      if (ownClient) {
        client.release();
      }
      // Modo CONVIDADO: NÃO release — o client pertence ao caller.
    }

    // Após COMMIT atômico — leitura derivada para devolver PaymentSplit[] no
    // formato esperado pelo contrato externo do método. bank_splits já está
    // comitado; findSplitsByExecutionId lê de fora da transação com segurança.
    const splits = await servicePaymentExecutionRepository.findSplitsByExecutionId(
      tenantId,
      execution.executionId
    );

    return { execution, splits };
  }

  /**
   * Busca execução por Payment Request ID
   * 🔴 BLINDAGEM: Apenas uma execução por payment_request (constraint UNIQUE)
   */
  async getExecutionByPaymentRequest(tenantId: string, paymentRequestId: string): Promise<{
    execution: ServicePaymentExecution | null;
    splits: PaymentSplit[];
  }> {
    // Validar que payment request existe
    const paymentRequest = await servicePaymentRequestRepository.findById(tenantId, paymentRequestId);
    if (!paymentRequest) {
      throw new BadRequestError('Payment request não encontrado');
    }

    const execution = await servicePaymentExecutionRepository.findByPaymentRequestId(tenantId, paymentRequestId);
    
    if (!execution) {
      return { execution: null, splits: [] };
    }

    const splits = await servicePaymentExecutionRepository.findSplitsByExecutionId(tenantId, execution.executionId);

    return { execution, splits };
  }
}

export const servicePaymentExecutionService = new ServicePaymentExecutionService();


