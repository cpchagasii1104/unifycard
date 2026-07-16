// backend/src/modules/bank/fiscal-reserve-bank-composition.service.ts
//
// FISCAL-4E · PASSE 3 — COMPOSIÇÃO FISCAL-BANK DORMENTE (DECISION-0179 · DECISION-0182 · DECISION-0183).
//
// Serviço INTERNO · DORMENTE · non-HTTP · non-worker · pre-activation. Transforma a COMMISSION GROSS
// SOURCE LINE (linha Bank original da comissão bruta da plataforma) em uma OU duas linhas Bank POSITIVAS:
//   commission_distributable > 0  → continuation line (herda destino/split_type/titularidade da source)
//   tax_reserve > 0               → tax_reserve line (destino = conta fiscal_reserve, resolver lookup-only)
// Materializa SOMENTE buckets positivos (DECISION-0183 D1/D2): bucket = 0 NÃO vira linha física — o zero é
// preservado no evento e no fingerprint (CHECK amount_cents>0 do sink permanece intacto; sem sentinela).
//
// Vive no DOMÍNIO BANK (direção de dependência Bank→fiscal; a escrita bank_* acontece EXCLUSIVAMENTE no sink
// canônico createTransactionWithExplicitSplitLines — este serviço NÃO duplica o sink). NÃO está na allowlist
// B8 do guard 4d-1 (consumidores monetários do motor). NÃO liga rota/controller/worker/cron/queue/webhook/
// frontend/caller vivo: dormência dupla (zero caller + firewall do sink OFF por padrão).
//
// DECISION-0183 D9 / envelope §7: allowlist D10 sobre commission_distributable = VAZIA — este serviço NUNCA
// materializa economic_policy_line sobre distributable; a continuation é a CONTINUAÇÃO da linha original,
// não uma nova distribuição. As demais linhas do split set original passam intactas.

import type { PoolClient } from 'pg';
import { fiscalProvisionService } from '@modules/fiscal-provision/fiscal-provision.service';
import { fiscalProvisionEventRepository } from '@modules/fiscal-provision/fiscal-provision-event.repository';
import { computeFiscalEconomicFingerprint } from '@modules/fiscal-provision/fiscal-economic-fingerprint';
import type { FiscalConsumptionMode } from '@modules/fiscal-provision/fiscal-provision.types';
import type { PlatformRevenueStream } from '@modules/fiscal/tax-catalog.types';
import { resolveFiscalReserveAccount } from './fiscal-reserve-account.resolver';
import { bankTransactionService } from './bank-transaction.service';
import type { BankSplitType } from './bank-split.types';
import type { FinancialAuthorshipContext } from './financial-authorship.types';
import type { BankCurrency } from './bank-account.types';

/** Falha fechada da composição (todas ANTES de qualquer write; §4/§5/§8). */
export class FiscalReserveCompositionError extends Error {
  readonly statusCode: number;
  constructor(code: string, message: string, statusCode = 422) {
    super(`${code}: ${message}`);
    this.name = 'FiscalReserveCompositionError';
    this.statusCode = statusCode;
  }
}

/** Uma linha do split set ORIGINAL (a source line de commission_gross é UMA delas, identificada por lineId). */
export interface OriginalSplitLine {
  /** Identidade explícita e estável da linha (fornecida pelo chamador; NÃO posicional). */
  lineId: string;
  targetAccountId: string;
  /** Centavos inteiros > 0. */
  amountCents: number;
  receiverActorId: string;
  splitType?: BankSplitType;
  percentage?: number | null;
  jurisdictionSnapshot?: Record<string, unknown> | null;
}

