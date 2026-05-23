// Única camada que conhece B2BCommercialContract v1 + v2.
// Convenções v1 (legado):
// - product.unitPrice = centavos inteiros (alinhar com §4.7; se no teu feed for unidade maior, converter antes).
// - terms.penaltyRate = percentual humano (ex.: 2.5 = 2,5% → 250 bps).

import type { B2BCommercialContract } from '../B2BCommercialContract.contract';
import type { B2BCommercialContractV2 } from '../B2BCommercialContract.v2.contract';
import { asMoneyAmountCents, asRateBps } from '../_canonical/money.types';

export function b2bCommercialContractV1ToV2(v1: B2BCommercialContract): B2BCommercialContractV2 {
  return {
    contractId: v1.contractId,
    supplierId: v1.supplierId,
    supplierType: v1.supplierType,
    buyerId: v1.buyerId,
    buyerType: v1.buyerType,
    region: v1.region,
    products: v1.products.map((p) => ({
      productId: p.productId,
      name: p.name,
      unitPrice: asMoneyAmountCents(Math.round(p.unitPrice), p.currency),
      minimumQuantity: p.minimumQuantity,
      maximumQuantity: p.maximumQuantity,
    })),
    terms: {
      volumeCommitment: v1.terms.volumeCommitment,
      deliverySchedule: v1.terms.deliverySchedule,
      paymentTerms: v1.terms.paymentTerms,
      penaltyRateBps:
        v1.terms.penaltyRate != null
          ? asRateBps(Math.round(v1.terms.penaltyRate * 100))
          : undefined,
    },
    status: v1.status,
    startDate: v1.startDate,
    endDate: v1.endDate,
    createdAt: v1.createdAt,
    signedAt: v1.signedAt,
  };
}