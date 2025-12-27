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
