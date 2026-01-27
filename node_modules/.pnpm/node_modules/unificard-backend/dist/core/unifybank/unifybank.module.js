"use strict";
// src/core/unifybank/unifybank.module.ts
// Módulo UnifyBank - Sistema de moeda fictícia de teste e transferências P2P
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifybankModule = void 0;
const test_currency_routes_1 = __importDefault(require("./test-currency.routes"));
const bank_p2p_transfer_routes_1 = __importDefault(require("./bank-p2p-transfer.routes"));
const donation_routes_1 = __importDefault(require("./donation.routes"));
const transparency_routes_1 = __importDefault(require("./transparency.routes"));
const user_group_allocation_routes_1 = __importDefault(require("../user-group-allocation/user-group-allocation.routes"));
const bank_metrics_routes_1 = __importDefault(require("../observability/bank-metrics.routes"));
const transparency_admin_routes_1 = __importDefault(require("./transparency-admin.routes"));
const regional_fund_governance_routes_1 = __importDefault(require("./regional-fund-governance.routes"));
const bank_balance_consolidation_routes_1 = __importDefault(require("./bank-balance-consolidation.routes"));
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
    // Rotas de alocação de grupos (registradas em /user/group-allocation quando prefix=/bank)
    // CONTINUOUS PRODUCTION: Group Allocation
    await fastify.register(user_group_allocation_routes_1.default, { prefix: '/user' });
    // Rotas de métricas (registradas em /admin/metrics quando prefix=/admin)
    // CONTINUOUS PRODUCTION: Observabilidade mínima
    await fastify.register(bank_metrics_routes_1.default, { prefix: '/metrics' });
    // Rotas de balanço consolidado (registradas em /admin/finance quando prefix=/admin)
    // READ-MODEL: Balanço Financeiro Consolidado
    await fastify.register(bank_balance_consolidation_routes_1.default, { prefix: '/finance' });
};
exports.unifybankModule = unifybankModule;
exports.default = unifybankModule;
