"use strict";
// src/core/unifybank/unifybank.module.ts
// Módulo UnifyBank - Sistema de moeda fictícia de teste e transferências P2P
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_currency_routes_1 = __importDefault(require("./test-currency.routes"));
const bank_p2p_transfer_routes_1 = __importDefault(require("./bank-p2p-transfer.routes"));
const donation_routes_1 = __importDefault(require("./donation.routes"));
const transparency_routes_1 = __importDefault(require("./transparency.routes"));
const transparency_admin_routes_1 = __importDefault(require("./transparency-admin.routes"));
const regional_fund_governance_routes_1 = __importDefault(require("./regional-fund-governance.routes"));
const unifybankModule = async (fastify) => {
    // Rotas administrativas de moeda de teste (registradas em /admin/test-currency)
    await fastify.register(test_currency_routes_1.default, { prefix: '/test-currency' });
    // Rotas de transferência P2P (registradas em /bank/p2p-transfer quando prefix=/bank)
    // ou em /admin/bank/p2p-transfer quando prefix=/admin
    await fastify.register(bank_p2p_transfer_routes_1.default);
    // Rotas de doação (registradas em /bank/donate quando prefix=/bank)
    await fastify.register(donation_routes_1.default);
    // Rotas de transparência financeira (registradas em /bank quando prefix=/bank)
    // FASE 6: Transparência Financeira
    await fastify.register(transparency_routes_1.default);
    // Rotas admin de transparência financeira (registradas em /admin/bank quando prefix=/admin)
    // FASE 6: Transparência Financeira - Admin
    await fastify.register(transparency_admin_routes_1.default);
    // Rotas de governança do fundo regional (registradas em /regional-fund quando prefix=/bank)
    // FASE 8: Governança do Fundo Regional
    await fastify.register(regional_fund_governance_routes_1.default, { prefix: '/regional-fund' });
};
exports.default = unifybankModule;
//# sourceMappingURL=unifybank.module.js.map