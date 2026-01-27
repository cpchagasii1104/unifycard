"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ai_routes_1 = __importDefault(require("./ai.routes"));
const devtoolsModule = async (fastify) => {
    await fastify.register(ai_routes_1.default, { prefix: '/ai' });
};
exports.default = devtoolsModule;
