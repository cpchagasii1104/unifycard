"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = require("@core/auth/auth.service");
const zod_1 = require("zod");
// Schemas de validação
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(100),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(100),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(10),
});
const authRoutes = async (fastify) => {
    // POST /auth/register
    fastify.post('/register', async (req, reply) => {
        // Validação
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { email, password } = parsed.data;
        // Auth é público, mas precisa de tenant para multi-tenancy
        const tenantId = req.headers['x-tenant-id'];
        if (!tenantId) {
            return reply.status(400).send({ error: 'Tenant ID is required' });
        }
        try {
            const result = await auth_service_1.authService.register(tenantId, email, password);
            return reply.status(201).send({
                success: true,
                data: result,
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
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { email, password } = parsed.data;
        if (!tenantId) {
            return reply.status(400).send({ error: 'Tenant ID is required' });
        }
        try {
            const result = await auth_service_1.authService.login(tenantId, email, password);
            return reply.send({
                success: true,
                data: result,
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
    // POST /auth/refresh
    fastify.post('/refresh', async (req, reply) => {
        const parsed = refreshSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { refreshToken } = parsed.data;
        const tenantId = req.headers['x-tenant-id'];
        if (!tenantId) {
            return reply.status(400).send({ error: 'Tenant ID is required' });
        }
        try {
            const tokens = await auth_service_1.authService.refreshToken(tenantId, refreshToken);
            return reply.send({
                success: true,
                data: tokens,
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
    // POST /auth/logout
    fastify.post('/logout', async (req, reply) => {
        const parsed = refreshSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        // Logout é opcional - apenas retorna sucesso
        // Implementar invalidação de refresh token se necessário
        return reply.send({
            success: true,
            message: 'Logged out successfully',
        });
    });
};
exports.default = authRoutes;
//# sourceMappingURL=auth.routes.js.map