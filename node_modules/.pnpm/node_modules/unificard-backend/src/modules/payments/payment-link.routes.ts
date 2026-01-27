// backend/src/modules/payments/payment-link.routes.ts
// SPRINT 86: PAYMENT LINKS

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { paymentLinkService } from './payment-link.service';
import { paymentLinkRepository } from './payment-link.repository';
import { contactService } from '../marketplace/contact.service';

/**
 * Rotas públicas para payment links (sem auth)
 */
const publicPaymentLinkRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /pay/:slug
   * Retorna dados do link (read-only, público)
   */
  fastify.get<{ Params: { slug: string } }>('/pay/:slug', async (req, reply) => {
    // SPRINT 86: Resolver tenant via slug (futuro: pode ter tenant no slug ou metadata)
    // Por enquanto, assumir que slug é único globalmente ou buscar via metadata
    // Por simplicidade, vamos buscar em todos os tenants (futuro: otimizar)
    
    // Por enquanto, retornar erro se não houver tenant no query param
    const tenantId = (req.query as any)?.tenantId;
    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId é obrigatório' });
    }

    const link = await paymentLinkService.getBySlug(tenantId, req.params.slug);

    if (!link) {
      return reply.status(404).send({ error: 'Link não encontrado' });
    }

    // Validar link
    const validation = await paymentLinkService.validateLink(link);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    return reply.send({
      id: link.id,
      title: link.title,
      description: link.description,
      amount: link.amount,
      currency: link.currency,
      expiresAt: link.expiresAt?.toISOString() || null,
      maxUses: link.maxUses,
      usesCount: link.usesCount,
      status: link.status,
    });
  });

  /**
   * POST /pay/:slug/intent
   * Cria PaymentIntent a partir do link
   * 
   * SPRINT 86: Rota pública, sem auth
   */
  fastify.post<{
    Params: { slug: string };
    Body: {
      tenantId: string;
      contact?: {
        name: string;
        email?: string;
        phone?: string;
        taxId?: string;
      };
      paymentMethodId?: string;
    };
  }>('/pay/:slug/intent', async (req, reply) => {
    const { slug } = req.params;
    const { tenantId, contact, paymentMethodId } = req.body;

    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId é obrigatório' });
    }

    // 1. Buscar link
    const link = await paymentLinkService.getBySlug(tenantId, slug);
    if (!link) {
      return reply.status(404).send({ error: 'Link não encontrado' });
    }

    // 2. Validar link
    const validation = await paymentLinkService.validateLink(link);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    // 3. Criar ou buscar contact se fornecido
    let contactId: string | undefined;
    if (contact) {
      try {
        const { contactService } = await import('../marketplace/contact.service');
        const existing = contact.taxId
          ? await contactService.getContactByTaxId(tenantId, contact.taxId)
          : null;

        if (existing) {
          contactId = existing.id;
        } else {
          const newContact = await contactService.createContact(
            tenantId,
            {
              type: contact.taxId && contact.taxId.length === 14 ? 'COMPANY' : 'PERSON',
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
              taxId: contact.taxId || null,
            },
            link.createdByActorId,
            null // createdByUserId não disponível em link público
          );
          contactId = newContact.id;
        }
      } catch (contactError) {
        // Log mas não bloqueia criação de intent
        console.warn('[PaymentLink] Erro ao criar contact:', contactError);
      }
    }

    // 4. Criar order temporário (PaymentIntent requer orderId)
    const { orderService } = await import('../marketplace/order.service');
    const tempOrder = await orderService.createOrder(tenantId, {
      buyerActorId: link.createdByActorId, // Usar actor do criador como buyer temporário
      sellerActorId: link.createdByActorId, // Mesmo actor (payment link é recebimento direto)
      metadata: {
        is_payment_link: true,
        payment_link_id: link.id,
        payment_link_slug: slug,
        contact_id: contactId,
      },
    });

    // Submeter order (necessário para criar PaymentIntent)
    const submittedOrder = await orderService.submitOrder(tenantId, tempOrder.id);

    // 5. Criar PaymentIntent
    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const intent = await paymentIntentService.createPaymentIntent(tenantId, {
      orderId: submittedOrder.id,
      amount: link.amount,
      currency: link.currency as any,
      paymentMethodId,
      metadata: {
        payment_link_id: link.id,
        payment_link_slug: slug,
        source: 'PAYMENT_LINK',
        contact_id: contactId,
        payerContactId: contactId, // SPRINT 0: Para AccountsReceivable
      },
    });

    // 6. Autorizar PaymentIntent
    const authorizedIntent = await paymentIntentService.authorizePaymentIntent(tenantId, intent.id);

    // 7. Registrar pagamento via link (append-only)
    await paymentLinkRepository.createPayment(
      tenantId,
      link.id,
      authorizedIntent.id,
      contactId
    );

    // 8. Retornar métodos disponíveis
    const availableMethods = ['PIX', 'UNIFYCARD']; // Por enquanto, sempre disponíveis

    return reply.send({
      paymentIntentId: authorizedIntent.id,
      availableMethods,
      amount: link.amount,
      currency: link.currency,
    });
  });

  /**
   * GET /pay/:slug/status
   * Consulta status do pagamento
   */
  fastify.get<{
    Params: { slug: string };
    Querystring: { tenantId: string; paymentIntentId?: string };
  }>('/pay/:slug/status', async (req, reply) => {
    const { slug } = req.params;
    const { tenantId, paymentIntentId } = req.query;

    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId é obrigatório' });
    }

    // Buscar link
    const link = await paymentLinkService.getBySlug(tenantId, slug);
    if (!link) {
      return reply.status(404).send({ error: 'Link não encontrado' });
    }

    // Se paymentIntentId fornecido, buscar status do pagamento
    if (paymentIntentId) {
      const { paymentIntentService } = await import('../marketplace/payment-intent.service');
      const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

      if (!intent) {
        return reply.status(404).send({ error: 'PaymentIntent não encontrado' });
      }

      // Buscar transaction se existir
      const { paymentTransactionRepository } = await import('../marketplace/payment-transaction.repository');
      const transactions = await paymentTransactionRepository.listTransactionsByIntent(
        tenantId,
        paymentIntentId
      );

      const latestTransaction = transactions[0] || null;

      return reply.send({
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          amount: intent.amount,
          currency: intent.currency,
        },
        transaction: latestTransaction
          ? {
              id: latestTransaction.id,
              status: latestTransaction.status,
              amount: latestTransaction.amount,
            }
          : null,
        link: {
          id: link.id,
          title: link.title,
          amount: link.amount,
          usesCount: link.usesCount,
        },
      });
    }

    // Sem paymentIntentId, retornar apenas dados do link
    return reply.send({
      link: {
        id: link.id,
        title: link.title,
        amount: link.amount,
        usesCount: link.usesCount,
        status: link.status,
      },
    });
  });
};

export default publicPaymentLinkRoutes;

