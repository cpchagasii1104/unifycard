// backend/src/modules/invoicing/invoice.service.ts
// Invoice Service - Faturamento e Notas Fiscais
// 🔴 BLINDAGEM: Nenhum invoice sem payout EXECUTED
// 🔴 BLINDAGEM: Valores vêm do Ledger, nunca do frontend

import { invoiceRepository } from './invoice.repository';
import type {
  Invoice,
  CreateInvoiceFromPayoutInput,
  IssueInvoiceInput,
  CancelInvoiceInput,
  InvoiceFilters,
} from './invoice.types';
import { NotFoundError, BadRequestError, ConflictError, HttpError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class InvoiceService {
  /**
   * Cria invoice a partir de payout EXECUTED
   * 🔴 BLINDAGEM: Regras não negociáveis
   */
  async createInvoiceFromPayout(
    tenantId: string,
    payoutOrderId: string,
    input: CreateInvoiceFromPayoutInput
  ): Promise<Invoice> {
    // 1. Validar que payout existe e está EXECUTED
    const { payoutService } = await import('../payout/payout.service');
    const payoutOrder = await payoutService.getOrderById(tenantId, payoutOrderId);

    if (payoutOrder.status !== 'EXECUTED') {
      throw new BadRequestError(`Payout deve estar EXECUTED para criar invoice (status atual: ${payoutOrder.status})`);
    }

    // 2. Verificar se já existe invoice para este payout
    const existing = await invoiceRepository.findByPayoutOrderId(tenantId, payoutOrderId);
    if (existing && existing.status !== 'cancelled') {
      throw new ConflictError('Já existe invoice para este payout');
    }

    // 3. FAIL-CLOSED FISCAL — DT-INVOICING-HARDCODED-TAX-RATE.
    // O caminho antigo calculava `taxesCents = Math.round(subtotalCents * 0.05)` — um "imposto" de 5%
    // fabricado, que não é imposto operacional nem tributo oficial e jamais poderia figurar como
    // "total tributário"/"nota fiscal". A ÚNICA autoridade fiscal do sistema é o motor fiscal canônico
    // (`tax_rules` / `actor_fiscal_profiles` via fiscal-policy-composition — FISCAL 4c/4d/4e,
    // DECISION-0166 "Lei do Contador"): o sistema NÃO inventa regime nem alíquota; ausência de
    // configuração canônica = `fiscal_config_missing`. Esse motor NÃO está integrado ao invoicing e a
    // tabela `invoices` NÃO existe no runtime (schema-ghost — `migrations_archive/0212_invoices.sql`
    // não é aplicada pelo runner oficial, AGENT_PROTOCOL §17). Portanto não há como derivar imposto
    // honesto aqui: a emissão é recusada FECHADA, nunca fabricando valor nem simulando documento fiscal.
    // Reabilitar exige: (a) integrar o motor fiscal canônico como fonte do imposto e (b) materializar o
    // schema de invoices por migration governada — ambos frentes próprias com GO/decisão soberana.
    throw new HttpError(
      'INVOICE_FISCAL_CONFIG_MISSING: emissão de invoice bloqueada (fail-closed). O motor fiscal ' +
        'canônico (tax_rules/actor_fiscal_profiles) não está integrado ao invoicing e o sistema não ' +
        'inventa alíquota nem regime. Nenhum imposto pode ser derivado; a emissão de documento fiscal ' +
        'oficial exige configuração fiscal válida e integração ainda inexistentes. Ver ' +
        'DT-INVOICING-HARDCODED-TAX-RATE / DECISION-0166.',
      422
    );
  }

  /**
   * Emite invoice (muda status para ISSUED).
   * ⚠️ `issued` aqui é um estado OPERACIONAL interno do documento — NÃO é emissão fiscal oficial
   * (NF-e/NFS-e). Emissão fiscal real exige integração com o motor fiscal canônico e autoridade
   * emissora correspondente (inexistentes hoje; ver createInvoiceFromPayout / DT-INVOICING-HARDCODED-TAX-RATE).
   */
  async issueInvoice(
    tenantId: string,
    invoiceId: string,
    input: IssueInvoiceInput
  ): Promise<Invoice> {
    const invoice = await invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice não encontrado');
    }

    if (invoice.status !== 'draft') {
      throw new BadRequestError(`Invoice deve estar DRAFT para emitir (status atual: ${invoice.status})`);
    }

    const issued = await invoiceRepository.updateStatus(
      tenantId,
      invoiceId,
      'issued',
      input.issuedAt || new Date()
    );

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, invoice.evidencePackId, {
      eventId: invoice.invoiceId,
      eventType: 'invoice_issued' as any,
      timestamp: new Date(),
      actorId: input.issuedByActorId,
      userId: input.issuedByUserId || null,
      data: {
        invoiceId: invoice.invoiceId,
        issuedAt: issued.issuedAt,
      },
      source: 'system',
      sourceId: invoice.invoiceId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'invoice_issued',
      actorId: input.issuedByActorId,
      userId: input.issuedByUserId || null,
      contextType: 'service_order' as any,
      contextId: invoice.invoiceId,
      metadata: {
        invoiceId: invoice.invoiceId,
      },
    });

    return issued;
  }

  /**
   * Cancela invoice
   */
  async cancelInvoice(
    tenantId: string,
    invoiceId: string,
    input: CancelInvoiceInput
  ): Promise<Invoice> {
    const invoice = await invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice não encontrado');
    }

    if (invoice.status === 'issued') {
      throw new BadRequestError('Invoice emitido não pode ser cancelado');
    }

    const cancelled = await invoiceRepository.updateStatus(
      tenantId,
      invoiceId,
      'cancelled',
      null,
      new Date(),
      input.cancellationReason
    );

    // Registrar no Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    await evidenceService.addEvent(tenantId, invoice.evidencePackId, {
      eventId: invoice.invoiceId,
      eventType: 'invoice_cancelled' as any,
      timestamp: new Date(),
      actorId: input.cancelledByActorId,
      userId: input.cancelledByUserId || null,
      data: {
        invoiceId: invoice.invoiceId,
        cancellationReason: input.cancellationReason,
      },
      source: 'system',
      sourceId: invoice.invoiceId,
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'invoice_cancelled',
      actorId: input.cancelledByActorId,
      userId: input.cancelledByUserId || null,
      contextType: 'service_order' as any,
      contextId: invoice.invoiceId,
      metadata: {
        invoiceId: invoice.invoiceId,
        cancellationReason: input.cancellationReason,
      },
    });

    return cancelled;
  }

  /**
   * Lista invoices
   */
  async listInvoices(tenantId: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
    return invoiceRepository.list(tenantId, filters);
  }

  /**
   * Busca invoice por ID
   */
  async getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice não encontrado');
    }
    return invoice;
  }

  /**
   * Busca invoice por payoutOrderId
   */
  async getInvoiceByPayoutOrderId(tenantId: string, payoutOrderId: string): Promise<Invoice | null> {
    return invoiceRepository.findByPayoutOrderId(tenantId, payoutOrderId);
  }
}

export const invoiceService = new InvoiceService();

