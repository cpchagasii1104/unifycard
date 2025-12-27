export declare class ReferralsService {
    generateDriverReferralCode(tenantId: string, driverId: string): Promise<string>;
    applyReferralCode(tenantId: string, userId: string, promoCode: string): Promise<{
        ok: boolean;
        referrerDriverId: string;
    }>;
    registerRideReferralBonus(tenantId: string, rideId: string, passengerId: string, totalAmount: number): Promise<{
        referrerDriverId: string;
        reward: number;
    } | null>;
    listDriverReferralEarnings(tenantId: string, driverId: string): Promise<any[]>;
    getDriverReferralSummary(tenantId: string, driverId: string): Promise<{
        total_earnings: string;
        total_rides: string;
    } | undefined>;
}
export declare const referralsService: ReferralsService;
//# sourceMappingURL=referrals.service.d.ts.map