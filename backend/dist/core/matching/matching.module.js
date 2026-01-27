"use strict";
// src/core/matching/matching.module.ts
// Módulo de Matching Humano
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingModule = void 0;
const matching_routes_1 = require("./matching.routes");
const matchingModule = async (fastify) => {
    await fastify.register(matching_routes_1.matchingRoutes);
};
exports.matchingModule = matchingModule;
