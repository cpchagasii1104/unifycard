// backend/src/modules/services/service-order.types.ts
// SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA

/**
 * Status da ordem de serviço
 *
 * `seller_pending` (2026-05-26 — F1 Camada 1 saída): prestador concluiu
 * serviço fixed_price_escrow; dinheiro permanece em escrow_payments até
 * buyer confirmar OU timeout do buyer_confirmation_deadline_at OU disputa
 * resolvida. Não move dinheiro nesta transição; só carimba estado e
 * deadlines.
 */
export type ServiceOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'seller_pending'
  | 'cancelled';

/**
 * Discriminador explícito do fluxo econômico de uma service order
 * (decisão Clayton K1 atualizado — 2026-05-26).
 *
 * - `none`: ordem sem fluxo Camada 1 (default; preserva legado).
 * - `fixed_price_escrow`: ordem cujo pagamento entrou na custódia
 *   escrow_payments via createExecution refatorado (commit 62771db9).
 *   F1 só aplica seller_pending para este caso.
 */
export type ServiceOrderSettlementFlow = 'none' | 'fixed_price_escrow';

/**
 * Ordem de Serviço
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Nada automático sem ação explícita
 * - NÃO executa pagamentos
 * - NÃO emite fiscal
 */
export interface ServiceOrder {
  id: string;
  tenantId: string;
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId: string | null;
  decisionId: string | null;
  status: ServiceOrderStatus;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  estimatedDurationMinutes: number | null;
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  description: string | null;
  customerNotes: string | null;
  workerNotes: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  confirmedAt: Date | null;
  confirmedByActorId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  /**
   * F1 (Camada 1 saída — 2026-05-26):
   * - settlementFlow: discriminador de fluxo econômico (none | fixed_price_escrow).
   * - buyerConfirmationDeadlineAt: now()+7d carimbado quando prestador conclui fixed_price_escrow.
   * - buyerConfirmedCompletionAt: futuro (D2 caminho rápido).
   * - releaseEligibleAt: momento mínimo para release-worker mover seller_pending → seller_available.
   * - disputedAt + disputeId: futuro (D2 — disputa pausa release).
   */
  settlementFlow: ServiceOrderSettlementFlow;
  buyerConfirmationDeadlineAt: Date | null;
  buyerConfirmedCompletionAt: Date | null;
  releaseEligibleAt: Date | null;
  disputedAt: Date | null;
  disputeId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar ordem de serviço
 */
export interface CreateServiceOrderInput {
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId?: string;
  decisionId?: string;
  scheduledStart: Date;
  scheduledEnd?: Date;
  estimatedDurationMinutes?: number;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  description?: string;
  customerNotes?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para confirmar ordem
 */
export interface ConfirmServiceOrderInput {
  confirmedByActorId: string;
  confirmedByUserId?: string;
}

/**
 * Input para iniciar ordem
 */
export interface StartServiceOrderInput {
  startedByActorId: string;
  startedByUserId?: string;
  workerNotes?: string;
}

/**
 * Input para completar ordem
 */
export interface CompleteServiceOrderInput {
  completedByActorId: string;
  completedByUserId?: string;
  workerNotes?: string;
}

/**
 * Input para cancelar ordem
 */
export interface CancelServiceOrderInput {
  cancelledByActorId: string;
  cancelledByUserId?: string;
  cancellationReason?: string;
}

/**
 * Filtros para listar ordens
 */
export interface ServiceOrderFilters {
  serviceId?: string;
  workerActorId?: string;
  customerActorId?: string;
  bookingId?: string;
  status?: ServiceOrderStatus;
  scheduledStartFrom?: Date;
  scheduledStartTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Termos financeiros de uma Service Order
 */
export interface ServiceOrderFinancialTerms {
  serviceOrderId: string;
  grossAmountCents: number; // Valor bruto em centavos
  platformFeeBps: number; // Percentual da comissão (ex: 3 = 3%)
  platformFeeCents: number; // Valor da comissão em centavos
  providerNetAmountCents: number; // Valor líquido do prestador em centavos
  currency: string;
  providerActorId: string;
  platformActorId: string; // ID da conta da plataforma
}

/**
 * Input para confirmar termos financeiros
 */
export interface ConfirmFinancialTermsInput {
  confirmedByActorId: string;
  confirmedByUserId?: string;
}





