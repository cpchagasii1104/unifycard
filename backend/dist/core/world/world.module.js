"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const world_routes_1 = __importDefault(require("./routes/world.routes"));
const worldModule = async (fastify) => {
    await fastify.register(world_routes_1.default);
};
exports.default = worldModule;
//# sourceMappingURL=world.module.js.map