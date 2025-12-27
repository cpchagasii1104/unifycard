"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const categories_service_1 = require("./categories.service");
const categories_schemas_1 = require("./categories.schemas");
const categoriesRoutes = async (fastify) => {
    /**
     * POST /categories/create-root
     * Cria uma categoria raiz
     * GOVERNANÇA: Requer role 'admin' OU cria como 'pending'
     */
    fastify.post('/create-root', {
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    allowActive: { type: 'boolean' },
                },
            },
        },
        preHandler: async (req, reply) => {
            // GOVERNANÇA: Se allowActive=true, exigir admin
            if (req.body.allowActive && req.tenant && req.user) {
                await fastify.requireRole(['admin'])(req, reply);
            }
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const validated = categories_schemas_1.createCategorySchema.parse(req.body);
            const category = await categories_service_1.categoriesService.createCategory({
                ...validated,
                parentId: null,
                allowActive: validated.allowActive || false,
                createdBy: {
                    userId: req.user.globalUserId,
                    tenantId: req.tenant.id,
                    source: 'manual',
                },
            }, {
                tenantId: req.tenant.id,
                userId: req.user.id,
                validateAdmin: validated.allowActive || false,
                context: 'professional', // Assumir professional para criação manual de raiz
                skipGate: false, // Admin ainda precisa passar pelo gate
            });
            return reply.status(201).send({ ok: true, data: category });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao criar categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/create-child
     * Cria uma subcategoria
     * GOVERNANÇA: Requer role 'admin' OU cria como 'pending'
     */
    fastify.post('/create-child', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'parentId'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    parentId: { type: 'string' },
                    allowActive: { type: 'boolean' },
                },
            },
        },
        preHandler: async (req, reply) => {
            // GOVERNANÇA: Se allowActive=true, exigir admin
            if (req.body.allowActive && req.tenant && req.user) {
                await fastify.requireRole(['admin'])(req, reply);
            }
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const validated = categories_schemas_1.createCategorySchema.parse(req.body);
            const category = await categories_service_1.categoriesService.createCategory({
                ...validated,
                allowActive: req.body.allowActive || false,
                createdBy: {
                    userId: req.user.globalUserId,
                    tenantId: req.tenant.id,
                    source: 'manual',
                },
            }, {
                tenantId: req.tenant.id,
                userId: req.user.id,
                validateAdmin: req.body.allowActive || false,
                context: 'professional', // Assumir professional para criação manual
                skipGate: false, // Admin ainda precisa passar pelo gate
            });
            return reply.status(201).send({ ok: true, data: category });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao criar subcategoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /categories/tree?countryCode=
     * Retorna árvore completa de categorias (opcionalmente filtrada por país)
     */
    fastify.get('/tree', async (req, reply) => {
        try {
            const countryCode = req.query.countryCode || undefined;
            const tree = await categories_service_1.categoriesService.getCategoryTree(countryCode);
            return reply.send({ ok: true, data: tree || [] });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar árvore de categorias');
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Se a mensagem já contém "Erro ao buscar árvore de categorias", usar ela diretamente
            const finalMessage = errorMessage.includes('Erro ao buscar árvore de categorias')
                ? errorMessage
                : `Erro ao buscar árvore de categorias: ${errorMessage}`;
            return reply.status(500).send({
                ok: false,
                message: finalMessage,
                error: errorMessage
            });
        }
    });
    /**
     * GET /categories/autocomplete?q=&context=&countryCode=
     * Autocomplete inteligente: busca apenas categorias leaf ACTIVE
     * Retorna resultados formatados com path completo para exibição
     */
    fastify.get('/autocomplete', {
        schema: {
            querystring: {
                type: 'object',
                required: ['q'],
                properties: {
                    q: { type: 'string', minLength: 1 },
                    context: {
                        type: 'string',
                        enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES
                    },
                    countryCode: { type: ['string', 'null'] },
                    limit: { type: 'number', minimum: 1, maximum: 50 },
                },
            },
        },
    }, async (req, reply) => {
        try {
            // DIAGNÓSTICO: Log completo para identificar problema
            const tenantHeader = req.headers['x-tenant-id'];
            const authHeader = req.headers['authorization'];
            fastify.log.info({
                route: '/categories/autocomplete',
                tenant: tenantHeader || 'MISSING',
                tenantPresent: !!tenantHeader,
                hasAuth: !!authHeader,
                query: req.query.q,
                context: req.query.context
            }, 'AUTOCOMPLETE REQUEST RECEIVED');
            // VALIDAÇÃO: Se está em protectedScope, tenant é obrigatório
            // (O tenantPlugin já valida isso, mas manter para consistência)
            if (!req.tenant) {
                return reply.status(400).send({
                    ok: false,
                    code: 'MISSING_TENANT',
                    message: 'Tenant ID é obrigatório'
                });
            }
            let countryCode = req.query.countryCode || undefined;
            // Se não fornecido e usuário autenticado, buscar da residência (opcional)
            if (!countryCode && req.user?.globalUserId) {
                try {
                    const { residenceService } = await Promise.resolve().then(() => __importStar(require('../residence/residence.service')));
                    const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
                    if (residence?.country?.code) {
                        countryCode = residence.country.code;
                    }
                }
                catch (error) {
                    // Falha ao buscar residência não pode quebrar autocomplete
                    fastify.log.debug({ err: error }, 'Não foi possível buscar residência para countryCode; usando categorias globais');
                }
            }
            const results = await categories_service_1.categoriesService.autocompleteCategories(req.query.q, req.query.context, countryCode, req.query.limit || 20);
            // DIAGNÓSTICO: Log resultado
            fastify.log.info({
                query: req.query.q,
                resultsCount: results.length,
                firstResult: results[0]?.name
            }, 'AUTOCOMPLETE SUCCESS');
            return reply.send({ ok: true, data: results });
        }
        catch (error) {
            // DIAGNÓSTICO: Log erro completo
            fastify.log.error({
                err: error,
                query: req.query.q,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined
            }, 'AUTOCOMPLETE ERROR');
            return reply.status(500).send({
                ok: false,
                code: 'INTERNAL_ERROR',
                message: 'Erro ao buscar autocomplete de categorias',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /categories/search?term=&countryCode=
     * Busca categorias por termo (opcionalmente filtrada por país)
     * Se countryCode não for fornecido e o usuário estiver autenticado, usa o país da residência
     */
    fastify.get('/search', {
        schema: {
            querystring: {
                type: 'object',
                required: ['term'],
                properties: {
                    term: { type: 'string' },
                    limit: { type: 'number' },
                    countryCode: { type: ['string', 'null'] },
                },
            },
        },
    }, async (req, reply) => {
        try {
            let countryCode = req.query.countryCode || undefined;
            // Se não fornecido e usuário autenticado, buscar da residência (opcional)
            if (!countryCode && req.user?.globalUserId) {
                try {
                    const { residenceService } = await Promise.resolve().then(() => __importStar(require('../residence/residence.service')));
                    const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
                    if (residence?.country?.code) {
                        countryCode = residence.country.code;
                    }
                }
                catch (error) {
                    // Falha ao buscar residência não pode quebrar a busca
                    fastify.log.debug({ err: error }, 'Não foi possível buscar residência para countryCode; usando categorias globais');
                }
            }
            const categories = await categories_service_1.categoriesService.searchCategories(req.query.term, req.query.limit, countryCode);
            return reply.send({ ok: true, data: { categories, total: categories.length } });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar categorias');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar categorias',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /categories/:categoryId
     * Busca categoria por ID
     */
    fastify.get('/:categoryId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const category = await categories_service_1.categoriesService.getCategoryById(req.params.categoryId);
            if (!category) {
                return reply.status(404).send({ ok: false, message: 'Categoria não encontrada' });
            }
            return reply.send({ ok: true, data: category });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar categoria');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /categories/:categoryId/children
     * Busca filhos de uma categoria
     */
    fastify.get('/:categoryId/children', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const children = await categories_service_1.categoriesService.getChildren(req.params.categoryId);
            return reply.send({ ok: true, data: { children, total: children.length } });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar filhos da categoria');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar filhos da categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/assign-company
     * Associa categoria a uma empresa
     */
    fastify.post('/assign-company', {
        schema: {
            body: {
                type: 'object',
                required: ['companyId', 'categoryId'],
                properties: {
                    companyId: { type: 'string' },
                    categoryId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = categories_schemas_1.assignCategoryToCompanySchema.parse(req.body);
            await categories_service_1.categoriesService.assignCategoryToCompany(req.tenant.id, validated);
            return reply.status(200).send({ success: true, message: 'Categoria associada à empresa' });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao associar categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/assign-skill
     * Associa skill/categoria a um usuário
     */
    fastify.post('/assign-skill', {
        schema: {
            body: {
                type: 'object',
                required: ['categoryId'],
                properties: {
                    categoryId: { type: 'string' },
                    skillLevel: { type: 'number' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        try {
            const validated = categories_schemas_1.assignSkillToUserSchema.parse(req.body);
            await categories_service_1.categoriesService.assignSkillToUser(req.user.globalUserId, validated);
            return reply.status(200).send({ success: true, message: 'Skill associada ao usuário' });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao associar skill',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/classify-text
     * Classifica texto em categorias (preparado para AI Kernel)
     */
    fastify.post('/classify-text', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    maxCategories: { type: 'number' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const validated = categories_schemas_1.classifyTextSchema.parse(req.body);
            const classifications = await categories_service_1.categoriesService.classifyTextIntoCategories(validated);
            return { classifications };
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao classificar texto' });
        }
    });
    /**
     * POST /categories/suggest-path
     * IA COMO CLASSIFICADORA: Sugere caminho hierárquico sem criar nada
     * Retorna: root, parent, leafName, confidence
     * SECURITY: reasoning removido do response (apenas mensagem fixa)
     */
    fastify.post('/suggest-path', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
                    countryCode: { type: ['string', 'null'] },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const suggestion = await categories_service_1.categoriesService.suggestCategoryPath(req.body.text, req.body.context || 'professional', req.body.countryCode);
            // SECURITY: Remover reasoning detalhado do response público
            const { reasoning, ...publicSuggestion } = suggestion;
            return reply.send({
                ok: true,
                data: {
                    ...publicSuggestion,
                    reasoning: 'Análise automática concluída', // Mensagem fixa curta
                }
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao sugerir caminho de categoria');
            if (error instanceof Error) {
                // Validação de input retorna 400
                if (error.message.includes('inválido') || error.message.includes('não permitido')) {
                    return reply.status(400).send({ ok: false, message: error.message });
                }
                return reply.status(500).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao sugerir caminho de categoria'
            });
        }
    });
    /**
     * POST /categories/ai-create
     * Cria categoria automaticamente usando IA quando não existe
     * Aceita texto ou transcrição de voz
     * Para categorias de educação, usa countryCode do usuário se não fornecido
     * REGRAS DE BLINDAGEM: Categoria criada como 'pending' e requires_review = true
     */
    fastify.post('/ai-create', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
                    parentId: { type: ['string', 'null'] },
                    countryCode: { type: ['string', 'null'] },
                    inputType: { type: 'string', enum: ['text', 'voice', 'transcription'] },
                    audioUrl: { type: 'string' },
                    audioHash: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const validated = categories_schemas_1.aiCreateCategorySchema.parse(req.body);
            // Se for educação e não tiver countryCode, buscar da residência do usuário (opcional)
            if (validated.context === 'education' && !validated.countryCode && req.user.globalUserId) {
                try {
                    const { residenceService } = await Promise.resolve().then(() => __importStar(require('../residence/residence.service')));
                    const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
                    if (residence?.country?.code) {
                        validated.countryCode = residence.country.code;
                    }
                }
                catch (error) {
                    // Falha ao buscar residência não pode quebrar a sugestão
                    fastify.log.debug({ err: error }, 'Não foi possível buscar residência para countryCode; usando categorias globais');
                }
            }
            // Buscar actor_id do usuário se disponível
            let actorId = undefined;
            try {
                const { social2Service } = await Promise.resolve().then(() => __importStar(require('../../modules/social/social-2.0.service')));
                const userActor = await social2Service.getUserActor(req.tenant.id, req.user.globalUserId || '');
                actorId = userActor?.actor_id;
            }
            catch (err) {
                // Não crítico se não encontrar actor
            }
            const result = await categories_service_1.categoriesService.createCategoryWithAI({
                ...validated,
                tenantId: req.tenant.id,
                actorId,
                globalUserId: req.user.globalUserId,
                inputType: validated.inputType || 'text',
                audioUrl: validated.audioUrl,
                audioHash: validated.audioHash,
            });
            return reply.status(result.created ? 201 : 200).send({
                ok: true,
                data: result
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao criar categoria via IA');
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao criar categoria via IA',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/:categoryId/approve
     * Aprova uma categoria pendente criada por IA
     * REGRAS: Apenas categorias com status 'pending' e requires_review = true podem ser aprovadas
     */
    fastify.post('/:categoryId/approve', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const result = await categories_service_1.categoriesService.approveCategory(req.params.categoryId, req.user.id);
            return reply.status(200).send({ ok: true, data: result });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao aprovar categoria');
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao aprovar categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /categories/:categoryId/reject
     * Rejeita uma categoria pendente criada por IA
     */
    fastify.post('/:categoryId/reject', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                properties: {
                    reason: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const result = await categories_service_1.categoriesService.rejectCategory(req.params.categoryId, req.body.reason || 'Rejeitada por moderador');
            return reply.status(200).send({ ok: true, data: result });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao rejeitar categoria');
            if (error instanceof Error) {
                return reply.status(400).send({ ok: false, message: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao rejeitar categoria',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /categories/pending
     * Lista categorias pendentes de aprovação
     */
    fastify.get('/pending', async (req, reply) => {
        try {
            const categories = await categories_service_1.categoriesService.getPendingCategories();
            return reply.send({ ok: true, data: categories });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar categorias pendentes');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar categorias pendentes',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = categoriesRoutes;
//# sourceMappingURL=categories.routes.js.map