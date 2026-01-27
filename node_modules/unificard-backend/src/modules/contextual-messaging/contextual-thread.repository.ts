// backend/src/modules/contextual-messaging/contextual-thread.repository.ts
// Repository para Threads e Mensagens Contextuais
// 🔴 BLINDAGEM: NÃO toma decisões automáticas

import { runQueryWithTenant } from '@core/database/pool';
import type {
  ContextualThread,
  ContextualMessage,
  CreateContextualThreadInput,
  SendContextualMessageInput,
  ContextualThreadFilters,
} from './contextual-thread.types';

interface ContextualThreadRow {
  thread_id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  title: string | null;
  participant_actor_ids: string[];
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface ContextualMessageRow {
  message_id: string;
  thread_id: string;
  tenant_id: string;
  sender_actor_id: string;
  sender_user_id: string | null;
  content: string;
  metadata: any;
  created_at: Date;
}

class ContextualThreadRepository {
  private toThread(row: ContextualThreadRow): ContextualThread {
    return {
      threadId: row.thread_id,
      tenantId: row.tenant_id,
      contextType: row.context_type as any,
      contextId: row.context_id,
      title: row.title,
      participantActorIds: row.participant_actor_ids,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMessage(row: ContextualMessageRow): ContextualMessage {
    return {
      messageId: row.message_id,
      threadId: row.thread_id,
      tenantId: row.tenant_id,
      senderActorId: row.sender_actor_id,
      senderUserId: row.sender_user_id,
      content: row.content,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Criar nova thread contextual
   */
  async createThread(
    tenantId: string,
    input: CreateContextualThreadInput
  ): Promise<ContextualThread> {
    const row = await runQueryWithTenant<ContextualThreadRow>(
      tenantId,
      `
      INSERT INTO contextual_threads (
        tenant_id, context_type, context_id, title, participant_actor_ids, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING thread_id, tenant_id, context_type, context_id, title, 
                participant_actor_ids, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.contextType,
        input.contextId,
        input.title || null,
        input.participantActorIds,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar thread contextual');
    }

    return this.toThread(row);
  }

  /**
   * Buscar thread por ID
   */
  async findThreadById(tenantId: string, threadId: string): Promise<ContextualThread | null> {
    const row = await runQueryWithTenant<ContextualThreadRow>(
      tenantId,
      `
      SELECT thread_id, tenant_id, context_type, context_id, title, 
             participant_actor_ids, metadata, created_at, updated_at
      FROM contextual_threads
      WHERE tenant_id = $1 AND thread_id = $2
      `,
      [tenantId, threadId]
    );

    return row ? this.toThread(row) : null;
  }

  /**
   * Buscar thread por contexto
   */
  async findThreadByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<ContextualThread | null> {
    const row = await runQueryWithTenant<ContextualThreadRow>(
      tenantId,
      `
      SELECT thread_id, tenant_id, context_type, context_id, title, 
             participant_actor_ids, metadata, created_at, updated_at
      FROM contextual_threads
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [tenantId, contextType, contextId]
    );

    return row ? this.toThread(row) : null;
  }

  /**
   * Listar threads com filtros
   */
  async findThreads(
    tenantId: string,
    filters: ContextualThreadFilters = {}
  ): Promise<{ threads: ContextualThread[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex++}`);
      params.push(filters.contextType);
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex++}`);
      params.push(filters.contextId);
    }

    if (filters.participantActorId) {
      conditions.push(`$${paramIndex++} = ANY(participant_actor_ids)`);
      params.push(filters.participantActorId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total
    const countRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM contextual_threads
      ${whereClause}
      `,
      params
    );

    const total = parseInt(countRow?.count || '0', 10);

    // Buscar threads
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant<ContextualThreadRow>(
      tenantId,
      `
      SELECT thread_id, tenant_id, context_type, context_id, title, 
             participant_actor_ids, metadata, created_at, updated_at
      FROM contextual_threads
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
      [...params, limit, offset]
    );

    return {
      threads: rows.map((row) => this.toThread(row)),
      total,
    };
  }

  /**
   * Adicionar participante à thread
   */
  async addParticipant(
    tenantId: string,
    threadId: string,
    actorId: string
  ): Promise<ContextualThread> {
    const row = await runQueryWithTenant<ContextualThreadRow>(
      tenantId,
      `
      UPDATE contextual_threads
      SET participant_actor_ids = array_append(participant_actor_ids, $3),
          updated_at = NOW()
      WHERE tenant_id = $1 AND thread_id = $2
        AND NOT ($3 = ANY(participant_actor_ids))
      RETURNING thread_id, tenant_id, context_type, context_id, title, 
                participant_actor_ids, metadata, created_at, updated_at
      `,
      [tenantId, threadId, actorId]
    );

    if (!row) {
      throw new Error('Thread não encontrada ou participante já existe');
    }

    return this.toThread(row);
  }

  /**
   * Criar mensagem em thread
   */
  async createMessage(
    tenantId: string,
    threadId: string,
    input: SendContextualMessageInput,
    senderActorId: string,
    senderUserId?: string | null
  ): Promise<ContextualMessage> {
    const row = await runQueryWithTenant<ContextualMessageRow>(
      tenantId,
      `
      INSERT INTO contextual_messages (
        thread_id, tenant_id, sender_actor_id, sender_user_id, content, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING message_id, thread_id, tenant_id, sender_actor_id, sender_user_id, 
                content, metadata, created_at
      `,
      [
        threadId,
        tenantId,
        senderActorId,
        senderUserId || null,
        input.content.trim(),
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar mensagem');
    }

    return this.toMessage(row);
  }

  /**
   * Listar mensagens de uma thread
   */
  async findMessages(
    tenantId: string,
    threadId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: ContextualMessage[]; total: number }> {
    // Contar total
    const countRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM contextual_messages
      WHERE tenant_id = $1 AND thread_id = $2
      `,
      [tenantId, threadId]
    );

    const total = parseInt(countRow?.count || '0', 10);

    // Buscar mensagens
    const rows = await runQueryWithTenant<ContextualMessageRow>(
      tenantId,
      `
      SELECT message_id, thread_id, tenant_id, sender_actor_id, sender_user_id, 
             content, metadata, created_at
      FROM contextual_messages
      WHERE tenant_id = $1 AND thread_id = $2
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4
      `,
      [tenantId, threadId, limit, offset]
    );

    return {
      messages: rows.map((row) => this.toMessage(row)),
      total,
    };
  }
}

export const contextualThreadRepository = new ContextualThreadRepository();




