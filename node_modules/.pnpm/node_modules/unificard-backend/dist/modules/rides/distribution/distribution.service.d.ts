export declare class DistributionService {
    processRidePayment(tenantId: string, ride: any, price: any): Promise<{
        ok: boolean;
        driverAmount: number;
        platformAmount: number;
        regionAmount: number;
        groupAmount: number;
        splits: {
            rule: import("../../../core/economy/split.types").SplitRule;
            amount: number;
            transactionId?: string;
        }[];
    }>;
    getDistributionRule(tenantId: string, serviceTypeId: string): Promise<any>;
    applyDistribution(total: number, rule: any): {
        driverAmount: number;
        platformAmount: number;
        communityAmount: number;
    };
    recordDistribution(tenantId: string, rideId: string, price: any, driverAmount: number, platformAmount: number, communityAmount: number): Promise<void>;
    transferFunds(tenantId: string, passengerAccount: any, driverAccount: any, platformAccount: any, communityFundAccount: any, driverAmount: number, platformAmount: number, communityAmount: number, rideId: string): Promise<void>;
    getByRideId(tenantId: string, rideId: string): Promise<any>;
    applyDistributionToRide(tenantId: string, rideId: string, options?: any): Promise<{
        ok: boolean;
        driverAmount: number;
        platformAmount: number;
        regionAmount: number;
        groupAmount: number;
        splits: {
            rule: import("../../../core/economy/split.types").SplitRule;
            amount: number;
            transactionId?: string;
        }[];
    }>;
}
export declare const distributionService: DistributionService;
//# sourceMappingURL=distribution.service.d.ts.map