// backend/src/modules/live-chat/chat.service.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { chatRoomRepository } from './chat-room.repository';
import { chatMessageRepository } from './chat-message.repository';
import { chatBlockRepository } from './chat-block.repository';
import { chatReportRepository } from './chat-report.repository';
import { policyRegistry } from '@core/policy/policy-registry';
import type {
  ChatRoom,
  ChatMessage,
  ChatBlock,
  ChatReport,
  SendMessageInput,
  BlockContactInput,
  ReportContactInput,
  PresenceContextType,
} from './live-chat.types';

class ChatService {
  async getOrCreateRoom(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<ChatRoom> {
    return await chatRoomRepository.getOrCreateRoom(tenantId, contextType, contextId, 'PUBLIC');
  }

  async sendMessage(tenantId: string, input: SendMessageInput): Promise<ChatMessage> {
    // 1. Verificar se live chat está habilitado
    const enabled = policyRegistry.getPolicyValue<boolean>('live_chat', 'enabled', true);
    if (enabled === false) {
      throw new Error('Chat ao vivo está desabilitado');
    }

    // 2. Rate limit
    const msgPerMinute = policyRegistry.getPolicyValue<number>('live_chat', 'msg_per_minute', 20) ?? 20;
    const messagesInWindow = await chatMessageRepository.countMessagesInWindow(
      tenantId,
      input.contactId,
      1 // última 1 minuto
    );

    if (messagesInWindow >= msgPerMinute) {
      throw new Error(`Limite de mensagens excedido (${msgPerMinute} por minuto)`);
    }

    // 3. Validar tamanho da mensagem
    const maxLength = policyRegistry.getPolicyValue<number>('live_chat', 'max_message_length', 280) ?? 280;
    if (input.content.length > maxLength) {
      throw new Error(`Mensagem muito longa (máximo ${maxLength} caracteres)`);
    }

    // 4. Criar mensagem (idempotente)
    const message = await chatMessageRepository.createMessage(
      tenantId,
      input.roomId,
      input.contactId,
      input.content,
      input.clientMessageId || null
    );

    await this.recordAudit(tenantId, {
      eventType: 'CHAT_MESSAGE_SENT',
      messageId: message.id,
      roomId: input.roomId,
      contactId: input.contactId,
    });

    return message;
  }

  async listMessages(
    tenantId: string,
    roomId: string,
    viewerContactId: string,
    cursor: string | null = null,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    // Buscar contatos bloqueados pelo viewer
    const blockedContactIds = await chatBlockRepository.listBlockedContacts(tenantId, viewerContactId);

    return await chatMessageRepository.listMessages(tenantId, roomId, cursor, limit, blockedContactIds);
  }

  async deleteOwnMessage(tenantId: string, messageId: string, contactId: string): Promise<void> {
    await chatMessageRepository.deleteMessage(tenantId, messageId, contactId);

    await this.recordAudit(tenantId, {
      eventType: 'CHAT_MESSAGE_DELETED',
      messageId,
      contactId,
    });
  }

  async blockContact(tenantId: string, input: BlockContactInput): Promise<ChatBlock> {
    const block = await chatBlockRepository.createBlock(
      tenantId,
      input.blockerContactId,
      input.blockedContactId,
      input.contextType,
      input.contextId
    );

    await this.recordAudit(tenantId, {
      eventType: 'CHAT_BLOCK_CREATED',
      blockId: block.id,
      blockerContactId: input.blockerContactId,
      blockedContactId: input.blockedContactId,
      contextType: input.contextType,
      contextId: input.contextId,
    });

    return block;
  }

  async reportContact(tenantId: string, input: ReportContactInput): Promise<ChatReport> {
    const report = await chatReportRepository.createReport(
      tenantId,
      input.reporterContactId,
      input.reportedContactId,
      input.roomId,
      input.messageId || null,
      input.reasonCode,
      input.details || null
    );

    await this.recordAudit(tenantId, {
      eventType: 'CHAT_REPORT_CREATED',
      reportId: report.id,
      reporterContactId: input.reporterContactId,
      reportedContactId: input.reportedContactId,
      roomId: input.roomId,
      messageId: input.messageId,
      reasonCode: input.reasonCode,
    });

    return report;
  }

  async archiveRoom(tenantId: string, roomId: string): Promise<void> {
    await chatRoomRepository.archiveRoom(tenantId, roomId);

    await this.recordAudit(tenantId, {
      eventType: 'CHAT_ROOM_ARCHIVED',
      roomId,
    });
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.event_type ?? data.eventType ?? 'CHAT_ACTION',
        severity: 'low',
        source: 'chat',
        context: data,
      });
    } catch (error) {
      console.warn('[ChatService] Erro ao registrar auditoria:', error);
    }
  }
}

export const chatService = new ChatService();





