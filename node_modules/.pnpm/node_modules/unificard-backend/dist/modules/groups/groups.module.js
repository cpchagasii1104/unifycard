"use strict";
// src/modules/groups/groups.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsModule = void 0;
const groups_routes_1 = __importDefault(require("./groups.routes"));
const groups_insights_routes_1 = __importDefault(require("./groups.insights.routes"));
const groups_closure_routes_1 = __importDefault(require("./groups-closure.routes"));
const groups_state_history_routes_1 = __importDefault(require("./groups-state-history.routes"));
const votes_routes_1 = __importDefault(require("./votes.routes"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const groupsModule = async (fastify) => {
    // Registrar multipart para upload de imagens
    await fastify.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB max
            files: 1,
        },
    });
    await fastify.register(groups_routes_1.default);
    await fastify.register(groups_insights_routes_1.default, { prefix: '/insights' });
    await fastify.register(groups_closure_routes_1.default);
    await fastify.register(groups_state_history_routes_1.default);
    await fastify.register(votes_routes_1.default);
};
exports.groupsModule = groupsModule;
exports.default = groupsModule;
