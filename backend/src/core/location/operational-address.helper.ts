// backend/src/core/location/operational-address.helper.ts
//
// PE-5-CARTÓRIO (DECISION-0050, 2026-05-26) — Cartório operacional de
// actor-unidade.
//
// Materializa a convenção canônica:
//
//   HQ jurídico:
//     address_assignments(
//       owner_type='company',
//       owner_id=<companies.company_id>,
//       role='HQ'
//     )
//
//   OPERATIONAL (unidade operacional de actor):
//     address_assignments(
//       owner_type='service_provider',  ← técnico, NÃO actor_type
//       owner_id=<actors.id>,
//       role='OPERATIONAL',
//       is_primary=true
//     )
//
// Regras inegociáveis:
//   - service_provider é owner_type TÉCNICO de endereço operacional;
//     NÃO é actor_type. Enum vivo de actors NÃO inclui service_provider.
//   - HQ NUNCA é fallback automático de OPERATIONAL (DECISION-0049).
//   - Sem backfill silencioso HQ → OPERATIONAL.
//   - Sem criar owner_type='actor' (decisão Clayton L_owner_1 = A).
//
// Esta fatia entrega APENAS o cartório (read + write + readiness).
// NÃO implementa resolver dinâmico (PE-5-RESOLVER, frente futura).
// NÃO bloqueia transação financeira (PE-5-RESOLVER plugará no
// risk-financial-gate quando habilitado).

import { pool, runQueryWithTenant } from '@core/database/pool';
import { locationRepository } from './location.repository';
import type { Address, CreateAddressInput, AddressAssignment } from './location.types';

export const PJ_OPERATIONAL_ADDRESS_REQUIRED = 'PJ_OPERATIONAL_ADDRESS_REQUIRED';
export const ACTOR_NOT_FOUND_OR_CROSS_TENANT = 'ACTOR_NOT_FOUND_OR_CROSS_TENANT';
export const OPERATIONAL_ADDRESS_ALREADY_EXISTS = 'OPERATIONAL_ADDRESS_ALREADY_EXISTS';

export type OperationalAddressMode = 'throw' | 'warn';

export interface OperationalAddressReadiness {
  hasOperational: boolean;
  actorId: string;
  message?: string;
}

export interface OperationalAssignmentWithAddress {
  assignment: AddressAssignment;
  address: Address;
}

/**
 * Lê o assignment ativo de OPERATIONAL para o actor.
 * Retorna `null` se ausente.
 *
 * Active = valid_until_at IS NULL (atual) E is_primary = true.
 *
 * Tenant-safe: a query NÃO restringe por tenant porque address_assignments
 * é global (sem tenant_id por design DECISION-0020). Mas o caller DEVE
 * validar previamente que o actor pertence ao tenant (vide
 * `createOperationalAddressForActor` que faz essa validação).
 */
