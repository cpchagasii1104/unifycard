"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyModule = void 0;
const notify_routes_1 = __importDefault(require("./notify.routes"));
const notifyModule = async (fastify) => {
    await fastify.register(notify_routes_1.default);
};
exports.notifyModule = notifyModule;
exports.default = notifyModule;
