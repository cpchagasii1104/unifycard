"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const checkout_routes_1 = __importDefault(require("./checkout.routes"));
const checkoutModule = async (fastify) => {
    await fastify.register(checkout_routes_1.default);
};
exports.default = checkoutModule;
//# sourceMappingURL=checkout.module.js.map