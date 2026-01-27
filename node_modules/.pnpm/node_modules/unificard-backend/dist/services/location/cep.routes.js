"use strict";
// src/services/location/cep.routes.ts
// Rotas para busca de CEP
Object.defineProperty(exports, "__esModule", { value: true });
const cep_service_1 = require("./cep.service");
const cepRoutes = async (fastify) => {
    // GET /api/location/cep/:cep
    // Busca endereço por CEP
    fastify.get('/cep/:cep', {
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
            response: {
                200: {
                    type: 'object',
                    properties: {
                        cep: { type: 'string' },
                        logradouro: { type: 'string' },
                        complemento: { type: 'string' },
                        bairro: { type: 'string' },
                        localidade: { type: 'string' },
                        uf: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
                500: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (req, reply) => {
        const { cep } = req.params;
        try {
            const cepData = await cep_service_1.cepService.fetchCEP(cep);
            if (!cepData) {
                return reply.status(404).send({
                    error: 'CEP não encontrado. Verifique se o CEP está correto.',
                });
            }
            return reply.send(cepData);
        }
        catch (error) {
            console.error('[CEP Routes] Erro ao buscar CEP:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar CEP';
            // Se for timeout ou erro de rede, retornar 503 (Service Unavailable)
            if (errorMessage.includes('Timeout') || errorMessage.includes('conexão')) {
                return reply.status(503).send({
                    error: errorMessage,
                });
            }
            return reply.status(500).send({
                error: errorMessage,
            });
        }
    });
};
exports.default = cepRoutes;
