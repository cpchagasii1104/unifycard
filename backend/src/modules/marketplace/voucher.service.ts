// backend/src/modules/marketplace/voucher.service.ts
// Módulo isolado de Vouchers
// Extraído de marketplace.service.ts para reduzir acoplamento

import { marketplaceLogger } from './marketplace.logger';
import type {
  VoucherOffer,
  VoucherType,
  VoucherVisibilityScope,
  VoucherClaim,
  VoucherRedemptionEvent,
  ServiceOffering,
  ServiceBooking,
  Order,
  EconomicIdentity,
} from '@contracts/marketplace';

type StoresData = {
  stores: Array<{
    store_id: string;
    branches: Array<{
      location?: {
        city?: string;
        neighborhood?: string;
      };
    }>;
  }>;
};

export class VoucherService {
  constructor(
    private voucherOffers: Map<string, VoucherOffer>,
    private voucherClaims: Map<string, VoucherClaim>,
    private voucherRedemptionEvents: Map<string, VoucherRedemptionEvent>,
    private voucherParticipationScores: Map<string, {
      storeId: string;
      participationCount: number;
      cancellationRate: number;
      noShowRate: number;
      lastBoostReset: string;
    }>,
    private userVoucherAbuseMetrics: Map<string, {
      userId: string;
      expiredClaimsCount: number;
      noShowCount: number;
      lastPenaltyReset: string;
      claimBlockedUntil?: string;
    }>,
    // Dependências externas
    private getStores: () => StoresData,
    private getEconomicIdentity: (userId: string) => EconomicIdentity | null,
    private serviceOfferings: Map<string, ServiceOffering>,
    private createOrder: (storeId: string) => { order_id: string },
    private addOrderItem: (orderId: string, productId: string, quantity: number) => { order_id: string },
    private createServiceBooking: (params: {
      offeringId: string;
      userId: string;
      date: string;
      time: string;
      quantity: number;
    }) => ServiceBooking
  ) {}

  /**
   * Criar oferta de voucher
   */
  createVoucherOffer(
    issuerActorId: string,
    storeId: string,
    offer: Omit<VoucherOffer, 'offerId' | 'issuerActorId' | 'storeId' | 'quantityClaimed' | 'status' | 'createdAt' | 'updatedAt'>
  ): VoucherOffer {
    // Validações obrigatórias
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
      // Verificar se store tem location definida
      const stores = this.getStores();
      const store = stores.stores.find(s => s.store_id === storeId);
      if (!store) {
        throw new Error('Loja não encontrada');
      }
      const hasLocation = store.branches.some(b => b.location?.city);
      if (!hasLocation) {
        throw new Error('Escopo local exige store_id com neighborhood/city definida');
      }
    }

