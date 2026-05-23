// backend/src/modules/live-chat/chat-report.repository.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { runQueryWithTenant } from '@core/database/pool';
import type {
  ChatReport,
  ChatReportReason,
} from './live-chat.types';

interface ChatReportRow {
  id: string;
  tenant_id: string;
  reporter_contact_id: string;
  reported_contact_id: string;
  room_id: string;
  message_id: string | null;
  reason_code: string;
  details: string | null;
  status: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class ChatReportRepository {
  private toChatReport(row: ChatReportRow): ChatReport {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      reporterContactId: row.reporter_contact_id,
      reportedContactId: row.reported_contact_id,
      roomId: row.room_id,
      messageId: row.message_id,
      reasonCode: row.reason_code as ChatReportReason,
      details: row.details,
      status: row.status as any,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createReport(
    tenantId: string,
    reporterContactId: string,
    reportedContactId: string,
    roomId: string,
    messageId: string | null,
    reasonCode: ChatReportReason,
    details: string | null
  ): Promise<ChatReport> {
    const row = await runQueryWithTenant<ChatReportRow>(
      tenantId,
      `
      INSERT INTO chat_reports (
        tenant_id, reporter_contact_id, reported_contact_id, room_id, message_id,
        reason_code, details, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', '{}'::jsonb)
      RETURNING id, tenant_id, reporter_contact_id, reported_contact_id, room_id, message_id,
                reason_code, details, status, metadata, created_at, updated_at
      `,
      [tenantId, reporterContactId, reportedContactId, roomId, messageId, reasonCode, details]
    );

    if (!row) {
      throw new Error('Erro ao criar denúncia');
    }

    return this.toChatReport(row);
  }
}

export const chatReportRepository = new ChatReportRepository();







