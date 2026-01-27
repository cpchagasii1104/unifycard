"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityModule = void 0;
const identity_routes_1 = __importDefault(require("./identity.routes"));
const identityModule = async (fastify) => {
    await fastify.register(identity_routes_1.default);
};
exports.identityModule = identityModule;
exports.default = identityModule;
