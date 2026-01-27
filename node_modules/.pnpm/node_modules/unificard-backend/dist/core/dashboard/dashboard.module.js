"use strict";
// src/core/dashboard/dashboard.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardModule = void 0;
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const daily_metrics_routes_1 = __importDefault(require("./daily-metrics.routes"));
// SPRINT 49: Dashboard Operacional (overview, today, month, sales, inventory)
const dashboard_routes_2 = __importDefault(require("@modules/dashboard/dashboard.routes"));
const dashboardModule = async (fastify) => {
    await fastify.register(dashboard_routes_1.default);
    await fastify.register(daily_metrics_routes_1.default, { prefix: '/metrics' });
    // SPRINT 49: Registrar rotas operacionais (overview, today, month, sales, inventory)
    await fastify.register(dashboard_routes_2.default);
};
exports.dashboardModule = dashboardModule;
exports.default = dashboardModule;
