"use strict";
// src/core/config/staging.config.ts
// Configuração de ambiente de staging
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stagingConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Carregar variáveis de ambiente
dotenv_1.default.config();
// Detectar ambiente
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_STAGING = NODE_ENV === 'staging';
const IS_PRODUCTION = NODE_ENV === 'production';
/**
 * Configuração de staging
 */
exports.stagingConfig = {
    // Ambiente
    nodeEnv: NODE_ENV,
    isStaging: IS_STAGING,
    isProduction: IS_PRODUCTION,
    // Database
    databaseUrl: IS_STAGING
        ? process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL
        : process.env.DATABASE_URL,
    // API
    apiBaseUrl: IS_STAGING
        ? process.env.API_BASE_URL_STAGING || process.env.API_BASE_URL || 'http://localhost:3000'
        : process.env.API_BASE_URL || 'http://localhost:3000',
    // Frontend
    frontendBaseUrl: IS_STAGING
        ? process.env.FRONTEND_BASE_URL_STAGING || process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
        : process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    // Feature Flags
    fundVisibilityEnabled: process.env.FUND_VISIBILITY_ENABLED !== 'false', // default: true
    // Logging
    logLevel: process.env.LOG_LEVEL || (IS_STAGING ? 'info' : 'debug'),
};
// Validação de staging
if (IS_STAGING) {
    if (!exports.stagingConfig.databaseUrl) {
        console.warn('⚠️  WARNING: DATABASE_URL_STAGING não configurada, usando DATABASE_URL');
    }
}
exports.default = exports.stagingConfig;
//# sourceMappingURL=staging.config.js.map