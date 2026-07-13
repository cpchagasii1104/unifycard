// FASE C — CASA ÚNICA do writer canônico actor-territorial.
// ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING.
//
// Única forma autorizada de criar/substituir/encerrar o endereço territorial actor-scoped
// (address_assignments.owner_type='actor'). Autoridade server-side, tenant server-side, transação atômica,
// idempotência (two-phase inline em idempotency_keys, atômica com a mutação), concorrência por advisory lock,
// histórico preservado (encerra anterior + cria novo; nunca DELETE/UPDATE in-place), evento append-only em
// actor_events. Sem CEP/provider, sem findOrCreate, sem fallback textual, sem rota/frontend, sem Bank/Social.

import { createHash } from 'crypto';
import { getClientWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import type { ActorTerritorialPurpose } from './actor-territorial-resolver';
import {
  createTerritorialAddress,
  retirePriorActorPrimary,
  insertActorAssignment,
  insertTerritorialEvent,
  type TerritorialAddressInput,
  type ActorTerritorialRole,
} from './actor-territorial-address.repository';

const PURPOSE_ROLE: Record<ActorTerritorialPurpose, ActorTerritorialRole> = {
  ACTOR_RESIDENCE: 'RESIDENCE',
  ACTOR_OPERATIONAL: 'OPERATIONAL',
  ACTOR_FISCAL_HQ: 'HQ',
};

/** Contexto autenticado — SEMPRE server-side. Nunca vem do body do cliente. */
export interface ActorTerritorialAuthContext {
  tenantId: string;
  operatorUserId: string;
}

export interface SetActorTerritorialAddressInput {
  actorId: string;
  purpose: ActorTerritorialPurpose;
  address: TerritorialAddressInput;
  idempotencyKey: string;
}

export interface RetireActorTerritorialAddressInput {
  actorId: string;
  purpose: ActorTerritorialPurpose;
  idempotencyKey: string;
}

export interface ActorTerritorialWriteResult {
  operation: 'set' | 'replaced' | 'retired' | 'retire_noop';
  actorId: string;
  role: ActorTerritorialRole;
  assignmentId: string | null;
  addressId: string | null;
  previousAssignmentId: string | null;
  replayed: boolean;
}

export class ActorTerritorialAuthorityError extends Error {}
export class ActorTerritorialConflictError extends Error {}
export class ActorTerritorialValidationError extends Error {}

function idemKey(parts: string[]): string {
  return 'atr:' + parts.join(':');
}
function requestHash(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
}

// Prova de autoridade — NUNCA engolida. Erro de infra propaga (não vira false/deny silencioso).
async function assertRepresentable(tenantId: string, operatorUserId: string, actorId: string): Promise<void> {
  const representable = await authorizationService.canRepresentActor(tenantId, operatorUserId, actorId);
  if (!representable) throw new ActorTerritorialAuthorityError('ACTOR_TERRITORIAL_NOT_REPRESENTABLE');
}

/**
 * Cria ou substitui o endereço territorial vigente do Actor para o purpose. Atômico, idempotente,
 * fail-closed. Substituição encerra o primary anterior e cria o novo (histórico preservado).
 */
export async function setActorTerritorialAddress(
  auth: ActorTerritorialAuthContext,
  input: SetActorTerritorialAddressInput,
): Promise<ActorTerritorialWriteResult> {
  const role = PURPOSE_ROLE[input.purpose];
  if (!role) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_PURPOSE_UNKNOWN');
  if (!input.idempotencyKey) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_IDEMPOTENCY_REQUIRED');
  if (!input.address || !input.address.countryId) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_COUNTRY_REQUIRED');

  // autoridade ANTES da transação (a re-validação tenant-bound do Actor ocorre dentro da tx contra RLS)
  await assertRepresentable(auth.tenantId, auth.operatorUserId, input.actorId);

  const key = idemKey([input.actorId, input.purpose, 'set', input.idempotencyKey]);
  const rHash = requestHash({ actorId: input.actorId, purpose: input.purpose, op: 'set', address: input.address });

  const client = await getClientWithTenant(auth.tenantId);
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [auth.tenantId, `${input.actorId}:${role}`]);

    // idempotência two-phase (atômica): claim 'processing'
    const claim = await client.query(
      `INSERT INTO idempotency_keys (tenant_id, key, status, response_payload)
       VALUES ($1, $2, 'processing', $3::jsonb) ON CONFLICT (tenant_id, key) DO NOTHING`,
      [auth.tenantId, key, JSON.stringify({ requestHash: rHash })],
    );
    if (claim.rowCount === 0) {
      const prior = await client.query<{ status: string; response_payload: any }>(
        'SELECT status, response_payload FROM idempotency_keys WHERE tenant_id = $1 AND key = $2',
        [auth.tenantId, key],
      );
      await client.query('ROLLBACK');
      const row = prior.rows[0];
      if (row && row.status === 'completed') {
        if (row.response_payload?.requestHash !== rHash) throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IDEMPOTENCY_PAYLOAD_MISMATCH');
        return { ...(row.response_payload.result as ActorTerritorialWriteResult), replayed: true };
      }
      throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IN_PROGRESS');
    }

    // re-validação tenant-bound do Actor sob RLS (TOCTOU): existe e visível no tenant real
    const actor = await client.query<{ actor_type: string }>('SELECT actor_type FROM actors WHERE id = $1', [input.actorId]);
    if (actor.rows.length === 0) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_ACTOR_NOT_FOUND');

    const addressId = await createTerritorialAddress(client, input.address, auth.tenantId);
    const prev = await retirePriorActorPrimary(client, input.actorId, role);
    const assignmentId = await insertActorAssignment(client, input.actorId, addressId, role);

    const result: ActorTerritorialWriteResult = {
      operation: prev ? 'replaced' : 'set',
      actorId: input.actorId,
      role,
      assignmentId,
      addressId,
      previousAssignmentId: prev?.assignmentId ?? null,
      replayed: false,
    };
    await insertTerritorialEvent(client, {
      tenantId: auth.tenantId,
      actorId: input.actorId,
      eventType: prev ? 'actor_territorial_address_replaced' : 'actor_territorial_address_set',
      referenceId: assignmentId,
      metadata: {
        purpose: input.purpose, role, operatorUserId: auth.operatorUserId,
        previousAssignmentId: prev?.assignmentId ?? null, previousAddressId: prev?.addressId ?? null,
        newAddressId: addressId, idempotencyKey: input.idempotencyKey,
      },
    });

    await client.query(
      `UPDATE idempotency_keys SET status = 'completed', response_payload = $3::jsonb WHERE tenant_id = $1 AND key = $2`,
      [auth.tenantId, key, JSON.stringify({ requestHash: rHash, result })],
    );
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* já revertido */ }
    throw err;
  } finally {
    client.release();
  }
}

