// backend/src/core/events/idempotency-tracker.ts
// Sistema de tracking de idempotência para eventos críticos

import { runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { createHash } from 'crypto';

export type IdempotencyResultStatus = 'success' | 'error' | 'skipped';

export interface IdempotencyTracking {
  id: number;
  tenantId: string;
  eventId: string;
  eventType: string;
  handlerName: string;
  idempotencyKey: string;
  processedAt: Date;
  resultStatus: IdempotencyResultStatus;
  resultData?: any;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Gera chave de idempotência única para evento + handler + payload
 */
export function generateIdempotencyKey(
  eventId: string,
  handlerName: string,
  payload: any
): string {
  // Gerar hash do payload para detectar mudanças
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `${eventId}:${handlerName}:${payloadHash}`;
}

/**
 * Verifica se evento já foi processado por um handler específico
 * Retorna tracking existente se encontrado, null caso contrário
 */
export async function checkIdempotency(
  tenantId: string,
  eventId: string,
  handlerName: string,
  payload: any
): Promise<IdempotencyTracking | null> {
  const idempotencyKey = generateIdempotencyKey(eventId, handlerName, payload);
  
  const result = await runQueryWithTenant<IdempotencyTracking>(
    tenantId,
    `
      SELECT 
        id,
        tenant_id as "tenantId",
        event_id as "eventId",
        event_type as "eventType",
        handler_name as "handlerName",
        idempotency_key as "idempotencyKey",
        processedAt as "processedAt",
        result_status as "resultStatus",
        result_data as "resultData",
        error_message as "errorMessage",
        createdAt as "createdAt"
      FROM event_idempotency_tracking
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
      LIMIT 1
    `,
    [tenantId, eventId, handlerName]
  );
  
  if (!result || result.length === 0) {
    return null;
  }
  
  // Verificar se idempotency key corresponde (payload não mudou)
  const existing = result[0];
  if (existing.idempotencyKey !== idempotencyKey) {
    // Payload mudou - não é replay, mas pode ser tentativa de violação
    canonicalLogger.warn(null, 'Payload mudou para evento já processado', {
      tenantId,
      eventId,
      handlerName,
      existingKey: existing.idempotencyKey,
      newKey: idempotencyKey,
    });
    return null; // Permitir processamento (mas logar warning)
  }
  
  return existing;
}

/**
 * Registra processamento de evento (sucesso)
 */
export async function recordIdempotencySuccess(
  tenantId: string,
  eventId: string,
  eventType: string,
  handlerName: string,
  payload: any,
  resultData?: any
): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(eventId, handlerName, payload);
  
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO event_idempotency_tracking (
        tenant_id,
        event_id,
        event_type,
        handler_name,
        idempotency_key,
        result_status,
        result_data,
        processedAt
      )
      VALUES ($1, $2, $3, $4, $5, 'success', $6, NOW())
      ON CONFLICT (tenant_id, event_id, handler_name)
      DO UPDATE SET
        result_status = 'success',
        result_data = EXCLUDED.result_data,
        processedAt = NOW()
    `,
    [tenantId, eventId, eventType, handlerName, idempotencyKey, resultData ? JSON.stringify(resultData) : null]
  );
}

/**
 * Registra processamento de evento (erro)
 */
export async function recordIdempotencyError(
  tenantId: string,
  eventId: string,
  eventType: string,
  handlerName: string,
  payload: any,
  error: Error
): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(eventId, handlerName, payload);
  
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO event_idempotency_tracking (
        tenant_id,
        event_id,
        event_type,
        handler_name,
        idempotency_key,
        result_status,
        error_message,
        processedAt
      )
      VALUES ($1, $2, $3, $4, $5, 'error', $6, NOW())
      ON CONFLICT (tenant_id, event_id, handler_name)
      DO UPDATE SET
        result_status = 'error',
        error_message = EXCLUDED.error_message,
        processedAt = NOW()
    `,
    [tenantId, eventId, eventType, handlerName, idempotencyKey, error.message]
  );
}

/**
 * Registra replay detectado (evento já processado)
 */
export async function recordIdempotencyReplay(
  tenantId: string,
  eventId: string,
  eventType: string,
  handlerName: string,
  payload: any,
  existingTracking: IdempotencyTracking
): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(eventId, handlerName, payload);
  
  // Log canônico de replay detectado
  canonicalLogger.abuse(null, 'REPLAY DETECTADO: Evento já processado', {
    tenantId,
    eventId,
    eventType,
    handlerName,
    idempotencyKey,
    previousStatus: existingTracking.resultStatus,
    previousProcessedAt: existingTracking.processedAt,
    timestamp: new Date().toISOString(),
  });
  
  // Atualizar tracking para marcar como replay
  await runQueryWithTenant(
    tenantId,
    `
      UPDATE event_idempotency_tracking
      SET processedAt = NOW()
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
    `,
    [tenantId, eventId, handlerName]
  );
}

/**
 * Wrapper para handlers críticos que garante idempotência
 */
export async function withIdempotency<T>(
  tenantId: string,
  eventId: string,
  eventType: string,
  handlerName: string,
  payload: any,
  handler: () => Promise<T>
): Promise<T> {
  // Verificar se já foi processado
  const existing = await checkIdempotency(tenantId, eventId, handlerName, payload);
  
  if (existing) {
    // Replay detectado
    await recordIdempotencyReplay(tenantId, eventId, eventType, handlerName, payload, existing);
    
    // Se foi sucesso anterior, retornar resultado (se disponível)
    if (existing.resultStatus === 'success' && existing.resultData) {
      return existing.resultData as T;
    }
    
    // Se foi erro anterior, lançar erro novamente (ou retornar null dependendo do caso)
    if (existing.resultStatus === 'error') {
      throw new Error(`Event already processed with error: ${existing.errorMessage || 'Unknown error'}`);
    }
    
    // Se foi skipped, retornar null (replay)
    return null as T;
  }
  
  // Processar evento
  try {
    const result = await handler();
    
    // Registrar sucesso
    await recordIdempotencySuccess(tenantId, eventId, eventType, handlerName, payload, result);
    
    return result;
  } catch (error) {
    // Registrar erro
    await recordIdempotencyError(
      tenantId,
      eventId,
      eventType,
      handlerName,
      payload,
      error instanceof Error ? error : new Error(String(error))
    );
    
    throw error;
  }
}


