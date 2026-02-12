// src/core/jobs/subscription-expiration.job.ts
// Job para processar expirações de assinaturas
// Deve ser executado diariamente via cron

import { organizerBillingService } from '../../modules/events/organizers/organizer-billing.service';
import { pool } from '@core/database/pool';

/**
 * Processa expirações de assinaturas para todos os tenants
 */
export async function processSubscriptionExpirations(): Promise<void> {
  // Buscar todos os tenants ativos (usando pool direto, sem tenant context)
  const result = await pool.query<{ tenant_id: string }>(
    `
    SELECT tenant_id
    FROM tenants
    WHERE is_active = true
    `
  );

  let totalExpired = 0;

  for (const tenant of result.rows) {
    try {
      const expired = await organizerBillingService.processExpirations(tenant.tenant_id);
      totalExpired += expired;
    } catch (error) {
      console.error(`Erro ao processar expirações para tenant ${tenant.tenant_id}:`, error);
    }
  }

  console.log(`Processadas ${totalExpired} expirações de assinaturas`);
}

