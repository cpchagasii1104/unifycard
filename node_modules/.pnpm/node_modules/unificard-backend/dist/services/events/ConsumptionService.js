"use strict";
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
exports.ConsumptionService = void 0;
// src/services/events/ConsumptionService.ts
const db_1 = require("@core/db");
class ConsumptionService {
    async registerConsumption(params) {
        const { eventId, userId, tenantId, items } = params;
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const eventResult = await trx.query({
                text: `
          SELECT id, event_type, city_id, accepts_consumption
          FROM events
          WHERE id = $1
        `,
                values: [eventId],
            });
            if (eventResult.length === 0) {
                throw new Error('Event not found');
            }
            const event = eventResult[0];
            if (!event.accepts_consumption) {
                throw new Error('Event does not accept consumption');
            }
            const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
            // 🔴 IDEMPOTÊNCIA: Verificar se consumptions já existem (retry)
            if (params.idempotencyKey) {
                const existingConsumptions = await trx.query({
                    text: `
            SELECT id, status, transaction_id
            FROM event_consumptions
            WHERE tenant_id = $1 AND idempotency_key = $2
            ORDER BY created_at ASC
          `,
                    values: [tenantId, params.idempotencyKey],
                });
                if (existingConsumptions.length > 0) {
                    // Retornar consumptions existentes (idempotência)
                    const existing = existingConsumptions.map((row) => row);
                    return {
                        consumptions: existing,
                        totalAmount,
                        transactionId: existing[0]?.transaction_id || undefined,
                    };
                }
            }
            // Cria registros de consumo com status PENDING (antes do pagamento)
            const consumptions = [];
            for (const item of items) {
                const consumptionResult = await trx.query({
                    text: `
            INSERT INTO event_consumptions (
              tenant_id, event_id, global_user_id,
              item_name, quantity, unit_price, total_amount, status, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `,
                    values: [
                        tenantId,
                        eventId,
                        userId,
                        item.name,
                        item.quantity,
                        item.price,
                        item.quantity * item.price,
                        'PENDING', // Status inicial (antes do pagamento)
                        params.idempotencyKey || null,
                    ],
                });
                if (consumptionResult.length > 0) {
                    consumptions.push(consumptionResult[0]);
                }
            }
            // Processa checkout (UnifyCard → UnifyBank)
            if (!event.city_id) {
                throw new Error('Event city_id is required for payment processing');
            }
            // Importação dinâmica para evitar dependência circular
            const { checkoutService } = await Promise.resolve().then(() => __importStar(require('../../core/checkout/CheckoutService')));
            const checkoutRequest = {
                amount: totalAmount,
                currency: 'BRL',
                paymentMethod: 'UNIFYCARD',
                context: {
                    module: 'EVENT_CONSUMPTION',
                    eventId: eventId,
                    eventType: event.event_type,
                    cityId: event.city_id,
                    globalUserId: userId,
                    consumptionIds: consumptions.map((c) => c.id),
                },
                idempotencyKey: params.idempotencyKey, // 🔴 CRÍTICO: Para idempotência no ledger
            };
            const checkoutResult = await checkoutService.processCheckout(tenantId, checkoutRequest);
            if (!checkoutResult.success || !checkoutResult.transactionId) {
                throw new Error('Checkout failed: ' + (checkoutResult.error || 'Unknown error'));
            }
            // Atualiza consumptions para ACTIVE e vincula transaction_id
            for (const consumption of consumptions) {
                await trx.query({
                    text: `
            UPDATE event_consumptions
            SET 
              status = 'ACTIVE',
              transaction_id = $1
            WHERE id = $2
          `,
                    values: [checkoutResult.transactionId, consumption.id],
                });
            }
            return {
                consumptions: consumptions.map(c => ({ ...c, status: 'ACTIVE', transaction_id: checkoutResult.transactionId })),
                totalAmount,
                transactionId: checkoutResult.transactionId,
            };
        });
    }
}
exports.ConsumptionService = ConsumptionService;
//# sourceMappingURL=ConsumptionService.js.map