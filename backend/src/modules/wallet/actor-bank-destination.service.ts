// backend/src/modules/wallet/actor-bank-destination.service.ts
//
// F4.0 — actor_bank_destinations service (DECISION-0060, 2026-05-28).
//
// CRUD canônico do catálogo de destinos externos DECLARADOS do actor.
//
// ESCOPO ESTRITO:
//   - Cadastro + lifecycle + verificação de titularidade.
//   - Zero PSP, zero PIX/TED real, zero callback, zero worker.
//   - Zero movimentação em bank_ledger/bank_transactions/bank_splits.
//   - Não toca actor_wallet_payout_requests.
//
// CONTA PRÓPRIA (DECISION-0060 D8) — defesa em profundidade:
//   - Camada A (este service): resolve identities.tax_id, normaliza, fail-closed.
//   - Camada B (DB TRIGGER): trg_abd_enforce_own_account valida o mesmo.
//
// KYC (DECISION-0060 D12):
//   - Cadastro NÃO bloqueia por kyc_status='pending' (somente uso real exige strict).
//   - kyc_status NULL (identity ausente) bloqueia — sem identity não há tax_id.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { normalizeTaxId, validateCPF, validateCNPJ } from '@core/kyc/kyc.validators';
import {
  toActorBankDestination,
  type ActorBankDestination,
  type ActorBankDestinationRow,
  type ActorBankDestinationType,
  type ActorBankDestinationPixKeyType,
  type ActorBankDestinationAccountType,
  type ActorBankDestinationHolderDocType,
  type ActorBankDestinationOwnershipMethod,
} from './actor-bank-destination.types';

// ── Error class ───────────────────────────────────────────────────────────────

export class ActorBankDestinationError extends Error {
  constructor(
    public readonly code:
      | 'ACTOR_BANK_DEST_ACTOR_NOT_FOUND'
      | 'ACTOR_BANK_DEST_IDENTITY_MISSING'
      | 'ACTOR_BANK_DEST_TAX_ID_MISSING'
      | 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_MISMATCH'
      | 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID'
      | 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_TYPE_MISMATCH'
      | 'ACTOR_BANK_DEST_DESTINATION_INCOMPLETE'
      | 'ACTOR_BANK_DEST_PIX_KEY_INVALID'
      | 'ACTOR_BANK_DEST_NOT_FOUND'
      | 'ACTOR_BANK_DEST_INVALID_TRANSITION'
      | 'ACTOR_BANK_DEST_INPUT_INVALID',
    message: string
  ) {
    super(message);
    this.name = 'ActorBankDestinationError';
  }
}

// ── Inputs ───────────────────────────────────────────────────────────────────

interface CreateBaseInput {
  tenantId: string;
  actorId: string;
  holderName: string;
  holderDocument: string;
  holderDocumentType: ActorBankDestinationHolderDocType;
  metadata?: Record<string, unknown>;
}

export interface CreatePixDestinationInput extends CreateBaseInput {
  destinationType: 'pix_key';
  pixKeyType: ActorBankDestinationPixKeyType;
  pixKeyValue: string; // será normalizada conforme tipo
}

export interface CreateBankAccountDestinationInput extends CreateBaseInput {
  destinationType: 'bank_account';
  bankCode: string;
  bankName?: string | null;
  agencyNumber: string;
  accountNumber: string;
  accountDigit?: string | null;
  accountType: ActorBankDestinationAccountType;
}

export type CreateDestinationInput =
  | CreatePixDestinationInput
  | CreateBankAccountDestinationInput;

// ── Helpers internos ─────────────────────────────────────────────────────────

interface ActorIdentityRow {
  global_user_id: string | null;
  tax_id: string | null;
  tax_id_type: string | null;
}

