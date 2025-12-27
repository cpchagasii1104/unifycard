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
const pool_1 = require("@core/database/pool");
const healthModule = async (fastify) => {
    // GET /health
    fastify.get('/', async () => {
        const packageJson = require('../../../package.json');
        const { getDatabaseInfo } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const dbInfo = await getDatabaseInfo();
        // 🔴 INSTRUMENTAÇÃO: Retornar informações de runtime para diagnóstico
        const serverAddress = fastify.server.address();
        const actualPort = typeof serverAddress === 'string'
            ? null
            : serverAddress?.port || null;
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: packageJson.version || '1.0.0',
            runtime: {
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                port: actualPort,
                env: process.env.NODE_ENV || 'development',
            },
            database: dbInfo ? {
                connected: true,
                host: dbInfo.host,
                port: dbInfo.port,
                database: dbInfo.database,
                schema: dbInfo.currentSchema,
                user: dbInfo.currentUser,
                connectionCount: dbInfo.connectionCount,
            } : {
                connected: false,
            },
        };
    });
    // GET /health/ready
    fastify.get('/ready', async (_req, reply) => {
        try {
            // Verifica conexão com banco
            await pool_1.pool.query('SELECT 1');
            return { status: 'ready', database: 'connected' };
        }
        catch {
            return reply.status(503).send({
                status: 'not ready',
                database: 'disconnected',
            });
        }
    });
    // GET /health/live
    fastify.get('/live', async () => {
        return { status: 'live' };
    });
};
exports.default = healthModule;
//# sourceMappingURL=health.module.js.map