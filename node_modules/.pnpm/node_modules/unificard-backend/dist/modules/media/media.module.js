"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const media_routes_1 = __importDefault(require("./media.routes"));
const mediaModule = async (fastify) => {
    await fastify.register(media_routes_1.default);
};
exports.default = mediaModule;
//# sourceMappingURL=media.module.js.map