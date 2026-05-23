// backend/src/modules/rides/distribution/distribution.controller.ts
//
/**
 * ⚠️ PROJEÇÃO FINANCEIRA — NÃO É SSOT (`rides_ride_distributions`)
 * Estes dados NÃO representam dinheiro real.
 * A verdade financeira está em:
 * - bank_ledger
 * - bank_transactions
 *
 * NÃO usar para:
 * - saldo
 * - reconciliação
 * - decisão financeira
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { distributionService } from './distribution.service';

/**
 * Controller de distribuição financeira do módulo Rides.
 *
 * Este controller é um ponto de entrada HTTP para visualizar/aplicar
 * distribuição de valores de uma corrida.
 *
 * Respostas HTTP: dados derivados — NÃO prova financeira canónica (usar Bank para valores oficiais).
 */
export class DistributionController {
  async getRideDistribution(req: FastifyRequest, reply: FastifyReply) {
    const { rideId } = req.params as any;
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant not found' });
    }

    const distribution = await distributionService.getByRideId(tenantId, String(rideId));

    // ⚠️ Este endpoint retorna distribuição derivada
    // NÃO é prova financeira canónica
    return reply.send({
      success: true,
      data: distribution,
    });
  }

  async applyDistribution(req: FastifyRequest, reply: FastifyReply) {
    const { rideId } = req.params as any;
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant not found' });
    }
    const body = req.body as any;

    const distribution = await distributionService.applyDistributionToRide(tenantId, String(rideId), body);

    // ⚠️ Este endpoint retorna distribuição derivada
    // NÃO é prova financeira canónica
    return reply.send({
      success: true,
      data: distribution,
    });
  }
}

export const distributionController = new DistributionController();
