"use strict";
// src/core/economy/fund/fund.module.ts
// Módulo do Fundo Regional
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fund_routes_1 = __importDefault(require("./fund.routes"));
const fund_admin_routes_1 = __importDefault(require("./fund-admin.routes"));
const fundModule = async (fastify) => {
    await fastify.register(fund_routes_1.default);
    // Rotas admin do fundo (registradas em /fund/admin)
    await fastify.register(fund_admin_routes_1.default, { prefix: '/admin' });
};
exports.default = fundModule;
//# sourceMappingURL=fund.module.js.map