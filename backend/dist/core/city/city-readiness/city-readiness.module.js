"use strict";
// src/core/city/city-readiness/city-readiness.module.ts
// Módulo de prontidão de cidade - READ-ONLY
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const city_readiness_routes_1 = __importDefault(require("./city-readiness.routes"));
const cityReadinessModule = async (fastify) => {
    await fastify.register(city_readiness_routes_1.default);
};
exports.default = cityReadinessModule;
