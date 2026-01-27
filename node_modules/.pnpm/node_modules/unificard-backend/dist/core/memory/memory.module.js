"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_routes_1 = __importDefault(require("./memory.routes"));
const memoryModule = async (fastify) => {
    await fastify.register(memory_routes_1.default);
};
exports.default = memoryModule;
