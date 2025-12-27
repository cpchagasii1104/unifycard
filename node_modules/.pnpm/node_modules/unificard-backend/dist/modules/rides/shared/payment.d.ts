export interface ProcessRidePaymentInput {
    tenantId: string;
    rideId: string;
    passengerId: string;
    driverId: string;
    totalAmount: number;
    platformFeePercent: number;
    communityFeePercent: number;
    driverIncentives: number;
    tipAmount: number;
}
export declare function processRidePayment(input: ProcessRidePaymentInput): Promise<{
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
//# sourceMappingURL=payment.d.ts.map