async function getOperationalAddressForActor(
  _tenantId: string,
  actorId: string
): Promise<OperationalAssignmentWithAddress | null> {
  void _tenantId;
  const result = await pool.query<{
    assignment_id: string;
    owner_type: string;
    owner_id: string;
    address_id: string;
    role: string;
    is_primary: boolean;
    valid_from_at: Date;
    valid_until_at: Date | null;
    created_at: Date;
    updated_at: Date;
    // address columns (JOIN)
    country_id: string;
    state_id: string | null;
    city_id: string | null;
    neighborhood_id: string | null;
    postal_code: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    reference: string | null;
    source: string;
    is_geocoded: boolean;
    lat: string | null;
    lng: string | null;
    created_by_tenant_id: string | null;
  }>(
    `
    SELECT
      aa.assignment_id, aa.owner_type, aa.owner_id, aa.address_id, aa.role,
      aa.is_primary, aa.valid_from_at, aa.valid_until_at,
      aa.created_at, aa.updated_at,
      a.country_id, a.state_id, a.city_id, a.neighborhood_id,
      a.postal_code, a.street, a.number, a.complement, a.reference,
      a.source, a.is_geocoded, a.lat, a.lng, a.created_by_tenant_id
    FROM address_assignments aa
    JOIN addresses a ON a.address_id = aa.address_id
    WHERE aa.owner_type = 'service_provider'
      AND aa.owner_id = $1::uuid
      AND aa.role = 'OPERATIONAL'
      AND aa.valid_until_at IS NULL
      AND aa.is_primary = true
    LIMIT 1
    `,
    [actorId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    assignment: {
      id: row.assignment_id,
      ownerType: row.owner_type as any,
      ownerId: row.owner_id,
      addressId: row.address_id,
      role: row.role as any,
      isPrimary: row.is_primary,
      validFromAt: row.valid_from_at,
      validUntilAt: row.valid_until_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as AddressAssignment,
    address: {
      id: row.address_id,
      countryId: row.country_id,
      stateId: row.state_id,
      cityId: row.city_id,
      neighborhoodId: row.neighborhood_id,
      postalCode: row.postal_code,
      street: row.street,
      number: row.number,
      complement: row.complement,
      reference: row.reference,
      source: row.source as any,
      isGeocoded: row.is_geocoded,
      lat: row.lat != null ? parseFloat(row.lat) : null,
      lng: row.lng != null ? parseFloat(row.lng) : null,
      createdByTenantId: row.created_by_tenant_id,
    } as Address,
  };
}

/**
 * Verifica se actor tem OPERATIONAL ativo.
 *
 * mode='throw' → lança Error(PJ_OPERATIONAL_ADDRESS_REQUIRED) se ausente.
 * mode='warn'  → retorna `{ hasOperational, message? }` sem lançar.
 *
 * Quando PE-5-RESOLVER for habilitado, risk-financial-gate chamará este
 * helper com mode='throw' ANTES do cliente ser cobrado, para impedir
 * transação econômica regional dinâmica sem endereço operacional
 * cadastrado (anti-padrão "premiar cadastro incompleto").
 */
async function assertActorHasOperationalAddress(
  tenantId: string,
  actorId: string,
  mode: OperationalAddressMode = 'throw'
): Promise<OperationalAddressReadiness> {
  const existing = await getOperationalAddressForActor(tenantId, actorId);
  if (existing) {
    return { hasOperational: true, actorId };
  }
  const message =
    `actor ${actorId} sem address_assignments(owner_type='service_provider', ` +
    `role='OPERATIONAL') ativo. Cadastre endereço operacional da unidade antes ` +
    `de qualquer transação econômica com regional_fund dinâmico ` +
    `(DECISION-0049 + DECISION-0050).`;
  if (mode === 'throw') {
    const err = new Error(`${PJ_OPERATIONAL_ADDRESS_REQUIRED}: ${message}`);
    (err as any).code = PJ_OPERATIONAL_ADDRESS_REQUIRED;
    throw err;
  }
  return { hasOperational: false, actorId, message };
}

export interface CreateOperationalAddressInput {
  address: CreateAddressInput;
}

/**
 * Cria address + assignment OPERATIONAL para um actor.
 *
 * Tenant-safety:
 *   - Confirma actor existe E pertence ao tenant (SELECT actors WHERE
 *     tenant_id = $1 AND id = $2). Falha se cross-tenant.
 *
 * Idempotência:
 *   - Falha com OPERATIONAL_ADDRESS_ALREADY_EXISTS se actor já tem
 *     assignment OPERATIONAL primário ativo. Trocar endereço é frente
 *     própria (encerrar valid_until_at do anterior + criar novo) —
 *     padrão não definido nesta fatia, então NÃO inventar.
 *
 * Atomicidade:
 *   - createAddress + assignAddress NÃO compartilham transação SQL
 *     hoje (são chamadas separadas no repository). Se assignAddress
 *     falhar APÓS createAddress, o address fica órfão. Risco baixo
 *     (constraints simples) mas registrado em DT-PE5-CARTORIO-ATOMICITY.
 */
async function createOperationalAddressForActor(
  tenantId: string,
  actorId: string,
  input: CreateOperationalAddressInput
): Promise<OperationalAssignmentWithAddress> {
  // 1. Valida actor + tenant
  // 🔴 F-RLS-TENANT-CONTEXT: actors tem RLS+FORCE — tenant-context obrigatório.
  const actorRow = await runQueryWithTenant<{ id: string; tenant_id: string; company_id: string | null }>(
    tenantId,
    `SELECT id::text, tenant_id::text, company_id::text
       FROM actors
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      LIMIT 1`,
    [tenantId, actorId]
  );
  if (!actorRow) {
    const err = new Error(
      `${ACTOR_NOT_FOUND_OR_CROSS_TENANT}: actor ${actorId} não encontrado no tenant ${tenantId}`
    );
    (err as any).code = ACTOR_NOT_FOUND_OR_CROSS_TENANT;
    throw err;
  }

  // 2. Idempotência: actor já tem OPERATIONAL ativo?
  const existing = await getOperationalAddressForActor(tenantId, actorId);
  if (existing) {
    const err = new Error(
      `${OPERATIONAL_ADDRESS_ALREADY_EXISTS}: actor ${actorId} já tem OPERATIONAL ` +
        `primário ativo (assignment_id=${existing.assignment.id}). Substituição de ` +
        `endereço operacional NÃO é suportada nesta fatia (PE-5-CARTÓRIO MVP).`
    );
    (err as any).code = OPERATIONAL_ADDRESS_ALREADY_EXISTS;
    throw err;
  }

  // 3-4. Cria address + assignment EM UMA TRANSAÇÃO SQL ATÔMICA.
  //      Se assignment falhar (FK/CHECK/UNIQUE), address é ROLLBACK.
  //      Fecha DT-PE5-CARTORIO-ATOMICITY (PE-5-CARTÓRIO-HARDENING).
  const { address, assignment } = await locationRepository.createAddressAndAssign(
    input.address,
    tenantId,
    {
      ownerType: 'service_provider',
      ownerId: actorId,
      role: 'OPERATIONAL',
      isPrimary: true,
    }
  );

  return { assignment, address };
}

export const operationalAddressHelper = {
  getOperationalAddressForActor,
  assertActorHasOperationalAddress,
  createOperationalAddressForActor,
};
