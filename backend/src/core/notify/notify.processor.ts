// backend/src/core/notify/notify.processor.ts

/**
 * Processor global da fila de notificações.
 *
 * - Percorre todos os tenants
 * - Para cada tenant, processa notificações pendentes
 * - Usa SKIP LOCKED → seguro em concorrência
 * - Pode rodar em loop interno ou via cron externo
 */

import { pool } from '@core/database/pool';
import { notifyService } from './notify.service';

const INTERVAL_MS = Number(process.env.NOTIFY_PROCESS_INTERVAL_MS || 5000); // 5s padrão

export class NotifyProcessor {
  private isRunning = false;

  /**
   * Coleta todos os tenants existentes.
   */
  private async getAllTenants(): Promise<string[]> {
    const result = await pool.query<{ tenant_id: string }>(
      `
        SELECT tenant_id
        FROM tenants
        WHERE is_active = TRUE
      `.trim()
    );

    return result.rows.map((r) => r.tenant_id);
  }

  /**
   * Processa notificações pendentes para TODOS os tenants.
   */
  private async processAllTenants() {
    if (this.isRunning) {
      console.warn('[NotifyProcessor] Skip — already running');
      return;
    }

    this.isRunning = true;

    try {
      const tenants = await this.getAllTenants();

      for (const tenantId of tenants) {
        try {
          const processed = await notifyService.processPendingForTenant(tenantId);
          if (processed > 0) {
            console.log(
              `[NotifyProcessor] Tenant ${tenantId}: ${processed} notificações processadas.`,
            );
          }
        } catch (err) {
          console.error(
            `[NotifyProcessor] Erro ao processar notificações para tenant ${tenantId}`,
            err,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Inicia o loop interno.
   */
  start() {
    console.log(
      `[NotifyProcessor] Iniciando processamento da fila a cada ${INTERVAL_MS}ms`,
    );

    setInterval(() => {
      this.processAllTenants().catch(err => {
        console.error('[NotifyProcessor] Erro no loop:', err);
      });
    }, INTERVAL_MS);
  }
}

export const notifyProcessor = new NotifyProcessor();
