"use strict";
// backend/src/core/notify/notify.worker.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNotifyWorkerOnce = runNotifyWorkerOnce;
const dotenv_1 = __importDefault(require("dotenv"));
const pool_1 = require("@core/database/pool");
const notify_service_1 = require("./notify.service");
dotenv_1.default.config();
const notifyService = new notify_service_1.NotifyService();
async function getAllTenantsWithQueue() {
    // Simples: pega todos tenants. Em prod, dá pra otimizar.
    const result = await pool_1.pool.query('SELECT tenant_id FROM tenants');
    return result.rows.map(r => r.tenant_id);
}
async function runNotifyWorkerOnce() {
    const tenants = await getAllTenantsWithQueue();
    for (const tenantId of tenants) {
        try {
            const processed = await notifyService.processPendingForTenant(tenantId, {
                limit: 50,
            });
            if (processed > 0) {
                console.log(`[NotifyWorker] Tenant ${tenantId} processed ${processed} notifications`);
            }
        }
        catch (error) {
            console.error('[NotifyWorker] Error processing tenant queue', { tenantId, error });
        }
    }
}
// Se quiser rodar em loop:
// (descomenta se for usar como processo separado)
/*
async function loop() {
  const intervalMs = Number(process.env.NOTIFY_WORKER_INTERVAL_MS || 5000);

  while (true) {
    await runNotifyWorkerOnce();
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

void loop();
*/
//# sourceMappingURL=notify.worker.js.map