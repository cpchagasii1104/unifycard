"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantModule = void 0;
const assistant_routes_1 = __importDefault(require("./assistant.routes"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const assistantModule = async (fastify) => {
    // Registrar multipart para upload de áudio
    await fastify.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB max
        },
    });
    await fastify.register(assistant_routes_1.default);
};
exports.assistantModule = assistantModule;
exports.default = assistantModule;
