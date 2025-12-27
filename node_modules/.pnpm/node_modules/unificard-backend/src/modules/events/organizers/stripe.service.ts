// src/modules/events/organizers/stripe.service.ts
// Service para integração com Stripe
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY não configurada. Funcionalidades de pagamento desabilitadas.');
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    })
  : null;

export interface CreateStripeCustomerInput {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateStripeSubscriptionInput {
  customerId: string;
  priceId: string; // Stripe Price ID (ex: price_xxx)
  metadata?: Record<string, string>;
}

export class StripeService {
  /**
   * Cria cliente no Stripe
   */
  async createCustomer(input: CreateStripeCustomerInput): Promise<Stripe.Customer> {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    return await stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: input.metadata || {},
    });
  }

  /**
   * Cria assinatura no Stripe
   */
  async createSubscription(input: CreateStripeSubscriptionInput): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    return await stripe.subscriptions.create({
      customer: input.customerId,
      items: [{ price: input.priceId }],
      metadata: input.metadata || {},
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  /**
   * Cancela assinatura no Stripe
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    if (cancelAtPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  }

  /**
   * Retoma assinatura cancelada
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Busca assinatura no Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Verifica webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    if (!stripe) {
      throw new Error('Stripe não configurado. Configure STRIPE_SECRET_KEY.');
    }

    return stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Mapeia plano do Unificard para Price ID do Stripe
   */
  getStripePriceId(plan: 'free' | 'basic' | 'pro' | 'enterprise'): string | null {
    const priceMap: Record<string, string> = {
      basic: process.env.STRIPE_PRICE_ID_BASIC || '',
      pro: process.env.STRIPE_PRICE_ID_PRO || '',
      enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
    };

    if (plan === 'free') {
      return null;
    }

    return priceMap[plan] || null;
  }
}

export const stripeService = new StripeService();













