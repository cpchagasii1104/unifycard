"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const care_routes_1 = __importDefault(require("./care.routes"));
const careModule = async (fastify) => {
    await fastify.register(care_routes_1.default);
};
exports.default = careModule;
//# sourceMappingURL=care.module.js.map