/** Encerra o endereço territorial vigente do Actor para o purpose. Idempotente; no-op governado se não houver. */
export async function retireActorTerritorialAddress(
  auth: ActorTerritorialAuthContext,
  input: RetireActorTerritorialAddressInput,
): Promise<ActorTerritorialWriteResult> {
  const role = PURPOSE_ROLE[input.purpose];
  if (!role) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_PURPOSE_UNKNOWN');
  if (!input.idempotencyKey) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_IDEMPOTENCY_REQUIRED');

  await assertRepresentable(auth.tenantId, auth.operatorUserId, input.actorId);

  const key = idemKey([input.actorId, input.purpose, 'retire', input.idempotencyKey]);
  const rHash = requestHash({ actorId: input.actorId, purpose: input.purpose, op: 'retire' });

  const client = await getClientWithTenant(auth.tenantId);
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [auth.tenantId, `${input.actorId}:${role}`]);

    const claim = await client.query(
      `INSERT INTO idempotency_keys (tenant_id, key, status, response_payload)
       VALUES ($1, $2, 'processing', $3::jsonb) ON CONFLICT (tenant_id, key) DO NOTHING`,
      [auth.tenantId, key, JSON.stringify({ requestHash: rHash })],
    );
    if (claim.rowCount === 0) {
      const prior = await client.query<{ status: string; response_payload: any }>(
        'SELECT status, response_payload FROM idempotency_keys WHERE tenant_id = $1 AND key = $2',
        [auth.tenantId, key],
      );
      await client.query('ROLLBACK');
      const row = prior.rows[0];
      if (row && row.status === 'completed') {
        if (row.response_payload?.requestHash !== rHash) throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IDEMPOTENCY_PAYLOAD_MISMATCH');
        return { ...(row.response_payload.result as ActorTerritorialWriteResult), replayed: true };
      }
      throw new ActorTerritorialConflictError('ACTOR_TERRITORIAL_IN_PROGRESS');
    }

    const actor = await client.query<{ actor_type: string }>('SELECT actor_type FROM actors WHERE id = $1', [input.actorId]);
    if (actor.rows.length === 0) throw new ActorTerritorialValidationError('ACTOR_TERRITORIAL_ACTOR_NOT_FOUND');

    const prev = await retirePriorActorPrimary(client, input.actorId, role);
    const result: ActorTerritorialWriteResult = {
      operation: prev ? 'retired' : 'retire_noop',
      actorId: input.actorId,
      role,
      assignmentId: null,
      addressId: null,
      previousAssignmentId: prev?.assignmentId ?? null,
      replayed: false,
    };
    if (prev) {
      await insertTerritorialEvent(client, {
        tenantId: auth.tenantId,
        actorId: input.actorId,
        eventType: 'actor_territorial_address_retired',
        referenceId: prev.assignmentId,
        metadata: { purpose: input.purpose, role, operatorUserId: auth.operatorUserId, retiredAssignmentId: prev.assignmentId, idempotencyKey: input.idempotencyKey },
      });
    }
    await client.query(
      `UPDATE idempotency_keys SET status = 'completed', response_payload = $3::jsonb WHERE tenant_id = $1 AND key = $2`,
      [auth.tenantId, key, JSON.stringify({ requestHash: rHash, result })],
    );
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* já revertido */ }
    throw err;
  } finally {
    client.release();
  }
}
