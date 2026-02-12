"use strict";
// src/core/checkout/types/unifycard-checkout.types.ts
// 🔴 CRÍTICO: Contrato formal UnifyCard → UnifyBank
// 
// DEPRECATED: Tipos movidos para @unificard/contracts
// Este arquivo mantido apenas para compatibilidade reversa
// Use: import { CheckoutRequest, CheckoutResult, CheckoutContext } from '@unificard/contracts';
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutResult = exports.CheckoutRequest = exports.CheckoutContext = void 0;
var contracts_1 = require("@unificard/contracts");
Object.defineProperty(exports, "CheckoutContext", { enumerable: true, get: function () { return contracts_1.CheckoutContext; } });
Object.defineProperty(exports, "CheckoutRequest", { enumerable: true, get: function () { return contracts_1.CheckoutRequest; } });
Object.defineProperty(exports, "CheckoutResult", { enumerable: true, get: function () { return contracts_1.CheckoutResult; } });
