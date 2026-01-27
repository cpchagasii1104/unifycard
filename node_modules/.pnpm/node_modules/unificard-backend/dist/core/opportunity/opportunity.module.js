"use strict";
// src/core/opportunity/opportunity.module.ts
// Módulo de Oportunidades Suaves
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opportunityModule = void 0;
const opportunity_routes_1 = __importDefault(require("./opportunity.routes"));
const opportunityModule = async (fastify) => {
    await fastify.register(opportunity_routes_1.default);
};
exports.opportunityModule = opportunityModule;
exports.default = opportunityModule;
