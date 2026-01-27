// backend/src/core/pilot/pilot-invites.service.ts
// SPRINT 14: Service para convites do modo piloto

import { pilotInvitesRepository, type PilotInvite, type CreatePilotInviteInput } from './pilot-invites.repository';

/**
 * Verifica se modo piloto está ativo
 */
function isPilotMode(): boolean {
  return process.env.PILOT_MODE === 'true';
}

class PilotInvitesService {
  /**
   * Verifica se email tem convite válido
   */
  async hasValidInvite(
    tenantId: string,
    email: string
  ): Promise<boolean> {
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Em modo piloto, registro requer convite (exceção ao fluxo normal de registro)
     * Contexto: Sistema em fase de piloto fechado
     * Tipo: estrutural (condicional ao PILOT_MODE)
     */
    if (!isPilotMode()) {
      // Se modo piloto não está ativo, permitir registro (comportamento padrão)
      return true;
    }

    const invite = await pilotInvitesRepository.findPendingByEmail(tenantId, email);
    return invite !== null;
  }

  /**
   * Cria um novo convite
   * Apenas funciona se PILOT_MODE=true
   */
  async createInvite(
    tenantId: string,
    input: CreatePilotInviteInput
  ): Promise<PilotInvite> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotInvitesRepository.create(tenantId, input);
  }

  /**
   * Marca convite como aceito (quando usuário se registra)
   */
  async acceptInvite(
    tenantId: string,
    email: string
  ): Promise<PilotInvite | null> {
    if (!isPilotMode()) {
      return null;
    }

    return await pilotInvitesRepository.markAsAccepted(tenantId, email);
  }

  /**
   * Revoga convite
   */
  async revokeInvite(
    tenantId: string,
    inviteId: string
  ): Promise<PilotInvite | null> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotInvitesRepository.revoke(tenantId, inviteId);
  }

  /**
   * Lista convites
   */
  async listInvites(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: 'pending' | 'accepted' | 'revoked' | 'expired';
    }
  ): Promise<PilotInvite[]> {
    if (!isPilotMode()) {
      return [];
    }

    return await pilotInvitesRepository.list(tenantId, options);
  }

  /**
   * Marca convites expirados
   */
  async markExpiredInvites(tenantId: string): Promise<number> {
    if (!isPilotMode()) {
      return 0;
    }

    return await pilotInvitesRepository.markExpired(tenantId);
  }
}

export const pilotInvitesService = new PilotInvitesService();

