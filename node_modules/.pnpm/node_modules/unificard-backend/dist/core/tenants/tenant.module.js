"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tenant_routes_1 = __importDefault(require("./tenant.routes"));
const tenantModule = async (fastify) => {
    await fastify.register(tenant_routes_1.default);
};
exports.default = tenantModule;
