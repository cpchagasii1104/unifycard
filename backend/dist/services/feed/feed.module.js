"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedLegacyModule = void 0;
const feed_routes_1 = __importDefault(require("./feed.routes"));
const feedModule = async (fastify) => {
    await fastify.register(feed_routes_1.default);
};
exports.default = feedModule;
exports.feedLegacyModule = feedModule;
