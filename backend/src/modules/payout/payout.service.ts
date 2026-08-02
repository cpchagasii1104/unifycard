// backend/src/modules/payout/payout.service.ts
// Payout Service - Execução Financeira Controlada
// 🔴 BLINDAGEM: Nenhum payout sem validação completa
// 🔴 BLINDAGEM: Tudo amarrado a EvidencePack e Audit

import { payoutRepository } from './payout.repository';
import type {
  PayoutBatch,
  PayoutOrder,
  CreatePayoutBatchInput,
  ExecutePayoutManualInput,
  FailPayoutInput,
  PayoutEligibilityResult,
  PayoutBatchFilters,
  PayoutOrderFilters,
} from './payout.types';
import { NotFoundError, BadRequestError, ConflictError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class PayoutService {
  /**
   * Valida elegibilidade para payout
   * 🔴 BLINDAGEM: Regras não negociáveis
   */
  async validatePayoutEligibility(
    tenantId: string,
    actorId: string,
    escrowId: string | null,
    agreementId: string | null,
    ledgerEntryIds: string[]
  ): Promise<PayoutEligibilityResult> {
    const reasons: string[] = [];
    let eligible = true;

    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  REMOVIDO — o passo "1. Validar Trust Score" saiu em 2026-08-02, GO de Clayton
    // ║ NORMA:   PROMPT_53_1_RISK_ENFORCEMENT_HARDENING:65 — o nível que trava desembolso é
    // ║          `blocked` (minúsculo) em `actor_risk_profile`, e quem o lê é o gate CANÔNICO
    // ║          `requireFinancialRiskClearance` (risk-financial-gate), que RODA ANTES desta
    // ║          função nos DOIS caminhos (createPayoutBatch :231 · executePayoutManual :366).
    // ║ NÃO:     reintroduzir leitura de risco AQUI. O bloco removido comparava
    // ║          `riskLevel === 'BLOCKED'` — valor que NÃO EXISTE desde o gênesis
    // ║          (trust_profiles usa `critical`; o TS vinha de migrations_archive/0067) — e por
    // ║          baixo, `getTrustProfile` → `getOrCreateProfile` INSERE `'MEDIUM'` contra CHECK
    // ║          minúsculo → EXCEÇÃO para qualquer actor sem perfil (a tabela tem 0 linhas).
    // ║          Não era uma trava morta: era uma trava morta EM CIMA de um crash.
    // ║ EM VEZ:  risco = gate canônico, único, ANTES. Esta função valida NEGÓCIO (escrow,
    // ║          agreement, ledger) — segunda verdade sobre risco é o que a remoção eliminou.
    // ╚════════════════════════════════════════════════════════════════

    // 2. Custódia — F-ESCROW-RETIREMENT fatia 2 (2026-08-02, GO Clayton): esta função NÃO lê mais
    // o 2º registro (escrow.service). Com a torneira fechada (fatia 1) nenhuma conta lá pode
    // nascer nem ser 'released'; a liberação REAL de custódia é da abertura da PORTA-01, lida do
    // Bank. Até lá: escrowId presente = NÃO elegível, fail-closed — igual ao efeito prático
    // anterior ('Escrow não encontrado'), agora com a razão verdadeira e sem a aresta.
    if (escrowId) {
      eligible = false;
      reasons.push('Custódia legada contida (F-ESCROW-RETIREMENT); liberação real de custódia é da PORTA-01, lida do Bank');
    }

    // 3. Validar Agreement (se aplicável)
    if (agreementId) {
      const { agreementRepository } = await import('../agreements/agreement.repository');
      const agreement = await agreementRepository.findById(tenantId, agreementId);

      if (!agreement) {
        eligible = false;
        reasons.push('Agreement não encontrado');
      } else if (agreement.status !== 'finalized') {
        eligible = false;
        reasons.push(`Agreement não está finalized (status: ${agreement.status})`);
      }
    }

    // 4. Validar ids de linhas de ledger (bank_ledger) — unicidade de uso
    for (const entryId of ledgerEntryIds) {
      // Verificar se entry já foi usada em outro payout
      const isUsed = await payoutRepository.isLedgerEntryUsed(tenantId, entryId);
      if (isUsed) {
        eligible = false;
        reasons.push(`Ledger entry ${entryId} já foi usada em outro payout`);
      }
    }

    // 5. Validar Evidence Pack
    // (Será validado ao criar o payout)

    // Buscar escrow e agreement para preencher hasOpenDispute e status
    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  CONTIDO (campo informativo, não bloqueia elegibilidade)
    // ║ NORMA:   backend/src/modules/services/service-order.types.ts:101 (ServiceOrder.disputedAt
    // ║          — fonte governada de sinal de disputa) — F-DISPUTE-SIGNAL, 2026-07-31
    // ║ NÃO:     `hasOpenDispute = false` por default silencioso — afirma "sem disputa" quando na
    // ║          verdade não conseguimos ler. NÃO compor de service_orders.disputed_at aqui —
    // ║          este bloco só tem escrowId/agreementId, SEM service_order (medido, GATE
    // ║          DT-ESCROW-ACCOUNTS-SCHEMA-DRIFT-BREAKS-CUSTODY); inventar o mapeamento seria a
    // ║          quarta fonte de sinal de disputa que este repositório já tem demais.
    // ║ EM VEZ:  `undefined` (desconhecido) na falha de leitura, nunca `false` (seguro-falso);
    // ║          log estruturado nomeando a causa — erro de "tabela/coluna não existe" tem que
    // ║          aparecer, não sumir. Este campo NÃO é usado para bloquear elegibilidade (o
    // ║          bloqueio real usa escrow.disputeStatus direto em :66-69, fora desta fatia) —
    // ║          é só o valor devolvido ao caller, hoje sem consumidor no frontend.
    // ╚════════════════════════════════════════════════════════════════
    let hasOpenDispute: boolean | undefined;
    let escrowStatus: string | undefined;
    let agreementStatus: string | undefined;

    // F-ESCROW-RETIREMENT f2: a leitura informacional do 2º registro saiu. Com a torneira
    // fechada, nada existe lá para ler — hasOpenDispute/escrowStatus ficam UNDEFINED (desconhecido
    // é a verdade; um false aqui afirmaria "sem disputa" sem fonte). A fonte real nasce com a
    // PORTA-01, no Bank.

    if (agreementId) {
      try {
        const { agreementRepository } = await import('../agreements/agreement.repository');
        const agreement = await agreementRepository.findById(tenantId, agreementId);
        agreementStatus = agreement?.status;
      } catch (err) {
        console.warn('[PayoutService] Falha ao ler agreement para agreementStatus — campo fica UNKNOWN (undefined)', {
          tenantId, agreementId, error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      eligible,
      reasons,
      hasOpenDispute,
      escrowStatus,
      agreementStatus,
    };
  }

  /**
   * Cria payout batch e gera orders
   */
  async createPayoutBatch(
    tenantId: string,
    input: CreatePayoutBatchInput
  ): Promise<{ batch: PayoutBatch; orders: PayoutOrder[] }> {
    // 1. Criar evidence pack para o batch
    const { evidenceService } = await import('../evidence/evidence.service');
    const evidencePack = await evidenceService.getOrCreatePack(tenantId, {
      contextType: 'event', // Batch não tem contexto específico
      contextId: `payout_batch_${Date.now()}`,
    });

    // 2. Criar batch
    const batch = await payoutRepository.createBatch(tenantId, evidencePack.packId, {
      currency: input.currency || 'BRL',
      payoutMethod: input.payoutMethod || 'MANUAL',
    });

    // 3. Buscar linhas elegíveis no bank_ledger (créditos a contas com actor) — substitui economy ledger stub
    const { bankReportingRepository } = await import('../bank/bank-reporting.repository');
    const windowStart = input.startDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const windowEnd = input.endDate ?? new Date();
    const ledgerEntries = await bankReportingRepository.listBankLedgerCreditLinesForPayoutWindow(
      tenantId,
      windowStart,
      windowEnd,
      1000
    );

    // 4. Agrupar por actor e gerar orders
    const orders: PayoutOrder[] = [];
    const actorAmounts = new Map<string, { amountCents: number; entryIds: string[]; escrowId?: string; agreementId?: string }>();

    for (const entry of ledgerEntries) {
      // Filtrar por actorIds se fornecido
      if (input.actorIds && !input.actorIds.includes(entry.debitAccountId.replace('actor:', ''))) {
        continue;
      }

      // Verificar se entry já foi usada
      const isUsed = await payoutRepository.isLedgerEntryUsed(tenantId, entry.entryId);
      if (isUsed) {
        continue;
      }

      // Filtrar por valor mínimo
      if (input.minAmountCents && entry.amountCents < input.minAmountCents) {
        continue;
      }

      const actorId = entry.debitAccountId.replace('actor:', '');
      const existing = actorAmounts.get(actorId) || { amountCents: 0, entryIds: [], escrowId: undefined, agreementId: undefined };

      existing.amountCents += entry.amountCents;
      existing.entryIds.push(entry.entryId);
      
      // Extrair escrowId e agreementId do metadata (quando presentes)
      const meta = entry.metadata;
      if (meta && typeof meta.escrowId === 'string') {
        existing.escrowId = meta.escrowId;
      }
      if (meta && typeof meta.agreementId === 'string') {
        existing.agreementId = meta.agreementId;
      }

      actorAmounts.set(actorId, existing);
    }

    // 5. Criar orders para cada actor
    for (const [actorId, data] of actorAmounts.entries()) {
      try {
        const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
        await requireFinancialRiskClearance(tenantId, {
          actorId,
          action: 'financial_payout',
          amountCents: data.amountCents,
        });
      } catch (riskErr: unknown) {
        const e = riskErr as Error & { statusCode?: number };
        // Bloqueio EXPLÍCITO de autoridade: decisão tomada pelo sistema.
        // Ref: docs/ssot/AUTHORITY_PRECEDENCE.md — ATL > KYC > GUARDA
        const isAuthorityBlock =
          e.statusCode === 403 ||
          e.message === 'ACTOR_RISK_LIMIT_EXCEEDED' ||
          e.message === 'ACTOR_RISK_BLOCKED' ||
          e.message === 'SSOT_ROOT_INACTIVE' ||
          e.message === 'SSOT_ATL_BLOCKED' ||
          e.message === 'ECONOMIC_GUARDIANSHIP_LIMIT_EXCEEDED';

        if (isAuthorityBlock) {
          console.error('[PayoutBatch] Ator bloqueado por autoridade — payout não executado', {
            actorId,
            reason: e.message,
            tenantId,
          });
          continue;
        }
        // Erro de infraestrutura: fail-closed — abortar ciclo.
        throw riskErr;
      }

      // Validar elegibilidade
      const eligibility = await this.validatePayoutEligibility(
        tenantId,
        actorId,
        data.escrowId || null,
        data.agreementId || null,
        data.entryIds
      );

      // Buscar evidence pack do contexto (escrow ou agreement)
      let orderEvidencePackId = evidencePack.packId;
      if (data.escrowId) {
        try {
          const escrowEvidencePack = await evidenceService.getPackByContext(tenantId, 'escrow', data.escrowId);
          if (escrowEvidencePack) {
            orderEvidencePackId = escrowEvidencePack.packId;
          }
        } catch (err) {
          // Usar batch evidence pack se não encontrar
        }
      }

      const order = await payoutRepository.createOrder(tenantId, {
        batchId: batch.batchId,
        actorId,
        amountCents: data.amountCents,
        currency: input.currency || 'BRL',
        payoutMethod: input.payoutMethod || 'MANUAL',
        ledgerEntryIds: data.entryIds,
        escrowId: data.escrowId || null,
        agreementId: data.agreementId || null,
        evidencePackId: orderEvidencePackId,
        metadata: {
          eligibility,
        },
      });

      // Atualizar status baseado na elegibilidade
      if (!eligibility.eligible) {
        await payoutRepository.updateOrderStatus(
          tenantId,
          order.orderId,
          'BLOCKED',
          eligibility.reasons.join('; ')
        );
      } else {
        await payoutRepository.updateOrderStatus(tenantId, order.orderId, 'READY');
      }

      orders.push(order);
    }

    // 6. Atualizar contadores do batch
    await payoutRepository.updateBatchCounters(tenantId, batch.batchId);

    // 7. Registrar no Evidence Pack
    await evidenceService.addEvent(tenantId, evidencePack.packId, {
      eventId: batch.batchId,
      eventType: 'payout_batch_created' as any,
      timestamp: new Date(),
      actorId: 'system',
      userId: null,
      data: {
        batchId: batch.batchId,
        orderCount: orders.length,
        totalAmountCents: orders.reduce((sum, o) => sum + o.amountCents, 0),
      },
      source: 'system',
      sourceId: batch.batchId,
    });

    // 8. Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_batch_created',
      actorId: 'system',
      userId: null,
      contextType: 'event' as any,
      contextId: batch.batchId,
      metadata: {
        batchId: batch.batchId,
        orderCount: orders.length,
      },
    });

    return { batch, orders };
  }

  /**
   * Executa payout manual (mock, sem integração bancária real)
   */
  async executePayoutManual(
    tenantId: string,
    orderId: string,
    input: ExecutePayoutManualInput
  ): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }

    if (order.status !== 'READY') {
      throw new BadRequestError(`Payout order deve estar READY para executar (status atual: ${order.status})`);
    }

    try {
      const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
      await requireFinancialRiskClearance(tenantId, {
        actorId: order.actorId,
        action: 'financial_payout',
        amountCents: order.amountCents,
      });
    } catch {
      throw new BadRequestError('Payout bloqueado por política de risco do beneficiário');
    }

    // Revalidar elegibilidade antes de executar
    const eligibility = await this.validatePayoutEligibility(
      tenantId,
      order.actorId,
      order.escrowId,
      order.agreementId,
      order.ledgerEntryIds
    );

    if (!eligibility.eligible) {
      // Bloquear se não elegível
      const blocked = await payoutRepository.updateOrderStatus(
        tenantId,
        orderId,
        'BLOCKED',
        eligibility.reasons.join('; ')
      );

      // Registrar no Evidence Pack
      const { evidenceService } = await import('../evidence/evidence.service');
      await evidenceService.addEvent(tenantId, order.evidencePackId, {
        eventId: orderId,
        eventType: 'payout_blocked' as any,
        timestamp: new Date(),
        actorId: input.executedByActorId,
        userId: input.executedByUserId || null,
        data: {
          orderId,
          reasons: eligibility.reasons,
        },
        source: 'system',
        sourceId: orderId,
      });

      throw new BadRequestError(`Payout bloqueado: ${eligibility.reasons.join('; ')}`);
    }

    // Marcar como executado (mock)
    const executed = await payoutRepository.updateOrderStatus(
      tenantId,
      orderId,
      'EXECUTED',
      null,
      {
        executedBy: input.executedByActorId,
        executedAt: new Date().toISOString(),
        ...input.executionMetadata,
      }
    );

    // Atualizar contadores do batch (se houver)
    if (order.batchId) {
      await payoutRepository.updateBatchCounters(tenantId, order.batchId);
    }

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, order.evidencePackId, {
      eventId: orderId,
      eventType: 'payout_executed' as any,
      timestamp: new Date(),
      actorId: input.executedByActorId,
      userId: input.executedByUserId || null,
      data: {
        orderId,
        amountCents: order.amountCents,
        currency: order.currency,
        executionMetadata: input.executionMetadata,
      },
      source: 'system',
      sourceId: orderId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_executed',
      actorId: input.executedByActorId,
      userId: input.executedByUserId || null,
      contextType: 'event' as any,
      contextId: orderId,
      metadata: {
        orderId,
        amountCents: order.amountCents,
        currency: order.currency,
      },
    });

    return executed;
  }

  /**
   * Marca payout como falho
   */
  async markAsFailed(tenantId: string, orderId: string, input: FailPayoutInput): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }

    if (!['READY', 'EXECUTED'].includes(order.status)) {
      throw new BadRequestError(`Payout order deve estar READY ou EXECUTED para marcar como falho (status atual: ${order.status})`);
    }

    const failed = await payoutRepository.updateOrderStatus(
      tenantId,
      orderId,
      'FAILED',
      null,
      null,
      input.failureReason
    );

    // Atualizar contadores do batch (se houver)
    if (order.batchId) {
      await payoutRepository.updateBatchCounters(tenantId, order.batchId);
    }

    const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
    recordActorRiskEventAsync(tenantId, order.actorId, 'payout_failed', orderId, {
      failureReason: input.failureReason?.slice(0, 500),
    });

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, order.evidencePackId, {
      eventId: orderId,
      eventType: 'payout_failed' as any,
      timestamp: new Date(),
      actorId: input.failedByActorId,
      userId: input.failedByUserId || null,
      data: {
        orderId,
        failureReason: input.failureReason,
      },
      source: 'system',
      sourceId: orderId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'payout_failed',
      actorId: input.failedByActorId,
      userId: input.failedByUserId || null,
      contextType: 'event' as any,
      contextId: orderId,
      metadata: {
        orderId,
        failureReason: input.failureReason,
      },
    });

    return failed;
  }

  /**
   * Lista payout batches
   */
  async listBatches(tenantId: string, filters: PayoutBatchFilters = {}): Promise<PayoutBatch[]> {
    return payoutRepository.listBatches(tenantId, filters);
  }

  /**
   * Lista payout orders
   */
  async listOrders(tenantId: string, filters: PayoutOrderFilters = {}): Promise<PayoutOrder[]> {
    return payoutRepository.listOrders(tenantId, filters);
  }

  /**
   * Busca payout batch por ID
   */
  async getBatchById(tenantId: string, batchId: string): Promise<PayoutBatch> {
    const batch = await payoutRepository.findBatchById(tenantId, batchId);
    if (!batch) {
      throw new NotFoundError('Payout batch não encontrado');
    }
    return batch;
  }

  /**
   * Busca payout order por ID
   */
  async getOrderById(tenantId: string, orderId: string): Promise<PayoutOrder> {
    const order = await payoutRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError('Payout order não encontrado');
    }
    return order;
  }
}

export const payoutService = new PayoutService();

