interface EmergencyContactRow {
    contact_id: string;
    tenant_id: string;
    user_id: string;
    name: string;
    phone: string;
    created_at: Date;
}
export declare class SafetyService {
    addEmergencyContact(tenantId: string, userId: string, contact: any): Promise<EmergencyContactRow>;
    listEmergencyContacts(tenantId: string, userId: string): Promise<EmergencyContactRow[]>;
    removeEmergencyContact(tenantId: string, contactId: string): Promise<{
        ok: boolean;
    }>;
    triggerSOS(tenantId: string, userId: string, rideId: string): Promise<{
        ok: boolean;
        alertId: string;
    }>;
    shareRide(tenantId: string, rideId: string, userId: string): Promise<{
        share_id: string;
        tenant_id: string;
        ride_id: string;
        user_id: string;
        share_token: string;
        share_url: string;
        expires_at: Date;
        created_at: Date;
    }>;
    openDispute(tenantId: string, rideId: string, userId: string, reason: string, details?: any): Promise<{
        dispute_id: string;
        tenant_id: string;
        ride_id: string;
        opened_by_user_id: string;
        reason: string;
        details: any;
        status: string;
        created_at: Date;
    }>;
    listRideShares(tenantId: string, rideId: string): Promise<{
        share_id: string;
        tenant_id: string;
        ride_id: string;
        user_id: string;
        share_token: string;
        share_url: string;
        expires_at: Date;
        created_at: Date;
    }[]>;
    listRideDisputes(tenantId: string, rideId: string): Promise<{
        dispute_id: string;
        tenant_id: string;
        ride_id: string;
        opened_by_user_id: string;
        reason: string;
        details: any;
        status: string;
        created_at: Date;
        updated_at: Date;
    }[]>;
}
export declare const safetyService: SafetyService;
export {};
//# sourceMappingURL=safety.service.d.ts.map