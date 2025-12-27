import type { FastifyReply, FastifyRequest } from 'fastify';
export declare class AvailabilityController {
    setOnline(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    setOffline(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    setDestinationMode(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    disableDestinationMode(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    getAvailability(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const availabilityController: AvailabilityController;
//# sourceMappingURL=availability.controller.d.ts.map