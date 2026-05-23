// backend/src/core/pilot/pilot-friction.job.ts
// SPRINT 14: Job para marcar convites expirados e gerar eventos de fricção

import { pilotInvitesRepository } from './pilot-invites.repository';
import { pilotEventsService } from './pilot-events.service';

/**
 * Verifica se modo piloto está ativo
 */
function isPilotMode(): boolean {
  return process.env.PILOT_MODE === 'true';
}

/**
 * Job para processar convites expirados e gerar eventos de fricção
 * Deve ser executado diariamente (cron ou scheduler)
 */
export async function processExpiredInvites(tenantId: string): Promise<{
  expiredCount: number;
  frictionEventsCreated: number;
}> {
  if (!isPilotMode()) {
    return { expiredCount: 0, frictionEventsCreated: 0 };
  }

  try {
    // 1. Marcar convites expirados
    const expiredCount = await pilotInvitesRepository.markExpired(tenantId);

    // 2. Buscar convites que foram marcados como expirados (pending > 7 dias)
    // Vamos buscar convites que expiraram recentemente (últimas 24h)
    const expiredInvites = await pilotInvitesRepository.list(tenantId, {
      status: 'expired',
      limit: 100,
    });

    // Filtrar apenas os que expiraram nas últimas 24h (para evitar duplicatas)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentlyExpired = expiredInvites.filter((invite) => {
      const expiredAt = new Date(invite.expiresAt);
      return expiredAt >= oneDayAgo && expiredAt <= now;
    });

    // 3. Gerar eventos de fricção para convites não usados
    let frictionEventsCreated = 0;
    for (const invite of recentlyExpired) {
      try {
        // Gerar evento invite_not_used
        // Nota: Não temos actorId aqui, então usamos o email como identificador
        // Mas o evento requer actorId - vamos usar um ID fictício baseado no email
        // Em produção, isso pode ser ajustado conforme necessário
        await pilotEventsService.recordEvent(tenantId, {
          eventType: 'invite_not_used',
          actorId: invite.inviteId, // Usando inviteId como identificador
          actorType: 'user', // Assumindo user
          metadata: {
            email: invite.email,
            invitedAt: invite.invitedAt.toISOString(),
            expiresAt: invite.expiresAt.toISOString(),
          },
        });
        frictionEventsCreated++;
      } catch (err) {
        // Erro silencioso - não quebrar processamento
        console.warn('[PilotFriction] Erro ao criar evento de fricção:', err);
      }
    }

    return {
      expiredCount,
      frictionEventsCreated,
    };
  } catch (error) {
    console.error('[PilotFriction] Erro ao processar convites expirados:', error);
    throw error;
  }
}

/**
 * Executa job para todos os tenants
 * Útil para execução manual ou cron
 */
export async function runPilotFrictionJob(): Promise<void> {
  if (!isPilotMode()) {
    console.log('[PilotFriction] Modo piloto não está ativo - job não executado');
    return;
  }

  try {
    // Buscar todos os tenants (simplificado - em produção pode ser mais complexo)
    const { pool } = await import('@core/database/pool');
    const result = await pool.query<{ id: string }>(
      'SELECT id FROM tenants'
    );

    let totalExpired = 0;
    let totalFrictions = 0;

    for (const row of result.rows) {
      try {
        const { expiredCount, frictionEventsCreated } = await processExpiredInvites(
          row.id
        );
        totalExpired += expiredCount;
        totalFrictions += frictionEventsCreated;
      } catch (err) {
        console.error(`[PilotFriction] Erro ao processar tenant ${row.id}:`, err);
      }
    }

    console.log('[PilotFriction] Job concluído:', {
      totalExpired,
      totalFrictions,
    });
  } catch (error) {
    console.error('[PilotFriction] Erro ao executar job:', error);
    throw error;
  }
}







