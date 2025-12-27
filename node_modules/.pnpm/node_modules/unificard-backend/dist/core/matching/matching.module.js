"use strict";
// src/core/matching/matching.module.ts
// Módulo de Matching Humano
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const matching_routes_1 = __importDefault(require("./matching.routes"));
const matchingModule = async (fastify) => {
    await fastify.register(matching_routes_1.default);
};
exports.default = matchingModule;
//# sourceMappingURL=matching.module.js.map