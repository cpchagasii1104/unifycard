// backend/src/modules/marketplace/domain/vouchers/marketplace-vouchers.service.ts
// Domínio de vouchers: ofertas, claims, eventos e métricas de abuso/participação.
// Single source of truth para estado de vouchers; stores (Maps) ficam apenas aqui.

import type { MarketplaceService } from '../../marketplace.service';
import type {
  VoucherOffer,
  VoucherClaim,
  VoucherRedemptionEvent,
  VoucherVisibilityScope,
  VoucherType,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';
import { economicIdentityService } from '../../economic-identity.service';

/** Domain service: dono do estado (Maps). Single source of truth para vouchers. */
export class MarketplaceVouchersDomainService {
  private voucherOffers: Map<string, VoucherOffer> = new Map();
  private voucherClaims: Map<string, VoucherClaim> = new Map();
  private voucherRedemptionEvents: Map<string, VoucherRedemptionEvent> = new Map();
  private voucherParticipationScores: Map<string, {
    storeId: string;
    participation_count: number;
    cancellationRate: number;
    no_show_rate: number;
    last_boost_reset: string;
  }> = new Map();
  private userVoucherAbuseMetrics: Map<string, {
    user_id: string;
    expired_claims_count: number;
    no_show_count: number;
    last_penalty_reset: string;
    claim_blocked_until?: string;
  }> = new Map();

  constructor(private readonly _facade: MarketplaceService) {}

  createVoucherOffer(
    issuerActorId: string,
    storeId: string,
    offer: Omit<VoucherOffer, 'offerId' | 'issuerActorId' | 'storeId' | 'quantityClaimed' | 'status' | 'createdAt' | 'updatedAt'>
  ): VoucherOffer {
    if (!offer.startAt || !offer.endAt) {
      throw new Error('Janela startAt e endAt são obrigatórias');
    }
    if (offer.quantityTotal <= 0) {
      throw new Error('quantityTotal deve ser maior que 0');
    }
    if (offer.type === 'service' && !offer.linkedServiceTemplateId && !offer.linkedServiceOfferingId) {
      throw new Error('Oferta de serviço deve vincular a um ServiceTemplateCanonical ou ServiceOffering');
    }
    if (offer.type === 'product' && !offer.linkedProductId) {
      throw new Error('Oferta de produto deve vincular a um StoreProduct');
    }
    if (offer.visibilityScope === 'local_neighborhood' || offer.visibilityScope === 'city') {
      const stores = this._facade.catalog.getStores();
      const store = stores.stores.find(s => s.storeId === storeId);
      if (!store) throw new Error('Loja não encontrada');
      const hasLocation = store.branches.some(b => b.location?.city);
      if (!hasLocation) throw new Error('Escopo local exige store_id com neighborhood/city definida');
    }

    const offerId = `voucher-offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const voucherOffer: VoucherOffer = {
      offerId,
      issuerActorId,
      storeId,
      ...offer,
      quantityClaimed: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      immutable: false,
    };
    this.voucherOffers.set(offerId, voucherOffer);
    this.recordVoucherEvent({
      offerId,
      actorId: issuerActorId,
      type: 'offer_created',
      metadata: { offerTitle: offer.title },
    });
    marketplaceLogger.init('Oferta de voucher criada', { offerId, storeId, type: offer.type });
    return voucherOffer;
  }

  async claimVoucherOffer(tenantId: string, offerId: string, userId: string, audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }): Promise<VoucherClaim> {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) throw new Error('Oferta não encontrada');
    if (offer.status !== 'active') throw new Error('Oferta não está ativa');

    const now = new Date();
    const startAt = new Date(offer.startAt);
    const endAt = new Date(offer.endAt);
    if (now < startAt || now > endAt) throw new Error('Oferta fora da janela de resgate');

    if (offer.quantityClaimed >= offer.quantityTotal) {
      offer.status = 'depleted';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      throw new Error('Oferta esgotada');
    }

    const userClaims = Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (userClaims.length >= offer.quantityPerUser) {
      throw new Error(`Limite de ${offer.quantityPerUser} resgate(s) por usuário atingido`);
    }

    const identity = await economicIdentityService.getEconomicIdentity(tenantId, userId);
    if (offer.eligibility.minTrustLevel) {
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[offer.eligibility.minTrustLevel] || 0;
      const userLevel = identity ? trustLevels[identity.trustLevel] || 0 : 0;
      if (userLevel < requiredLevel) {
        throw new Error(`Trust level mínimo requerido: ${offer.eligibility.minTrustLevel}`);
      }
    }

    const abuseMetrics = this.userVoucherAbuseMetrics.get(userId);
    if (abuseMetrics?.claim_blocked_until) {
      const blockedUntil = new Date(abuseMetrics.claim_blocked_until);
      if (now < blockedUntil) {
        throw new Error(`Usuário bloqueado de resgatar vouchers até ${blockedUntil.toISOString()}`);
      }
    }

    const existingClaim = Array.from(this.voucherClaims.values())
      .find(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (existingClaim) throw new Error('Usuário já possui um resgate ativo para esta oferta');

    const redemptionCode = this.generateRedemptionCode();
    const redemptionDeadline = offer.redemptionDeadlineAt
      ? new Date(offer.redemptionDeadlineAt)
      : new Date(endAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const claimId = `voucher-claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const claim: VoucherClaim = {
      claimId,
      offerId,
      claimerUserId: userId,
      status: 'claimed',
      claimedAt: now.toISOString(),
      redemptionCode,
      expiresAt: redemptionDeadline.toISOString(),
      storeCheckinRequired: offer.pickupConstraints?.requiresCheckin || false,
      audit: {
        ipHash: audit?.ip_hash,
        deviceHash: audit?.device_hash,
        claimedFromNeighborhood: audit?.neighborhood,
        claimedFromCity: audit?.city,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      immutable: true,
    };
    this.voucherClaims.set(claimId, claim);
    offer.quantityClaimed += 1;
    if (offer.quantityClaimed >= offer.quantityTotal) offer.status = 'depleted';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    this.recordVoucherEvent({
      offerId,
      claimId,
      actorId: userId,
      type: 'claim_created',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: userId,
        redemptionCode,
        quantityRemaining: offer.quantityTotal - offer.quantityClaimed,
      },
    });
    marketplaceLogger.init('Voucher resgatado', { claimId, offerId, user_id: userId });
    return claim;
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
    const claim = this.voucherClaims.get(claimId);
    if (!claim) throw new Error('Claim não encontrado');
    if (claim.status !== 'claimed') {
      throw new Error(`Claim não pode ser resgatado (status: ${claim.status})`);
    }
    if (claim.redemptionCode !== presentedCode.toUpperCase()) {
      throw new Error('Código de resgate inválido');
    }

    const now = new Date();
    const expiresAt = new Date(claim.expiresAt);
    if (now > expiresAt) {
      claim.status = 'expired';
      claim.updatedAt = now.toISOString();
      this.voucherClaims.set(claimId, claim);
      throw new Error('Claim expirado');
    }

    const offer = this.voucherOffers.get(claim.offerId);
    if (!offer) throw new Error('Oferta não encontrada');
    if (claim.storeCheckinRequired && !claim.checkedInAt) {
      throw new Error('Check-in obrigatório antes do resgate');
    }

    claim.status = 'redeemed';
    claim.redeemedAt = now.toISOString();
    claim.updatedAt = now.toISOString();
    this.voucherClaims.set(claimId, claim);

    let orderId: string | undefined;
    let serviceBookingId: string | undefined;

    if (offer.type === 'product' && offer.linkedProductId) {
      const order = this._facade.orders.createOrder(offer.storeId);
      const orderWithItem = await this._facade.orders.addOrderItem(order.orderId, offer.linkedProductId, 1);
      orderId = orderWithItem.orderId;
      claim.linkedOrderId = orderId;
    } else if (offer.type === 'service' && (offer.linkedServiceTemplateId || offer.linkedServiceOfferingId)) {
      const offeringId = offer.linkedServiceOfferingId || '';
      const offering = (this._facade as unknown as { serviceOfferings: Map<string, unknown> }).serviceOfferings.get(offeringId);
      if (!offering) throw new Error('ServiceOffering não encontrado');
      const booking = this._facade.services.createServiceBooking({
        offeringId,
        user_id: claim.claimerUserId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        quantity: 1,
      });
      serviceBookingId = booking.booking_id;
      claim.linkedServiceBookingId = serviceBookingId;
    }
    this.voucherClaims.set(claimId, claim);

    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId,
      actorId: storeOperatorActorId,
      type: 'redeemed',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: claim.claimerUserId,
        redemptionCode: claim.redemptionCode,
      },
    });
    marketplaceLogger.init('Voucher resgatado na loja', { claimId, offerId: claim.offerId, user_id: claim.claimerUserId });

    return { claim, order_id: orderId, service_booking_id: serviceBookingId };
  }

  expireVoucherClaims(): { expired_count: number; expired_claims: string[] } {
    const now = new Date();
    const expiredClaims: string[] = [];
    for (const [claimId, claim] of this.voucherClaims.entries()) {
      if (claim.status === 'claimed') {
        const expiresAt = new Date(claim.expiresAt);
        if (now > expiresAt) {
          claim.status = 'expired';
          claim.updatedAt = now.toISOString();
          this.voucherClaims.set(claimId, claim);
          this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'expired');
          const offer = this.voucherOffers.get(claim.offerId);
          this.recordVoucherEvent({
            offerId: claim.offerId,
            claimId,
            actorId: claim.claimerUserId,
            type: 'claim_expired',
            metadata: {
              offerTitle: offer?.title,
              claimerUserId: claim.claimerUserId,
              reason: 'Prazo de resgate expirado',
            },
          });
          expiredClaims.push(claimId);
        }
      }
    }
    marketplaceLogger.init('Claims expirados processados', { expired_count: expiredClaims.length });
    return { expired_count: expiredClaims.length, expired_claims: expiredClaims };
  }

  activateVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) return null;
    if (offer.status !== 'draft' && offer.status !== 'paused') {
      throw new Error('Oferta só pode ser ativada se estiver em draft ou paused');
    }
    const now = new Date();
    const endAt = new Date(offer.endAt);
    if (now > endAt) {
      offer.status = 'expired';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      return offer;
    }
    offer.status = 'active';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);
    this.recordVoucherEvent({
      offerId,
      actorId: offer.issuerActorId,
      type: 'offer_activated',
      metadata: { offerTitle: offer.title, quantityRemaining: offer.quantityTotal - offer.quantityClaimed },
    });
    marketplaceLogger.init('Oferta de voucher ativada', { offerId, storeId: offer.storeId });
    return offer;
  }

  pauseVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) return null;
    if (offer.status !== 'active') throw new Error('Oferta só pode ser pausada se estiver ativa');
    offer.status = 'paused';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);
    this.recordVoucherEvent({
      offerId,
      actorId: offer.issuerActorId,
      type: 'offer_paused',
      metadata: { offerTitle: offer.title, reason: 'Pausada pela empresa' },
    });
    this.updateVoucherParticipationScore(offer.storeId, 'pause');
    marketplaceLogger.init('Oferta de voucher pausada', { offerId, storeId: offer.storeId });
    return offer;
  }

  getVoucherOffer(offerId: string): VoucherOffer | null {
    return this.voucherOffers.get(offerId) || null;
  }

  listVoucherOffers(filters: {
    city?: string;
    neighborhood?: string;
    scope?: VoucherVisibilityScope;
    type?: VoucherType;
    active_only?: boolean;
    storeId?: string;
  }): VoucherOffer[] {
    let offers = Array.from(this.voucherOffers.values());
    if (filters.active_only) offers = offers.filter(o => o.status === 'active');
    if (filters.type) offers = offers.filter(o => o.type === filters.type);
    if (filters.storeId) offers = offers.filter(o => o.storeId === filters.storeId);
    if (filters.city || filters.neighborhood) {
      const stores = this._facade.catalog.getStores();
      offers = offers.filter(offer => {
        const store = stores.stores.find(s => s.storeId === offer.storeId);
        if (!store) return false;
        if (offer.visibilityScope === 'local_neighborhood') {
          if (filters.neighborhood) return store.branches.some(b => b.location?.neighborhood === filters.neighborhood);
          return false;
        }
        if (offer.visibilityScope === 'city') {
          if (filters.city) return store.branches.some(b => b.location?.city === filters.city);
          return false;
        }
        return true;
      });
    }
    if (filters.scope) offers = offers.filter(o => o.visibilityScope === filters.scope);
    const now = new Date();
    offers = offers.filter(offer => {
      const startAt = new Date(offer.startAt);
      const endAt = new Date(offer.endAt);
      return now >= startAt && now <= endAt;
    });
    offers = offers.filter(offer => offer.quantityClaimed < offer.quantityTotal);
    return offers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getVoucherClaim(claimId: string): VoucherClaim | null {
    return this.voucherClaims.get(claimId) || null;
  }

  markNoShow(claimId: string): VoucherClaim | null {
    const claim = this.voucherClaims.get(claimId);
    if (!claim) return null;
    if (claim.status !== 'claimed') {
      throw new Error('Apenas claims com status "claimed" podem ser marcados como no-show');
    }
    claim.status = 'no_show';
    claim.updatedAt = new Date().toISOString();
    this.voucherClaims.set(claimId, claim);
    this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'no_show');
    const offer = this.voucherOffers.get(claim.offerId);
    if (offer) this.updateVoucherParticipationScore(offer.storeId, 'no_show');
    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId,
      actorId: offer?.issuerActorId || '',
      type: 'no_show_marked',
      metadata: { offerTitle: offer?.title, claimerUserId: claim.claimerUserId, reason: 'No-show marcado pela empresa' },
    });
    marketplaceLogger.init('No-show marcado', { claimId, user_id: claim.claimerUserId });
    return claim;
  }

  getUserVoucherClaims(userId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.claimerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getOfferVoucherClaims(offerId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private updateVoucherParticipationScore(storeId: string, action: 'pause' | 'no_show'): void {
    let score = this.voucherParticipationScores.get(storeId);
    if (!score) {
      score = {
        storeId,
        participation_count: 0,
        cancellationRate: 0,
        no_show_rate: 0,
        last_boost_reset: new Date().toISOString(),
      };
    }
    if (action === 'pause') score.cancellationRate = Math.min(1.0, score.cancellationRate + 0.1);
    else if (action === 'no_show') score.no_show_rate = Math.min(1.0, score.no_show_rate + 0.05);
    this.voucherParticipationScores.set(storeId, score);
  }

  private recordVoucherEvent(event: Omit<VoucherRedemptionEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `voucher-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.voucherRedemptionEvents.set(eventId, {
      eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    });
  }

  private updateUserVoucherAbuseMetrics(userId: string, type: 'expired' | 'no_show'): void {
    let metrics = this.userVoucherAbuseMetrics.get(userId);
    if (!metrics) {
      metrics = {
        user_id: userId,
        expired_claims_count: 0,
        no_show_count: 0,
        last_penalty_reset: new Date().toISOString(),
      };
    }
    if (type === 'expired') metrics.expired_claims_count += 1;
    else if (type === 'no_show') metrics.no_show_count += 1;
    const totalAbuse = metrics.expired_claims_count + metrics.no_show_count;
    if (totalAbuse >= 5) {
      const blockedUntil = new Date();
      blockedUntil.setDate(blockedUntil.getDate() + 30);
      metrics.claim_blocked_until = blockedUntil.toISOString();
    }
    this.userVoucherAbuseMetrics.set(userId, metrics);
  }

  private generateRedemptionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}