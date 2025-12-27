import type { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Controller de demanda do módulo Rides.
 *
 * Usa o serviço `demandService.calculateZonePressure` para calcular
 * a pressão de demanda de uma zona específica.
 */
export declare class DemandController {
    recalculateZonePressure(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const demandController: DemandController;
//# sourceMappingURL=demand.controller.d.ts.map