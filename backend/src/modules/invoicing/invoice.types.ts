// backend/src/modules/invoicing/invoice.types.ts
// Invoice Engine - Faturamento e Notas Fiscais
// 🔴 BLINDAGEM: Nenhum invoice sem payout EXECUTED
// 🔴 BLINDAGEM: Valores vêm do Ledger, nunca do frontend

/**
 * Status do invoice
 */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

/**
 * Tipo de invoice
 */
export type InvoiceType = 'SERVICE_PROVIDER' | 'PLATFORM_FEE';

/**
 * Invoice Item (Item Faturado)
 */
export interface InvoiceItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  taxRate?: number; // Percentual de imposto (opcional)
  taxAmountCents?: number; // Valor do imposto (opcional)
}

/**
 * Invoice (Fatura Fiscal)
 * 
 * REGRAS:
 * - Só pode ser criado a partir de payout EXECUTED
 * - Valores vêm exclusivamente do Ledger
 * - Imutável após ISSUED
 * - Sempre vinculado a Evidence Pack
 */
export interface Invoice {
  invoiceId: string;
  tenantId: string;
  actorId: string; // Emissor
  recipientActorId: string; // Destinatário
  invoiceType: InvoiceType;
  serviceOrderId: string | null;
  payoutOrderId: string; // Obrigatório: deve referenciar payout EXECUTED
  ledgerEntryIds: string[]; // Entradas do ledger que originam este invoice
  evidencePackId: string; // Obrigatório
  items: InvoiceItem[];
  subtotalCents: number;
  taxesCents: number;
  totalCents: number;
  currency: string;
  status: InvoiceStatus;
  // Dados fiscais
  fiscalMetadata: {
    cfop?: string; // Código Fiscal de Operações e Prestações
    cnae?: string; // Código Nacional de Atividade Econômica
    nature?: string; // Natureza da operação
    taxRegime?: string; // Regime tributário
    issuerCNPJ?: string; // CNPJ do emissor
    recipientCNPJ?: string; // CNPJ do destinatário
    recipientCPF?: string; // CPF do destinatário (se pessoa física)
  } | null;
  issuedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar invoice a partir de payout
 */
export interface CreateInvoiceFromPayoutInput {
  invoiceType: InvoiceType;
  fiscalMetadata?: {
    cfop?: string;
    cnae?: string;
    nature?: string;
    taxRegime?: string;
    issuerCNPJ?: string;
    recipientCNPJ?: string;
    recipientCPF?: string;
  };
  items?: InvoiceItem[]; // Se não fornecido, será gerado a partir do ledger
}

/**
 * Input para emitir invoice
 */
export interface IssueInvoiceInput {
  issuedByActorId: string;
  issuedByUserId?: string | null;
  issuedAt?: Date; // Se não fornecido, usa NOW()
}

/**
 * Input para cancelar invoice
 */
export interface CancelInvoiceInput {
  cancelledByActorId: string;
  cancelledByUserId?: string | null;
  cancellationReason: string;
}

/**
 * Filtros para buscar invoices
 */
export interface InvoiceFilters {
  actorId?: string;
  recipientActorId?: string;
  payoutOrderId?: string;
  serviceOrderId?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}