export interface FiscalReserveCompositionInput {
  tenantId: string;
  currency: 'BRL';
  // raiz externa de idempotência (DECISION-0179 D11)
  referenceType: string;
  referenceId: string;
  // contexto da transação Bank
  fromAccountId: string;
  payerActorId: string;
  conceptId: string;
  description: string;
  metadata?: Record<string, unknown>;
  authorship: FinancialAuthorshipContext;
  // split set original + identidade EXPLÍCITA da source line de commission_gross
  originalSplitLines: OriginalSplitLine[];
  commissionGrossSourceLineId: string;
  // contexto fiscal PLATFORM (jurisdição = CADASTRAL do contribuinte, IDs canônicos)
  platformRevenueStream: PlatformRevenueStream;
  fiscalCountryId: string;
  fiscalStateId?: string | null;
  fiscalCityId?: string | null;
  occurredAt: Date;
  effectiveAt?: Date;
  /** Materialização exige provisão VÁLIDA → 'mandatory'. */
  consumptionMode: FiscalConsumptionMode;
  // território econômico do COMPRADOR (snapshot separado da jurisdição fiscal; §9)
  buyerTerritory: Record<string, unknown> | null;
}

export interface FiscalReserveCompositionResult {
  fiscalProvisionEventId: string;
  bankTransactionId: string;
  idempotent: boolean;
  commissionGrossCents: number;
  taxReserveCents: number;
  commissionDistributableCents: number;
  materializedContinuation: boolean;
  materializedTaxReserve: boolean;
  splitCount: number;
}

export interface FiscalReserveReversalInput {
  tenantId: string;
  referenceType: string;
  referenceId: string;
  actorId: string;
}

export interface FiscalReserveReversalResult {
  reversalEventId: string;
  reversedEventId: string;
  idempotent: boolean;
  bankReversalTransactionId: string;
}

function assertInteger(name: string, n: number): void {
  if (!Number.isInteger(n)) {
    throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_NON_INTEGER', `${name}=${n} não é inteiro`);
  }
}

