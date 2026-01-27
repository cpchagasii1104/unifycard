// backend/src/core/compatibility/compatibility-engine.routes.ts
// Rotas do Motor de Compatibilidade
// 🔴 BLINDAGEM: Validação antes de booking

import type { FastifyInstance } from 'fastify';
import { compatibilityEngineService } from './compatibility-engine.service';
import type { CompatibilityInput } from './compatibility-engine.types';

const compatibilityRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /compatibility/evaluate
   * Avalia compatibilidade entre evento e setup de serviço
   */
  fastify.post<{ Body: CompatibilityInput }>(
    '/compatibility/evaluate',
    async (req, reply) => {
      const input = req.body;

      // Validação básica
      if (!input.eventCapacity || !input.venueInfrastructure || !input.serviceSetup) {
        return reply.status(400).send({
          error: 'eventCapacity, venueInfrastructure e serviceSetup são obrigatórios',
        });
      }

      try {
        const result = await compatibilityEngineService.evaluateCompatibility(input);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: error.message || 'Erro ao avaliar compatibilidade',
        });
      }
    }
  );
};

export default compatibilityRoutes;




