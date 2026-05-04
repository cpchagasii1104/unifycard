// backend/src/modules/marketplace/services/marketplace-vouchers.service.ts
// Agregador: apenas delega para o domain. Sem estado; estado (Maps) fica em domain/vouchers.

import type { MarketplaceService } from '../marketplace.service';
import type {
  VoucherOffer,
  VoucherClaim,
  VoucherVisibilityScope,
  VoucherType,
} from '@contracts/marketplace';
import { MarketplaceVouchersDomainService } from '../domain/vouchers/marketplace-vouchers.service';

export class MarketplaceVouchersService {
  private readonly vouchersDomain: MarketplaceVouchersDomainService;

  constructor(facade: MarketplaceService) {
    this.vouchersDomain = new MarketplaceVouchersDomainService(facade);
  }

  createVoucherOffer(
    issuerActorId: string,
    storeId: string,
    offer: Omit<VoucherOffer, 'offerId' | 'issuerActorId' | 'storeId' | 'quantityClaimed' | 'status' | 'createdAt' | 'updatedAt'>
  ): VoucherOffer {
    return this.vouchersDomain.createVoucherOffer(issuerActorId, storeId, offer);
  }

  activateVoucherOffer(offerId: string): VoucherOffer | null {
    return this.vouchersDomain.activateVoucherOffer(offerId);
  }

  pauseVoucherOffer(offerId: string): VoucherOffer | null {
    return this.vouchersDomain.pauseVoucherOffer(offerId);
  }

  getVoucherOffer(offerId: string): VoucherOffer | null {
    return this.vouchersDomain.getVoucherOffer(offerId);
  }

  listVoucherOffers(filters: {
    city?: string;
    neighborhood?: string;
    scope?: VoucherVisibilityScope;
    type?: VoucherType;
    active_only?: boolean;
    storeId?: string;
  }): VoucherOffer[] {
    return this.vouchersDomain.listVoucherOffers(filters);
  }

  async claimVoucherOffer(tenantId: string, offerId: string, userId: string, audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }): Promise<VoucherClaim> {
    return this.vouchersDomain.claimVoucherOffer(tenantId, offerId, userId, audit);
  }

  getVoucherClaim(claimId: string): VoucherClaim | null {
    return this.vouchersDomain.getVoucherClaim(claimId);
  }

  async redeemVoucherClaim(
    claimId: string,
    storeOperatorActorId: string,
    presentedCode: string
  ): Promise<{
    claim: VoucherClaim;
    order_id?: string;
    service_booking_id?: string;
  }> {
    return this.vouchersDomain.redeemVoucherClaim(claimId, storeOperatorActorId, presentedCode);
  }

  markNoShow(claimId: string): VoucherClaim | null {
    return this.vouchersDomain.markNoShow(claimId);
  }

  expireVoucherClaims(): {
    expired_count: number;
    expired_claims: string[];
  } {
    return this.vouchersDomain.expireVoucherClaims();
  }

  getUserVoucherClaims(userId: string): VoucherClaim[] {
    return this.vouchersDomain.getUserVoucherClaims(userId);
  }

  getOfferVoucherClaims(offerId: string): VoucherClaim[] {
    return this.vouchersDomain.getOfferVoucherClaims(offerId);
  }
}