"use strict";
// src/core/catalog/canonical/canonical-product.module.ts
// Módulo de catálogo canônico de produtos - READ-ONLY
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const canonical_product_routes_1 = __importDefault(require("./canonical-product.routes"));
const canonicalProductModule = async (fastify) => {
    await fastify.register(canonical_product_routes_1.default);
};
exports.default = canonicalProductModule;
