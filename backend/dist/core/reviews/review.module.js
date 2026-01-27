"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewModule = void 0;
const review_routes_1 = __importDefault(require("./review.routes"));
const reviewModule = async (fastify) => {
    await fastify.register(review_routes_1.default);
};
exports.reviewModule = reviewModule;
exports.default = reviewModule;
