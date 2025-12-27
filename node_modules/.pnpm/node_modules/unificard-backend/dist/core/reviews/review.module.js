"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const review_routes_1 = __importDefault(require("./review.routes"));
const reviewModule = async (fastify) => {
    await fastify.register(review_routes_1.default);
};
exports.default = reviewModule;
//# sourceMappingURL=review.module.js.map