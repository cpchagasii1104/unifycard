"use strict";
// src/core/catalog/offer-index/offer-index.module.ts
// Módulo de índice de ofertas - READ-ONLY
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const offer_index_routes_1 = __importDefault(require("./offer-index.routes"));
const offerIndexModule = async (fastify) => {
    await fastify.register(offer_index_routes_1.default);
};
exports.default = offerIndexModule;
