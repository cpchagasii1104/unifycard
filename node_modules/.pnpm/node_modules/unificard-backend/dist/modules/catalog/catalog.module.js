"use strict";
// src/modules/catalog/catalog.module.ts
// Módulo de catálogo canônico híbrido
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catalog_routes_1 = __importDefault(require("./catalog.routes"));
const catalogModule = async (fastify) => {
    await fastify.register(catalog_routes_1.default);
};
exports.default = catalogModule;
