"use strict";
// src/core/catalog/product-demand/product-demand.module.ts
// Módulo de sinal de demanda de produtos - READ-ONLY
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const product_demand_routes_1 = __importDefault(require("./product-demand.routes"));
const productDemandModule = async (fastify) => {
    await fastify.register(product_demand_routes_1.default);
};
exports.default = productDemandModule;
//# sourceMappingURL=product-demand.module.js.map