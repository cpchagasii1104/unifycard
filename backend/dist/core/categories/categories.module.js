"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const categories_routes_1 = __importDefault(require("./categories.routes"));
const categoriesModule = async (fastify) => {
    await fastify.register(categories_routes_1.default);
};
exports.default = categoriesModule;
//# sourceMappingURL=categories.module.js.map