class FiscalReserveBankCompositionService {
  /**
   * COMPOSIÇÃO (provisão). Executa TUDO sob `existingClient` (transação DONA do chamador): nenhuma camada
   * interna dá COMMIT/ROLLBACK/release; falha em qualquer ponto → o chamador faz ROLLBACK de tudo
   * (evento + logs + transaction + splits + ledger). O sink 403 quando o firewall está OFF (dormência).
   */
  async composePlatformCommission(
    input: FiscalReserveCompositionInput,
    existingClient: PoolClient
  ): Promise<FiscalReserveCompositionResult> {
    if (existingClient == null) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_EXTERNAL_CLIENT_REQUIRED',
        'composição dormente exige transação DONA (existingClient) — sem aquisição própria de conexão',
        500
      );
    }
    const { tenantId, currency, referenceType, referenceId } = input;
    if (currency !== 'BRL') {
      throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_CURRENCY_UNSUPPORTED', `currency=${currency}`);
    }
    if (!Array.isArray(input.originalSplitLines) || input.originalSplitLines.length === 0) {
      throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_EMPTY_SPLIT_SET', 'split set original vazio');
    }
    for (const l of input.originalSplitLines) {
      assertInteger(`splitLine[${l.lineId}].amountCents`, l.amountCents);
      if (l.amountCents <= 0) {
        throw new FiscalReserveCompositionError(
          'FISCAL_COMPOSITION_NONPOSITIVE_ORIGINAL_LINE',
          `linha original ${l.lineId} com amount ${l.amountCents} (≤0) — split físico exige >0`
        );
      }
    }

    // ── §4 SOURCE LINE EXPLÍCITA (fail-closed; NUNCA inferida) ──
    const matches = input.originalSplitLines.filter((l) => l.lineId === input.commissionGrossSourceLineId);
    if (matches.length === 0) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_SOURCE_LINE_MISSING',
        `source line ${input.commissionGrossSourceLineId} ausente do split set original`
      );
    }
    if (matches.length > 1) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_SOURCE_LINE_DUPLICATE',
        `source line ${input.commissionGrossSourceLineId} aparece ${matches.length}× (esperado exatamente uma)`
      );
    }
    const source = matches[0]!;
    if (!source.targetAccountId) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_SOURCE_DESTINATION_INCOMPATIBLE',
        `source line ${source.lineId} sem destination account`
      );
    }
    const commissionGrossCents = source.amountCents;

    // ── §8 PROVISÃO FISCAL UMA ÚNICA VEZ (mesma transação; logs idempotentes) ──
    const outcome = await fiscalProvisionService.provisionPlatformCommission(
      {
        tenantId,
        sourceModule: referenceType,
        sourceReferenceId: referenceId,
        taxpayerKind: 'platform',
        platformRevenueStream: input.platformRevenueStream,
        commissionGrossCents,
        conceptId: input.conceptId ?? null,
        countryId: input.fiscalCountryId,
        stateId: input.fiscalStateId ?? null,
        cityId: input.fiscalCityId ?? null,
        occurredAt: input.occurredAt,
        effectiveAt: input.effectiveAt ?? input.occurredAt,
        currency,
        consumptionMode: input.consumptionMode,
        contractVersion: 1,
      },
      existingClient
    );
    if (outcome.status !== 'found') {
      // materialização exige provisão VÁLIDA — ausência é fail-closed (nunca vira zero silencioso).
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_FISCAL_CONFIG_MISSING',
        `provisão fiscal ausente (${outcome.missingReason}) — materialização exige provisão válida`
      );
    }
    const taxReserveCents = outcome.taxReserveCents;
    const commissionDistributableCents = outcome.commissionDistributableCents;
    const snapshot = outcome.fiscalSnapshot;

    // ── §5 CONSERVAÇÃO (inteiros, sem float; gross = reserve + distributable) ──
    assertInteger('taxReserveCents', taxReserveCents);
    assertInteger('commissionDistributableCents', commissionDistributableCents);
    if (commissionDistributableCents < 0) {
      throw new FiscalReserveCompositionError(
        'COMMISSION_DISTRIBUTABLE_NEGATIVE',
        `distributable=${commissionDistributableCents} negativo — nenhuma materialização`
      );
    }
    if (taxReserveCents < 0) {
      throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_TAX_RESERVE_NEGATIVE', `tax_reserve=${taxReserveCents}`);
    }

    // ── DECISION-0183 D2 MATRIZ ZERO-BUCKET: (reserve=0 ∧ dist=0) ANTES da conservação ──
    // A source line é física e positiva (validada acima), logo commission_gross > 0. Um outcome fiscal
    // que declare AMBOS os buckets zero é uma CONTRADIÇÃO de invariante (nenhum bucket positivo para um
    // gross positivo) — fail-closed, nunca materializa linha.
    if (taxReserveCents === 0 && commissionDistributableCents === 0) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_INVARIANT_VIOLATION',
        `reserve=0 e distributable=0 com gross=${commissionGrossCents}>0 — incompatível com source line positiva`
      );
    }

    // ── §5 CONSERVAÇÃO por bucket (gross = reserve + distributable) ──
    if (commissionGrossCents !== taxReserveCents + commissionDistributableCents) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_CONSERVATION_VIOLATION',
        `gross=${commissionGrossCents} != reserve=${taxReserveCents} + distributable=${commissionDistributableCents}`
      );
    }

    // Snapshots territoriais SEPARADOS (§9): jurisdição fiscal CADASTRAL × território do comprador.
    const fiscalJurisdiction: Record<string, unknown> = {
      countryId: snapshot.countryId,
      stateId: snapshot.stateId,
      cityId: snapshot.cityId,
    };
    const sourceLineRef: Record<string, unknown> = { lineId: source.lineId };
    const destinationSnapshot: Record<string, unknown> = {
      targetAccountId: source.targetAccountId,
      splitType: source.splitType ?? 'revenue_share',
      receiverActorId: source.receiverActorId,
    };
    const taxRuleVersions = snapshot.rules.map((r) => ({ taxRuleId: r.taxRuleId, version: r.taxRuleVersion }));

    // ── §10 FINGERPRINT (identidade do PAYLOAD; tuple externa NÃO entra) ──
    const fingerprint = computeFiscalEconomicFingerprint({
      tenantId,
      fiscalIdentityId: snapshot.fiscalIdentityId,
      taxpayerKind: 'platform',
      taxRegime: snapshot.taxRegime,
      platformRevenueStream: input.platformRevenueStream,
      conceptId: snapshot.conceptId,
      fiscalJurisdiction,
      buyerTerritory: input.buyerTerritory,
      economicPolicyId: null, // allowlist D10 vazia — nenhuma policy line sobre distributable (§7)
      taxRuleVersions,
      currency,
      commissionGrossCents,
      taxReserveCents,
      commissionDistributableCents,
      sourceLineIdentity: sourceLineRef,
      sourceDestination: destinationSnapshot,
      eventKind: 'provision',
      reversesEventId: null,
      snapshotVersion: snapshot.calculationVersion,
    });

    // ── §8 (5)(6) EVENTO append-only (idempotente por tuple+fingerprint; mesma tx) ──
    const event = await fiscalProvisionEventRepository.insertProvisionEvent(
      {
        tenantId,
        fiscalIdentityId: snapshot.fiscalIdentityId,
        taxpayerKind: 'platform',
        currency,
        referenceType,
        referenceId,
        fiscalEconomicContextFingerprint: fingerprint,
        commissionGrossCents,
        taxReserveCents,
        commissionDistributableCents,
        sourceLineRef,
        destinationSnapshot,
        fiscalJurisdiction,
        buyerTerritory: input.buyerTerritory,
        snapshotVersion: snapshot.calculationVersion,
        fiscalSnapshot: snapshot as unknown as Record<string, unknown>,
        eventKind: 'provision',
        reversesEventId: null,
        status: 'materialized',
        occurredAt: input.occurredAt,
        effectiveAt: input.effectiveAt ?? input.occurredAt,
      },
      existingClient
    );

    // ── TRANSFORMAÇÃO: demais linhas intactas + buckets POSITIVOS (DECISION-0183 D1/D4/D5) ──
    const transformed: Array<{
      targetAccountId: string;
      amountCents: number;
      receiverActorId: string;
      splitType?: BankSplitType;
      percentage?: number | null;
      jurisdictionSnapshot?: Record<string, unknown> | null;
    }> = input.originalSplitLines
      .filter((l) => l.lineId !== source.lineId)
      .map((l) => ({
        targetAccountId: l.targetAccountId,
        amountCents: l.amountCents,
        receiverActorId: l.receiverActorId,
        splitType: l.splitType,
        percentage: l.percentage ?? null,
        jurisdictionSnapshot: l.jurisdictionSnapshot ?? null,
      }));

    let materializedContinuation = false;
    if (commissionDistributableCents > 0) {
      // §5 continuation: HERDA destino/split_type/titularidade da source; só o amount muda.
      transformed.push({
        targetAccountId: source.targetAccountId,
        amountCents: commissionDistributableCents,
        receiverActorId: source.receiverActorId,
        splitType: source.splitType,
        percentage: null,
        jurisdictionSnapshot: source.jurisdictionSnapshot ?? null,
      });
      materializedContinuation = true;
    }

    let materializedTaxReserve = false;
    if (taxReserveCents > 0) {
      // §6 resolver CONDICIONAL a tax_reserve>0 (DECISION-0183 D5): só aqui a conta fiscal_reserve é exigida.
      const reserveAccount = await resolveFiscalReserveAccount(
        { tenantId, fiscalIdentityId: snapshot.fiscalIdentityId, currency },
        existingClient
      );
      transformed.push({
        targetAccountId: reserveAccount.bankAccountId,
        amountCents: taxReserveCents,
        // tax_reserve = segregação INTERNA da comissão da plataforma (DECISION-0179): titularidade econômica
        // permanece a mesma da source (o dinheiro é da plataforma, apenas segregado na conta fiscal_reserve).
        receiverActorId: source.receiverActorId,
        splitType: 'tax_reserve',
        percentage: null,
        jurisdictionSnapshot: fiscalJurisdiction,
      });
      materializedTaxReserve = true;
    }

    // ── §5 conservação do split set: Σ(transformadas) == Σ(original) == amount da transação ──
    const amountCents = input.originalSplitLines.reduce((s, l) => s + l.amountCents, 0);
    const transformedSum = transformed.reduce((s, l) => s + l.amountCents, 0);
    if (transformedSum !== amountCents) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_SPLIT_SET_CONSERVATION_VIOLATION',
        `Σtransformadas=${transformedSum} != Σoriginal=${amountCents}`
      );
    }

    // ── §8 (7)(8)(9) SINK BANK CANÔNICO (existingClient; Σsplits==amount; firewall-gated) ──
    const sinkResult = await bankTransactionService.createTransactionWithExplicitSplitLines(
      tenantId,
      {
        referenceType,
        referenceId,
        fromAccountId: input.fromAccountId,
        payerActorId: input.payerActorId,
        amountCents,
        currency: currency as BankCurrency,
        splitLines: transformed,
        description: input.description,
        metadata: {
          ...(input.metadata ?? {}),
          fiscal_provision_event_id: event.id,
          fiscal_economic_context_fingerprint: fingerprint,
        },
        concept_id: input.conceptId,
        authorship: input.authorship,
      },
      existingClient
    );
    const bankTransactionId = sinkResult.transaction.transactionId;

    // Vínculo Bank→fiscal (DECISION-0179 D7): grava as colunas dedicadas em bank_transactions (bank_* write
    // legítima dentro de modules/bank, na MESMA transação). Idempotente: no replay o sink devolve a tx
    // existente e o UPDATE apenas reconfirma os mesmos valores.
    await existingClient.query(
      `UPDATE bank_transactions
          SET fiscal_provision_event_id = $1::uuid, fiscal_economic_context_fingerprint = $2
        WHERE tenant_id = $3::uuid AND id = $4::uuid`,
      [event.id, fingerprint, tenantId, bankTransactionId]
    );

    return {
      fiscalProvisionEventId: event.id,
      bankTransactionId,
      idempotent: event.idempotent,
      commissionGrossCents,
      taxReserveCents,
      commissionDistributableCents,
      materializedContinuation,
      materializedTaxReserve,
      splitCount: transformed.length,
    };
  }

  /**
   * FULL REVERSAL (DECISION-0179 D16 / DECISION-0183 D8). REUTILIZA amounts + snapshots do evento original
   * (NUNCA recomputa imposto, NUNCA relê policy). Reverte SOMENTE as linhas positivas originalmente
   * materializadas (bucket original zero permanece zero — zero não gera reversal line). Persiste NOVO evento
   * append-only (event_kind='full_reversal'), preservando o original imutável. Idempotente (dupla reversão
   * integral = no-op via tuple+kind). Fail-closed sem evento original.
   *
   * ELO DE FRONTEIRA (envelope §15): a reversão física do conjunto Bank usa o motor formal
   * `bankIntegrationService.reverseTransaction` → `requestAndExecuteReversalSync`, que gerencia a PRÓPRIA
   * transação (não aceita existingClient). O evento fiscal de reversão e a reversão Bank são, portanto,
   * DUPLAMENTE IDEMPOTENTES (não uma única transação): re-execução converge sem duplicar. Tornar os dois
   * uma única transação exigiria threading de existingClient no motor de reversão = escolha institucional
   * nova sobre a fronteira de reversão.
   */
  async reverseFullPlatformCommission(
    input: FiscalReserveReversalInput,
    existingClient: PoolClient
  ): Promise<FiscalReserveReversalResult> {
    if (existingClient == null) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_EXTERNAL_CLIENT_REQUIRED',
        'full reversal atômica exige transação DONA (existingClient)',
        500
      );
    }
    const { tenantId, referenceType, referenceId } = input;
    // §11 localizar evento original (fail-closed sem original) — na MESMA tx DONA
    const original = await fiscalProvisionEventRepository.findByTuple(tenantId, referenceType, referenceId, 'provision', existingClient);
    if (!original) {
      throw new FiscalReserveCompositionError(
        'FISCAL_COMPOSITION_REVERSAL_NO_ORIGINAL',
        `sem evento de provisão original para ${referenceType}/${referenceId} — full reversal proibido`,
        404
      );
    }
    const orig = await fiscalProvisionEventRepository.getProvisionEventById(tenantId, original.id, existingClient);
    if (!orig) {
      throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_REVERSAL_NO_ORIGINAL', 'cabeçalho original ausente', 404);
    }

    // Fingerprint de reversão: REUSA o payload original, mudando apenas eventKind + reversesEventId
    // (nenhum recomputo de imposto/policy — só re-serialização determinística dos mesmos fatos).
    const snap = orig.fiscal_snapshot as { rules?: Array<{ taxRuleId: string; taxRuleVersion: number }>; taxRegime?: string | null; conceptId?: string | null; fiscalIdentityId?: string };
    const taxRuleVersions = (snap.rules ?? []).map((r) => ({ taxRuleId: r.taxRuleId, version: r.taxRuleVersion }));
    const reversalFingerprint = computeFiscalEconomicFingerprint({
      tenantId,
      fiscalIdentityId: orig.fiscal_identity_id,
      taxpayerKind: 'platform',
      taxRegime: snap.taxRegime ?? null,
      platformRevenueStream: (orig.fiscal_snapshot as { platformRevenueStream?: string }).platformRevenueStream ?? null,
      conceptId: snap.conceptId ?? null,
      fiscalJurisdiction: orig.fiscal_jurisdiction,
      buyerTerritory: orig.buyer_territory,
      economicPolicyId: null,
      taxRuleVersions,
      currency: orig.currency,
      commissionGrossCents: orig.commission_gross_cents,
      taxReserveCents: orig.tax_reserve_cents,
      commissionDistributableCents: orig.commission_distributable_cents,
      sourceLineIdentity: orig.source_line_ref,
      sourceDestination: orig.destination_snapshot,
      eventKind: 'full_reversal',
      reversesEventId: original.id,
      snapshotVersion: orig.snapshot_version,
    });

    // Persiste o evento de reversão (idempotente por tuple+kind: dupla full reversal = no-op) na tx DONA.
    const reversalEvent = await fiscalProvisionEventRepository.insertProvisionEvent({
      tenantId,
      fiscalIdentityId: orig.fiscal_identity_id,
      taxpayerKind: 'platform',
      currency: orig.currency,
      referenceType,
      referenceId,
      fiscalEconomicContextFingerprint: reversalFingerprint,
      commissionGrossCents: orig.commission_gross_cents,
      taxReserveCents: orig.tax_reserve_cents,
      commissionDistributableCents: orig.commission_distributable_cents,
      sourceLineRef: orig.source_line_ref,
      destinationSnapshot: orig.destination_snapshot,
      fiscalJurisdiction: orig.fiscal_jurisdiction,
      buyerTerritory: orig.buyer_territory,
      snapshotVersion: orig.snapshot_version,
      fiscalSnapshot: orig.fiscal_snapshot,
      eventKind: 'full_reversal',
      reversesEventId: original.id,
      status: 'reversed',
      occurredAt: orig.occurred_at,
      effectiveAt: orig.effective_at,
    }, existingClient);

    // Reverte o conjunto Bank COMPOSTO na MESMA transação DONA (motor formal com existingClient; reverte
    // TODAS as legs = só as positivas materializadas). Import DINÂMICO (dormência). Atomicidade total:
    // evento fiscal de reversão + reversal row + legs Bank commitam/desfazem JUNTOS pelo chamador.
    const bankTxId = await this.locateBankTransactionId(tenantId, referenceType, referenceId, existingClient);
    const { bankIntegrationService } = await import('./bank-integration.service');
    const bankReversal = await bankIntegrationService.reverseTransaction(tenantId, bankTxId, undefined, input.actorId, existingClient);

    return {
      reversalEventId: reversalEvent.id,
      reversedEventId: original.id,
      idempotent: reversalEvent.idempotent,
      bankReversalTransactionId: bankReversal.reversalTransactionId,
    };
  }

  /** Localiza a bank_transaction composta por (tenant, reference tuple) na tx DONA. bank_* READ em modules/bank. */
  private async locateBankTransactionId(tenantId: string, referenceType: string, referenceId: string, existingClient: PoolClient): Promise<string> {
    const res = await existingClient.query<{ id: string }>(
      `SELECT id::text AS id FROM bank_transactions WHERE tenant_id = $1::uuid AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
      [tenantId, referenceType, referenceId]
    );
    const row = res.rows[0];
    if (!row) {
      throw new FiscalReserveCompositionError('FISCAL_COMPOSITION_REVERSAL_NO_BANK_TX', `sem bank_transaction para ${referenceType}/${referenceId}`, 404);
    }
    return row.id;
  }
}

export const fiscalReserveBankCompositionService = new FiscalReserveBankCompositionService();
