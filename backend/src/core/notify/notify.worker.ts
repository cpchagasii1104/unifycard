// backend/src/core/notify/notify.worker.ts

import dotenv from 'dotenv';
import { pool } from '@core/database/pool';
import { NotifyService } from './notify.service';

dotenv.config();

const notifyService = new NotifyService();

async function getAllTenantsWithQueue(): Promise<string[]> {
  // Simples: pega todos tenants. Em prod, dá pra otimizar.
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM tenants'
  );
  return result.rows.map(r => r.id);
}

export async function runNotifyWorkerOnce(): Promise<void> {
  const tenants = await getAllTenantsWithQueue();

  for (const tenantId of tenants) {
    try {
      const processed = await notifyService.processPendingForTenant(tenantId, {
        limit: 50,
      });
      if (processed > 0) {
        console.log(
          `[NotifyWorker] Tenant ${tenantId} processed ${processed} notifications`
        );
      }
    } catch (error) {
      console.error(
        '[NotifyWorker] Error processing tenant queue',
        { tenantId, error }
      );
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
