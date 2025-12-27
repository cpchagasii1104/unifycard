import type { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Controller de distribuição financeira do módulo Rides.
 *
 * Este controller é um ponto de entrada HTTP para visualizar/aplicar
 * distribuição de valores de uma corrida.
 */
export declare class DistributionController {
    getRideDistribution(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    applyDistribution(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const distributionController: DistributionController;
//# sourceMappingURL=distribution.controller.d.ts.map