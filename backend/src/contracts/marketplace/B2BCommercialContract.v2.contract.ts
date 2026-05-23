// CONTRATO v2 — B2BCommercialContract (nomenclatura canônica)
// v1: B2BCommercialContract.contract.ts (CONGELADO)
// §4.7 / §4.8 — preço e multas com unidade explícita.

import type { MoneyAmountCents, RateBps } from './_canonical/money.types';

export interface B2BCommercialContractV2 {
  contractId: string;
  supplierId: string;
  supplierType: 'store' | 'hub' | 'industry';
  buyerId: string;
  buyerType: 'store' | 'hub';
  region: {
    country: string;
    state: string;
    city: string;
  };
  products: Array<{
    productId: string;
    name: string;
    unitPrice: MoneyAmountCents;
    minimumQuantity: number;
    maximumQuantity?: number;
  }>;
  terms: {
    volumeCommitment: number;
    deliverySchedule: 'weekly' | 'monthly' | 'quarterly';
    paymentTerms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    /** Multa por atraso em basis points (§4.8), ex.: 250 = 2,5%. */
    penaltyRateBps?: RateBps;
  };
  status: 'draft' | 'active' | 'fulfilled' | 'breached' | 'cancelled';
  startDate: string;
  endDate: string;
  createdAt: string;
  signedAt?: string;
}