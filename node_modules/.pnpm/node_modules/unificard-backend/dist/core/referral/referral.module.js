"use strict";
// src/core/referral/referral.module.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const referral_routes_1 = __importDefault(require("./referral.routes"));
const referralModule = async (fastify) => {
    await fastify.register(referral_routes_1.default);
};
exports.default = referralModule;
//# sourceMappingURL=referral.module.js.map