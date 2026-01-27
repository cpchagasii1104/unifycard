"use strict";
// src/core/core.module.ts
// Módulo CORE - Fonte única de identidade e dados do ecossistema
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreModule = void 0;
const core_routes_1 = require("./core.routes");
const coreModule = async (fastify) => {
    await fastify.register(core_routes_1.coreRoutes);
};
exports.coreModule = coreModule;
