"use strict";
// src/core/companies/companies.module.ts
// Módulo de empresas (PJ)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.companiesModule = void 0;
const companies_routes_1 = require("./companies.routes");
const company_members_routes_1 = __importDefault(require("./company-members.routes"));
const companiesModule = async (fastify) => {
    await fastify.register(companies_routes_1.companiesRoutes);
    // 🔴 BLINDAGEM: Rotas de membros (base estrutural, NÃO CRM/ERP completo)
    // Prefixo removido pois o módulo já é registrado com /companies no server.ts
    await fastify.register(company_members_routes_1.default);
};
exports.companiesModule = companiesModule;
