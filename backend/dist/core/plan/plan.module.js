"use strict";
// src/core/plan/plan.module.ts
// Módulo de gerenciamento de planos
// FASE 3.6: Toggle FREE/PRO para usuário teste
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plan_routes_1 = __importDefault(require("./plan.routes"));
const planModule = async (fastify) => {
    await fastify.register(plan_routes_1.default);
};
exports.default = planModule;
//# sourceMappingURL=plan.module.js.map