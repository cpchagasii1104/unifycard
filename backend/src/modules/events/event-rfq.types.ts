// backend/src/modules/events/event-rfq.types.ts
// Tipos para RFQ (Request for Quotation) / ORÇAMENTO EM LOTE
// 🔴 BLINDAGEM: RFQ é conceitual, pode viver em metadata do evento
// 🔴 BLINDAGEM: NÃO aceita proposta automaticamente
// 🔴 BLINDAGEM: NÃO cria booking automaticamente

/**
 * Status do RFQ
 */
export enum RFQStatus {
  OPEN = 'open',       // RFQ aberto, aceitando propostas
  CLOSED = 'closed',   // RFQ fechado, não aceita mais propostas
}

/**
 * Item do RFQ (necessidade ou serviço específico)
 */
export interface RFQItem {
  type: 'need' | 'service';  // Tipo: necessidade ou serviço específico
  id: string;                // ID da necessidade ou serviceId
  category?: string;         // Categoria (se type = 'need')
  description?: string | null; // Descrição adicional
}

/**
 * Critérios do RFQ
 */
export interface RFQCriteria {
  expectedPriceCents?: number | null;  // Preço esperado (opcional)
  date?: string | null;                 // Data do evento (ISO 8601)
  location?: string | null;             // Localização
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  notes?: string | null;                // Observações adicionais
}

/**
 * Event RFQ (entidade conceitual)
 * 
 * REGRAS:
 * - NÃO cria nova tabela (pode viver em metadata do evento)
 * - RFQ é explícito e estruturado
 * - Status controla se aceita novas propostas
 */
export interface EventRFQ {
  rfqId: string;              // ID único do RFQ
  eventId: string;            // ID do evento
  tenantId: string;
  organizerActorId: string;   // Quem criou o RFQ
  items: RFQItem[];          // Lista de necessidades ou serviços
  criteria: RFQCriteria;     // Critérios do RFQ
  status: RFQStatus;         // Status do RFQ
  createdAt: string;
  updatedAt: string;
  closedAt?: Date | null;    // Quando foi fechado
}

/**
 * Input para criar RFQ
 */
export interface CreateEventRFQInput {
  eventId: string;
  items: RFQItem[];          // Mínimo 1 item
  criteria: RFQCriteria;
}

/**
 * Resposta de orçamento (Quote)
 */
export interface QuoteResponse {
  quoteId: string;           // ID único da proposta
  rfqId: string;             // RFQ ao qual responde
  serviceId: string;         // Serviço que está propondo
  providerActorId: string;   // Prestador que está propondo
  priceCents: number;        // Valor proposto (em centavos)
  currency: string;          // Moeda
  notes?: string | null;     // Observações do prestador
  validityDays?: number | null; // Validade da proposta em dias
  validUntil?: Date | null;  // Data de validade
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para responder RFQ (criar proposta)
 */
export interface CreateQuoteResponseInput {
  rfqId: string;
  serviceId: string;
  priceCents: number;
  currency: string;
  notes?: string | null;
  validityDays?: number | null;
}

/**
 * Resultado da criação de RFQ
 */
export interface CreateEventRFQResult {
  rfq: EventRFQ;
  servicesNotified: number;  // Quantos serviços foram notificados
}

/**
 * Resultado da busca de RFQs
 */
export interface EventRFQListResult {
  rfqs: EventRFQ[];
  totalCents: number;
}

/**
 * Resultado da busca de propostas
 */
export interface QuoteListResult {
  quotes: QuoteResponse[];
  totalCents: number;
}






