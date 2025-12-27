"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
// src/core/auth/auth.service.ts
const dotenv_1 = __importDefault(require("dotenv"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_1 = require("@core/database/pool");
const identity_service_1 = require("@core/identity/identity.service");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
// Type assertion após validação
const jwtSecret = JWT_SECRET;
class AuthService {
    toAuthUser(row) {
        return {
            userId: row.user_id,
            tenantId: row.tenant_id,
            email: row.email,
            globalUserId: row.global_user_id,
            createdAt: row.created_at,
        };
    }
    generateTokens(user) {
        const basePayload = {
            sub: user.userId,
            userId: user.userId,
            tenantId: user.tenantId,
            email: user.email,
        };
        if (user.globalUserId) {
            basePayload.globalUserId = user.globalUserId;
        }
        const accessToken = jsonwebtoken_1.default.sign({ ...basePayload, type: 'access' }, jwtSecret, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ ...basePayload, type: 'refresh' }, jwtSecret, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        return { accessToken, refreshToken };
    }
    async verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            if (decoded.type !== 'access') {
                const error = new Error('Invalid token type');
                error.statusCode = 401;
                throw error;
            }
            return decoded;
        }
        catch {
            const error = new Error('Invalid or expired access token');
            error.statusCode = 401;
            throw error;
        }
    }
    async register(tenantId, email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at
        FROM users
        WHERE email = $1
        LIMIT 1
      `, [normalizedEmail]);
        if (existing) {
            const error = new Error('Email already registered');
            error.statusCode = 409;
            throw error;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const inserted = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO users (tenant_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING user_id, tenant_id, email, password_hash, global_user_id, created_at
      `, [tenantId, normalizedEmail, passwordHash]);
        if (!inserted) {
            throw new Error('Failed to create user');
        }
        const user = this.toAuthUser(inserted);
        // Criar identidade global automaticamente
        try {
            await identity_service_1.identityService.createGlobalIdentityForUser(user.userId, tenantId);
        }
        catch (error) {
            // Log mas não falha o registro
            console.error('Erro ao criar identidade global:', error);
        }
        const tokens = this.generateTokens(user);
        return { user, tokens };
    }
    async login(tenantId, email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const userRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at
        FROM users
        WHERE email = $1
        LIMIT 1
      `, [normalizedEmail]);
        if (!userRow) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }
        const passwordMatch = await bcrypt_1.default.compare(password, userRow.password_hash);
        if (!passwordMatch) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }
        const user = this.toAuthUser(userRow);
        const tokens = this.generateTokens(user);
        return { user, tokens };
    }
    async refreshToken(tenantId, refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, jwtSecret);
            if (decoded.type !== 'refresh') {
                const error = new Error('Invalid token type');
                error.statusCode = 401;
                throw error;
            }
            if (decoded.tenantId !== tenantId) {
                const error = new Error('Invalid tenant for token');
                error.statusCode = 401;
                throw error;
            }
            const userRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [decoded.sub]);
            if (!userRow) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            const user = this.toAuthUser(userRow);
            return this.generateTokens(user);
        }
        catch {
            const error = new Error('Invalid refresh token');
            error.statusCode = 401;
            throw error;
        }
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map