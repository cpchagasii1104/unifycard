"use strict";
// src/core/catalog/category-review.module.ts
// Módulo de revisão de categorias - Rotas administrativas
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryReviewModule = void 0;
const category_review_routes_1 = __importDefault(require("./category-review.routes"));
const categoryReviewModule = async (fastify) => {
    await fastify.register(category_review_routes_1.default, { prefix: '/categories' });
};
exports.categoryReviewModule = categoryReviewModule;
exports.default = categoryReviewModule;
