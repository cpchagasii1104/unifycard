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
const ssot_observability_service_1 = require("./ssot-observability.service");
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
                required: ['name', 'context'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    allowActive: { type: 'boolean' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
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
                    userId: req.user.userId,
                    tenantId: req.tenant.id,
                    source: 'manual',
                },
            }, {
                tenantId: req.tenant.id,
                userId: req.user.userId,
                validateAdmin: validated.allowActive || false,
                context: req.body.context,
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
                required: ['name', 'parentId', 'context'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    parentId: { type: 'string' },
                    allowActive: { type: 'boolean' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
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
                    userId: req.user.userId,
                    tenantId: req.tenant.id,
                    source: 'manual',
                },
            }, {
                tenantId: req.tenant.id,
                userId: req.user.userId,
                validateAdmin: req.body.allowActive || false,
                context: req.body.context,
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
     * GET /categories/tree?context=
     * Retorna árvore completa de categorias filtrada por tenant e context
     * SSOT: Único caminho canônico para leitura de categorias via HTTP
     *
     * GUARDS OBRIGATÓRIOS:
     * - context é obrigatório (querystring)
     * - tenantId é obrigatório (header X-Tenant-ID ou JWT)
     * - countryCode é ignorado se fornecido (vem do tenant)
     */
    fastify.get('/tree', async (req, reply) => {
        try {
            // DIAGNÓSTICO: Verificar se req.tenant está populado
            fastify.log.info({
                route: '/categories/tree',
                hasTenant: !!req.tenant,
                tenantId: req.tenant?.id || 'MISSING',
                headers: {
                    'x-tenant-id': req.headers['x-tenant-id'] || 'MISSING',
                    'authorization': req.headers['authorization'] ? 'PRESENT' : 'MISSING'
                }
            }, '[DIAGNÓSTICO] GET /categories/tree - Estado do request');
            // GUARD 1: Context obrigatório
            const context = req.query.context;
            if (!context) {
                // Registrar SSOT_VIOLATION
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_VIOLATION', {
                    tenantId: req.tenant?.id || null,
                    context: null,
                    details: {
                        route: '/categories/tree',
                        reason: 'context ausente no querystring',
                    },
                });
                return reply.status(400).send({
                    ok: false,
                    error: 'CONTEXT_REQUIRED'
                });
            }
            // GUARD 2: Tenant obrigatório
            if (!req.tenant || !req.tenant.id) {
                // Registrar SSOT_VIOLATION
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_VIOLATION', {
                    tenantId: null,
                    context,
                    details: {
                        route: '/categories/tree',
                        reason: 'tenant ausente no header',
                    },
                });
                return reply.status(401).send({
                    ok: false,
                    error: 'TENANT_REQUIRED'
                });
            }
            const tenantId = req.tenant.id;
            // Validação adicional: garantir que tenantId não está vazio
            if (!tenantId || tenantId.trim() === '') {
                return reply.status(400).send({
                    ok: false,
                    error: 'TENANT_ID_INVALID',
                    message: 'Tenant ID está vazio ou inválido'
                });
            }
            // GUARD 3: CountryCode ignorado se fornecido
            if (req.query.countryCode !== undefined && req.query.countryCode !== null) {
                fastify.log.warn({
                    route: '/categories/tree',
                    tenantId,
                    context,
                    attemptedCountryCode: req.query.countryCode
                }, 'SSOT_VIOLATION: countryCode fornecido via query será ignorado (vem do tenant)');
                // Registrar SSOT_SMELL (tentativa de violação)
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_SMELL', {
                    tenantId,
                    context,
                    details: {
                        route: '/categories/tree',
                        attemptedCountryCode: req.query.countryCode,
                        reason: 'countryCode fornecido via query (deve vir do tenant)',
                    },
                });
            }
            // Encaminhamento: chamar EXCLUSIVAMENTE método canônico
            const tree = await categories_service_1.categoriesService.getCategoriesForTenant(tenantId, context);
            fastify.log.info({
                tenantId,
                context,
                treeLength: tree?.length || 0
            }, 'GET /categories/tree - Sucesso');
            return reply.send({ ok: true, data: tree || [] });
        }
        catch (error) {
            // 🔴 ADR: Log detalhado do erro UMA VEZ (não entrar em loop)
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            // 🔴 ADR: Erro específico para tenant_contexts não existe
            if (errorMessage.includes('tenant_contexts') && errorMessage.includes('não existe')) {
                fastify.log.error({
                    err: error,
                    errorMessage,
                    context: req.query.context,
                    tenantId: req.tenant?.id,
                    hint: 'Tabela tenant_contexts não encontrada. Execute migration 312.'
                }, '❌ ERRO CRÍTICO: Tabela tenant_contexts não existe');
                return reply.status(500).send({
                    ok: false,
                    error: 'SCHEMA_ERROR',
                    message: 'Tabela tenant_contexts não encontrada. Execute a migration 312: 312_tenant_default_context_permissions.sql'
                });
            }
            fastify.log.error({
                err: error,
                errorMessage,
                errorStack,
                context: req.query.context,
                tenantId: req.tenant?.id
            }, 'Erro ao buscar árvore de categorias');
            // Se for erro de SSOT_VIOLATION, retornar erro específico
            if (errorMessage.includes('SSOT_VIOLATION')) {
                return reply.status(400).send({
                    ok: false,
                    error: errorMessage
                });
            }
            // Se for erro de CONTEXT_ACCESS_DENIED, retornar erro específico
            if (errorMessage.includes('CONTEXT_ACCESS_DENIED')) {
                return reply.status(403).send({
                    ok: false,
                    error: 'CONTEXT_ACCESS_DENIED',
                    message: errorMessage
                });
            }
            // Se for erro de tenant não encontrado, retornar erro específico
            if (errorMessage.includes('Tenant não encontrado') || errorMessage.includes('TENANT_NOT_FOUND')) {
                return reply.status(404).send({
                    ok: false,
                    error: 'TENANT_NOT_FOUND',
                    message: errorMessage
                });
            }
            return reply.status(500).send({
                ok: false,
                error: 'INTERNAL_ERROR',
                message: errorMessage
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
            if (!req.tenant || !req.tenant.id) {
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
            // SSOT: Autocomplete DEVE usar a mesma árvore canônica da navegação
            // Não usar repository.autocomplete() diretamente
            const tenantId = req.tenant.id;
            const context = req.query.context;
            if (!context) {
                return reply.status(400).send({
                    ok: false,
                    error: 'CONTEXT_REQUIRED',
                    message: 'Context é obrigatório para autocomplete'
                });
            }
            let results = await categories_service_1.categoriesService.autocompleteCategories(req.query.q, tenantId, context, req.query.limit || 20);
            // 🔴 FALLBACK: Se não houver categorias e for primeira busca, tentar criar categorias básicas
            if (results.length === 0) {
                const categoryCount = await categories_service_1.categoriesService.getCategoryCount?.();
                if (categoryCount === 0) {
                    fastify.log.warn('Tabela categories está vazia - tentando criar categorias básicas');
                    try {
                        // Tentar criar categorias básicas automaticamente
                        await categories_service_1.categoriesService.ensureBasicCategories?.();
                        // Tentar buscar novamente
                        results = await categories_service_1.categoriesService.autocompleteCategories(req.query.q, tenantId, context, req.query.limit || 20);
                    }
                    catch (seedError) {
                        fastify.log.error({ err: seedError }, 'Erro ao criar categorias básicas automaticamente');
                        // Continuar com array vazio - não quebrar autocomplete
                    }
                }
            }
            // DIAGNÓSTICO: Log resultado
            fastify.log.info({
                query: req.query.q,
                resultsCount: results.length,
                firstResult: results[0]?.name
            }, 'AUTOCOMPLETE SUCCESS');
            return reply.send({ ok: true, data: results });
        }
        catch (error) {
            // Tratar erro 429 (rate limit) - retornar array vazio silenciosamente
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
                fastify.log.warn({ query: req.query.q }, 'Rate limit atingido no autocomplete - retornando vazio');
                return reply.send({ ok: true, data: [] });
            }
            // DIAGNÓSTICO: Log erro completo (apenas para erros reais)
            fastify.log.error({
                err: error,
                query: req.query.q,
                errorMessage,
                errorStack: error instanceof Error ? error.stack : undefined
            }, 'AUTOCOMPLETE ERROR');
            return reply.status(500).send({
                ok: false,
                code: 'INTERNAL_ERROR',
                message: 'Erro ao buscar autocomplete de categorias',
                error: errorMessage
            });
        }
    });
    /**
     * GET /categories/search?term=&context=
     * Busca categorias por termo
     * SSOT: Usa o mesmo método canônico de leitura que /categories/tree
     *
     * GUARDS OBRIGATÓRIOS:
     * - context é obrigatório (querystring)
     * - tenantId é obrigatório (header X-Tenant-ID ou JWT)
     * - countryCode é ignorado se fornecido (vem do tenant)
     */
    fastify.get('/search', {
        schema: {
            querystring: {
                type: 'object',
                required: ['term', 'context'],
                properties: {
                    term: { type: 'string' },
                    limit: { type: 'number' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
                    countryCode: { type: ['string', 'null'] },
                },
            },
        },
    }, async (req, reply) => {
        try {
            // GUARD 1: Context obrigatório
            const context = req.query.context;
            if (!context) {
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_VIOLATION', {
                    tenantId: req.tenant?.id || null,
                    context: null,
                    details: {
                        route: '/categories/search',
                        reason: 'context ausente no querystring',
                    },
                });
                return reply.status(400).send({
                    ok: false,
                    error: 'CONTEXT_REQUIRED'
                });
            }
            // GUARD 2: Tenant obrigatório
            if (!req.tenant || !req.tenant.id) {
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_VIOLATION', {
                    tenantId: null,
                    context,
                    details: {
                        route: '/categories/search',
                        reason: 'tenant ausente no header',
                    },
                });
                return reply.status(401).send({
                    ok: false,
                    error: 'TENANT_REQUIRED'
                });
            }
            const tenantId = req.tenant.id;
            // Validação adicional: garantir que tenantId não está vazio
            if (!tenantId || tenantId.trim() === '') {
                return reply.status(400).send({
                    ok: false,
                    error: 'TENANT_ID_INVALID',
                    message: 'Tenant ID está vazio ou inválido'
                });
            }
            // GUARD 3: CountryCode ignorado se fornecido
            if (req.query.countryCode !== undefined && req.query.countryCode !== null) {
                fastify.log.warn({
                    route: '/categories/search',
                    tenantId,
                    context,
                    attemptedCountryCode: req.query.countryCode
                }, 'SSOT_VIOLATION: countryCode fornecido via query será ignorado (vem do tenant)');
                await ssot_observability_service_1.ssotObservabilityService.recordViolation('SSOT_SMELL', {
                    tenantId,
                    context,
                    details: {
                        route: '/categories/search',
                        attemptedCountryCode: req.query.countryCode,
                        reason: 'countryCode fornecido via query (deve vir do tenant)',
                    },
                });
            }
            // SSOT: Usar o mesmo método canônico de leitura
            const categories = await categories_service_1.categoriesService.searchCategoriesForTenant(req.query.term, tenantId, context, req.query.limit || 50);
            return reply.send({ ok: true, data: { categories, totalCents: categories.length } });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar categorias');
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Se for erro de SSOT_VIOLATION, retornar erro específico
            if (errorMessage.includes('SSOT_VIOLATION')) {
                return reply.status(400).send({
                    ok: false,
                    error: errorMessage
                });
            }
            // Se for erro de tenant não encontrado, retornar erro específico
            if (errorMessage.includes('Tenant não encontrado')) {
                return reply.status(404).send({
                    ok: false,
                    error: 'TENANT_NOT_FOUND',
                    message: errorMessage
                });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar categorias',
                error: errorMessage
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
            return reply.send({ ok: true, data: { children, totalCents: children.length } });
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
        if (!req.user.userId) {
            return reply.status(400).send({ error: 'User ID não encontrado' });
        }
        try {
            const validated = categories_schemas_1.assignSkillToUserSchema.parse(req.body);
            await categories_service_1.categoriesService.assignSkillToUser(req.user.userId, validated);
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
                required: ['text', 'context'],
                properties: {
                    text: { type: 'string' },
                    context: { type: 'string', enum: categories_schemas_1.CATEGORY_CONTEXT_VALUES },
                    countryCode: { type: ['string', 'null'] },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const suggestion = await categories_service_1.categoriesService.suggestCategoryPath(req.body.text, req.body.context, req.body.countryCode);
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
            // Nota: residenceService ainda pode usar globalUserId internamente, mas não bloqueia
            if (validated.context === 'education' && !validated.countryCode && req.user.userId) {
                try {
                    const { resolveGlobalUserId } = await Promise.resolve().then(() => __importStar(require('../identity/identity.utils')));
                    const globalUserId = await resolveGlobalUserId(req.user.userId, req.tenant.id);
                    if (globalUserId) {
                        const { residenceService } = await Promise.resolve().then(() => __importStar(require('../residence/residence.service')));
                        const residence = await residenceService.getResidenceWithDetails(globalUserId);
                        if (residence?.country?.code) {
                            validated.countryCode = residence.country.code;
                        }
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
                const userActor = await social2Service.getUserActor(req.tenant.id, req.user.userId);
                actorId = userActor?.actor_id;
            }
            catch (err) {
                // Não crítico se não encontrar actor
            }
            const result = await categories_service_1.categoriesService.createCategoryWithAI({
                text: validated.text,
                context: validated.context,
                parentId: validated.parentId,
                countryCode: validated.countryCode,
                tenantId: req.tenant.id,
                actorId,
                globalUserId: undefined, // Removido - não é mais necessário
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
    /**
     * GET /categories/diagnostic
     * 🔴 DIAGNÓSTICO: Verifica estado das categorias no banco
     * Endpoint temporário para investigar problema de children vazios
     */
    fastify.get('/diagnostic', async (req, reply) => {
        try {
            const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            // 1. Verificar se coluna status existe
            const statusCheck = await pool.query(`SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'categories' AND column_name = 'status'
        ) as exists`);
            const hasStatusColumn = statusCheck.rows[0]?.exists || false;
            // 2. Contar categorias por level e status
            const countByLevelStatus = await pool.query(`
        SELECT level, status, scope, COUNT(*) as count
        FROM categories
        GROUP BY level, status, scope
        ORDER BY level, status, scope
      `);
            // 3. Verificar categorias level 2 (profissões)
            const level2Categories = await pool.query(`
        SELECT category_id, name, slug, parent_id, level, status, scope
        FROM categories
        WHERE level = 2
        ORDER BY name
        LIMIT 20
      `);
            // 4. Verificar algumas categorias level 1 e seus filhos
            const level1WithChildren = await pool.query(`
        SELECT
          l1.category_id as level1_id,
          l1.name as level1_name,
          l1.status as level1_status,
          l2.category_id as level2_id,
          l2.name as level2_name,
          l2.status as level2_status
        FROM categories l1
        LEFT JOIN categories l2 ON l2.parent_id = l1.category_id
        WHERE l1.level = 1
        ORDER BY l1.name, l2.name
        LIMIT 30
      `);
            // 5. Verificar se há categorias com status diferente de active
            const nonActiveCategories = await pool.query(`
        SELECT category_id, name, level, status, scope
        FROM categories
        WHERE status != 'active' OR status IS NULL
        ORDER BY level, name
        LIMIT 20
      `);
            return reply.send({
                ok: true,
                diagnostic: {
                    hasStatusColumn,
                    countByLevelStatus: countByLevelStatus.rows,
                    level2Sample: level2Categories.rows,
                    level1WithChildren: level1WithChildren.rows,
                    nonActiveCategories: nonActiveCategories.rows,
                }
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao executar diagnóstico');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao executar diagnóstico',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = categoriesRoutes;
