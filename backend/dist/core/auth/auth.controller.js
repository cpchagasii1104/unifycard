"use strict";
// backend/src/core/auth/auth.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("@core/auth/auth.service");
const errors_1 = require("@core/errors");
class AuthController {
    // ============================================================
    // REGISTER
    // ============================================================
    async register(req, reply) {
        const tenantId = req.tenantId;
        const { email, password } = req.body;
        if (!email || !password) {
            throw new errors_1.BadRequestError('Email and password are required.');
        }
        const result = await auth_service_1.authService.register(tenantId, email, password);
        return reply.send({
            success: true,
            data: result,
        });
    }
    // ============================================================
    // LOGIN
    // ============================================================
    async login(req, reply) {
        const tenantId = req.tenantId;
        const { email, password } = req.body;
        if (!email || !password) {
            throw new errors_1.BadRequestError('Email and password are required.');
        }
        const result = await auth_service_1.authService.login(tenantId, email, password);
        return reply.send({
            success: true,
            data: result,
        });
    }
    // ============================================================
    // REFRESH TOKEN
    // ============================================================
    async refreshToken(req, reply) {
        const tenantId = req.tenantId;
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new errors_1.BadRequestError('Refresh token is required.');
        }
        const tokens = await auth_service_1.authService.refreshToken(tenantId, refreshToken);
        return reply.send({
            success: true,
            data: tokens,
        });
    }
    // ============================================================
    // LOGOUT (opcional, se invalidar refresh for suportado)
    // ============================================================
    async logout(req, reply) {
        const tenantId = req.tenantId;
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new errors_1.BadRequestError('Refresh token is required.');
        }
        // Apenas se você implementar invalidation no tokenService
        if (auth_service_1.authService.logout) {
            await auth_service_1.authService.logout(tenantId, refreshToken);
        }
        return reply.send({
            success: true,
            message: 'Logged out successfully.',
        });
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map