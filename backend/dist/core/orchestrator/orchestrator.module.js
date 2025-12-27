"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const orchestrator_routes_1 = __importDefault(require("./orchestrator.routes"));
const orchestratorModule = async (fastify) => {
    await fastify.register(orchestrator_routes_1.default);
};
exports.default = orchestratorModule;
//# sourceMappingURL=orchestrator.module.js.map