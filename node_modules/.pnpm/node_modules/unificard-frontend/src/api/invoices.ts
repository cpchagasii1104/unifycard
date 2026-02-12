// frontend/src/api/invoices.ts
// API client para Invoice Engine
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { apiFetch, apiFetchJson } from './client';

/**
 * Status do invoice
 */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

/**
 * Tipo de invoice
 */
export type InvoiceType = 'SERVICE_PROVIDER' | 'PLATFORM_FEE';

/**
 * Invoice Item
 */
export interface InvoiceItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  taxRate?: number;
  taxAmountCents?: number;
}

/**
 * Invoice
 */
export interface Invoice {
  invoiceId: string;
  tenantId: string;
  actorId: string;
  recipientActorId: string;
  invoiceType: InvoiceType;
  serviceOrderId: string | null;
  payoutOrderId: string;
  ledgerEntryIds: string[];
  evidencePackId: string;
  items: InvoiceItem[];
  subtotalCents: number;
  taxesCents: number;
  totalCents: number;
  currency: string;
  status: InvoiceStatus;
  fiscalMetadata: {
    cfop?: string;
    cnae?: string;
    nature?: string;
    taxRegime?: string;
    issuerCNPJ?: string;
    recipientCNPJ?: string;
    recipientCPF?: string;
  } | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
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
  items?: InvoiceItem[];
}

/**
 * Input para emitir invoice
 */
export interface IssueInvoiceInput {
  issuedByActorId: string;
  issuedByUserId?: string | null;
  issuedAt?: string;
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
 * Lista invoices
 */
export async function listInvoices(filters: {
  actorId?: string;
  recipientActorId?: string;
  payoutOrderId?: string;
  serviceOrderId?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<Invoice[]> {
  const queryParams = new URLSearchParams();
  if (filters.actorId) queryParams.append('actorId', filters.actorId);
  if (filters.recipientActorId) queryParams.append('recipientActorId', filters.recipientActorId);
  if (filters.payoutOrderId) queryParams.append('payoutOrderId', filters.payoutOrderId);
  if (filters.serviceOrderId) queryParams.append('serviceOrderId', filters.serviceOrderId);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.invoiceType) queryParams.append('invoiceType', filters.invoiceType);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ invoices: Invoice[] }>(`/invoices?${queryParams.toString()}`);
  return data.invoices;
}

/**
 * Busca invoice por ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const response = await apiFetch(`/invoices/${invoiceId}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar invoice' }));
    throw new Error(error.error || 'Erro ao buscar invoice');
  }
  const data = await response.json();
  return data.invoice;
}

/**
 * Busca invoice por payoutOrderId
 */
export async function getInvoiceByPayoutOrderId(payoutOrderId: string): Promise<Invoice[]> {
  const response = await apiFetch(`/invoices?payoutOrderId=${payoutOrderId}`);
  if (!response.ok) {
    // Se não encontrar, retornar array vazio (invoice pode não existir ainda)
    return [];
  }
  const data = await response.json();
  return data.invoices || [];
}

/**
 * Cria invoice a partir de payout
 */
export async function createInvoiceFromPayout(
  payoutOrderId: string,
  input: CreateInvoiceFromPayoutInput
): Promise<Invoice> {
  const response = await apiFetch(`/invoices/from-payout/${payoutOrderId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar invoice' }));
    throw new Error(error.error || 'Erro ao criar invoice');
  }

  const data = await response.json();
  return data.invoice;
}

/**
 * Emite invoice
 */
export async function issueInvoice(invoiceId: string, input: IssueInvoiceInput): Promise<Invoice> {
  const response = await apiFetch(`/invoices/${invoiceId}/issue`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao emitir invoice' }));
    throw new Error(error.error || 'Erro ao emitir invoice');
  }

  const data = await response.json();
  return data.invoice;
}

/**
 * Cancela invoice
 */
export async function cancelInvoice(invoiceId: string, input: CancelInvoiceInput): Promise<Invoice> {
  const response = await apiFetch(`/invoices/${invoiceId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao cancelar invoice' }));
    throw new Error(error.error || 'Erro ao cancelar invoice');
  }

  const data = await response.json();
  return data.invoice;
}

