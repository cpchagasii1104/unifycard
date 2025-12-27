"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const reputation_routes_1 = __importDefault(require("./reputation.routes"));
const reputationModule = async (fastify) => {
    await fastify.register(reputation_routes_1.default);
};
exports.default = reputationModule;
//# sourceMappingURL=reputation.module.js.map