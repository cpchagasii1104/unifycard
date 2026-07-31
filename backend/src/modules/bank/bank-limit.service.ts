// backend/src/modules/bank/bank-limit.service.ts
// SPRINT 36.1: BANK SAFETY LAYER - Service para pedidos de mudança de limite
//
// ⚠️ HOTFIX (SPRINT 36.3): Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
// Nenhum fluxo financeiro (Bank) é bloqueado ou liberado baseado em step-up enquanto verificação real não existir.

import { bankLimitRepository } from './bank-limit.repository';
import { bankPolicyService } from './bank-policy.service';
import { bankLedgerRepository } from './bank-ledger.repository';
import { bankAccountService } from './bank-account.service';
import { getClientWithTenant } from '@core/database/pool';
import { asMoneyCents, toMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
import type {
  RequestLimitChangeInput,
  CurrentLimits,
  ActorLimit,
  BankLimitType,
} from './bank-limit.types';
import type { BankTransactionContext } from './bank-split.types';

/**
 * Defaults de limite (usados se não houver policy)
 */
const DEFAULT_LIMITS: Record<BankLimitType, MoneyCents> = {
  pix_out: asMoneyCents(500000),
  transfer_out: asMoneyCents(1_000_000),
  payment_out: asMoneyCents(2_000_000),
  daily_out: asMoneyCents(5_000_000),
  monthly_out: asMoneyCents(100_000_000),
};

/**
 * Cooldown para aumentos de limite (24 horas em milissegundos)
 */
const LIMIT_INCREASE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

class BankLimitService {
  /**
   * Busca limite padrão de uma policy ou usa default
   */
  private async getDefaultLimit(
    tenantId: string,
    limitType: BankLimitType
  ): Promise<MoneyCents> {
    // Tentar buscar da policy registry
    const policy = await bankPolicyService.getPolicy<{ defaultLimit?: number }>(
      tenantId,
      `limit.${limitType}`
    );

    if (policy?.defaultLimit != null) {
      return asMoneyCents(Math.round(Number(policy.defaultLimit)));
    }

    // Usar default hardcoded
    return DEFAULT_LIMITS[limitType];
  }

  /**
   * Busca limite atual de um actor por tipo
   * Retorna último applied ou default da policy
   */
  private async getCurrentLimit(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType
  ): Promise<MoneyCents> {
    // Buscar último limite aplicado
    const lastApplied = await bankLimitRepository.getLastAppliedLimit(
      tenantId,
      actorId,
      limitType
    );

    if (lastApplied !== null) {
      return lastApplied;
    }

    return await this.getDefaultLimit(tenantId, limitType);
  }

  /**
   * Threshold para exigir step-up em aumento de limite (em centavos)
   * Valores acima deste threshold exigem confirmação WebAuthn
   */
  private readonly STEP_UP_THRESHOLD = 1000000; // R$ 10.000,00

  /**
   * ⚠️ HOTFIX: Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
   * 
   * Flag de ambiente: WEBAUTHN_STEP_UP_STRICT
   * - false (default): Nunca bloqueia por step-up (sistema funciona normalmente)
   * - true: Falha-safe (retorna erro explícito dizendo que verify real não existe)
   */
  private readonly STEP_UP_STRICT_MODE = process.env.WEBAUTHN_STEP_UP_STRICT === 'true';

  /**
   * Verifica se step-up é necessário e válido
   * 
   * ⚠️ HOTFIX: Enforcement desativado por padrão.
   * Step-up só é exigido se WEBAUTHN_STEP_UP_STRICT=true (e mesmo assim falha-safe).
   */
  private async requireStepUpIfNeeded(
    tenantId: string,
    userId: string,
    requestedAmountCents: MoneyCents,
    currentLimitCents: MoneyCents,
    stepUpVerified?: boolean
  ): Promise<void> {
    // HOTFIX: Se strict mode não estiver ativo, nunca bloquear
    if (!this.STEP_UP_STRICT_MODE) {
      return; // Não bloquear - enforcement desativado
    }

    // Apenas exigir step-up se for aumento E valor > threshold
    const isIncrease = requestedAmountCents > currentLimitCents;
    const exceedsThreshold = requestedAmountCents > this.STEP_UP_THRESHOLD;

    if (!isIncrease || !exceedsThreshold) {
      return; // Não precisa step-up
    }

    // Verificar se usuário tem credencial registrada
    const { webauthnService } = await import('@core/auth/webauthn.service');
    const hasCredential = await webauthnService.hasCredential(tenantId, userId);

    if (!hasCredential) {
      // Não bloquear se não houver credencial (sistema funciona sem WebAuthn)
      return;
    }

    // HOTFIX: Se strict mode ativo, falhar-safe (verify real não existe)
    // Não aceitar stepUpVerified=true porque verify não está implementado
    const error = new Error('Step-up WebAuthn: verificação criptográfica real ainda não implementada. Enforcement financeiro desativado.') as Error & {
      statusCode?: number;
      errorCode?: string;
    };
    error.statusCode = 503; // Service Unavailable (não implementado)
    error.errorCode = 'STEP_UP_NOT_IMPLEMENTED';
    throw error;
  }

  /**
   * Solicita mudança de limite
   * - Se requestedAmountCents < limite atual → status = applied, effectiveAt = now
   * - Se requestedAmountCents > limite atual → status = pending, effectiveAt = now + 24h
   * - Se requestedAmountCents > threshold → exige step-up (se credencial registrada)
   */
  async requestLimitChange(
    tenantId: string,
    input: RequestLimitChangeInput,
    stepUpVerified?: boolean
  ): Promise<{
    requestId: string;
    status: 'pending' | 'applied';
    effectiveAt: Date;
    currentLimitCents: MoneyCents;
    requestedLimitCents: MoneyCents;
  }> {
    const amountCentsNorm = toMoneyCents(input.amountCents);
    const inputNorm: RequestLimitChangeInput = { ...input, amountCents: amountCentsNorm };

    // Buscar limite atual
    const currentLimit = await this.getCurrentLimit(
      tenantId,
      inputNorm.actorId,
      inputNorm.limitType
    );

    // SPRINT 36.3: Verificar se step-up é necessário
    // ⚠️ HOTFIX: Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
    // Por padrão, não bloqueia (WEBAUTHN_STEP_UP_STRICT=false)
    if (inputNorm.requestedByUserId) {
      await this.requireStepUpIfNeeded(
        tenantId,
        inputNorm.requestedByUserId,
        amountCentsNorm,
        currentLimit,
        stepUpVerified
      );
    }

    const now = new Date();
    let effectiveAt: Date;
    let status: 'pending' | 'applied';

    // Se redução (requestedAmountCents < current) → aplica imediatamente
    // Se aumento (requestedAmountCents > current) → cooldown de 24h
    if (amountCentsNorm < currentLimit) {
      effectiveAt = now;
      status = 'applied';
    } else if (amountCentsNorm > currentLimit) {
      effectiveAt = new Date(now.getTime() + LIMIT_INCREASE_COOLDOWN_MS);
      status = 'pending';
    } else {
      // Mesmo valor: aplica imediatamente (sem mudança)
      effectiveAt = now;
      status = 'applied';
    }

    // Criar pedido (append-only)
    const request = await bankLimitRepository.createLimitChangeRequest(
      tenantId,
      inputNorm,
      effectiveAt,
      status
    );

    return {
      requestId: request.id,
      status,
      effectiveAt: request.effectiveAt,
      currentLimitCents: currentLimit,
      requestedLimitCents: amountCentsNorm,
    };
  }

  /**
   * Retorna limites vigentes + pendências futuras de um actor
   */
  async getCurrentLimits(
    tenantId: string,
    actorId: string
  ): Promise<CurrentLimits> {
    const limitTypes: BankLimitType[] = [
      'pix_out',
      'transfer_out',
      'payment_out',
      'daily_out',
      'monthly_out',
    ];

    const limits: Record<
      BankLimitType,
      { currentAmountCents: MoneyCents; pending: { requestedAmountCents: MoneyCents; effectiveAt: Date } | null }
    > = {} as Record<
      BankLimitType,
      { currentAmountCents: MoneyCents; pending: { requestedAmountCents: MoneyCents; effectiveAt: Date } | null }
    >;

    for (const limitType of limitTypes) {
      const currentAmountCents = await this.getCurrentLimit(tenantId, actorId, limitType);
      const pending = await bankLimitRepository.getPendingRequest(
        tenantId,
        actorId,
        limitType
      );

      limits[limitType] = {
        currentAmountCents,
        pending: pending
          ? {
              requestedAmountCents: pending.requestedAmountCents,
              effectiveAt: pending.effectiveAt,
            }
          : null,
      };
    }

    return {
      actorId,
      limits,
    };
  }

  /**
   * Aplica pedidos pendentes quando effectiveAt <= now
   * Retorna número de pedidos aplicados
   */
  async applyPendingIfDue(
    tenantId: string,
    actorId?: string
  ): Promise<number> {
    const pendingRequests = await bankLimitRepository.getPendingRequestsDue(
      tenantId,
      actorId
    );

    let appliedCount = 0;

    for (const request of pendingRequests) {
      await bankLimitRepository.updateRequestStatus(
        tenantId,
        request.id,
        'applied'
      );
      appliedCount++;
    }

    return appliedCount;
  }

  /**
   * Busca limite de um tipo específico (com pendência se houver)
   */
  async getLimit(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType
  ): Promise<ActorLimit> {
    const current = await this.getCurrentLimit(tenantId, actorId, limitType);
    const pending = await bankLimitRepository.getPendingRequest(
      tenantId,
      actorId,
      limitType
    );

    return {
      limitType,
      currentAmountCents: current,
      pendingAmountCents: pending?.requestedAmountCents ?? null,
      pendingEffectiveAt: pending?.effectiveAt || null,
    };
  }

  /**
   * Mapeia contexto de transação para tipo de limite
   */
  private mapContextToLimitType(context: BankTransactionContext): BankLimitType | null {
    switch (context) {
      case 'p2p_transfer':
        return 'transfer_out';
      case 'service_booking':
      case 'event_ticket':
      case 'ride_payment':
        return 'payment_out';
      case 'withdrawal':
        // Assumir PIX para saques (pode ser refinado depois)
        return 'pix_out';
      default:
        // Depósitos e outros não contam para limites de saída
        return null;
    }
  }

  /**
   * Calcula uso diário (outflow) derivado do ledger
   * Soma apenas débitos (outflow) filtrados por contexto compatível com limitType
   * 
   * REGRA ARQUITETURAL: Uso é SEMPRE calculado do ledger (fonte da verdade)
   */
  async getDailyOutflow(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType,
    date?: Date
  ): Promise<MoneyCents> {
    const account = await bankAccountService.getAccountByOwner(
      tenantId,
      actorId,
      'user',
      'BRL'
    );

    if (!account) {
      return asMoneyCents(0);
    }

    // Data do dia (início e fim)
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Mapear limitType para contextos compatíveis
    const compatibleContexts: BankTransactionContext[] = [];
    switch (limitType) {
      case 'pix_out':
        compatibleContexts.push('withdrawal');
        break;
      case 'transfer_out':
        compatibleContexts.push('p2p_transfer');
        break;
      case 'payment_out':
        compatibleContexts.push('service_booking', 'event_ticket', 'ride_payment');
        break;
      case 'daily_out':
        // Todos os contextos de saída
        compatibleContexts.push('p2p_transfer', 'service_booking', 'event_ticket', 'ride_payment', 'withdrawal');
        break;
      case 'monthly_out':
        // Todos os contextos de saída
        compatibleContexts.push('p2p_transfer', 'service_booking', 'event_ticket', 'ride_payment', 'withdrawal');
        break;
    }

    if (compatibleContexts.length === 0) {
      return asMoneyCents(0);
    }

    const client = await getClientWithTenant(tenantId);
    try {
      if (limitType === 'daily_out' || limitType === 'monthly_out') {
        const result = await client.query<{ outflowCents: string }>(
          `
          SELECT COALESCE(SUM(amount_cents), 0)::text as "outflowCents"
          FROM bank_ledger
          WHERE account_id = $1
            AND direction = 'debit'
            AND created_at >= $2
            AND created_at <= $3
          `,
          [account.accountId, startOfDay, endOfDay]
        );

        return asMoneyCents(parseInt(result.rows[0]?.outflowCents || '0', 10));
      }

      const result = await client.query<{ outflowCents: string }>(
        `
        SELECT COALESCE(SUM(bl.amount_cents), 0)::text as "outflowCents"
        FROM bank_ledger bl
        INNER JOIN bank_transactions bt ON bl.transaction_id = bt.id
        WHERE bl.account_id = $1
          AND bl.direction = 'debit'
          AND bl.created_at >= $2
          AND bl.created_at <= $3
          AND COALESCE(bt.metadata->>'context', '') = ANY($4::text[])
        `,
        [account.accountId, startOfDay, endOfDay, compatibleContexts]
      );

      return asMoneyCents(parseInt(result.rows[0]?.outflowCents || '0', 10));
    } finally {
      client.release();
    }
  }

  /**
   * Threshold para exigir step-up em transações (em centavos)
   * Transações acima deste valor exigem confirmação WebAuthn
   */
  private readonly HIGH_VALUE_THRESHOLD = 500000; // R$ 5.000,00

  /**
   * Verifica se step-up é necessário para transação high-value
   * 
   * ⚠️ HOTFIX: Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
   * 
   * Flag de ambiente: WEBAUTHN_STEP_UP_STRICT
   * - false (default): Nunca bloqueia por step-up (sistema funciona normalmente)
   * - true: Falha-safe (retorna erro explícito dizendo que verify real não existe)
   */
  async requireStepUpForHighValue(
    tenantId: string,
    userId: string,
    amountCents: MoneyCents,
    stepUpVerified?: boolean
  ): Promise<void> {
    // HOTFIX: Se strict mode não estiver ativo, nunca bloquear
    if (!this.STEP_UP_STRICT_MODE) {
      return; // Não bloquear - enforcement desativado
    }

    if (amountCents <= this.HIGH_VALUE_THRESHOLD) {
      return; // Não precisa step-up
    }

    // Verificar se usuário tem credencial registrada
    const { webauthnService } = await import('@core/auth/webauthn.service');
    const hasCredential = await webauthnService.hasCredential(tenantId, userId);

    if (!hasCredential) {
      // Não bloquear se não houver credencial (sistema funciona sem WebAuthn)
      return;
    }

    // HOTFIX: Se strict mode ativo, falhar-safe (verify real não existe)
    // Não aceitar stepUpVerified=true porque verify não está implementado
    const error = new Error('Step-up WebAuthn: verificação criptográfica real ainda não implementada. Enforcement financeiro desativado.') as Error & {
      statusCode?: number;
      errorCode?: string;
    };
    error.statusCode = 503; // Service Unavailable (não implementado)
    error.errorCode = 'STEP_UP_NOT_IMPLEMENTED';
    throw error;
  }

  /**
   * Valida se transação pode ser executada (enforcement)
   * Aplica pendências antes de validar
   *
   * @param attemptedAmount centavos inteiros da operação (§4.7). Nome imposto pelo BankLimitPort; sem fração.
   * @throws Error com statusCode 403 se limite excedido
   */
  async validateLimit(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType,
    attemptedAmount: number,
    actingUserId?: string,
    stepUpVerified?: boolean
  ): Promise<void> {
    const attemptedAmountCents = toMoneyCents(attemptedAmount);

    // 1. Aplicar pendências vencidas
    await this.applyPendingIfDue(tenantId, actorId);

    // 2. SPRINT 36.3: Verificar step-up para transações high-value
    // ⚠️ HOTFIX: Step-up WebAuthn está em scaffolding; enforcement financeiro desativado até verificação criptográfica real.
    // Por padrão, não bloqueia (WEBAUTHN_STEP_UP_STRICT=false)
    if (actingUserId) {
      await this.requireStepUpForHighValue(
        tenantId,
        actingUserId,
        attemptedAmountCents,
        stepUpVerified
      );
    }

    // 3. Obter limite vigente
    const limit = await this.getLimit(tenantId, actorId, limitType);

    // 4. Calcular uso diário do ledger
    const usedToday = await this.getDailyOutflow(tenantId, actorId, limitType);

    // 5. Validar se transação excede limite
    if (usedToday + attemptedAmountCents > limit.currentAmountCents) {
      let referenceId: string | undefined;
      try {
        const { auditService } = await import('@core/audit/audit.service');
        const auditEvent = await auditService.record(tenantId, {
          event_type: 'BANK_LIMIT_EXCEEDED',
          severity: 'WARNING',
          actor_id: actorId,
          actor_type: 'user',
          company_id: undefined,
          source: 'bank_limit',
          context: {
            limit_type: limitType,
            limit_amount_cents: limit.currentAmountCents,
            used_today_cents: usedToday,
            attempted_amount_cents: attemptedAmountCents,
            acting_user_id: actingUserId || null,
            authority_source: 'bank_limit',
          },
        });
        referenceId = auditEvent.id;
      } catch (auditErr) {
        console.warn('[BankLimit] Erro ao registrar bloqueio em auditoria:', auditErr);
      }

      const error = new Error('Limite diário atingido') as Error & {
        statusCode?: number;
        errorCode?: string;
        limitType?: string;
        limitAmountCents?: MoneyCents;
        usedTodayCents?: MoneyCents;
        attemptedAmountCents?: MoneyCents;
        referenceId?: string;
      };
      error.statusCode = 403;
      error.errorCode = 'DAILY_LIMIT_EXCEEDED';
      error.limitType = limitType;
      error.limitAmountCents = limit.currentAmountCents;
      error.usedTodayCents = usedToday;
      error.attemptedAmountCents = attemptedAmountCents;
      error.referenceId = referenceId;
      throw error;
    }
  }
}

export const bankLimitService = new BankLimitService();



