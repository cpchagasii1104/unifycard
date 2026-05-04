// backend/src/modules/marketplace/fiscal-document.service.ts
// SPRINT 44: Service para documentos fiscais

import { fiscalDocumentRepository } from './fiscal-document.repository';
import { orderRepository } from './order.repository';
import { orderItemRepository } from './order-item.repository';
import type {
  FiscalDocument,
  FiscalDocumentItem,
  CreateFiscalDocumentInput,
  IssueFiscalDocumentInput,
  CancelFiscalDocumentInput,
  FiscalDocumentType,
} from './fiscal-document.types';

/**
 * Service para documentos fiscais
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Documento é REPRESENTAÇÃO, não execução
 * - Não integra com SEFAZ ainda
 * - Não bloqueia venda
 * - Não recalcula valores
 * - Apenas espelha a venda
 */
class FiscalDocumentService {
  /**
   * Cria documento fiscal a partir de um pedido
   * 
   * Regras:
   * - Documento nasce em DRAFT
   * - Não recalcula valores (usa totalAmount fornecido)
   * - Cria itens baseados em order_items
   * - Tipo determinado pela origem (PDV → NFC-e, Marketplace → NF-e)
   */
  async createFromOrder(
    tenantId: string,
    orderId: string,
    paymentIntentId: string | null,
    documentType: FiscalDocumentType,
    totalAmount: number
  ): Promise<FiscalDocument> {
    // 1. Verificar se pedido existe
    const order = await orderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    // SPRINT 80: Validar se tipo de documento é permitido pelo regime tributário
    if (documentType !== 'NONE') {
      const { taxProfileService } = await import('./tax-profile.service');
      const validation = await taxProfileService.validateDocumentType(tenantId, documentType);
      if (!validation.allowed) {
        throw new Error(validation.reason || 'Tipo de documento não permitido para o regime tributário');
      }
    }

    // SPRINT 0: Extrair contact_id do intent metadata se fornecido
    let payerContactId: string | undefined;
    if (paymentIntentId) {
      try {
        const { paymentIntentService } = await import('./payment-intent.service');
        const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);
        if (intent?.metadata?.payerContactId) {
          payerContactId = intent.metadata.payerContactId;
        }
      } catch (error) {
        // Não bloquear se busca falhar
        console.warn(`[FiscalDocument] Erro ao buscar PaymentIntent para contact_id:`, error);
      }
    }

    // 2. Criar documento fiscal
    const document = await fiscalDocumentRepository.createDocument(tenantId, {
      orderId,
      paymentIntentId: paymentIntentId || undefined,
      documentType,
      totalAmount,
      metadata: {
        created_from: 'order',
        order_status: order.status,
        // SPRINT 0: Contact ID do pagador (se fornecido)
        contact_id: payerContactId,
      },
    });

    // 3. Criar itens do documento baseados em order_items
    const orderItems = await orderItemRepository.listItemsByOrder(tenantId, orderId);
    
    for (const orderItem of orderItems) {
      await fiscalDocumentRepository.createItem(
        tenantId,
        document.id,
        orderItem.productVariantId,
        orderItem.quantity,
        orderItem.unit,
        {
          order_item_id: orderItem.id,
          price_cents_unit: orderItem.priceCents ?? undefined,
          currency_snapshot: orderItem.currency ?? undefined,
          sale_unit: orderItem.saleUnit,
          // Futuro: CFOP, NCM, CST serão adicionados aqui
        }
      );
    }

