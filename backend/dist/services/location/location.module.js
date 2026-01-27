"use strict";
// src/services/location/location.module.ts
// Módulo de localização (CEP, etc)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cep_routes_1 = __importDefault(require("./cep.routes"));
const locationModule = async (fastify) => {
    // Registrar rotas de CEP
    await fastify.register(cep_routes_1.default, { prefix: '/location' });
};
exports.default = locationModule;
