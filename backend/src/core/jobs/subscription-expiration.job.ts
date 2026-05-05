/**
 * STATUS: CÓDIGO LATENTE — classificado em 2026-05-04 (Hipótese #019)
 *
 * Funcional mas não integrado: processa expiração de assinaturas
 * (organizerBillingService.processExpirations) sem scheduler que o invoque.
 *
 * Categoria da fase de reconstrução do sistema. Não é erro nem código morto —
 * é funcionalidade válida aguardando reintegração.
 *
 * Débito conhecido: core → modules (inversão de dependência).
 * Resolução depende da arquitetura de jobs.
 *
 * PROIBIÇÕES: não mover, não deletar, não integrar sem decisão formal.
 *
 * Detalhes: docs/decisions/CODIGO_LATENTE_REGISTRY.md#subscription-expirationjob
 */

import { organizerBillingService } from '../../modules/events/organizers/organizer-billing.service';
import { pool } from '@core/database/pool';

/**
 * Processa expirações de assinaturas para todos os tenants
 */
export async function processSubscriptionExpirations(): Promise<void> {
  // Buscar todos os tenants ativos (usando pool direto, sem tenant context)
  const result = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM tenants
    `
  );

  let totalExpired = 0;

  for (const tenant of result.rows) {
    try {
      const expired = await organizerBillingService.processExpirations(tenant.id);
      totalExpired += expired;
    } catch (error) {
      console.error(`Erro ao processar expirações para tenant ${tenant.id}:`, error);
    }
  }

  console.log(`Processadas ${totalExpired} expirações de assinaturas`);
}

