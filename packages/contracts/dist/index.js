"use strict";
/**
 * @unificard/contracts
 *
 * Contratos de domínio compartilhados entre frontend e backend.
 * Fonte única de verdade para tipos que cruzam camadas.
 *
 * REGRA DE OURO:
 * - Se um tipo cruza frontend ↔ backend, ele nasce aqui ou não nasce.
 * - Backend e frontend NUNCA redefinem tipos de domínio.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEZONE_VALUES = exports.CURRENCY_VALUES = exports.COUNTRY_VALUES = exports.LANGUAGE_VALUES = exports.isGender = exports.GENDER_VALUES = void 0;
// Reference vocabulary (validação semântica — ver SSOT_REGISTRY_UNIFICARD §5.16)
var vocabulary_1 = require("./vocabulary");
Object.defineProperty(exports, "GENDER_VALUES", { enumerable: true, get: function () { return vocabulary_1.GENDER_VALUES; } });
Object.defineProperty(exports, "isGender", { enumerable: true, get: function () { return vocabulary_1.isGender; } });
Object.defineProperty(exports, "LANGUAGE_VALUES", { enumerable: true, get: function () { return vocabulary_1.LANGUAGE_VALUES; } });
Object.defineProperty(exports, "COUNTRY_VALUES", { enumerable: true, get: function () { return vocabulary_1.COUNTRY_VALUES; } });
Object.defineProperty(exports, "CURRENCY_VALUES", { enumerable: true, get: function () { return vocabulary_1.CURRENCY_VALUES; } });
Object.defineProperty(exports, "TIMEZONE_VALUES", { enumerable: true, get: function () { return vocabulary_1.TIMEZONE_VALUES; } });
