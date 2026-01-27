"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.economyModule = void 0;
const account_routes_1 = __importDefault(require("./accounts/account.routes"));
const transaction_routes_1 = __importDefault(require("./transactions/transaction.routes"));
const ledger_routes_1 = __importDefault(require("./ledger/ledger.routes"));
const distribution_routes_1 = __importDefault(require("./distribution/distribution.routes"));
// Fund routes são registrados separadamente no server.ts
const economyModule = async (fastify) => {
    await fastify.register(account_routes_1.default, { prefix: '/accounts' });
    await fastify.register(transaction_routes_1.default, { prefix: '/transactions' });
    await fastify.register(ledger_routes_1.default, { prefix: '/ledger' });
    await fastify.register(distribution_routes_1.default, { prefix: '/distribution' });
};
exports.economyModule = economyModule;
exports.default = economyModule;
