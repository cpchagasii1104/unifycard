"use strict";
// src/core/catalog/dynamic-pricing/dynamic-pricing.module.ts
// Módulo de simulação de preço dinâmico - READ-ONLY
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_pricing_routes_1 = __importDefault(require("./dynamic-pricing.routes"));
const dynamicPricingModule = async (fastify) => {
    await fastify.register(dynamic_pricing_routes_1.default);
};
exports.default = dynamicPricingModule;
