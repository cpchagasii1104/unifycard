// src/services/location/cep.routes.ts
// FACADE FINA do contrato legado GET /api/location/cep/:cep (consumido pelo frontend vivo).
//
// FASE B (RFC B1-D · D-K): a implementação própria (cep.service legado com fetch direto a
// ViaCEP/BrasilAPI, retry ad-hoc e logging de payload/PII) foi APOSENTADA. Esta rota delega
// INTEGRALMENTE ao resolver postal canônico — sem fetch próprio, sem DB lookup próprio, sem
// cache próprio, sem normalização própria, sem write, sem log de payload. Contrato legado
// brasileiro: o país é EXPLÍCITO no call-site ('BR'), nunca default silencioso no resolver.
// Read-only: NUNCA cria city/state/neighborhood/address/assignment.

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { postalAddressResolverService } from '@core/location/postal-address-resolver.service';

const cepRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/location/cep/:cep — sugestão de endereço por CEP (shape legado preservado).
  fastify.get<{ Params: { cep: string } }>(
    '/cep/:cep',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            cep: {
              type: 'string',
              description: 'CEP no formato 00000000 (apenas números) ou 00000-000',
            },
          },
          required: ['cep'],
        },
      },
    },
    async (req, reply) => {
      const resolution = await postalAddressResolverService.resolve({
        countryCode: 'BR', // contrato legado brasileiro — país explícito no call-site (D-B)
        postalCode: req.params.cep,
      });

      if (resolution.status === 'resolved') {
        return reply.send({
          cep: resolution.postalCodeNormalized,
          logradouro: resolution.street ?? '',
          complemento: '',
          bairro: resolution.neighborhoodDisplayText ?? '',
          localidade: resolution.cityDisplayText ?? '',
          uf: resolution.stateDisplayText ?? '',
        });
      }
      if (resolution.status === 'postal_code_invalid') {
        return reply.status(400).send({ error: 'CEP inválido. Informe 8 dígitos.' });
      }
      if (resolution.status === 'provider_unavailable') {
        return reply.status(503).send({
          error: 'Serviço de CEP temporariamente indisponível. Tente novamente em alguns instantes.',
        });
      }
      // not_found / cidade fora do catálogo canônico / conflito / malformado → contrato legado 404
      // (o frontend cai no preenchimento manual + picker governado de cidade). Nenhum detalhe de
      // payload externo é ecoado.
      return reply.status(404).send({
        error: 'CEP não encontrado. Verifique se o CEP está correto.',
      });
    }
  );
};

export default cepRoutes;
