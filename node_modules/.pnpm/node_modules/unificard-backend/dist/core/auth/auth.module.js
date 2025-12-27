"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_routes_1 = __importDefault(require("@core/auth/auth.routes"));
const authModule = async (fastify) => {
    await fastify.register(auth_routes_1.default);
};
exports.default = authModule;
//# sourceMappingURL=auth.module.js.map