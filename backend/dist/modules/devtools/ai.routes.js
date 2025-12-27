"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const runAISchema = zod_1.z.object({
    prompt: zod_1.z.string().min(1, 'Prompt é obrigatório'),
    payload: zod_1.z.any().optional(),
});
const aiRoutes = async (fastify) => {
    /**
     * POST /dev/ai/run
     * Executa um prompt através do AI Kernel
     */
    fastify.post('/run', {
        schema: {
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string' },
                    payload: {},
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        output: { type: 'string' },
                        reasoning: { type: 'array', items: { type: 'string' } },
                        contextUsed: { type: 'object' },
                    },
                },
            },
        },
    }, async (req, reply) => {
        try {
            // Validar body
            const validated = runAISchema.parse(req.body);
            const { prompt, payload } = validated;
            // Obter tenantId se disponível
            const tenantId = req.tenant?.id;
            // Executar através do AI Kernel
            const result = await fastify.ai.run(prompt, payload, tenantId);
            if (!result.success) {
                return reply.status(500).send({
                    error: result.error || 'Erro ao executar prompt',
                    output: '',
                    reasoning: [],
                    contextUsed: null,
                });
            }
            // Formatar resposta
            return reply.send({
                output: result.result || '',
                reasoning: result.thought?.reasoning || [],
                contextUsed: result.thought?.context || null,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao processar rota AI');
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    error: 'Validação falhou',
                    details: error.errors,
                    output: '',
                    reasoning: [],
                    contextUsed: null,
                });
            }
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                output: '',
                reasoning: [],
                contextUsed: null,
            });
        }
    });
};
exports.default = aiRoutes;
//# sourceMappingURL=ai.routes.js.map