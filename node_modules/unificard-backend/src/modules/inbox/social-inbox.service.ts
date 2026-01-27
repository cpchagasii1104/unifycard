// src/modules/inbox/social-inbox.service.ts
// Service do Domínio de INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
// 🔴 BLINDAGEM: Inbox NÃO decide nada
// 🔴 BLINDAGEM: Inbox NÃO cria ação automática
// 🔴 BLINDAGEM: Inbox apenas ORGANIZA o que já aconteceu

import { socialInboxRepository } from './social-inbox.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import type {
  SocialInboxItem,
  SocialInboxFilters,
  InboxCounter,
} from './social-inbox.types';
import { InboxItemStatus } from './social-inbox.types';

class SocialInboxService {
  /**
   * Busca items do inbox de um actor
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   */
  async getInboxItems(
    tenantId: string,
    actorId: string,
    filters?: Partial<SocialInboxFilters>
  ): Promise<SocialInboxItem[]> {
    // 🔴 BLINDAGEM: Validar que actor existe
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new NotFoundError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Buscar items do inbox (apenas organização, não decisão)
    return await socialInboxRepository.find(tenantId, {
      actorId,
      status: filters?.status,
      sourceType: filters?.sourceType,
    });
  }

  /**
   * Busca contador de inbox de um actor
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   */
  async getInboxCounter(tenantId: string, actorId: string): Promise<InboxCounter> {
    // 🔴 BLINDAGEM: Validar que actor existe
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new NotFoundError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Calcular contador (apenas organização, não decisão)
    return await socialInboxRepository.getCounter(tenantId, actorId);
  }

  /**
   * Marca item do inbox como lido
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   * 🔴 BLINDAGEM: NÃO cria ação automática
   */
  async markAsRead(
    tenantId: string,
    inboxItemId: string,
    userId: string
  ): Promise<SocialInboxItem> {
    // 🔴 BLINDAGEM: Validar que item existe
    const item = await socialInboxRepository.findById(tenantId, inboxItemId);
    if (!item) {
      throw new NotFoundError('Item do inbox não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que usuário tem acesso ao actor destinatário
    // Por enquanto, permitimos que qualquer usuário autenticado marque como lido
    // (validação de ownership pode ser implementada quando necessário)

    // 🔴 BLINDAGEM: Atualizar status (apenas organização, não decisão)
    return await socialInboxRepository.updateStatus(tenantId, inboxItemId, InboxItemStatus.READ);
  }

  /**
   * Arquivar item do inbox
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   * 🔴 BLINDAGEM: NÃO cria ação automática
   */
  async archive(
    tenantId: string,
    inboxItemId: string,
    userId: string
  ): Promise<SocialInboxItem> {
    // 🔴 BLINDAGEM: Validar que item existe
    const item = await socialInboxRepository.findById(tenantId, inboxItemId);
    if (!item) {
      throw new NotFoundError('Item do inbox não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que usuário tem acesso ao actor destinatário
    // Por enquanto, permitimos que qualquer usuário autenticado arquive
    // (validação de ownership pode ser implementada quando necessário)

    // 🔴 BLINDAGEM: Atualizar status (apenas organização, não decisão)
    return await socialInboxRepository.updateStatus(tenantId, inboxItemId, InboxItemStatus.ARCHIVED);
  }
}

export const socialInboxService = new SocialInboxService();