    const offerId = `voucher-offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const voucherOffer: VoucherOffer = {
      offerId: offerId,
      issuerActorId: issuerActorId,
      storeId: storeId,
      ...offer,
      quantityClaimed: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      immutable: false,
    };

    this.voucherOffers.set(offerId, voucherOffer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: issuerActorId,
      type: 'offer_created',
      metadata: {
        offerTitle: offer.title,
      },
    });

    marketplaceLogger.init('Oferta de voucher criada', {
      offerId: offerId,
      storeId: storeId,
      type: offer.type,
    });

    return voucherOffer;
  }

  /**
   * Ativar oferta de voucher
   */
  activateVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      return null;
    }

    if (offer.status !== 'draft' && offer.status !== 'paused') {
      throw new Error('Oferta só pode ser ativada se estiver em draft ou paused');
    }

    // Verificar se ainda está dentro da janela
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

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: offer.issuerActorId,
      type: 'offer_activated',
      metadata: {
        offerTitle: offer.title,
        quantityRemaining: offer.quantityTotal - offer.quantityClaimed,
      },
    });

    marketplaceLogger.init('Oferta de voucher ativada', {
      offerId: offerId,
      storeId: offer.storeId,
    });

    return offer;
  }

  /**
   * Pausar oferta de voucher
   */
  pauseVoucherOffer(offerId: string): VoucherOffer | null {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      return null;
    }

    if (offer.status !== 'active') {
      throw new Error('Oferta só pode ser pausada se estiver ativa');
    }

    offer.status = 'paused';
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      actorId: offer.issuerActorId,
      type: 'offer_paused',
      metadata: {
        offerTitle: offer.title,
        reason: 'Pausada pela empresa',
      },
    });

    // Atualizar métricas de participação (cancelamento alto reduz boost)
    this.updateVoucherParticipationScore(offer.storeId, 'pause');

    marketplaceLogger.init('Oferta de voucher pausada', {
      offerId: offerId,
      storeId: offer.storeId,
    });

    return offer;
  }

  /**
   * Buscar oferta de voucher
   */
  getVoucherOffer(offerId: string): VoucherOffer | null {
    return this.voucherOffers.get(offerId) || null;
  }

  /**
   * Listar ofertas de voucher (com filtros)
   */
  listVoucherOffers(filters: {
    city?: string;
    neighborhood?: string;
    scope?: VoucherVisibilityScope;
    type?: VoucherType;
    active_only?: boolean;
    store_id?: string;
  }): VoucherOffer[] {
    let offers = Array.from(this.voucherOffers.values());

    // Filtrar por status
    if (filters.active_only) {
      offers = offers.filter(o => o.status === 'active');
    }

    // Filtrar por tipo
    if (filters.type) {
      offers = offers.filter(o => o.type === filters.type);
    }

    // Filtrar por loja
    if (filters.store_id) {
      offers = offers.filter(o => o.storeId === filters.store_id);
    }

    // Filtrar por escopo e localização
    if (filters.city || filters.neighborhood) {
      const stores = this.getStores();
      offers = offers.filter(offer => {
        const store = stores.stores.find(s => s.store_id === offer.storeId);
        if (!store) return false;

        // Verificar escopo
        if (offer.visibilityScope === 'local_neighborhood') {
          if (filters.neighborhood) {
            return store.branches.some(b => b.location?.neighborhood === filters.neighborhood);
          }
          return false; // Escopo neighborhood requer neighborhood no filtro
        }

        if (offer.visibilityScope === 'city') {
          if (filters.city) {
            return store.branches.some(b => b.location?.city === filters.city);
          }
          return false; // Escopo city requer city no filtro
        }

        return true; // restricted_group não filtra por localização
      });
    }

    // Filtrar por escopo
    if (filters.scope) {
      offers = offers.filter(o => o.visibilityScope === filters.scope);
    }

    // Verificar se ainda está dentro da janela
    const now = new Date();
    offers = offers.filter(offer => {
      const startAt = new Date(offer.startAt);
      const endAt = new Date(offer.endAt);
      return now >= startAt && now <= endAt;
    });

    // Verificar se não está esgotada
    offers = offers.filter(offer => {
      return offer.quantityClaimed < offer.quantityTotal;
    });

    return offers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Resgatar voucher (claim)
   */
  claimVoucherOffer(offerId: string, userId: string, audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }): VoucherClaim {
    const offer = this.voucherOffers.get(offerId);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    // Verificar se oferta está ativa
    if (offer.status !== 'active') {
      throw new Error('Oferta não está ativa');
    }

    // Verificar se ainda está dentro da janela
    const now = new Date();
    const startAt = new Date(offer.startAt);
    const endAt = new Date(offer.endAt);
    if (now < startAt || now > endAt) {
      throw new Error('Oferta fora da janela de resgate');
    }

    // Verificar se ainda há quantidade disponível
    if (offer.quantityClaimed >= offer.quantityTotal) {
      offer.status = 'depleted';
      offer.updatedAt = new Date().toISOString();
      this.voucherOffers.set(offerId, offer);
      throw new Error('Oferta esgotada');
    }

    // Verificar quantidade por usuário
    const userClaims = Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (userClaims.length >= offer.quantityPerUser) {
      throw new Error(`Limite de ${offer.quantityPerUser} resgate(s) por usuário atingido`);
    }

    // Verificar elegibilidade
    const identity = this.getEconomicIdentity(userId);
    if (offer.eligibility.minTrustLevel) {
      const trustLevels: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
      const requiredLevel = trustLevels[offer.eligibility.minTrustLevel] || 0;
      const userLevel = identity ? trustLevels[identity.trustLevel] || 0 : 0;
      if (userLevel < requiredLevel) {
        throw new Error(`Trust level mínimo requerido: ${offer.eligibility.minTrustLevel}`);
      }
    }

    // Verificar se usuário está bloqueado
    const abuseMetrics = this.userVoucherAbuseMetrics.get(userId);
    if (abuseMetrics?.claimBlockedUntil) {
      const blockedUntil = new Date(abuseMetrics.claimBlockedUntil);
      if (now < blockedUntil) {
        throw new Error(`Usuário bloqueado de resgatar vouchers até ${blockedUntil.toISOString()}`);
      }
    }

    // Lock determinístico: verificar se já existe claim ativo para este usuário nesta oferta
    const existingClaim = Array.from(this.voucherClaims.values())
      .find(c => c.offerId === offerId && c.claimerUserId === userId && c.status === 'claimed');
    if (existingClaim) {
      throw new Error('Usuário já possui um resgate ativo para esta oferta');
    }

    // Gerar código de resgate único
    const redemptionCode = this.generateRedemptionCode();

    // Calcular expiresAt
    const redemptionDeadline = offer.redemptionDeadlineAt
      ? new Date(offer.redemptionDeadlineAt)
      : new Date(endAt.getTime() + 7 * 24 * 60 * 60 * 1000); // Padrão: 7 dias após endAt

    const claimId = `voucher-claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const claim: VoucherClaim = {
      claimId: claimId,
      offerId: offerId,
      claimerUserId: userId,
      status: 'claimed',
      claimedAt: now.toISOString(),
      redemptionCode: redemptionCode,
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

    // Atualizar quantidade resgatada
    offer.quantityClaimed += 1;
    if (offer.quantityClaimed >= offer.quantityTotal) {
      offer.status = 'depleted';
    }
    offer.updatedAt = new Date().toISOString();
    this.voucherOffers.set(offerId, offer);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: offerId,
      claimId: claimId,
      actorId: userId,
      type: 'claim_created',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: userId,
        redemptionCode: redemptionCode,
        quantityRemaining: offer.quantityTotal - offer.quantityClaimed,
      },
    });

    marketplaceLogger.init('Voucher resgatado', {
      claimId: claimId,
      offerId: offerId,
      userId: userId,
    });

    return claim;
  }

  /**
   * Gerar código de resgate único
   */
  private generateRedemptionCode(): string {
    // Código curto, não adivinhável (ex: "ABC123")
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removido I, O, 0, 1 para evitar confusão
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Buscar claim de voucher
   */
  getVoucherClaim(claimId: string): VoucherClaim | null {
    return this.voucherClaims.get(claimId) || null;
  }

  /**
   * Validar e resgatar voucher (redeem)
   */
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
    if (!claim) {
      throw new Error('Claim não encontrado');
    }

    if (claim.status !== 'claimed') {
      throw new Error(`Claim não pode ser resgatado (status: ${claim.status})`);
    }

    // Verificar código
    if (claim.redemptionCode !== presentedCode.toUpperCase()) {
      throw new Error('Código de resgate inválido');
    }

    // Verificar se não expirou
    const now = new Date();
    const expiresAt = new Date(claim.expiresAt);
    if (now > expiresAt) {
      claim.status = 'expired';
      claim.updatedAt = now.toISOString();
      this.voucherClaims.set(claimId, claim);
      throw new Error('Claim expirado');
    }

    const offer = this.voucherOffers.get(claim.offerId);
    if (!offer) {
      throw new Error('Oferta não encontrada');
    }

    // Verificar check-in (se exigido)
    if (claim.storeCheckinRequired && !claim.checkedInAt) {
      throw new Error('Check-in obrigatório antes do resgate');
    }

    // Resgatar voucher
    claim.status = 'redeemed';
    claim.redeemedAt = now.toISOString();
    claim.updatedAt = now.toISOString();
    this.voucherClaims.set(claimId, claim);

    let orderId: string | undefined;
    let serviceBookingId: string | undefined;

    // Criar Order ou ServiceBooking baseado no tipo
    if (offer.type === 'product' && offer.linkedProductId) {
      // Criar Order com desconto total ou parcial
      const order = this.createOrder(offer.storeId);
      
      // Adicionar produto ao pedido
      const orderWithItem = this.addOrderItem(order.order_id, offer.linkedProductId, 1);

      // Aplicar desconto (se houver)
      if (offer.discountValue) {
        // TODO: Aplicar desconto no Order (por enquanto, criar com valor 0)
        // O desconto pode ser aplicado no PaymentPlan posteriormente
      }

      orderId = orderWithItem.order_id;
      claim.linkedOrderId = orderId;
    } else if (offer.type === 'service' && (offer.linkedServiceTemplateId || offer.linkedServiceOfferingId)) {
      // Criar ServiceBooking
      const offeringId = offer.linkedServiceOfferingId || '';
      const offering = this.serviceOfferings.get(offeringId);
      if (!offering) {
        throw new Error('ServiceOffering não encontrado');
      }

      const booking = this.createServiceBooking({
        offeringId: offeringId,
        userId: claim.claimerUserId,
        date: new Date().toISOString().split('T')[0], // Hoje
        time: new Date().toTimeString().split(' ')[0].substring(0, 5), // Agora
        quantity: 1,
      });

      serviceBookingId = booking.bookingId;
      claim.linkedServiceBookingId = serviceBookingId;
    }

    this.voucherClaims.set(claimId, claim);

    // Registrar evento
    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId: claimId,
      actorId: storeOperatorActorId,
      type: 'redeemed',
      metadata: {
        offerTitle: offer.title,
        claimerUserId: claim.claimerUserId,
        redemptionCode: claim.redemptionCode,
      },
    });

    marketplaceLogger.init('Voucher resgatado na loja', {
      claimId: claimId,
      offerId: claim.offerId,
      userId: claim.claimerUserId,
    });

    return {
      claim,
      order_id: orderId,
      service_booking_id: serviceBookingId,
    };
  }

  /**
   * Marcar no-show
   */
  markNoShow(claimId: string): VoucherClaim | null {
    const claim = this.voucherClaims.get(claimId);
    if (!claim) {
      return null;
    }

    if (claim.status !== 'claimed') {
      throw new Error('Apenas claims com status "claimed" podem ser marcados como no-show');
    }

    claim.status = 'no_show';
    claim.updatedAt = new Date().toISOString();
    this.voucherClaims.set(claimId, claim);

    // Atualizar métricas de abuso do usuário
    this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'no_show');

    // Atualizar métricas de participação da empresa
    const offer = this.voucherOffers.get(claim.offerId);
    if (offer) {
      this.updateVoucherParticipationScore(offer.storeId, 'no_show');
    }

    // Registrar evento
    this.recordVoucherEvent({
      offerId: claim.offerId,
      claimId: claimId,
      actorId: offer?.issuerActorId || '',
      type: 'no_show_marked',
      metadata: {
        offerTitle: offer?.title,
        claimerUserId: claim.claimerUserId,
        reason: 'No-show marcado pela empresa',
      },
    });

    marketplaceLogger.init('No-show marcado', {
      claimId: claimId,
      userId: claim.claimerUserId,
    });

    return claim;
  }

  /**
   * Expirar claims expirados (job manual)
   */
  expireVoucherClaims(): {
    expired_count: number;
    expired_claims: string[];
  } {
    const now = new Date();
    const expiredClaims: string[] = [];

    for (const [claimId, claim] of this.voucherClaims.entries()) {
      if (claim.status === 'claimed') {
        const expiresAt = new Date(claim.expiresAt);
        if (now > expiresAt) {
          claim.status = 'expired';
          claim.updatedAt = now.toISOString();
          this.voucherClaims.set(claimId, claim);

          // Atualizar métricas de abuso
          this.updateUserVoucherAbuseMetrics(claim.claimerUserId, 'expired');

          // Registrar evento
          const offer = this.voucherOffers.get(claim.offerId);
          this.recordVoucherEvent({
            offerId: claim.offerId,
            claimId: claimId,
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

    marketplaceLogger.init('Claims expirados processados', {
      expired_count: expiredClaims.length,
    });

    return {
      expired_count: expiredClaims.length,
      expired_claims: expiredClaims,
    };
  }

  /**
   * Registrar evento de voucher
   */
  private recordVoucherEvent(event: Omit<VoucherRedemptionEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `voucher-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const voucherEvent: VoucherRedemptionEvent = {
      eventId: eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.voucherRedemptionEvents.set(eventId, voucherEvent);
  }

  /**
   * Atualizar métricas de abuso do usuário
   */
  private updateUserVoucherAbuseMetrics(userId: string, type: 'expired' | 'no_show'): void {
    let metrics = this.userVoucherAbuseMetrics.get(userId);
    if (!metrics) {
      metrics = {
        userId: userId,
        expiredClaimsCount: 0,
        noShowCount: 0,
        lastPenaltyReset: new Date().toISOString(),
      };
    }

    if (type === 'expired') {
      metrics.expiredClaimsCount += 1;
    } else if (type === 'no_show') {
      metrics.noShowCount += 1;
    }

    // Bloquear usuário se reincidente (determinístico)
    const totalAbuse = metrics.expiredClaimsCount + metrics.noShowCount;
    if (totalAbuse >= 5) {
      // Bloquear por 30 dias
      const blockedUntil = new Date();
      blockedUntil.setDate(blockedUntil.getDate() + 30);
      metrics.claimBlockedUntil = blockedUntil.toISOString();
    }

    this.userVoucherAbuseMetrics.set(userId, metrics);
  }

  /**
   * Atualizar score de participação em vouchers (para boost local)
   */
  private updateVoucherParticipationScore(storeId: string, action: 'pause' | 'no_show'): void {
    let score = this.voucherParticipationScores.get(storeId);
    if (!score) {
      score = {
        storeId: storeId,
        participationCount: 0,
        cancellationRate: 0,
        noShowRate: 0,
        lastBoostReset: new Date().toISOString(),
      };
    }

    if (action === 'pause') {
      // Aumentar taxa de cancelamento
      score.cancellationRate = Math.min(1.0, score.cancellationRate + 0.1);
    } else if (action === 'no_show') {
      // Aumentar taxa de no-show
      score.noShowRate = Math.min(1.0, score.noShowRate + 0.05);
    }

    this.voucherParticipationScores.set(storeId, score);
  }

  /**
   * Buscar claims de um usuário
   */
  getUserVoucherClaims(userId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.claimerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar claims de uma oferta
   */
  getOfferVoucherClaims(offerId: string): VoucherClaim[] {
    return Array.from(this.voucherClaims.values())
      .filter(c => c.offerId === offerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}