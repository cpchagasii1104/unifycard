"use strict";
// src/core/profile/profile.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileModule = void 0;
const profile_routes_1 = __importDefault(require("./profile.routes"));
const commitments_routes_1 = __importDefault(require("@modules/profile/commitments.routes"));
const pending_responsibilities_routes_1 = __importDefault(require("./pending-responsibilities.routes"));
const impact_overview_routes_1 = __importDefault(require("./impact-overview.routes"));
const profileModule = async (fastify) => {
    await fastify.register(profile_routes_1.default);
    await fastify.register(commitments_routes_1.default);
    await fastify.register(pending_responsibilities_routes_1.default);
    await fastify.register(impact_overview_routes_1.default);
};
exports.profileModule = profileModule;
exports.default = profileModule;
