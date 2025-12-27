"use strict";
// src/core/dashboard/dashboard.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const dashboardModule = async (fastify) => {
    await fastify.register(dashboard_routes_1.default);
};
exports.default = dashboardModule;
//# sourceMappingURL=dashboard.module.js.map