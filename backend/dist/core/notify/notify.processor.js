"use strict";
// backend/src/core/notify/notify.processor.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyProcessor = exports.NotifyProcessor = void 0;
/**
 * Processor global da fila de notificações.
 *
 * - Percorre todos os tenants
 * - Para cada tenant, processa notificações pendentes
 * - Usa SKIP LOCKED → seguro em concorrência
 * - Pode rodar em loop interno ou via cron externo
 */
const pool_1 = require("@core/database/pool");
const notify_service_1 = require("./notify.service");
const INTERVAL_MS = Number(process.env.NOTIFY_PROCESS_INTERVAL_MS || 5000); // 5s padrão
class NotifyProcessor {
    isRunning = false;
    /**
     * Coleta todos os tenants existentes.
     */
    async getAllTenants() {
        const result = await pool_1.pool.query(`
        SELECT tenant_id
        FROM tenants
        WHERE is_active = TRUE
      `.trim());
        return result.rows.map((r) => r.tenant_id);
    }
    /**
     * Processa notificações pendentes para TODOS os tenants.
     */
    async processAllTenants() {
        if (this.isRunning) {
            console.warn('[NotifyProcessor] Skip — already running');
            return;
        }
        this.isRunning = true;
        try {
            const tenants = await this.getAllTenants();
            for (const tenantId of tenants) {
                try {
                    const processed = await notify_service_1.notifyService.processPendingForTenant(tenantId);
                    if (processed > 0) {
                        console.log(`[NotifyProcessor] Tenant ${tenantId}: ${processed} notificações processadas.`);
                    }
                }
                catch (err) {
                    console.error(`[NotifyProcessor] Erro ao processar notificações para tenant ${tenantId}`, err);
                }
            }
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Inicia o loop interno.
     */
    start() {
        console.log(`[NotifyProcessor] Iniciando processamento da fila a cada ${INTERVAL_MS}ms`);
        setInterval(() => {
            this.processAllTenants().catch(err => {
                console.error('[NotifyProcessor] Erro no loop:', err);
            });
        }, INTERVAL_MS);
    }
}
exports.NotifyProcessor = NotifyProcessor;
exports.notifyProcessor = new NotifyProcessor();
