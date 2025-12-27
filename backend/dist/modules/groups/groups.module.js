"use strict";
// src/modules/groups/groups.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const groups_routes_1 = __importDefault(require("./groups.routes"));
const groups_insights_routes_1 = __importDefault(require("./groups.insights.routes"));
const groupsModule = async (fastify) => {
    await fastify.register(groups_routes_1.default);
    await fastify.register(groups_insights_routes_1.default, { prefix: '/insights' });
};
exports.default = groupsModule;
//# sourceMappingURL=groups.module.js.map