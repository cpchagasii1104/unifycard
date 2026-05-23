// backend/src/core/events/idempotency-tracker.ts
// Event-handler idempotency tracking (§4.12.1)

import { runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { createHash } from 'crypto';

export type IdempotencyResultStatus = 'success' | 'error' | 'skipped';

/** Same (tenant, event_id, handler) with a different payload hash — fail-closed (no re-execution). */
export class IdempotencyMismatchError extends Error {
  readonly code = 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';

  constructor(
    message: string,
    public readonly details?: {
      tenantId: string;
      eventId: string;
      handlerName: string;
      existingKeyPrefix?: string;
      newKeyPrefix?: string;
    }
  ) {
    super(message);
    this.name = 'IdempotencyMismatchError';
    Object.setPrototypeOf(this, IdempotencyMismatchError.prototype);
  }
}

/** Mensagem pública para resposta HTTP 409 (contrato API). */
export const IDEMPOTENCY_MISMATCH_HTTP_MESSAGE =
  'Request with same idempotency key but different payload';

export function isIdempotencyMismatchError(
  err: unknown
): err is IdempotencyMismatchError {
  return err instanceof IdempotencyMismatchError;
}

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
 * Verifica se evento já foi processado por um handler específico.
 * Retorna tracking existente se encontrado e o hash do payload coincidir; null se não houver linha.
 * Lança {@link IdempotencyMismatchError} se já existir linha para o mesmo handler com outro payload.
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
        processed_at as "processedAt",
        result_status as "resultStatus",
        result_data as "resultData",
        error_message as "errorMessage",
        created_at as "createdAt"
      FROM event_idempotency_tracking
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
      LIMIT 1
    `,
    [tenantId, eventId, handlerName]
  );
  
  if (!result) {
    return null;
  }
  
  // Verificar se idempotency key corresponde (payload não mudou)
  const existing = result;
  if (existing.idempotencyKey !== idempotencyKey) {
    canonicalLogger.warn(null, 'Idempotency key mismatch — fail-closed (no re-execution)', {
      tenantId,
      eventId,
      handlerName,
      existingKey: existing.idempotencyKey.substring(0, 32),
      newKey: idempotencyKey.substring(0, 32),
    });
    throw new IdempotencyMismatchError(
      'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: same event+handler already processed with a different payload hash',
      {
        tenantId,
        eventId,
        handlerName,
        existingKeyPrefix: existing.idempotencyKey.substring(0, 16),
        newKeyPrefix: idempotencyKey.substring(0, 16),
      }
    );
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
        processed_at
      )
      VALUES ($1, $2, $3, $4, $5, 'success', $6, NOW())
      ON CONFLICT (tenant_id, event_id, handler_name)
      DO UPDATE SET
        result_status = 'success',
        result_data = EXCLUDED.result_data,
        processed_at = NOW()
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
        processed_at
      )
      VALUES ($1, $2, $3, $4, $5, 'error', $6, NOW())
      ON CONFLICT (tenant_id, event_id, handler_name)
      DO UPDATE SET
        result_status = 'error',
        error_message = EXCLUDED.error_message,
        processed_at = NOW()
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
      SET processed_at = NOW()
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
    `,
    [tenantId, eventId, handlerName]
  );
}

/**
 * Wrapper para handlers críticos que garante idempotência.
 *
 * Norma: docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.12.1 (formato canónico
 * `${event_type}:${reference_id}:${handler_name}` em semântica; payload estável para hash).
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


