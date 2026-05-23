// src/modules/services/service-payment-request.types.ts
// Tipos do Domínio de PAGAMENTO (Payment Request / Payment Intent)
// 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
// 🔴 BLINDAGEM: Pagamento é um PEDIDO de pagamento, não execução automática
// 🔴 BLINDAGEM: Nenhum dinheiro real
// 🔴 BLINDAGEM: Nenhum split ainda
// 🔴 BLINDAGEM: Nenhuma confirmação automática

/**
 * Status do Pedido de Pagamento
 * 🔴 BLINDAGEM: Status é estado do pedido, não execução
 */
export enum PaymentRequestStatus {
  PENDING = 'pending',   // Pedido de pagamento pendente
  CANCELLED = 'cancelled', // Pedido de pagamento cancelado
  EXPIRED = 'expired',    // Pedido de pagamento expirado
}

/**
 * Pedido de Pagamento de Serviço (entidade de domínio)
 * 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
 * 🔴 BLINDAGEM: Pagamento é um PEDIDO de pagamento, não execução automática
 * 🔴 BLINDAGEM: Nenhum dinheiro real
 * 🔴 BLINDAGEM: Nenhum split ainda
 * 🔴 BLINDAGEM: Nenhuma confirmação automática
 * 🔴 BLINDAGEM: Payment Request é intenção financeira
 * 🔴 BLINDAGEM: Não existe "pago" ainda
 * 🔴 BLINDAGEM: Nada movimenta saldo
 * 🔴 BLINDAGEM: Booking e Decision continuam imutáveis
 */
export interface ServicePaymentRequest {
  paymentRequestId: string;
  tenantId: string;
  bookingId: string; // OBRIGATÓRIO: Booking relacionado
  serviceId: string; // OBRIGATÓRIO: Service relacionado
  payerActorId: string; // OBRIGATÓRIO: Actor que paga
  receiverActorId: string; // OBRIGATÓRIO: Actor que recebe (dono do service)
  status: PaymentRequestStatus;
  amountCents: number; // Valor do pagamento
  currency: string; // Moeda (default: 'FIC' = Fictícia)
  requestedAt: Date;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: Date | null; // Quando foi cancelado (se status = 'cancelled')
  expiredAt?: Date | null; // Quando expirou (se status = 'expired')
}

/**
 * Linha do banco de dados (ServicePaymentRequestRow)
 */
export interface ServicePaymentRequestRow {
  payment_request_id: string;
  tenant_id: string;
  booking_id: string;
  service_id: string;
  payer_actor_id: string;
  receiver_actor_id: string;
  status: PaymentRequestStatus;
  amountCents: number;
  currency: string;
  requested_at: Date;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  expired_at: Date | null;
}

/**
 * Input para criar pedido de pagamento
 * 🔴 BLINDAGEM: bookingId, serviceId, payerActorId e receiverActorId são OBRIGATÓRIOS
 * 🔴 BLINDAGEM: Só pode criar payment se existir booking_decision = accepted
 */
export interface CreateServicePaymentRequestInput {
  bookingId: string; // OBRIGATÓRIO
  serviceId: string; // OBRIGATÓRIO
  payerActorId: string; // OBRIGATÓRIO
  receiverActorId: string; // OBRIGATÓRIO
  amountCents: number; // OBRIGATÓRIO: Valor do pagamento
  currency?: string; // Default: 'FIC'
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar pedido de pagamento
 */
export interface UpdateServicePaymentRequestInput {
  status?: PaymentRequestStatus;
  metadata?: Record<string, any>;
}