async function resolveActorIdentity(
  tenantId: string,
  actorId: string
): Promise<{ taxId: string; taxIdNormalized: string; taxIdType: 'cpf' | 'cnpj' }> {
  // 🔴 F-RLS-TENANT-CONTEXT: actors tem RLS+FORCE — tenant-context obrigatório.
  const row = await runQueryWithTenant<ActorIdentityRow>(
    tenantId,
    `SELECT a.global_user_id, i.tax_id, i.tax_id_type
       FROM actors a
       LEFT JOIN identities i ON i.global_user_id = a.global_user_id
      WHERE a.tenant_id = $1 AND a.id = $2
      LIMIT 1`,
    [tenantId, actorId]
  );
  if (!row) {
    throw new ActorBankDestinationError(
      'ACTOR_BANK_DEST_ACTOR_NOT_FOUND',
      `actor ${actorId} não encontrado no tenant ${tenantId}`
    );
  }
  if (!row.global_user_id) {
    throw new ActorBankDestinationError(
      'ACTOR_BANK_DEST_IDENTITY_MISSING',
      `actor ${actorId} sem identity vinculada (global_user_id NULL) — DECISION-0060 D8 exige identity`
    );
  }
  if (!row.tax_id) {
    throw new ActorBankDestinationError(
      'ACTOR_BANK_DEST_TAX_ID_MISSING',
      `identity ${row.global_user_id} sem tax_id — verificação de "conta própria" impossível`
    );
  }
  const norm = normalizeTaxId(row.tax_id);
  if (norm.length !== 11 && norm.length !== 14) {
    throw new ActorBankDestinationError(
      'ACTOR_BANK_DEST_TAX_ID_MISSING',
      `identities.tax_id formato inválido: ${row.tax_id}`
    );
  }
  const inferredType: 'cpf' | 'cnpj' = norm.length === 11 ? 'cpf' : 'cnpj';
  const declaredType = (row.tax_id_type ?? inferredType) as 'cpf' | 'cnpj';
  return {
    taxId: row.tax_id,
    taxIdNormalized: norm,
    taxIdType: declaredType,
  };
}

function normalizePixKeyForStorage(
  pixKeyType: ActorBankDestinationPixKeyType,
  raw: string
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    throw new ActorBankDestinationError(
      'ACTOR_BANK_DEST_PIX_KEY_INVALID',
      'pixKeyValue vazio'
    );
  }
  switch (pixKeyType) {
    case 'cpf':
    case 'cnpj':
      return normalizeTaxId(trimmed);
    case 'phone':
      // remove tudo que não é dígito
      return trimmed.replace(/\D/g, '');
    case 'email':
      return trimmed.toLowerCase();
    case 'random':
      // UUID-like (não tocar formato; só validar não-vazio)
      return trimmed;
    default:
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_PIX_KEY_INVALID',
        `pixKeyType desconhecido: ${pixKeyType}`
      );
  }
}

function validateHolderDocument(
  document: string,
  type: ActorBankDestinationHolderDocType
): string {
  const normalized = normalizeTaxId(document);
  if (type === 'cpf') {
    const v = validateCPF(normalized);
    if (!v.valid) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID',
        `holder_document CPF inválido: ${v.errors.join(', ')}`
      );
    }
    if (normalized.length !== 11) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID',
        'CPF deve ter 11 dígitos'
      );
    }
  } else if (type === 'cnpj') {
    const v = validateCNPJ(normalized);
    if (!v.valid) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID',
        `holder_document CNPJ inválido: ${v.errors.join(', ')}`
      );
    }
    if (normalized.length !== 14) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID',
        'CNPJ deve ter 14 dígitos'
      );
    }
  }
  return normalized;
}

/**
 * Determina se podemos auto-verificar via tax_id match.
 * Aplica APENAS quando:
 *   - destination_type='pix_key' AND pix_key_type IN ('cpf','cnpj')
 *   - pix_key_value_normalized === identities.tax_id (já garantido por holder match,
 *     mas exige que a CHAVE seja a mesma string normalizada)
 */
function canAutoVerifyByTaxIdMatch(
  destinationType: ActorBankDestinationType,
  pixKeyType: ActorBankDestinationPixKeyType | null,
  pixKeyValueNormalized: string | null,
  taxIdNormalized: string
): boolean {
  if (destinationType !== 'pix_key') return false;
  if (pixKeyType !== 'cpf' && pixKeyType !== 'cnpj') return false;
  if (!pixKeyValueNormalized) return false;
  return pixKeyValueNormalized === taxIdNormalized;
}

// ── Service ──────────────────────────────────────────────────────────────────

