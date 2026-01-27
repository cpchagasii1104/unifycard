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
const auth_service_1 = require("@core/auth/auth.service");
const schema_validator_1 = require("@core/database/schema-validator");
const cpf_validator_1 = require("@utils/cpf.validator");
const auth_rate_limit_service_1 = require("@core/rate-limiting/auth-rate-limit.service");
const errors_1 = require("@core/errors");
const zod_1 = require("zod");
// Schemas de validação
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(100),
    cpf: zod_1.z.string().min(11).max(11),
    fullName: zod_1.z.string().min(1).optional(),
    birthdate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
    referralCode: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(100),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(10),
});
const authRoutes = async (fastify) => {
    // POST /auth/register
    fastify.post('/register', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado
        const tenantIdHeader = req.headers['x-tenant-id'];
        fastify.log.info({
            pid: process.pid,
            route: '/auth/register',
            method: 'POST',
            tenantIdProvided: !!tenantIdHeader,
            tenantId: tenantIdHeader || null,
            email: req.body?.email ? req.body.email.substring(0, 3) + '***' : null,
        }, '[RUNTIME] POST /auth/register');
        // Validação
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { email, password, cpf, fullName, birthdate, gender, referralCode } = parsed.data;
        // 🔴 RATE LIMITING: Verificar limite antes de processar
        try {
            const rateLimitCheck = await auth_rate_limit_service_1.authRateLimitService.checkRateLimit('auth.register', req, tenantIdHeader, undefined, // userId ainda não existe
            email);
            if (!rateLimitCheck.allowed) {
                // 🔴 LOG CANÔNICO: Abuso detectado
                fastify.log.warn({
                    route: '/auth/register',
                    ip: auth_rate_limit_service_1.authRateLimitService.extractClientIp(req),
                    tenantId: tenantIdHeader,
                    email: email.substring(0, 3) + '***',
                    reason: rateLimitCheck.reason,
                    limit: rateLimitCheck.limit,
                    resetAt: rateLimitCheck.resetAt.toISOString(),
                }, '🚫 [AUTH] Rate limit excedido em /auth/register');
                throw new errors_1.RateLimitError(`Limite de tentativas de registro excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`, rateLimitCheck.resetAt, rateLimitCheck.remaining);
            }
        }
        catch (error) {
            if (error instanceof errors_1.RateLimitError) {
                return reply.status(429).send({
                    success: false,
                    error: error.message,
                    resetAt: error.resetAt?.toISOString(),
                    remaining: error.remaining,
                });
            }
            // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
            fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
        }
        // Tenant é opcional no registro - será criado automaticamente se não fornecido
        const tenantId = tenantIdHeader;
        try {
            // 🔴 GARANTIA CANÔNICA: Schema guard - fail fast
            // Validação de schema: verificar se coluna token_version existe
            const hasTokenVersion = await (0, schema_validator_1.hasTokenVersionColumn)();
            if (!hasTokenVersion) {
                fastify.log.error({
                    route: '/auth/register',
                    pid: process.pid,
                }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
                return reply.status(500).send({
                    success: false,
                    error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
                    details: 'Execute as migrations do banco de dados para atualizar o schema.',
                });
            }
            const result = await auth_service_1.authService.register(tenantId, email, password, cpf, fullName, birthdate, gender, referralCode);
            // 🔴 LOG CANÔNICO: tenant criado vs fornecido
            // Garantir que tenantId final está sempre presente
            if (!result.tenantId || typeof result.tenantId !== 'string') {
                fastify.log.error({
                    pid: process.pid,
                    route: '/auth/register',
                    email: email.substring(0, 3) + '***',
                }, '❌ [AUTH] tenantId ausente no resultado do registro - estado inválido');
                return reply.status(500).send({
                    success: false,
                    error: 'Erro interno: tenantId não foi retornado após registro',
                });
            }
            // 🔴 GARANTIA CANÔNICA: Verificar se tenantId está no JWT
            // Decodificar JWT para validar que tenantId está presente
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(result.tokens.accessToken);
                if (!decoded || !decoded.tenantId || typeof decoded.tenantId !== 'string') {
                    fastify.log.error({
                        pid: process.pid,
                        route: '/auth/register',
                        tenantId: result.tenantId,
                        hasDecoded: !!decoded,
                        decodedKeys: decoded ? Object.keys(decoded) : [],
                    }, '❌ [AUTH] tenantId ausente no JWT após registro - estado inválido');
                    return reply.status(500).send({
                        success: false,
                        error: 'Erro interno: tenantId não foi incluído no JWT',
                    });
                }
                // Log canônico de sucesso com validação completa
                fastify.log.info({
                    pid: process.pid,
                    route: '/auth/register',
                    tenantIdFinal: result.tenantId,
                    tenantIdInJWT: decoded.tenantId,
                    tenantWasCreated: !tenantId,
                    tenantWasProvided: !!tenantId,
                    jwtValidated: decoded.tenantId === result.tenantId,
                }, '[RUNTIME] POST /auth/register - sucesso (tenantId validado no JWT)');
            }
            catch (jwtError) {
                fastify.log.error({
                    pid: process.pid,
                    route: '/auth/register',
                    error: jwtError instanceof Error ? jwtError.message : String(jwtError),
                }, '❌ [AUTH] Erro ao validar tenantId no JWT');
                return reply.status(500).send({
                    success: false,
                    error: 'Erro interno: falha ao validar JWT',
                });
            }
            return reply.status(201).send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            const err = error;
            const status = err.statusCode ?? 500;
            fastify.log.error({ err: error, status }, 'Erro no registro');
            return reply.status(status).send({
                success: false,
                error: err.message || 'Erro interno do servidor',
            });
        }
    });
    // POST /auth/login
    fastify.post('/login', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
        const tenantId = req.headers['x-tenant-id'];
        fastify.log.info({
            pid: process.pid,
            route: '/auth/login',
            method: 'POST',
            tenantId,
            email: req.body?.email ? req.body.email.substring(0, 3) + '***' : null,
        }, '[RUNTIME] POST /auth/login');
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            fastify.log.warn({
                route: '/auth/login',
                body: req.body,
                errors: parsed.error.errors,
            }, '❌ [AUTH] Validação de body falhou no login');
            return reply.status(400).send({
                error: 'Dados de login inválidos',
                message: 'Email e senha são obrigatórios. Email deve ser válido e senha deve ter no mínimo 6 caracteres.',
                details: parsed.error.errors,
            });
        }
        const { email, password } = parsed.data;
        // 🔴 RATE LIMITING: Verificar limite antes de processar
        try {
            const rateLimitCheck = await auth_rate_limit_service_1.authRateLimitService.checkRateLimit('auth.login', req, tenantId, undefined, // userId ainda não conhecido
            email);
            if (!rateLimitCheck.allowed) {
                // 🔴 LOG CANÔNICO: Abuso detectado
                fastify.log.warn({
                    route: '/auth/login',
                    ip: auth_rate_limit_service_1.authRateLimitService.extractClientIp(req),
                    tenantId,
                    email: email.substring(0, 3) + '***',
                    reason: rateLimitCheck.reason,
                    limit: rateLimitCheck.limit,
                    resetAt: rateLimitCheck.resetAt.toISOString(),
                }, '🚫 [AUTH] Rate limit excedido em /auth/login');
                throw new errors_1.RateLimitError(`Limite de tentativas de login excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`, rateLimitCheck.resetAt, rateLimitCheck.remaining);
            }
        }
        catch (error) {
            if (error instanceof errors_1.RateLimitError) {
                return reply.status(429).send({
                    success: false,
                    error: error.message,
                    resetAt: error.resetAt?.toISOString(),
                    remaining: error.remaining,
                });
            }
            // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
            fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
        }
        // tenantId é opcional no login - será obtido do usuário encontrado
        try {
            // Validação de schema: verificar se coluna token_version existe
            const hasTokenVersion = await (0, schema_validator_1.hasTokenVersionColumn)();
            if (!hasTokenVersion) {
                fastify.log.error({
                    route: '/auth/login',
                }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
                return reply.status(500).send({
                    success: false,
                    error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
                    details: 'Execute as migrations do banco de dados para atualizar o schema.',
                });
            }
            // tenantId do header é opcional - o login busca usuário apenas por email
            const result = await auth_service_1.authService.login(tenantId || undefined, email, password);
            return reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            const err = error;
            const status = err.statusCode ?? 500;
            fastify.log.error({ err: error, status }, 'Erro no login');
            return reply.status(status).send({
                success: false,
                error: err.message || 'Erro interno do servidor',
            });
        }
    });
    // POST /auth/refresh
    fastify.post('/refresh', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado
        const tenantId = req.headers['x-tenant-id'];
        fastify.log.info({
            pid: process.pid,
            route: '/auth/refresh',
            method: 'POST',
            tenantId: tenantId || null,
            hasTenantId: !!tenantId,
        }, '[RUNTIME] POST /auth/refresh');
        const parsed = refreshSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { refreshToken } = parsed.data;
        // 🔴 GARANTIA CANÔNICA: refresh exige tenantId obrigatório
        if (!tenantId) {
            fastify.log.warn({
                pid: process.pid,
                route: '/auth/refresh',
            }, '❌ [AUTH] refresh sem tenantId');
            return reply.status(400).send({ error: 'Tenant ID is required' });
        }
        // 🔴 RATE LIMITING: Verificar limite antes de processar
        try {
            // Tentar extrair userId do refresh token (opcional, para rate limit mais preciso)
            let userId;
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(refreshToken);
                userId = decoded?.userId || decoded?.sub;
            }
            catch {
                // Ignorar erro de decode (token pode estar inválido)
            }
            const rateLimitCheck = await auth_rate_limit_service_1.authRateLimitService.checkRateLimit('auth.refresh', req, tenantId, userId);
            if (!rateLimitCheck.allowed) {
                // 🔴 LOG CANÔNICO: Abuso detectado
                fastify.log.warn({
                    route: '/auth/refresh',
                    ip: auth_rate_limit_service_1.authRateLimitService.extractClientIp(req),
                    tenantId,
                    userId,
                    reason: rateLimitCheck.reason,
                    limit: rateLimitCheck.limit,
                    resetAt: rateLimitCheck.resetAt.toISOString(),
                }, '🚫 [AUTH] Rate limit excedido em /auth/refresh');
                throw new errors_1.RateLimitError(`Limite de tentativas de refresh excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`, rateLimitCheck.resetAt, rateLimitCheck.remaining);
            }
        }
        catch (error) {
            if (error instanceof errors_1.RateLimitError) {
                return reply.status(429).send({
                    success: false,
                    error: error.message,
                    resetAt: error.resetAt?.toISOString(),
                    remaining: error.remaining,
                });
            }
            // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
            fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
        }
        try {
            // 🔴 GARANTIA CANÔNICA: Schema guard - fail fast
            const hasTokenVersion = await (0, schema_validator_1.hasTokenVersionColumn)();
            if (!hasTokenVersion) {
                fastify.log.error({
                    route: '/auth/refresh',
                    pid: process.pid,
                }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
                return reply.status(500).send({
                    success: false,
                    error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
                    details: 'Execute as migrations do banco de dados para atualizar o schema.',
                });
            }
            const tokens = await auth_service_1.authService.refreshToken(tenantId, refreshToken);
            // 🔴 LOG CANÔNICO: Refresh success (log já existe no service, mas adicionar aqui também para rastreabilidade na rota)
            const { canonicalLogger } = await Promise.resolve().then(() => __importStar(require('@core/logging/canonical-logger')));
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(refreshToken);
                canonicalLogger.info(req, 'Refresh success', {
                    tenantId,
                    userId: decoded?.sub || decoded?.userId,
                });
            }
            catch {
                // Ignorar se não conseguir decodificar (já logado no service)
            }
            return reply.send({
                success: true,
                data: tokens,
            });
        }
        catch (error) {
            const err = error;
            const status = err.statusCode ?? 500;
            // 🔴 LOG CANÔNICO: Refresh failure (log já existe no service, mas adicionar aqui também para rastreabilidade na rota)
            if (status === 401 || status === 404) {
                const { canonicalLogger } = await Promise.resolve().then(() => __importStar(require('@core/logging/canonical-logger')));
                canonicalLogger.warn(req, 'Refresh failure', {
                    tenantId,
                    statusCode: status,
                    error: err.message,
                });
            }
            return reply.status(status).send({
                success: false,
                error: err.message,
            });
        }
    });
    // POST /auth/logout
    fastify.post('/logout', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado
        const tenantId = req.headers['x-tenant-id'];
        fastify.log.info({
            pid: process.pid,
            route: '/auth/logout',
            method: 'POST',
            tenantId: tenantId || null,
            hasTenantId: !!tenantId,
        }, '[RUNTIME] POST /auth/logout');
        const parsed = refreshSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { refreshToken } = parsed.data;
        // 🔴 GARANTIA CANÔNICA: logout exige tenantId obrigatório
        if (!tenantId) {
            fastify.log.warn({
                pid: process.pid,
                route: '/auth/logout',
            }, '❌ [AUTH] logout sem tenantId');
            return reply.status(400).send({ error: 'Tenant ID is required' });
        }
        try {
            // Verificar token para obter userId
            const decoded = auth_service_1.authService.verifyJWT(refreshToken);
            if (decoded.tenantId !== tenantId) {
                // 🔴 LOG CANÔNICO: Cross-tenant violation detectada
                const { canonicalLogger } = await Promise.resolve().then(() => __importStar(require('@core/logging/canonical-logger')));
                canonicalLogger.abuse(req, 'Cross-tenant violation: tenantId do token não corresponde ao header', {
                    tenantIdFromHeader: tenantId,
                    tenantIdFromToken: decoded.tenantId,
                    userId: decoded.sub,
                });
                return reply.status(401).send({
                    success: false,
                    error: 'Invalid tenant for token',
                });
            }
            // Invalidar tokens antigos incrementando tokenVersion
            await auth_service_1.authService.logout(tenantId, decoded.sub);
            return reply.send({
                success: true,
                message: 'Logged out successfully',
            });
        }
        catch (error) {
            const err = error;
            const status = err.statusCode ?? 500;
            return reply.status(status).send({
                success: false,
                error: err.message,
            });
        }
    });
    // GET /auth/check-cpf
    // Verifica se um CPF já está cadastrado no sistema
    fastify.get('/check-cpf', async (req, reply) => {
        const rawCpf = req.query.cpf;
        const tenantId = req.headers['x-tenant-id'];
        if (!rawCpf || typeof rawCpf !== 'string') {
            return reply.status(400).send({
                error: 'CPF é obrigatório',
                message: 'Forneça o CPF como query parameter: ?cpf=XXXXXXXXXXX',
            });
        }
        // 🔴 RATE LIMITING: Verificar limite antes de processar
        try {
            const rateLimitCheck = await auth_rate_limit_service_1.authRateLimitService.checkRateLimit('auth.check-cpf', req, tenantId);
            if (!rateLimitCheck.allowed) {
                // 🔴 LOG CANÔNICO: Abuso detectado
                fastify.log.warn({
                    route: '/auth/check-cpf',
                    ip: auth_rate_limit_service_1.authRateLimitService.extractClientIp(req),
                    tenantId,
                    reason: rateLimitCheck.reason,
                    limit: rateLimitCheck.limit,
                    resetAt: rateLimitCheck.resetAt.toISOString(),
                }, '🚫 [AUTH] Rate limit excedido em /auth/check-cpf');
                throw new errors_1.RateLimitError(`Limite de verificações de CPF excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`, rateLimitCheck.resetAt, rateLimitCheck.remaining);
            }
        }
        catch (error) {
            if (error instanceof errors_1.RateLimitError) {
                return reply.status(429).send({
                    success: false,
                    error: error.message,
                    resetAt: error.resetAt?.toISOString(),
                    remaining: error.remaining,
                });
            }
            // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
            fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
        }
        try {
            // 🔒 SEGURANÇA: Validar e normalizar CPF antes da consulta
            // validateCpfOrThrow valida formato e dígitos verificadores
            (0, cpf_validator_1.validateCpfOrThrow)(rawCpf);
            // Normalizar CPF (remover formatação, deixar apenas números)
            const normalizedCpf = (0, cpf_validator_1.normalizeCpf)(rawCpf);
            // Consultar banco de dados usando CPF normalizado
            const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            const result = await pool.query('SELECT EXISTS(SELECT 1 FROM user_profiles WHERE cpf = $1) as exists', [normalizedCpf]);
            const exists = result.rows[0]?.exists === true;
            return reply.send({
                exists,
            });
        }
        catch (error) {
            const err = error;
            // Se for erro de validação de CPF, retornar 400
            if (err.message.includes('CPF') || err.message.includes('dígitos')) {
                return reply.status(400).send({
                    error: 'CPF inválido',
                    message: err.message,
                });
            }
            // Outros erros retornam 500
            fastify.log.error({ err: error }, 'Erro ao verificar CPF');
            return reply.status(500).send({
                error: 'Erro interno ao verificar CPF',
            });
        }
    });
};
exports.default = authRoutes;
