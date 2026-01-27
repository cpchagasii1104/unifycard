// backend/src/modules/marketplace/fiscal-kyc.routes.ts
// SPRINT 84: KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS

import type { FastifyInstance } from 'fastify';
import { fiscalKycService } from './fiscal-kyc.service';
import type { ValidateFiscalKycInput } from './fiscal-kyc.service';

const fiscalKycRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /fiscal/kyc/check
   * Pré-check de KYC para emissão fiscal (read-only)
   */
  fastify.post<{ Body: ValidateFiscalKycInput }>('/fiscal/kyc/check', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const result = await fiscalKycService.validateFiscalKyc(tenantId, req.body);

    return reply.send(result);
  });
};

export default fiscalKycRoutes;





