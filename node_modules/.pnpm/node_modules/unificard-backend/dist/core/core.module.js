"use strict";
// src/core/core.module.ts
// Módulo CORE - Fonte única de identidade e dados do ecossistema
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_routes_1 = __importDefault(require("./core.routes"));
const coreModule = async (fastify) => {
    await fastify.register(core_routes_1.default);
};
exports.default = coreModule;
//# sourceMappingURL=core.module.js.map