class ActorBankDestinationService {
  /**
   * Cria destino bancário declarado do actor.
   *
   * Camada A (DECISION-0060 D8): resolve identity, normaliza, valida documento,
   * checa "conta própria" no service. Se holder_document_type não bate com
   * identities.tax_id_type, falha aqui.
   *
   * Camada B (DB TRIGGER): trg_abd_enforce_own_account valida o mesmo predicado.
   * Em caso de inconsistência entre camadas, TRIGGER vence.
   *
   * KYC (DECISION-0060 D12): cadastro NÃO bloqueia por kyc_status='pending'.
   * Somente F4.1+ (uso real) exigirá strict approved.
   */
  async createDestination(input: CreateDestinationInput): Promise<ActorBankDestination> {
    // 1. Resolver identity do actor (SSOT: identities.tax_id)
    const identity = await resolveActorIdentity(input.tenantId, input.actorId);

    // 2. Validar holder_document e tipo
    const holderNormalized = validateHolderDocument(input.holderDocument, input.holderDocumentType);

    // 3. Verificar coerência holder_document_type vs identities.tax_id_type
    if (input.holderDocumentType !== identity.taxIdType) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_TYPE_MISMATCH',
        `holder_document_type='${input.holderDocumentType}' não corresponde a identities.tax_id_type='${identity.taxIdType}'`
      );
    }

    // 4. Conta própria (DECISION-0060 D8 camada A) — comparação normalizada
    if (holderNormalized !== identity.taxIdNormalized) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_HOLDER_DOCUMENT_MISMATCH',
        `holder_document (${holderNormalized}) não corresponde a identities.tax_id do actor (${identity.taxIdNormalized}) — conta própria obrigatória`
      );
    }

    // 5. Validações estruturais e normalização específica do tipo
    let pixKeyType: ActorBankDestinationPixKeyType | null = null;
    let pixKeyValueNormalized: string | null = null;
    let bankCode: string | null = null;
    let bankName: string | null = null;
    let agencyNumber: string | null = null;
    let accountNumber: string | null = null;
    let accountDigit: string | null = null;
    let accountType: ActorBankDestinationAccountType | null = null;

    if (input.destinationType === 'pix_key') {
      pixKeyType = input.pixKeyType;
      pixKeyValueNormalized = normalizePixKeyForStorage(input.pixKeyType, input.pixKeyValue);
      if (!pixKeyValueNormalized) {
        throw new ActorBankDestinationError(
          'ACTOR_BANK_DEST_PIX_KEY_INVALID',
          'pix_key_value vazio após normalização'
        );
      }
    } else if (input.destinationType === 'bank_account') {
      const bc = input.bankCode?.trim();
      const ag = input.agencyNumber?.trim();
      const ac = input.accountNumber?.trim();
      const at = input.accountType;
      if (!bc || !ag || !ac || !at) {
        throw new ActorBankDestinationError(
          'ACTOR_BANK_DEST_DESTINATION_INCOMPLETE',
          'bank_account exige bank_code + agency_number + account_number + account_type'
        );
      }
      bankCode = bc;
      bankName = input.bankName?.trim() || null;
      agencyNumber = ag;
      accountNumber = ac;
      accountDigit = input.accountDigit?.trim() || null;
      accountType = at;
    } else {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_INPUT_INVALID',
        `destinationType inválido`
      );
    }

    // 6. Determinar status inicial + método de verificação
    let initialStatus: 'pending_verification' | 'verified' = 'pending_verification';
    let verificationMethod: ActorBankDestinationOwnershipMethod | null = null;
    let verifiedAt: string | null = null;

    if (
      canAutoVerifyByTaxIdMatch(
        input.destinationType,
        pixKeyType,
        pixKeyValueNormalized,
        identity.taxIdNormalized
      )
    ) {
      initialStatus = 'verified';
      verificationMethod = 'auto_tax_id_match';
      verifiedAt = new Date().toISOString();
    }

    // 7. INSERT (TRIGGER de "conta própria" é camada B; valida novamente no DB)
    // DT-RAW-POOL-RLS-ACCESS-INHERITS-STALE-GUC (achado N4, corrigido D_FIX Onda 2, 2026-07-05):
    // pool.query cru sem tenant-context — corrigido pra runQueryWithTenant em todo o arquivo.
    const row = await runQueryWithTenant<ActorBankDestinationRow>(
      input.tenantId,
      `INSERT INTO actor_bank_destinations
         (tenant_id, actor_id, destination_type,
          pix_key_type, pix_key_value_normalized,
          bank_code, bank_name, agency_number, account_number, account_digit, account_type,
          holder_name, holder_document, holder_document_type,
          status, ownership_verification_method, ownership_verified_at,
          metadata)
       VALUES ($1, $2, $3,
               $4, $5,
               $6, $7, $8, $9, $10, $11,
               $12, $13, $14,
               $15, $16, $17,
               $18::jsonb)
       RETURNING *`,
      [
        input.tenantId,
        input.actorId,
        input.destinationType,
        pixKeyType,
        pixKeyValueNormalized,
        bankCode,
        bankName,
        agencyNumber,
        accountNumber,
        accountDigit,
        accountType,
        input.holderName.trim(),
        holderNormalized,
        input.holderDocumentType,
        initialStatus,
        verificationMethod,
        verifiedAt,
        JSON.stringify(input.metadata ?? {}),
      ]
    );

    return toActorBankDestination(row!);
  }

  /** Lista destinos do actor (ordenado por created_at DESC). */
  async listByActor(
    tenantId: string,
    actorId: string,
    options: { includeArchived?: boolean } = {}
  ): Promise<ActorBankDestination[]> {
    const includeArchived = options.includeArchived ?? false;
    const rows = await runQueriesWithTenant<ActorBankDestinationRow>(
      tenantId,
      `SELECT id, tenant_id, actor_id, destination_type,
              pix_key_type, pix_key_value_normalized,
              bank_code, bank_name, agency_number, account_number, account_digit, account_type,
              holder_name, holder_document, holder_document_type,
              status, rejected_reason, archived_at,
              ownership_verification_method, ownership_verified_at,
              metadata, created_at, updated_at
         FROM actor_bank_destinations
        WHERE tenant_id = $1 AND actor_id = $2
          ${includeArchived ? '' : `AND status != 'archived'`}
        ORDER BY created_at DESC`,
      [tenantId, actorId]
    );
    return rows.map(toActorBankDestination);
  }

  async getById(tenantId: string, id: string): Promise<ActorBankDestination | null> {
    const row = await runQueryWithTenant<ActorBankDestinationRow>(
      tenantId,
      `SELECT id, tenant_id, actor_id, destination_type,
              pix_key_type, pix_key_value_normalized,
              bank_code, bank_name, agency_number, account_number, account_digit, account_type,
              holder_name, holder_document, holder_document_type,
              status, rejected_reason, archived_at,
              ownership_verification_method, ownership_verified_at,
              metadata, created_at, updated_at
         FROM actor_bank_destinations
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, id]
    );
    return row ? toActorBankDestination(row) : null;
  }

  /**
   * Marca destino como verified via manual_review.
   * Para auto_tax_id_match, use createDestination (auto-verify acontece no create).
   */
  async markVerified(
    tenantId: string,
    id: string,
    method: 'manual_review' = 'manual_review'
  ): Promise<ActorBankDestination> {
    const row = await runQueryWithTenant<ActorBankDestinationRow>(
      tenantId,
      `UPDATE actor_bank_destinations
          SET status = 'verified',
              ownership_verification_method = $1,
              ownership_verified_at = NOW()
        WHERE tenant_id = $2 AND id = $3
        RETURNING *`,
      [method, tenantId, id]
    );
    if (!row) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_NOT_FOUND',
        `actor_bank_destination ${id} não encontrado para tenant ${tenantId}`
      );
    }
    return toActorBankDestination(row);
  }

  async markRejected(
    tenantId: string,
    id: string,
    reason: string
  ): Promise<ActorBankDestination> {
    const trimmedReason = reason?.trim() ?? '';
    if (!trimmedReason) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_INPUT_INVALID',
        'rejected_reason obrigatório (não vazio)'
      );
    }
    const row = await runQueryWithTenant<ActorBankDestinationRow>(
      tenantId,
      `UPDATE actor_bank_destinations
          SET status = 'rejected',
              rejected_reason = $1
        WHERE tenant_id = $2 AND id = $3
        RETURNING *`,
      [trimmedReason, tenantId, id]
    );
    if (!row) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_NOT_FOUND',
        `actor_bank_destination ${id} não encontrado para tenant ${tenantId}`
      );
    }
    return toActorBankDestination(row);
  }

  async archive(tenantId: string, id: string): Promise<ActorBankDestination> {
    const row = await runQueryWithTenant<ActorBankDestinationRow>(
      tenantId,
      `UPDATE actor_bank_destinations
          SET status = 'archived',
              archived_at = NOW()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [tenantId, id]
    );
    if (!row) {
      throw new ActorBankDestinationError(
        'ACTOR_BANK_DEST_NOT_FOUND',
        `actor_bank_destination ${id} não encontrado para tenant ${tenantId}`
      );
    }
    return toActorBankDestination(row);
  }
}

export const actorBankDestinationService = new ActorBankDestinationService();
