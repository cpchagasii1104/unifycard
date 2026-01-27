// backend/src/modules/crm/crm.service.ts
// SPRINT 88: CRM CANÔNICO

import { crmRepository } from './crm.repository';
import type {
  CrmNote,
  CrmTag,
  CrmConsent,
  CrmTimelineEvent,
  CreateCrmNoteInput,
  CreateCrmTagInput,
  SetCrmConsentInput,
  CrmTimelineFilters,
  CrmTimelineEventType,
} from './crm.types';

/**
 * Service para CRM
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ/WRITE apenas em entidades CRM
 * - Não altera Order/Payment/Fiscal
 * - Timeline é READ-ONLY (consolida dados existentes)
 * - Tudo auditável
 */
class CrmService {
  // ============================================================
  // NOTES
  // ============================================================

  /**
   * Adiciona nota ao contato
   */
  async addNote(
    tenantId: string,
    authorActorId: string,
    authorUserId: string | null,
    input: CreateCrmNoteInput
  ): Promise<CrmNote> {
    const note = await crmRepository.createNote(
      tenantId,
      authorActorId,
      authorUserId,
      input
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CRM_NOTE_ADDED',
      noteId: note.id,
      contactId: input.contactId,
      authorActorId,
      authorUserId,
    });

    return note;
  }

  /**
   * Lista notas do contato
   */
  async listNotes(tenantId: string, contactId: string): Promise<CrmNote[]> {
    return await crmRepository.listNotes(tenantId, contactId);
  }

  // ============================================================
  // TAGS
  // ============================================================

  /**
   * Cria tag
   */
  async createTag(
    tenantId: string,
    input: CreateCrmTagInput
  ): Promise<CrmTag> {
    const tag = await crmRepository.createTag(tenantId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CRM_TAG_CREATED',
      tagId: tag.id,
      tagName: tag.name,
    });

    return tag;
  }

  /**
   * Lista tags
   */
  async listTags(tenantId: string): Promise<CrmTag[]> {
    return await crmRepository.listTags(tenantId);
  }

  /**
   * Atribui tag ao contato
   */
  async assignTag(
    tenantId: string,
    contactId: string,
    tagId: string,
    assignedByActorId: string,
    assignedByUserId: string | null
  ): Promise<void> {
    // Verificar se tag existe
    const tag = await crmRepository.getTagById(tenantId, tagId);
    if (!tag) {
      throw new Error(`Tag não encontrada: ${tagId}`);
    }

    await crmRepository.assignTag(tenantId, contactId, tagId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CRM_TAG_ASSIGNED',
      contactId,
      tagId,
      tagName: tag.name,
      assignedByActorId,
      assignedByUserId,
    });
  }

  /**
   * Remove tag do contato
   */
  async removeTag(
    tenantId: string,
    contactId: string,
    tagId: string,
    removedByActorId: string,
    removedByUserId: string | null
  ): Promise<void> {
    // Verificar se tag existe
    const tag = await crmRepository.getTagById(tenantId, tagId);
    if (!tag) {
      throw new Error(`Tag não encontrada: ${tagId}`);
    }

    await crmRepository.removeTag(tenantId, contactId, tagId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CRM_TAG_REMOVED',
      contactId,
      tagId,
      tagName: tag.name,
      removedByActorId,
      removedByUserId,
    });
  }

  /**
   * Lista tags do contato
   */
  async listContactTags(tenantId: string, contactId: string): Promise<CrmTag[]> {
    const contactTags = await crmRepository.listContactTags(tenantId, contactId);
    const allTags = await crmRepository.listTags(tenantId);
    
    // Mapear tagIds para tags completas
    const tagMap = new Map(allTags.map((tag) => [tag.id, tag]));
    return contactTags
      .map((ct) => tagMap.get(ct.tagId))
      .filter((tag): tag is CrmTag => tag !== undefined);
  }

  // ============================================================
  // CONSENTS
  // ============================================================

  /**
   * Define consentimento
   */
  async setConsent(
    tenantId: string,
    updatedByActorId: string,
    updatedByUserId: string | null,
    input: SetCrmConsentInput
  ): Promise<CrmConsent> {
    const consent = await crmRepository.setConsent(
      tenantId,
      updatedByActorId,
      updatedByUserId,
      input
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CRM_CONSENT_CHANGED',
      consentId: consent.id,
      contactId: input.contactId,
      channel: input.channel,
      status: input.status,
      updatedByActorId,
      updatedByUserId,
    });

    return consent;
  }

  /**
   * Busca consentimentos do contato
   */
  async getConsents(tenantId: string, contactId: string): Promise<CrmConsent[]> {
    return await crmRepository.getConsents(tenantId, contactId);
  }

  // ============================================================
  // TIMELINE (READ-ONLY, CONSOLIDADO)
  // ============================================================

  /**
   * Busca timeline do contato (consolida dados existentes)
   * 
   * SPRINT 88: READ-ONLY, não cria dados novos
   */
  async getTimeline(
    tenantId: string,
    contactId: string,
    filters: CrmTimelineFilters = {}
  ): Promise<CrmTimelineEvent[]> {
    const events: CrmTimelineEvent[] = [];

    // 1. Orders (PDV/Marketplace) - buscar via metadata.contact_id
    try {
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const orderRows = await runQueriesWithTenant<{
        id: string;
        status: string;
        total_amount: number;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT o.id, o.status, o.created_at
        FROM orders o
        WHERE o.tenant_id = $1
          AND o.metadata->>'contact_id' = $2
        ORDER BY o.created_at DESC
        LIMIT 50
        `,
        [tenantId, contactId]
      );
      
      for (const order of orderRows) {
        // Buscar payment intent para obter valor
        let orderAmount = 0;
        try {
          const { paymentIntentRepository } = await import('../marketplace/payment-intent.repository');
          const intents = await paymentIntentRepository.listIntentsByOrder(tenantId, order.id);
          if (intents.length > 0) {
            orderAmount = intents[0].amount;
          }
        } catch (error) {
          // Ignorar erro
        }

        events.push({
          id: `order-${order.id}`,
          type: 'ORDER_CREATED',
          occurredAt: order.created_at,
          title: `Pedido criado`,
          description: `Pedido #${order.id.substring(0, 8)}${orderAmount > 0 ? ` - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orderAmount)}` : ''}`,
          metadata: {
            order_id: order.id,
            status: order.status,
          },
          sourceEntity: {
            type: 'order',
            id: order.id,
          },
        });

        // Se order foi pago, adicionar evento ORDER_PAID
        if (order.status === 'PAID' || order.status === 'FULFILLED') {
          // Buscar payment transaction via payment intent
          try {
            const { paymentIntentRepository } = await import('../marketplace/payment-intent.repository');
            const intents = await paymentIntentRepository.listIntentsByOrder(tenantId, order.id);
            if (intents.length > 0) {
              const { paymentTransactionRepository } = await import('../marketplace/payment-transaction.repository');
              const transactions = await paymentTransactionRepository.listTransactionsByIntent(tenantId, intents[0].id);
              const successTransaction = transactions.find((t) => t.status === 'SUCCESS');
              
              if (successTransaction) {
                events.push({
                  id: `order-paid-${order.id}`,
                  type: 'ORDER_PAID',
                  occurredAt: successTransaction.updatedAt,
                  title: `Pedido pago`,
                  description: `Pagamento confirmado${orderAmount > 0 ? ` - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orderAmount)}` : ''}`,
                  metadata: {
                    order_id: order.id,
                    transaction_id: successTransaction.id,
                  },
                  sourceEntity: {
                    type: 'order',
                    id: order.id,
                  },
                });
              }
            }
          } catch (error) {
            // Ignorar erro
          }
        }
      }
    } catch (error) {
      // Log mas não bloqueia timeline
      console.warn('[CrmService] Erro ao buscar orders:', error);
    }

    // 2. Ticket Sales (Eventos) - buscar via metadata.contact_id
    try {
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const ticketSaleRows = await runQueriesWithTenant<{
        id: string;
        status: string;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT ts.id, ts.status, ts.created_at
        FROM ticket_sales ts
        WHERE ts.tenant_id = $1
          AND ts.metadata->>'contact_id' = $2
        ORDER BY ts.created_at DESC
        LIMIT 50
        `,
        [tenantId, contactId]
      );
      
      for (const sale of ticketSaleRows) {
        events.push({
          id: `ticket-${sale.id}`,
          type: 'TICKET_PURCHASED',
          occurredAt: sale.created_at,
          title: `Ingresso comprado`,
          description: `Ingresso para evento`,
          metadata: {
            ticket_sale_id: sale.id,
            status: sale.status,
          },
          sourceEntity: {
            type: 'ticket_sale',
            id: sale.id,
          },
        });
      }
    } catch (error) {
      console.warn('[CrmService] Erro ao buscar ticket sales:', error);
    }

    // 3. Payment Links - buscar via payment_link_payments.contact_id
    try {
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const paymentRows = await runQueriesWithTenant<{
        id: string;
        payment_link_id: string;
        payment_intent_id: string;
        status: string;
        updated_at: Date;
      }>(
        tenantId,
        `
        SELECT plp.id, plp.payment_link_id, plp.payment_intent_id, plp.status, plp.updated_at
        FROM payment_link_payments plp
        WHERE plp.tenant_id = $1
          AND plp.contact_id = $2
        ORDER BY plp.updated_at DESC
        LIMIT 50
        `,
        [tenantId, contactId]
      );
      
      for (const payment of paymentRows) {
        if (payment.status === 'SUCCESS') {
          events.push({
            id: `payment-link-${payment.id}`,
            type: 'PAYMENT_LINK_USED',
            occurredAt: payment.updated_at,
            title: `Link de pagamento usado`,
            description: `Pagamento via link confirmado`,
            metadata: {
              payment_link_payment_id: payment.id,
              payment_intent_id: payment.payment_intent_id,
            },
            sourceEntity: {
              type: 'payment_link',
              id: payment.payment_link_id,
            },
          });
        }
      }
    } catch (error) {
      console.warn('[CrmService] Erro ao buscar payment links:', error);
    }

    // 4. Accounts Receivable - buscar via metadata.contact_id
    try {
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const receivableRows = await runQueriesWithTenant<{
        id: string;
        amount_cents: number;
        status: string;
        expected_at: Date;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT ar.id, ar.amount_cents, ar.status, ar.expected_at, ar.created_at
        FROM accounts_receivable ar
        WHERE ar.tenant_id = $1
          AND ar.metadata->>'contact_id' = $2
        ORDER BY ar.created_at DESC
        LIMIT 50
        `,
        [tenantId, contactId]
      );
      
      for (const receivable of receivableRows) {
        events.push({
          id: `receivable-${receivable.id}`,
          type: 'RECEIVABLE_CREATED',
          occurredAt: receivable.created_at,
          title: `Conta a receber criada`,
          description: `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receivable.amount_cents / 100)} - Vencimento: ${new Date(receivable.expected_at).toLocaleDateString('pt-BR')}`,
          metadata: {
            receivable_id: receivable.id,
            amount_cents: receivable.amount_cents,
            status: receivable.status,
          },
          sourceEntity: {
            type: 'receivable',
            id: receivable.id,
          },
        });
      }
    } catch (error) {
      console.warn('[CrmService] Erro ao buscar receivables:', error);
    }

    // 5. Fiscal Documents - buscar via metadata.contact_id
    try {
      const { runQueriesWithTenant } = await import('@core/database/pool');
      const documentRows = await runQueriesWithTenant<{
        id: string;
        document_type: string;
        status: string;
        total_amount: number;
        created_at: Date;
        updated_at: Date;
      }>(
        tenantId,
        `
        SELECT fd.id, fd.document_type, fd.status, fd.total_amount, fd.created_at, fd.updated_at
        FROM fiscal_documents fd
        WHERE fd.tenant_id = $1
          AND fd.metadata->>'contact_id' = $2
        ORDER BY fd.created_at DESC
        LIMIT 50
        `,
        [tenantId, contactId]
      );
      
      for (const doc of documentRows) {
        if (doc.status === 'DRAFT') {
          events.push({
            id: `fiscal-draft-${doc.id}`,
            type: 'FISCAL_DRAFT',
            occurredAt: doc.created_at,
            title: `Documento fiscal (rascunho)`,
            description: `${doc.document_type} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.total_amount)}`,
            metadata: {
              fiscal_document_id: doc.id,
              document_type: doc.document_type,
            },
            sourceEntity: {
              type: 'fiscal_document',
              id: doc.id,
            },
          });
        } else if (doc.status === 'ISSUED') {
          events.push({
            id: `fiscal-issued-${doc.id}`,
            type: 'FISCAL_ISSUED',
            occurredAt: doc.updated_at,
            title: `Documento fiscal emitido`,
            description: `${doc.document_type} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.total_amount)}`,
            metadata: {
              fiscal_document_id: doc.id,
              document_type: doc.document_type,
            },
            sourceEntity: {
              type: 'fiscal_document',
              id: doc.id,
            },
          });
        }
      }
    } catch (error) {
      console.warn('[CrmService] Erro ao buscar fiscal documents:', error);
    }

    // 6. Notes
    const notes = await crmRepository.listNotes(tenantId, contactId);
    for (const note of notes) {
      events.push({
        id: `note-${note.id}`,
        type: 'NOTE_ADDED',
        occurredAt: note.createdAt,
        title: `Nota adicionada`,
        description: note.note.substring(0, 100) + (note.note.length > 100 ? '...' : ''),
        metadata: {
          note_id: note.id,
          visibility: note.visibility,
        },
        sourceEntity: {
          type: 'note',
          id: note.id,
        },
      });
    }

    // 7. Tags (apenas últimas atribuições)
    const contactTags = await crmRepository.listContactTags(tenantId, contactId);
    for (const contactTag of contactTags) {
      const tag = await crmRepository.getTagById(tenantId, contactTag.tagId);
      if (tag) {
        events.push({
          id: `tag-${contactTag.id}`,
          type: 'TAG_ASSIGNED',
          occurredAt: contactTag.createdAt,
          title: `Tag atribuída: ${tag.name}`,
          description: null,
          metadata: {
            tag_id: tag.id,
            tag_name: tag.name,
          },
          sourceEntity: {
            type: 'tag',
            id: tag.id,
          },
        });
      }
    }

    // 8. Consents (apenas mudanças)
    const consents = await crmRepository.getConsents(tenantId, contactId);
    for (const consent of consents) {
      if (consent.status === 'GRANTED') {
        events.push({
          id: `consent-${consent.id}`,
          type: 'CONSENT_CHANGED',
          occurredAt: consent.updatedAt,
          title: `Consentimento concedido: ${consent.channel}`,
          description: null,
          metadata: {
            consent_id: consent.id,
            channel: consent.channel,
          },
          sourceEntity: {
            type: 'consent',
            id: consent.id,
          },
        });
      }
    }

    // Filtrar por tipo se fornecido
    let filteredEvents = events;
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter((e) => filters.eventTypes!.includes(e.type));
    }

    // Filtrar por data se fornecido
    if (filters.startDate) {
      filteredEvents = filteredEvents.filter((e) => e.occurredAt >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredEvents = filteredEvents.filter((e) => e.occurredAt <= filters.endDate!);
    }

    // Ordenar por data (mais recente primeiro)
    filteredEvents.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    // Paginação
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    return filteredEvents.slice(offset, offset + limit);
  }

  /**
   * Registra auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[CrmService] Erro ao registrar auditoria:', error);
    }
  }
}

export const crmService = new CrmService();

