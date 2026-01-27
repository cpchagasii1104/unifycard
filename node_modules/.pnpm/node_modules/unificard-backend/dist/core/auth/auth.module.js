"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authModule = void 0;
const auth_routes_1 = __importDefault(require("@core/auth/auth.routes"));
const webauthn_routes_1 = __importDefault(require("@core/auth/webauthn.routes"));
const authModule = async (fastify) => {
    await fastify.register(auth_routes_1.default);
    // SPRINT 36.3: WebAuthn step-up authentication
    await fastify.register(webauthn_routes_1.default, { prefix: '/webauthn' });
};
exports.authModule = authModule;
