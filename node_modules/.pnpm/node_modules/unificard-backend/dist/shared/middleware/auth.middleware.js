"use strict";
// src/shared/middleware/auth.middleware.ts
//
// Middleware oficial de autenticação do Unificard.
// - optionalAuth → tenta autenticar, mas permite continuar sem usuário
// - requireAuth  → exige req.user, caso contrário 401
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = optionalAuth;
exports.requireAuth = requireAuth;
const errors_1 = require("@core/errors");
const auth_service_1 = require("@core/auth/auth.service");
// --------------------------------------------------------
// Extrator de token Bearer
// --------------------------------------------------------
function extractToken(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;
    const parts = header.split(" ");
    if (parts.length !== 2)
        return null;
    const [scheme, token] = parts;
    if (scheme.toLowerCase() !== "bearer")
        return null;
    if (!token.trim())
        return null;
    return token.trim();
}
// --------------------------------------------------------
// optionalAuth → tenta validar, mas não falha se token for inválido
// --------------------------------------------------------
async function optionalAuth(req, _res, next) {
    const token = extractToken(req);
    if (!token)
        return next();
    try {
        const payload = await auth_service_1.authService.verifyAccessToken(token);
        req.user = {
            id: payload.userId ?? payload.sub,
            role: payload.role,
            permissions: payload.permissions ?? [],
            tenantId: payload.tenantId,
            email: payload.email,
        };
    }
    catch {
        // Token inválido é ignorado silenciosamente (não quebra fluxo)
    }
    return next();
}
// --------------------------------------------------------
// requireAuth → exige autenticação válida
// --------------------------------------------------------
async function requireAuth(req, _res, next) {
    const token = extractToken(req);
    if (!token) {
        return next(new errors_1.UnauthorizedError("Missing authentication token"));
    }
    try {
        const payload = await auth_service_1.authService.verifyAccessToken(token);
        req.user = {
            id: payload.userId ?? payload.sub,
            role: payload.role,
            permissions: payload.permissions ?? [],
            tenantId: payload.tenantId,
            email: payload.email,
        };
        // Proteção extra multi-tenant
        if (req.tenant && req.user.tenantId && req.tenant.id !== req.user.tenantId) {
            return next(new errors_1.UnauthorizedError("Tenant mismatch"));
        }
        return next();
    }
    catch {
        return next(new errors_1.UnauthorizedError("Invalid or expired token"));
    }
}
//# sourceMappingURL=auth.middleware.js.map