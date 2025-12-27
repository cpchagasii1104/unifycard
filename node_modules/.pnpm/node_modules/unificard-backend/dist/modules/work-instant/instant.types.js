"use strict";
// src/modules/work-instant/instant.types.ts
//
// Tipos para o módulo Work Instant (matching em tempo real estilo Uber)
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstantJobStatus = void 0;
/**
 * Status do job instantâneo (fluxo completo da corrida)
 */
var InstantJobStatus;
(function (InstantJobStatus) {
    InstantJobStatus["PENDING"] = "pending";
    InstantJobStatus["ACCEPTED"] = "accepted";
    InstantJobStatus["EN_ROUTE"] = "en_route";
    InstantJobStatus["ARRIVED"] = "arrived";
    InstantJobStatus["IN_SERVICE"] = "in_service";
    InstantJobStatus["COMPLETED"] = "completed";
    InstantJobStatus["CANCELLED"] = "cancelled";
    InstantJobStatus["EXPIRED"] = "expired";
})(InstantJobStatus || (exports.InstantJobStatus = InstantJobStatus = {}));
//# sourceMappingURL=instant.types.js.map