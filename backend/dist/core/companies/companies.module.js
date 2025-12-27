"use strict";
// src/core/companies/companies.module.ts
// Módulo de empresas (PJ)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const companies_routes_1 = __importDefault(require("./companies.routes"));
const companiesModule = async (fastify) => {
    await fastify.register(companies_routes_1.default);
};
exports.default = companiesModule;
//# sourceMappingURL=companies.module.js.map