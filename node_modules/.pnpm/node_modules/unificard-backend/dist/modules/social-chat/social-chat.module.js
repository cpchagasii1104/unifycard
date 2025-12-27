"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const social_chat_routes_1 = __importDefault(require("./social-chat.routes"));
const socialChatModule = async (fastify) => {
    await fastify.register(social_chat_routes_1.default);
};
exports.default = socialChatModule;
//# sourceMappingURL=social-chat.module.js.map