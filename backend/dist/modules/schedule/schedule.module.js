"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const schedule_routes_1 = __importDefault(require("./schedule.routes"));
const scheduleModule = async (fastify) => {
    await fastify.register(schedule_routes_1.default);
};
exports.default = scheduleModule;
//# sourceMappingURL=schedule.module.js.map