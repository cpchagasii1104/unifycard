import type { FastifyRequest, FastifyReply } from 'fastify';
export declare class SafetyController {
    addEmergencyContact(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    listEmergencyContacts(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    shareRide(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    listRideShares(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    openDispute(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    listDisputesForRide(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const safetyController: SafetyController;
//# sourceMappingURL=safety.controller.d.ts.map