    // 4. Atualizar metadata do pedido com referência ao documento
    const currentMetadata = order.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      fiscal_document_id: document.id,
      fiscal_document_type: documentType,
    };

    await orderRepository.updateOrder(tenantId, orderId, {
      metadata: updatedMetadata,
    });

    return document;
  }

  /**
   * Busca documento por ID
   */
  async getDocumentById(
    tenantId: string,
    documentId: string
  ): Promise<FiscalDocument | null> {
    return await fiscalDocumentRepository.getDocumentById(tenantId, documentId);
  }

  /**
   * Busca documento por pedido
   */
  async getDocumentByOrder(
    tenantId: string,
    orderId: string
  ): Promise<FiscalDocument | null> {
    return await fiscalDocumentRepository.getDocumentByOrder(tenantId, orderId);
  }

  /**
   * Lista documentos por pedido
   */
  async listDocumentsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<FiscalDocument[]> {
    return await fiscalDocumentRepository.listDocumentsByOrder(tenantId, orderId);
  }

  /**
   * Lista itens de um documento
   */
  async listItemsByDocument(
    tenantId: string,
    documentId: string
  ): Promise<FiscalDocumentItem[]> {
    return await fiscalDocumentRepository.listItemsByDocument(tenantId, documentId);
  }

  /**
   * Emite documento fiscal
   * 
   * SPRINT 44: Apenas muda status para ISSUED
   * SPRINT 45: Dispara emissão no provider externo (não bloqueia se falhar)
   * SPRINT 84: Valida KYC básico antes de emitir
   */
  async issueDocument(
    tenantId: string,
    documentId: string,
    input: IssueFiscalDocumentInput = {}
  ): Promise<FiscalDocument> {
    const document = await this.getDocumentById(tenantId, documentId);
    if (!document) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    if (document.status !== 'DRAFT') {
      throw new Error(
        `Documento não pode ser emitido. Status atual: ${document.status}. Apenas DRAFT pode ser emitido.`
      );
    }

    // SPRINT 84: Validar KYC básico antes de emitir
    // AUTORIDADE: fail-closed — qualquer erro bloqueia emissão.
    // Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §4.2 — KYC define capacidade jurídica.
    const { validateFiscalKyc } = await import('./fiscal-kyc.service');
    const kycValidation = await validateFiscalKyc(tenantId, {
      documentId: document.id,
    });

    if (!kycValidation.canIssue) {
      const error = new Error('FISCAL_KYC_INCOMPLETE') as Error & {
        code: string;
        missingFields?: string[];
        warnings?: string[];
      };
      error.code = 'FISCAL_KYC_INCOMPLETE';
      error.missingFields = kycValidation.missingFields;
      error.warnings = kycValidation.warnings;
      throw error;
    }
    // Sem try/catch: infra down → bloqueio (500). Nunca emissão silenciosa.

    // SPRINT 44: Apenas muda status para ISSUED
    const updatedDocument = await fiscalDocumentRepository.updateDocumentStatus(
      tenantId,
      documentId,
      'ISSUED',
      {
        ...input.metadata,
        issuedAt: new Date().toISOString(),
      }
    );

    // SPRINT 45: Disparar emissão no provider externo (não bloqueia se falhar)
    const { fiscalIssuanceService } = await import('./fiscal-issuance.service');
    try {
      await fiscalIssuanceService.issueDocument(tenantId, documentId);
    } catch (issuanceError) {
      // Log mas não bloqueia emissão interna
      console.warn(
        `[FiscalDocument] Erro ao emitir documento ${documentId} no provider externo:`,
        issuanceError
      );
    }

    return updatedDocument;
  }

  /**
   * Cancela documento fiscal
   * 
   * SPRINT 44: Apenas muda status para CANCELLED
   * SPRINT 45: Dispara cancelamento no provider externo (não bloqueia se falhar)
   */
  async cancelDocument(
    tenantId: string,
    documentId: string,
    input: CancelFiscalDocumentInput = {}
  ): Promise<FiscalDocument> {
    const document = await this.getDocumentById(tenantId, documentId);
    if (!document) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    if (document.status === 'CANCELLED') {
      throw new Error('Documento já está cancelado');
    }

    if (document.status !== 'ISSUED') {
      throw new Error(
        `Documento não pode ser cancelado. Status atual: ${document.status}. Apenas ISSUED pode ser cancelado.`
      );
    }

    // SPRINT 44: Apenas muda status para CANCELLED
    const updatedDocument = await fiscalDocumentRepository.updateDocumentStatus(
      tenantId,
      documentId,
      'CANCELLED',
      {
        ...input.metadata,
        cancelledAt: new Date().toISOString(),
        cancellation_reason: input.reason,
      }
    );

    // SPRINT 45: Disparar cancelamento no provider externo (não bloqueia se falhar)
    const { fiscalIssuanceService } = await import('./fiscal-issuance.service');
    try {
      await fiscalIssuanceService.cancelDocument(tenantId, documentId, input.reason);
    } catch (cancelError) {
      // Log mas não bloqueia cancelamento interno
      console.warn(
        `[FiscalDocument] Erro ao cancelar documento ${documentId} no provider externo:`,
        cancelError
      );
    }

    return updatedDocument;
  }
}

export const fiscalDocumentService = new FiscalDocumentService();


