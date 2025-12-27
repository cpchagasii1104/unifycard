"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const identity_routes_1 = __importDefault(require("./identity.routes"));
const identityModule = async (fastify) => {
    await fastify.register(identity_routes_1.default);
};
exports.default = identityModule;
//# sourceMappingURL=identity.module.js.map