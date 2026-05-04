// backend/src/modules/marketplace/marketplace.service.industry.ts
// Módulo Industry: indústria, hubs, dropship, delivery via hub

import type { MarketplaceService } from '../../marketplace.service';
import { marketplaceLogger } from '../../marketplace.logger';
import type { IndustryAccount, DistributionHub, PaymentPlan, DeliveryOrder } from '@contracts/marketplace';

export class MarketplaceIndustryModule {
  private industryAccounts = new Map<string, IndustryAccount>();
  private distributionHubs = new Map<string, DistributionHub>();

  constructor(private readonly facade: MarketplaceService) {}

  createIndustryAccount(input: {
    name: string;
    cnpj: string;
    categoriesSupported: string[];
    defaultMarginRules: {
      hubMarginPercentage: number;
      storeMarginPercentage: number;
      minimumPrice?: number;
    };
    authorizedHubs?: string[];
  }): IndustryAccount {
    const industryId = `industry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const industry: IndustryAccount = {
      industryId: industryId,
      name: input.name,
      cnpj: input.cnpj,
      categoriesSupported: input.categoriesSupported,
      defaultMarginRules: {
        hubMarginPercentage: input.defaultMarginRules.hubMarginPercentage,
        storeMarginPercentage: input.defaultMarginRules.storeMarginPercentage,
        minimumPrice: input.defaultMarginRules.minimumPrice,
      },
      authorizedHubs: input.authorizedHubs || [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.industryAccounts.set(industryId, industry);

    marketplaceLogger.init('Industry account criada', { industryId: industryId });

    return industry;
  }

  getIndustryAccount(industryId: string): IndustryAccount | null {
    return this.industryAccounts.get(industryId) || null;
  }

  getIndustryAccounts(): IndustryAccount[] {
    return Array.from(this.industryAccounts.values()).filter((i) => i.isActive);
  }

  createDistributionHub(input: {
    industryId: string;
    name: string;
    location: {
      country: string;
      state: string;
      city: string;
      neighborhood?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    supportedProducts: string[];
    fulfillmentType: 'pickup' | 'delivery' | 'mixed';
    margin_override?: {
      percentage?: number;
      fixed_amount?: number;
    };
    logisticsProfile: {
      defaultEtaMinutes: number;
      supportedVehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
      costPerKm?: number;
      baseCost?: number;
    };
  }): DistributionHub {
    const industry = this.industryAccounts.get(input.industryId);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    const hubId = `hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const hub: DistributionHub = {
      hubId: hubId,
      industryId: input.industryId,
      name: input.name,
      location: input.location,
      supportedProducts: input.supportedProducts,
      fulfillmentType: input.fulfillmentType,
      marginOverride: input.margin_override,
      logisticsProfile: {
        defaultEtaMinutes: input.logisticsProfile.defaultEtaMinutes,
        supportedVehicles: input.logisticsProfile.supportedVehicles,
        costPerKm: input.logisticsProfile.costPerKm,
        baseCost: input.logisticsProfile.baseCost,
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.distributionHubs.set(hubId, hub);

    if (!industry.authorizedHubs.includes(hubId)) {
      industry.authorizedHubs.push(hubId);
      industry.updatedAt = new Date().toISOString();
    }

    marketplaceLogger.init('Distribution hub criado', { hubId: hubId, industryId: input.industryId });

    return hub;
  }

  getDistributionHub(hubId: string): DistributionHub | null {
    return this.distributionHubs.get(hubId) || null;
  }

  getIndustryHubs(industryId: string): DistributionHub[] {
    return Array.from(this.distributionHubs.values()).filter((h) => h.industryId === industryId && h.isActive);
  }

  findHubForProduct(productId: string, city: string, state: string): DistributionHub | null {
    const hubs = Array.from(this.distributionHubs.values()).filter(
      (h) =>
        h.isActive &&
        h.supportedProducts.includes(productId) &&
        h.location.city === city &&
        h.location.state === state
    );
    return hubs[0] || null;
  }

  createPaymentPlanWithDropship(
    checkoutId: string,
    method: 'balance' | 'card' | 'invoice',
    dropshipItems: Array<{
      productId: string;
      industryId: string;
      hubId: string;
      storeId: string;
      quantity: number;
      unitPrice: number;
    }>
  ): PaymentPlan {
    const checkout = this.facade.checkout.getCheckout(checkoutId);
    if (!checkout) throw new Error('Checkout não encontrado');
    if (checkout.status !== 'confirmed') throw new Error('Checkout precisa estar confirmado para criar payment plan');

    const paymentPlanId = `payment-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const paymentPlan: PaymentPlan = {
      paymentPlanId,
      checkoutId: checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [],
      status: 'calculated',
    };
    this.facade.orders.getOrders().setPaymentPlan(paymentPlanId, paymentPlan);
    marketplaceLogger.init('PaymentPlan criado com dropship', { paymentPlanId, dropship_items: dropshipItems.length });
    return paymentPlan;
  }

  createDeliveryFromHub(checkoutId: string, hubId: string, storeId: string): DeliveryOrder {
    const hub = this.getDistributionHub(hubId);
    if (!hub) throw new Error('Hub não encontrado');
    if (!hub.isActive) throw new Error('Hub não está ativo');

    const checkout = this.facade.checkout.getCheckout(checkoutId);
    if (!checkout) throw new Error('Checkout não encontrado');
    if ((checkout as unknown as Record<string, string>).status !== 'paid' && (checkout as unknown as Record<string, string>).status !== 'invoiced') {
      throw new Error('Checkout precisa estar pago para criar entrega via hub');
    }

    const deliveryId = `delivery-hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const rawVehicle = hub.logisticsProfile.supportedVehicles[0] || 'car';
    const defaultVehicle: 'bike' | 'moto' | 'car' | 'van' =
      rawVehicle === 'truck' ? 'van' : rawVehicle === 'bike' || rawVehicle === 'moto' || rawVehicle === 'car' || rawVehicle === 'van' ? rawVehicle : 'car';
    const baseCost = hub.logisticsProfile.baseCost ?? 10;

    const delivery: DeliveryOrder = {
      deliveryId,
      checkoutId,
      storeId,
      type: hub.fulfillmentType === 'pickup' ? 'own' : 'third_party',
      vehicle: defaultVehicle,
      etaMinutes: hub.logisticsProfile.defaultEtaMinutes,
      cost: {
        amountCents: Math.round(baseCost * 100),
        currency: 'BRL',
        payer: 'buyer',
      },
      status: 'created',
    };
    (delivery as unknown as Record<string, string>).hub_id = hubId;
    (delivery as unknown as Record<string, string>).fulfillment_by = 'hub';
    this.facade.orders.getOrders().setDelivery(deliveryId, delivery);
    marketplaceLogger.init('Delivery criado via hub', { delivery_id: deliveryId, hubId, storeId });
    return delivery;
  }
}