// backend/src/modules/payments/payment-link.routes.ts
// SPRINT 86: PAYMENT LINKS

import type { FastifyInstance } from 'fastify';
import { paymentLinkService } from './payment-link.service';
import { paymentLinkRepository } from './payment-link.repository';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const publicPaymentLinkRoutes = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { slug: string } }>('/pay/:slug', async (req, reply) => {
    const tenantId = (req.query as any)?.tenantId;
    if (!tenantId) {
      throw new BadRequestError('tenantId is required', ErrorCode.MISSING_TENANT);
    }

    const link = await paymentLinkService.getBySlug(tenantId, req.params.slug);

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const validation = await paymentLinkService.validateLink(link);
    if (!validation.valid) {
      throw new BadRequestError(validation.error || 'Invalid link', ErrorCode.VALIDATION_ERROR);
    }

    return reply.send({
      id: link.id,
      title: link.title,
      description: link.description,
      amountCents: link.amountCents,
      currency: link.currency,
      expiresAt: link.expiresAt?.toISOString() || null,
      maxUses: link.maxUses,
      usesCount: link.usesCount,
      status: link.status,
    });
  });

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
      throw new BadRequestError('tenantId is required', ErrorCode.MISSING_TENANT);
    }

    const link = await paymentLinkService.getBySlug(tenantId, slug);
    if (!link) {
      throw new NotFoundError('Link not found');
    }

    const validation = await paymentLinkService.validateLink(link);
    if (!validation.valid) {
      throw new BadRequestError(validation.error || 'Invalid link', ErrorCode.VALIDATION_ERROR);
    }

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
              email: contact.email || undefined,
              phone: contact.phone || undefined,
              taxId: contact.taxId || undefined,
            },
            link.createdByActorId,
            undefined
          );
          contactId = newContact.id;
        }
      } catch (contactError) {
        console.warn('[PaymentLink] Erro ao criar contact:', contactError);
      }
    }

    const { orderService } = await import('../marketplace/order.service');
    const tempOrder = await orderService.createOrder(tenantId, {
      buyerActorId: link.createdByActorId,
      sellerActorId: link.createdByActorId,
      metadata: {
        is_payment_link: true,
        payment_link_id: link.id,
        payment_link_slug: slug,
        contact_id: contactId,
      },
    });

    const submittedOrder = await orderService.submitOrder(tenantId, tempOrder.id);

    const { createPaymentIntent } = await import('./payment-intent-repository');
    const intent = await createPaymentIntent(tenantId, {
      referenceId: submittedOrder.id,
      gateway: 'internal',
      actorId: link.createdByActorId,
      amountCents: link.amountCents,
      currency: link.currency,
      source: 'payment_link',
      metadata: {
        payment_link_id: link.id,
        payment_link_slug: slug,
        contact_id: contactId,
        payerContactId: contactId,
        order_id: submittedOrder.id,
        payment_method_id: paymentMethodId,
      },
    });

    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const authorizedIntent = await paymentIntentService.authorizePaymentIntent(tenantId, intent.id);

    await paymentLinkRepository.createPayment(tenantId, link.id, authorizedIntent.id, contactId);

    const availableMethods = ['PIX', 'UNIFYCARD'];

    return reply.send({
      paymentIntentId: authorizedIntent.id,
      availableMethods,
      amountCents: link.amountCents,
      currency: link.currency,
    });
  });

  fastify.get<{
    Params: { slug: string };
    Querystring: { tenantId: string; paymentIntentId?: string };
  }>('/pay/:slug/status', async (req, reply) => {
    const { slug } = req.params;
    const { tenantId, paymentIntentId } = req.query;

    if (!tenantId) {
      throw new BadRequestError('tenantId is required', ErrorCode.MISSING_TENANT);
    }

    const link = await paymentLinkService.getBySlug(tenantId, slug);
    if (!link) {
      throw new NotFoundError('Link not found');
    }

    if (paymentIntentId) {
      const { paymentIntentService } = await import('../marketplace/payment-intent.service');
      const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

      if (!intent) {
        throw new NotFoundError('PaymentIntent not found');
      }

      const { paymentTransactionRepository } = await import('./payment-transaction.repository');
      const transactions = await paymentTransactionRepository.listTransactionsByIntent(
        tenantId,
        paymentIntentId
      );

      const latestTransaction = transactions[0] || null;

      return reply.send({
        paymentIntent: {
          id: intent.id,
          status: intent.status,
          amountCents: intent.amountCents,
          currency: intent.currency,
        },
        transaction: latestTransaction
          ? {
              id: latestTransaction.id,
              status: latestTransaction.status,
              amountCents: latestTransaction.amountCents ?? 0,
            }
          : null,
        link: {
          id: link.id,
          title: link.title,
          amountCents: link.amountCents,
          usesCount: link.usesCount,
        },
      });
    }

    return reply.send({
      link: {
        id: link.id,
        title: link.title,
        amountCents: link.amountCents,
        usesCount: link.usesCount,
        status: link.status,
      },
    });
  });
};

export default publicPaymentLinkRoutes;
