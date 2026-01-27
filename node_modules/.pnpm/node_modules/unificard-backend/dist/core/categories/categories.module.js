"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesModule = void 0;
const categories_routes_1 = __importDefault(require("./categories.routes"));
const categoriesModule = async (fastify) => {
    await fastify.register(categories_routes_1.default);
};
exports.categoriesModule = categoriesModule;
exports.default = categoriesModule;
