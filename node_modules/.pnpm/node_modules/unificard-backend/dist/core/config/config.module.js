"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_routes_1 = __importDefault(require("./config.routes"));
const configModule = async (fastify) => {
    await fastify.register(config_routes_1.default);
};
exports.default = configModule;
//# sourceMappingURL=config.module.js.map