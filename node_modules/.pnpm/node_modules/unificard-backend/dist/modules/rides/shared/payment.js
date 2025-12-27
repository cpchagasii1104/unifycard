"use strict";
// src/modules/rides/shared/payment.ts
//
// Fluxo de pagamento da corrida (DEPRECATED - usar distribution.service.ts)
// Este arquivo foi mantido para compatibilidade, mas o processamento real
// está em distribution.service.ts que usa SplitEngine
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRidePayment = processRidePayment;
const distribution_service_1 = require("../distribution/distribution.service");
const errors_1 = require("@core/errors");
async function processRidePayment(input) {
    // DEPRECATED: Este método foi mantido para compatibilidade
    // O processamento real está em distribution.service.ts que usa SplitEngine
    // Este método apenas delega para distributionService.processRidePayment
    const { tenantId, rideId, passengerId, driverId, totalAmount } = input;
    if (!tenantId || !rideId) {
        throw new errors_1.BadRequestError("Missing tenantId or rideId for payment processing");
    }
    // Buscar ride completo
    const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require("@core/db")));
    const ride = await runQueryWithTenant(tenantId, {
        text: `
        SELECT ride_id, passenger_user_id, driver_id, service_type_id, final_price
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
        LIMIT 1
      `,
        values: [tenantId, rideId],
    });
    if (!ride) {
        throw new errors_1.BadRequestError("Ride not found");
    }
    // Delegar para distributionService que usa SplitEngine
    return await distribution_service_1.distributionService.processRidePayment(tenantId, ride, { total: totalAmount || ride.final_price || 0 });
}
//# sourceMappingURL=payment.js.map