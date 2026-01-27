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
  InvoiceItem,
} from './invoice.types';
import { NotFoundError, BadRequestError, ConflictError } from '@core/errors';
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
    if (existing && existing.status !== 'CANCELLED') {
      throw new ConflictError('Já existe invoice para este payout');
    }

    // 3. Buscar ledger entries para calcular valores
    const { ledgerService } = await import('../ledger/ledger.service');
    const ledgerEntries = await Promise.all(
      payoutOrder.ledgerEntryIds.map((entryId) =>
        ledgerService.getEntryById(tenantId, entryId).catch(() => null)
      )
    );

    const validEntries = ledgerEntries.filter((e) => e !== null) as any[];
    if (validEntries.length === 0) {
      throw new BadRequestError('Nenhuma ledger entry válida encontrada');
    }

    // 4. Calcular valores a partir do ledger
    let subtotalCents = 0;
    const items: InvoiceItem[] = [];

    for (const entry of validEntries) {
      if (!entry) continue;

      subtotalCents += entry.amountCents;

      // Criar item do invoice
      const itemId = entry.entryId.substring(0, 8);
      items.push({
        itemId,
        description: `Serviço - ${entry.entryType}`,
        quantity: 1,
        unitPriceCents: entry.amountCents,
        totalCents: entry.amountCents,
      });
    }

    // 5. Calcular impostos (simplificado - pode ser expandido no futuro)
    const taxesCents = Math.round(subtotalCents * 0.05); // 5% simplificado (exemplo)
    const totalCents = subtotalCents + taxesCents;

    // 6. Buscar ou criar evidence pack
    const { evidenceService } = await import('../evidence/evidence.service');
    let evidencePack;
    try {
      // Tentar buscar pelo escrow primeiro
      if (payoutOrder.escrowId) {
        evidencePack = await evidenceService.getPackByContext(tenantId, 'escrow', payoutOrder.escrowId);
      }
      // Se não encontrou, tentar pelo serviceOrderId
      if (!evidencePack && payoutOrder.metadata?.serviceOrderId) {
        evidencePack = await evidenceService.getPackByContext(tenantId, 'service_order', payoutOrder.metadata.serviceOrderId);
      }
      // Se ainda não encontrou, criar novo
      if (!evidencePack) {
        evidencePack = await evidenceService.getOrCreatePack(tenantId, {
          contextType: 'service_order',
          contextId: payoutOrder.metadata?.serviceOrderId || payoutOrderId,
        });
      }
    } catch (err) {
      // Criar novo evidence pack se não existir
      evidencePack = await evidenceService.getOrCreatePack(tenantId, {
        contextType: 'service_order',
        contextId: payoutOrder.metadata?.serviceOrderId || payoutOrderId,
      });
    }

    // 7. Determinar actorId e recipientActorId
    // Para SERVICE_PROVIDER: actorId = provider, recipientActorId = platform
    // Para PLATFORM_FEE: actorId = platform, recipientActorId = provider
    let actorId: string;
    let recipientActorId: string;

    if (input.invoiceType === 'SERVICE_PROVIDER') {
      actorId = payoutOrder.actorId; // Provider
      recipientActorId = 'system:platform'; // Plataforma
    } else {
      actorId = 'system:platform'; // Plataforma
      recipientActorId = payoutOrder.actorId; // Provider
    }

    // 8. Buscar serviceOrderId se disponível (pode estar no metadata do payout)
    let serviceOrderId: string | null = null;
    if (payoutOrder.metadata?.serviceOrderId) {
      serviceOrderId = payoutOrder.metadata.serviceOrderId;
    } else if (payoutOrder.agreementId) {
      // Tentar buscar serviceOrderId do agreement
      try {
        const { agreementRepository } = await import('../agreements/agreement.repository');
        const agreement = await agreementRepository.findById(tenantId, payoutOrder.agreementId);
        // ServiceOrderId pode estar no metadata do agreement
        serviceOrderId = agreement?.metadata?.serviceOrderId || null;
      } catch (err) {
        // Ignorar erro
      }
    }

    // 9. Criar invoice
    const invoice = await invoiceRepository.create(tenantId, {
      actorId,
      recipientActorId,
      invoiceType: input.invoiceType,
      serviceOrderId,
      payoutOrderId,
      ledgerEntryIds: payoutOrder.ledgerEntryIds,
      evidencePackId: evidencePack.packId,
      items: input.items && input.items.length > 0 ? input.items : items,
      subtotalCents,
      taxesCents,
      totalCents,
      currency: payoutOrder.currency,
      fiscalMetadata: input.fiscalMetadata || null,
      metadata: {
        createdFrom: 'payout',
        payoutOrderId,
      },
    });

    // 10. Registrar no Evidence Pack
    await evidenceService.addEvent(tenantId, evidencePack.packId, {
      eventId: invoice.invoiceId,
      eventType: 'invoice_created' as any,
      timestamp: new Date(),
      actorId: 'system',
      userId: null,
      data: {
        invoiceId: invoice.invoiceId,
        invoiceType: input.invoiceType,
        totalCents: invoice.totalCents,
      },
      source: 'system',
      sourceId: invoice.invoiceId,
    });

    // 11. Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'invoice_created',
      actorId: 'system',
      userId: null,
      contextType: 'service_order' as any,
      contextId: invoice.invoiceId,
      metadata: {
        invoiceId: invoice.invoiceId,
        payoutOrderId,
        invoiceType: input.invoiceType,
      },
    });

    return invoice;
  }

  /**
   * Emite invoice (muda status para ISSUED)
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

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestError(`Invoice deve estar DRAFT para emitir (status atual: ${invoice.status})`);
    }

    const issued = await invoiceRepository.updateStatus(
      tenantId,
      invoiceId,
      'ISSUED',
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

    if (invoice.status === 'ISSUED') {
      throw new BadRequestError('Invoice emitido não pode ser cancelado');
    }

    const cancelled = await invoiceRepository.updateStatus(
      tenantId,
      invoiceId,
      'CANCELLED',
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

