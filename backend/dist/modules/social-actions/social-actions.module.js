"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const social_actions_routes_1 = __importDefault(require("./social-actions.routes"));
const socialActionsModule = async (fastify) => {
    await fastify.register(social_actions_routes_1.default);
};
exports.default = socialActionsModule;
//# sourceMappingURL=social-actions.module.js.map