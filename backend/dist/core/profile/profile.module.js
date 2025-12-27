"use strict";
// src/core/profile/profile.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const profile_routes_1 = __importDefault(require("./profile.routes"));
const profileModule = async (fastify) => {
    await fastify.register(profile_routes_1.default);
};
exports.default = profileModule;
//# sourceMappingURL=profile.module.js.map