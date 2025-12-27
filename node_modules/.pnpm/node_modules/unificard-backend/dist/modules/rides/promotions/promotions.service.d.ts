export declare class PromotionsService {
    createPromotion(tenantId: string, data: any): Promise<any>;
    getPromotionByCode(tenantId: string, promoCode: string): Promise<any>;
    validatePromotion(tenantId: string, promoCode: string, rideData: any): Promise<any>;
    applyDiscount(promo: any, price: number): number;
    registerPromotionUse(tenantId: string, promotionId: string, rideId: string): Promise<void>;
    listAvailablePromotions(tenantId: string, cityId: string, serviceTypeId: string): Promise<any[]>;
}
export declare const promotionsService: PromotionsService;
//# sourceMappingURL=promotions.service.d.ts.map