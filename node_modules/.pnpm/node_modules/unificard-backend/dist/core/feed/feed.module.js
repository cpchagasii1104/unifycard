"use strict";
// src/core/feed/feed.module.ts
// Módulo de Feed Contextual
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedContextualModule = void 0;
const feed_routes_1 = __importDefault(require("./feed.routes"));
const feed_plugin_routes_1 = __importDefault(require("./feed-plugin.routes"));
const feedModule = async (fastify) => {
    // Rotas do feed existente
    await fastify.register(feed_routes_1.default);
    // Rotas do plugin system
    await fastify.register(feed_plugin_routes_1.default, { prefix: '/plugin' });
};
exports.default = feedModule;
exports.feedContextualModule = feedModule;
